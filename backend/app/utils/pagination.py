"""Pagination helpers."""
from math import ceil


def paginate(total: int, page: int, page_size: int) -> tuple[int, int, int]:
    """Return (offset, limit, total_pages)."""
    total_pages = max(1, ceil(total / page_size)) if total else 1
    page = max(1, min(page, total_pages))
    offset = (page - 1) * page_size
    limit = page_size
    return offset, limit, total_pages
