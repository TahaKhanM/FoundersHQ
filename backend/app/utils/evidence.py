"""Evidence ID collection and validation (txn ids, invoice ids)."""
import re
from typing import Any


def extract_evidence_ids_from_payload(payload: dict[str, Any]) -> set[str]:
    """Collect all known evidence IDs from a facts payload (transaction ids, invoice ids)."""
    ids: set[str] = set()
    uuid_re = re.compile(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    )

    def collect(obj: Any) -> None:
        if isinstance(obj, str) and uuid_re.fullmatch(obj):
            ids.add(obj)
        elif isinstance(obj, list):
            for x in obj:
                collect(x)
        elif isinstance(obj, dict):
            for k, v in obj.items():
                if k in ("id", "txn_id", "invoice_id", "transaction_id", "evidence_ids"):
                    if isinstance(v, str):
                        ids.add(v)
                    elif isinstance(v, list):
                        for i in v:
                            if isinstance(i, str):
                                ids.add(i)
                collect(v)

    collect(payload)
    return ids


def validate_citations(citations: list[str], allowed_ids: set[str]) -> list[str]:
    """Return only citations that are in allowed_ids."""
    return [c for c in citations if c in allowed_ids]
