"""Parse CSV and yield invoice rows."""
import csv
import io
from typing import Any, Iterator


def parse_invoices_csv(content: bytes | str) -> Iterator[dict[str, Any]]:
    for row in csv.DictReader(io.StringIO(content.decode("utf-8") if isinstance(content, bytes) else content)):
        yield {
            "invoice_number": row.get("invoice_number"),
            "customer_name": row.get("customer_name"),
            "issue_date": row.get("issue_date"),
            "due_date": row.get("due_date"),
            "amount": row.get("amount"),
            "currency": row.get("currency", "USD"),
            "status": row.get("status", "open"),
        }
