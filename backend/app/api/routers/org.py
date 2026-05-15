"""Org router: org info, data delete, members, invitations."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import and_, delete, select

from app.api.schemas import (
    InvitationCreate,
    InvitationDTO,
    MembershipDTO,
    MembershipPatch,
    OrgDataDeleteRequest,
    OrgDTO,
)
from app.config import get_settings
from app.deps import CurrentOrg, CurrentUser, DbSession, requires_role
from app.models import commitment, invoice, runway, transaction
from app.models.audit import AuditLog
from app.models.base import gen_uuid
from app.models.funding import UserSavedOpportunity
from app.models.invitation import Invitation
from app.models.llm import LLMExplanation
from app.models.org import Membership
from app.models.user import User
from app.services.auth.tokens import generate_token
from app.services.events import publish_event_best_effort as publish_event
from app.utils.audit import record_audit

router = APIRouter()
log = logging.getLogger(__name__)


def _safe_publish(org_id: str, event_type: str, payload: dict) -> None:
    try:
        publish_event(org_id, event_type, payload)
    except Exception:  # noqa: BLE001
        log.exception("publish_event failed for %s", event_type)


@router.get("", response_model=OrgDTO)
async def get_org(org: CurrentOrg):
    return OrgDTO.model_validate(org)


@router.delete("/data", status_code=204)
async def delete_org_data(
    body: OrgDataDeleteRequest,
    org: CurrentOrg,
    session: DbSession,
):
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Set confirm=true to delete org data")
    await session.execute(delete(UserSavedOpportunity).where(UserSavedOpportunity.org_id == org.id))
    await session.execute(delete(LLMExplanation).where(LLMExplanation.org_id == org.id))
    await session.execute(delete(AuditLog).where(AuditLog.org_id == org.id))
    await session.execute(delete(runway.Milestone).where(runway.Milestone.org_id == org.id))
    await session.execute(delete(runway.Scenario).where(runway.Scenario.org_id == org.id))
    await session.execute(delete(runway.ForecastRow).where(runway.ForecastRow.org_id == org.id))
    await session.execute(delete(runway.RunwayForecast).where(runway.RunwayForecast.org_id == org.id))
    for t in [invoice.InvoiceRiskScore, invoice.InvoicePrediction, invoice.InvoiceEvent, invoice.InvoiceParsingJob, invoice.Invoice, invoice.Customer]:
        await session.execute(delete(t).where(t.org_id == org.id))
    await session.execute(delete(commitment.CommitmentInstance).where(commitment.CommitmentInstance.org_id == org.id))
    await session.execute(delete(commitment.Commitment).where(commitment.Commitment.org_id == org.id))
    await session.execute(delete(transaction.CategorizationRule).where(transaction.CategorizationRule.org_id == org.id))
    await session.execute(delete(transaction.Transaction).where(transaction.Transaction.org_id == org.id))
    await session.execute(delete(transaction.TransactionCategory).where(transaction.TransactionCategory.org_id == org.id))
    await session.execute(delete(transaction.BankAccount).where(transaction.BankAccount.org_id == org.id))
    return None


# ---- Phase 1.A: invitations (admin/owner only) ----

@router.post("/invitations", response_model=InvitationDTO)
async def create_invitation(
    body: InvitationCreate,
    org: CurrentOrg,
    user: CurrentUser,
    session: DbSession,
    _membership: Membership = requires_role("owner", "admin"),
):
    raw, token_hash = generate_token()
    inv = Invitation(
        id=gen_uuid(),
        org_id=org.id,
        email=body.email.lower(),
        role=body.role,
        token_hash=token_hash,
        created_by_user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    session.add(inv)
    await session.flush()

    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="invitation.created",
        entity_type="invitation",
        entity_id=inv.id,
        details={"email": body.email, "role": body.role},
    )
    _safe_publish(org.id, "invitation.created", {"invitation_id": inv.id, "email": body.email})

    settings = get_settings()
    dto = InvitationDTO.model_validate(inv)
    if settings.env != "prod":
        dto = dto.model_copy(update={"dev_token": raw})
    return dto


@router.get("/invitations", response_model=list[InvitationDTO])
async def list_invitations(
    org: CurrentOrg,
    session: DbSession,
    _membership: Membership = requires_role("owner", "admin"),
):
    rows = (await session.execute(
        select(Invitation)
        .where(Invitation.org_id == org.id)
        .where(Invitation.accepted_at.is_(None))
        .where(Invitation.revoked_at.is_(None))
        .order_by(Invitation.created_at.desc())
    )).scalars().all()
    return [InvitationDTO.model_validate(r) for r in rows]


@router.delete("/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(
    invitation_id: str,
    org: CurrentOrg,
    user: CurrentUser,
    session: DbSession,
    _membership: Membership = requires_role("owner", "admin"),
):
    inv = (await session.execute(
        select(Invitation).where(and_(Invitation.id == invitation_id, Invitation.org_id == org.id))
    )).scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})
    if inv.revoked_at is None:
        inv.revoked_at = datetime.now(timezone.utc)
        await session.flush()

    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="invitation.revoked",
        entity_type="invitation",
        entity_id=inv.id,
    )
    _safe_publish(org.id, "invitation.revoked", {"invitation_id": inv.id})
    return None


# ---- Phase 1.A: members ----

@router.get("/members", response_model=list[MembershipDTO])
async def list_members(
    org: CurrentOrg,
    session: DbSession,
    _user: CurrentUser,
):
    rows = (await session.execute(
        select(Membership, User)
        .join(User, User.id == Membership.user_id)
        .where(Membership.org_id == org.id)
        .order_by(Membership.created_at.asc())
    )).all()
    return [
        MembershipDTO(
            id=m.id,
            org_id=m.org_id,
            user_id=m.user_id,
            email=u.email,
            role=m.role,
            created_at=m.created_at,
        )
        for (m, u) in rows
    ]


@router.patch("/members/{membership_id}", response_model=MembershipDTO)
async def patch_member_role(
    membership_id: str,
    body: MembershipPatch,
    org: CurrentOrg,
    user: CurrentUser,
    session: DbSession,
    _membership: Membership = requires_role("owner", "admin"),
):
    target = (await session.execute(
        select(Membership).where(and_(Membership.id == membership_id, Membership.org_id == org.id))
    )).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})

    # last-owner invariant: cannot demote the last owner.
    if target.role == "owner" and body.role != "owner":
        owners = (await session.execute(
            select(Membership).where(Membership.org_id == org.id).where(Membership.role == "owner")
        )).scalars().all()
        if len(owners) <= 1:
            raise HTTPException(
                status_code=400,
                detail={"code": "last_owner", "message": "Cannot demote the last owner"},
            )

    old_role = target.role
    target.role = body.role
    await session.flush()

    # Load the user for response email
    u = (await session.execute(select(User).where(User.id == target.user_id))).scalar_one()

    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="membership.role_changed",
        entity_type="membership",
        entity_id=target.id,
        details={"from": old_role, "to": body.role},
    )
    _safe_publish(org.id, "membership.role_changed", {"membership_id": target.id, "from": old_role, "to": body.role})

    return MembershipDTO(
        id=target.id, org_id=target.org_id, user_id=target.user_id,
        email=u.email, role=target.role, created_at=target.created_at,
    )


@router.delete("/members/{membership_id}", status_code=204)
async def remove_member(
    membership_id: str,
    org: CurrentOrg,
    user: CurrentUser,
    session: DbSession,
    _membership: Membership = requires_role("owner", "admin"),
):
    target = (await session.execute(
        select(Membership).where(and_(Membership.id == membership_id, Membership.org_id == org.id))
    )).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail={"code": "not_found"})

    if target.role == "owner":
        owners = (await session.execute(
            select(Membership).where(Membership.org_id == org.id).where(Membership.role == "owner")
        )).scalars().all()
        if len(owners) <= 1:
            raise HTTPException(
                status_code=400,
                detail={"code": "last_owner", "message": "Cannot remove the last owner"},
            )

    await session.delete(target)
    await session.flush()

    await record_audit(
        session,
        org_id=org.id,
        user_id=user.id,
        action="membership.removed",
        entity_type="membership",
        entity_id=membership_id,
    )
    _safe_publish(org.id, "membership.removed", {"membership_id": membership_id})
    return None
