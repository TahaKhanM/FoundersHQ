"""Customers router: list, detail."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from app.api.schemas import CustomerDTO, CustomerDetailDTO, InvoiceDTO, PaginatedResponse
from app.deps import CurrentOrg, DbSession
from app.models import invoice as inv_models
from app.utils.pagination import paginate

router = APIRouter()


@router.get("", response_model=PaginatedResponse[CustomerDTO])
async def list_customers(
    org: CurrentOrg,
    session: DbSession,
    page: int = 1,
    page_size: int = 20,
):
    q = select(inv_models.Customer).where(inv_models.Customer.org_id == org.id)
    count_q = select(func.count()).select_from(inv_models.Customer).where(inv_models.Customer.org_id == org.id)
    total = (await session.execute(count_q)).scalar() or 0
    offset, limit, _ = paginate(total, page, page_size)
    result = await session.execute(q.offset(offset).limit(limit))
    items = [CustomerDTO.model_validate(r) for r in result.scalars().all()]
    return PaginatedResponse(items=items, page=page, page_size=page_size, total=total)


@router.get("/{customer_id}", response_model=CustomerDetailDTO)
async def get_customer(customer_id: str, org: CurrentOrg, session: DbSession):
    result = await session.execute(
        select(inv_models.Customer).where(
            inv_models.Customer.id == customer_id,
            inv_models.Customer.org_id == org.id,
        )
    )
    cust = result.scalar_one_or_none()
    if not cust:
        raise HTTPException(404, "Customer not found")
    inv_result = await session.execute(
        select(inv_models.Invoice).where(
            inv_models.Invoice.customer_id == customer_id,
            inv_models.Invoice.org_id == org.id,
        )
    )
    invoices = [InvoiceDTO.model_validate(r) for r in inv_result.scalars().all()]
    return CustomerDetailDTO(**CustomerDTO.model_validate(cust).model_dump(), invoices=invoices)
