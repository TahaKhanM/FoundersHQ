"""FX services — historical rate lookup, conversion, ingest.

Multi-currency design (phase 2.C):

- Rates live in the ``fx_rates`` table. The application never invents them;
  rows are deterministic snapshots fed via the ``/fx/rates`` admin endpoint.
- :func:`get_rate` looks up a rate on a given date with fallback to the
  most recent known rate on or before that date.
- :func:`convert_amount` is the high-level helper used at ingest time.
- :func:`upsert_rates` is the idempotent bulk loader.

Convention: a rate row ``(source=S, target=T, rate=r, date=d)`` means
"on day ``d``, one unit of ``S`` was worth ``r`` units of ``T``". So
``convert_amount(100, source='EUR', target='USD', on_date=d) == 100 * r``.
"""
from __future__ import annotations

from app.services.fx.conversion import convert_amount
from app.services.fx.ingest import upsert_rates
from app.services.fx.rates import FxRateMissing, get_rate

__all__ = [
    "FxRateMissing",
    "convert_amount",
    "get_rate",
    "upsert_rates",
]
