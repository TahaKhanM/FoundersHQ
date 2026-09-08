"""Test forecasting with persisted evidence and explicitly missing inputs."""
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from app.models.financial_profile import FinancialProfile
from app.models.org import Org
from app.models.transaction import Transaction
from app.services.runway.history import historical_weekly_flows
from app.services.runway.scenarios import apply_scenario_params
from app.utils.dates import week_start


def test_history_excludes_partial_current_week_and_future_and_counts_empty_weeks():
    today = date(2026, 9, 8)
    assert historical_weekly_flows([
        (date(2026, 9, 1), Decimal("-800")),
        (date(2026, 8, 1), Decimal("400")),
        (date(2026, 9, 7), Decimal("-999999")),
        (date(2026, 10, 1), Decimal("999999")),
        (date(2025, 1, 1), Decimal("999999")),
    ], today) == (Decimal("50.0000"), Decimal("100.0000"))


def test_zero_scenario_multiplier_is_honored():
    day = date(2026, 9, 7)
    assert apply_scenario_params({day: Decimal(100)}, {day: Decimal(50)}, {
        "outflows_multiplier": 0, "inflows_multiplier": 0,
    }) == ({day: Decimal(0)}, {day: Decimal(0)})


@pytest.mark.parametrize("params", [
    {"outflows_multiplier": -1}, {"inflows_multiplier": "NaN"},
    {"outflows_multiplier": None}, {"unknown": 2}, {"inflows_multiplier": 11},
])
def test_invalid_scenario_is_rejected(params):
    with pytest.raises(ValueError):
        apply_scenario_params({}, {}, params)


def register(client):
    response = client.post("/auth/register", json={
        "email": f"forecast-{uuid4()}@example.com", "password": "password123",
    })
    assert response.status_code == 200
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    return headers, client.get("/org", headers=headers).json()["id"]


async def test_forecast_uses_cash_and_tenant_history_with_distinct_stress_case(client, async_session):
    headers, org_id = register(client)
    profile = FinancialProfile(id=str(uuid4()), org_id=org_id, cash_balance=Decimal("220"), currency="USD")
    txn = Transaction(id=str(uuid4()), org_id=org_id, txn_date=week_start(date.today()) - timedelta(days=1),
                      amount=Decimal("-800"), currency="USD", source="csv")
    other = Org(id=str(uuid4()), name="Other")
    async_session.add_all([profile, txn, other])
    async_session.add(Transaction(id=str(uuid4()), org_id=other.id, txn_date=txn.txn_date,
                                  amount=Decimal("900000"), currency="USD", source="csv"))
    await async_session.commit()
    response = client.post("/runway/forecast/compute", json={"horizon_weeks": 3}, headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert Decimal(body["forecast"]["cash_start"]) == 220
    assert Decimal(body["rows"][0]["outflows"]) == 100
    assert body["rows"][0]["evidence_ids"] == [profile.id, txn.id]
    assert body["forecast"]["crash_week_base"] == 2
    assert body["forecast"]["crash_week_pess"] == 1
    assert body["forecast"]["scenario_params"]["method"] == "historical_average_v1"
    fetched = client.get(f"/runway/forecast/{body['forecast']['id']}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["rows"] == body["rows"]
    # Raising receipts/lowering costs is an explicit scenario, including complete shutdown.
    zero = client.post("/runway/forecast/compute", json={
        "horizon_weeks": 3, "scenario_params": {"outflows_multiplier": 0},
    }, headers=headers)
    assert zero.status_code == 200
    assert zero.json()["forecast"]["crash_week_base"] is None


async def test_forecast_refuses_missing_cash_history_and_mixed_currencies(client, async_session):
    headers, org_id = register(client)
    endpoint = "/runway/forecast/compute"
    assert client.post(endpoint, headers=headers, json={}).status_code == 422
    async_session.add(FinancialProfile(id=str(uuid4()), org_id=org_id, cash_balance=Decimal("1000"), currency="USD"))
    await async_session.commit()
    assert client.post(endpoint, headers=headers, json={}).status_code == 422
    async_session.add(Transaction(id=str(uuid4()), org_id=org_id,
                                  txn_date=week_start(date.today()) - timedelta(days=1),
                                  amount=Decimal("-800"), currency="GBP", source="csv"))
    await async_session.commit()
    response = client.post(endpoint, headers=headers, json={})
    assert response.status_code == 422
    assert "mixed currencies" in response.text
    assert client.get("/spending/metrics", headers=headers).status_code == 422
    assert client.get("/dashboard/metrics", headers=headers).status_code == 422


async def test_spending_metrics_use_chronology_and_recorded_cash(client, async_session):
    headers, org_id = register(client)
    async_session.add(FinancialProfile(org_id=org_id, cash_balance=Decimal(1000), currency="USD"))
    async_session.add_all([
        Transaction(org_id=org_id, txn_date=week_start(date.today()) - timedelta(days=1),
                    amount=Decimal(-800), currency="USD", source="csv"),
        Transaction(org_id=org_id, txn_date=date.today(), amount=Decimal(-10),
                    currency="USD", source="csv"),
        Transaction(org_id=org_id, txn_date=date.today() + timedelta(days=1),
                    amount=Decimal(-90000), currency="USD", source="csv"),
    ])
    await async_session.commit()
    response = client.get("/spending/metrics", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert Decimal(body["total_outflow_90d"]) == 810
    assert body["cash_weeks"] > 0
    # Current partial week is ten, previous eight complete weeks average one hundred.
    assert body["spend_creep_pct"] == -0.9
    assert body["reconciliation"]["mismatch"] is False
