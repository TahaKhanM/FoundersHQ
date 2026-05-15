---
name: deterministic-finance
description: Use when adding or modifying any financial metric, forecast, or scoring function. Encodes the patterns that keep numbers reproducible, testable, and provably correct.
---

# Deterministic finance

A "metric" here means any number a user can see on the screen. Burn, runway, spend creep, health scores, vendor findings, decision-engine answers — all metrics. Every one of them must satisfy this skill.

## The pure-function contract

Every metric is a pure Python function with:
- **Typed inputs** drawn only from data in our DB plus explicit "now" parameters.
- **No I/O.** No sessions, no HTTP, no clocks, no environment reads.
- **Deterministic.** Given the same inputs, returns the same output, every time, on every machine.
- **`Decimal` for money,** `int` for counts, `date` for calendar boundaries.

```python
# good
def cash_weeks(cash_balance: Decimal, weekly_net_burn: Decimal) -> tuple[float | None, str | None]:
    ...

# bad — reads the clock
def cash_weeks(cash_balance: Decimal, weekly_net_burn: Decimal):
    today = date.today()
    ...

# bad — uses session inside the metric
def cash_weeks(session, org_id):
    txns = session.execute(...)
    ...
```

If you need "now", the caller passes it. Routers default the parameter to `date.today()`; tests pass a fixed date.

## Decimal discipline

- Import `Decimal` from `decimal`. Never use `float` for money.
- Use `app.utils.money.round_currency` for final rounding; do not round intermediate values.
- For percentages, use `Decimal` for the math then convert to `float` only at the API boundary. The frontend formats.

```python
ratio = (current_outflow - baseline) / baseline   # Decimal / Decimal -> Decimal
return float(ratio)                                # only at the edge
```

## Date and week handling

- Use `app.utils.dates.week_start(d)` to bucket by ISO week (Monday start).
- Use `app.utils.dates.iter_week_starts(start, n)` to iterate `n` consecutive weeks.
- Never assume month length; if you need a "month run-rate", multiply weekly figures by `30 / period_days`.
- Fiscal year aware metrics take `fiscal_year_start_month: int` as a parameter; the org config supplies it.

## Currency conversion (multi-currency)

When the org has a base currency and a transaction's currency differs:

1. The router fetches the historical FX rate from `fx_rates` table for the transaction's `txn_date`.
2. The router converts to base currency and writes `fx_rate_used` on the transaction at ingest time.
3. **Metrics operate on base-currency values only.** They do not call FX functions.

Why: historical reproducibility. The rate at ingest is the rate forever. Re-running the forecast next month gives the same numbers.

## Reconciliation tests

Every metric must have at least one **reconciliation test** that asserts the metric agrees with a simpler ground truth. Examples:

- Weekly outflow buckets sum to the period total (within `Decimal("0.01")` epsilon). See `reconcile_weekly_to_period` for the pattern.
- Total inflow + total outflow equals abs-sum of transactions (no rounding loss).
- Forecast crash week ≥ the week where ending_cash first crosses 0.
- Customer health score is monotonic in payment lateness (more late = lower).

If you can't write a reconciliation test, the metric is probably under-specified.

## Documenting evidence

Every service function that surfaces a number which a user could ask "why?" about must return:

```python
{
    "value": ...,
    "evidence_ids": ["uuid-1", "uuid-2", ...],
}
```

`evidence_ids` is the set of transaction or invoice UUIDs that drive the value. For aggregates, include the top-N contributors (the user clicks "show all" to fetch the rest). For point-in-time values (e.g. cash balance), include the most recent balance record or import job ID.

## Forecasting

- `app/services/runway/forecast.py` is the reference. Read it.
- Weekly buckets, not daily. We are not a real-time treasury system.
- Always return both `base_case` and `pessimistic` series, even if one is a copy of the other for now.
- Include `crash_week_base` and `crash_week_pess` as integer offsets from `start_date`.
- Always include `flags` per row (e.g. `["committed_outflow_due"]`) and per-row `evidence_ids`.

## Scoring (health, funding fit, etc.)

- Scores are integers in `[0, 100]`. Document the breakdown:

```python
def funding_fit_score(profile, opp) -> dict:
    """Return {'score': int, 'breakdown': [{'factor': str, 'weight': float, 'contribution': float, ...}]}"""
```

- The breakdown is shown in the UI. The LLM, if asked to explain, sees the breakdown in the facts payload and is forbidden from inventing new factors.

## Testing pattern

```python
# tests/test_<domain>.py
from decimal import Decimal
from datetime import date
from app.services.<domain>.<file> import the_metric

def test_metric_happy_path():
    out = the_metric(
        cash_balance=Decimal("100000"),
        weekly_net_burn=Decimal("10000"),
    )
    assert out == (10.0, None)

def test_metric_edge_zero_burn():
    out = the_metric(cash_balance=Decimal("100000"), weekly_net_burn=Decimal("0"))
    assert out == (None, "infinite")

def test_metric_reconciles():
    # Sum of weekly outflows equals total
    weekly = [(date(2024,1,1), Decimal("100")), (date(2024,1,8), Decimal("200"))]
    mismatch, total = reconcile_weekly_to_period(weekly, Decimal("300"))
    assert not mismatch
    assert total == Decimal("300")
```

Run a single test fast: `pytest tests/test_metrics.py::test_metric_happy_path -x`.

## Red flags

- "I'll just compute this on the frontend." → No. The frontend formats; it does not compute.
- "Let me cache this metric." → Don't cache metric outputs; cache the inputs (rows). Metrics are cheap.
- "Let me approximate with `float`." → No.
- "Let me call OpenAI to get the number." → Absolutely not.
