"""Parse CSV and yield transaction rows. No DB write here."""
import csv
import io
from typing import Any, Iterator


def parse_transactions_csv(content: bytes | str) -> Iterator[dict[str, Any]]:
    """Yield dicts with keys: txn_date, description, amount, currency, merchant_raw, etc."""
    text = content.decode("utf-8") if isinstance(content, bytes) else content
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        yield {
            "txn_date": row.get("date") or row.get("txn_date"),
            "description": row.get("description", ""),
            "amount": row.get("amount"),
            "currency": row.get("currency", "USD"),
            "merchant_raw": row.get("merchant") or row.get("merchant_raw"),
        }
