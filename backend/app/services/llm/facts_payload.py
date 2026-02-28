"""Build facts payload for LLM from metrics, transactions, invoices, forecast."""
from typing import Any
from decimal import Decimal


def serialize_for_facts(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return float(obj)
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: serialize_for_facts(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [serialize_for_facts(x) for x in obj]
    return obj


def build_facts_payload(
    metrics: dict[str, Any] | None = None,
    transactions: list[dict] | None = None,
    invoices: list[dict] | None = None,
    forecast_summary: dict[str, Any] | None = None,
    attribution: list[dict] | None = None,
) -> dict[str, Any]:
    payload = {}
    if metrics:
        payload["metrics"] = serialize_for_facts(metrics)
    if transactions:
        payload["transactions"] = serialize_for_facts(
            [{"id": t.get("id"), "amount": t.get("amount"), "date": t.get("txn_date"), "merchant": t.get("merchant_canonical")} for t in transactions]
        )
    if invoices:
        payload["invoices"] = serialize_for_facts(
            [{"id": i.get("id"), "amount": i.get("amount"), "due_date": i.get("due_date"), "status": i.get("status")} for i in invoices]
        )
    if forecast_summary:
        payload["forecast"] = serialize_for_facts(forecast_summary)
    if attribution:
        payload["attribution"] = serialize_for_facts(attribution)
    return payload
