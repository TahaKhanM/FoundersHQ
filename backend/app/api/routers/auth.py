"""Auth router: register, login, me, logout."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import RegisterRequest, LoginRequest, UserDTO, SessionDTO, RegisterResponse
from app.deps import get_async_session, get_current_user, CurrentUser
from app.models.user import User
from app.models.org import Org, Membership
from app.utils.hashing import hash_password, verify_password
from app.utils.security import create_access_token

router = APIRouter()


@router.post("/register", response_model=RegisterResponse)
async def register(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_async_session),
):
    from app.models.base import gen_uuid
    result = await session.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        id=gen_uuid(),
        email=body.email,
        password_hash=hash_password(body.password),
    )
    session.add(user)
    org = Org(id=gen_uuid(), name=f"{body.email}'s Org")
    session.add(org)
    session.add(Membership(id=gen_uuid(), user_id=user.id, org_id=org.id, role="owner"))
    await session.commit()
    await session.refresh(user)
    token = create_access_token(user.id)
    return RegisterResponse(
        user=UserDTO.model_validate(user),
        access_token=token,
    )


@router.post("/login", response_model=SessionDTO)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id)
    return SessionDTO(access_token=token, user=UserDTO.model_validate(user))


@router.get("/me", response_model=UserDTO)
async def me(current_user: CurrentUser):
    return UserDTO.model_validate(current_user)


@router.post("/logout", status_code=204)
async def logout():
    return None
