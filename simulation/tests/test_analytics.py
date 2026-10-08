import pytest
from fastapi.testclient import TestClient
from stackforge_shared.templates import build_configuration

import engine
from app.analytics import metrics
from app.config import Settings
from app.main import create_app
from engine.models import Decision, DecisionType
from tests.engine.helpers import play

SEED = 1234


@pytest.fixture(scope="module")
def config():
    return build_configuration("SAAS")


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    settings = Settings(app_env="test", forecast_model_dir=tmp_path_factory.mktemp("none"))
    return TestClient(create_app(settings, llm=None))


def dump(model) -> dict:
    return model.model_dump(mode="json", by_alias=True, exclude_none=True)


def test_derived_metrics(config) -> None:
    state = engine.run_turn(
        engine.create_initial_state(config, SEED),
        [Decision(type=DecisionType.marketing, value=5_000_000)],
        config,
        SEED,
        1,
    ).state_after
    assert metrics.burn_rate(state) == -state.profit > 0
    assert metrics.runway_months(state) == pytest.approx(state.cash / -state.profit, abs=0.01)
    assert metrics.cac(state) == round(5_000_000 / state.new_customers)
    margin = metrics.gross_margin(state)
    assert margin == pytest.approx((state.revenue - state.expenses.variable) / state.revenue)
    assert metrics.ltv(state) is None  # no churn yet in turn 1
    assert metrics.demand_index(config, 1, []) == pytest.approx(1.0)


def test_analytics_endpoint_summarises_a_run(client, config) -> None:
    records = play(config, 6, SEED, "growth")
    initial = engine.create_initial_state(config, SEED)
    body = {
        "initialState": dump(initial),
        "records": [dump(r) for r in records],
        "seed": SEED,
        "configuration": dump(config),
    }
    response = client.post("/analytics/simulation", json=body)
    assert response.status_code == 200
    data = response.json()
    assert data["currentTurn"] == 6
    assert [p["turn"] for p in data["series"]] == list(range(7))
    last, prior = records[-1].state_after, records[-2].state_after
    assert data["kpis"]["cash"] == {
        "value": last.cash,
        "previous": prior.cash,
        "change": last.cash - prior.cash,
    }
    assert len(data["segments"]) == 7 * 5
    assert len(data["competitors"]) == 7 * 4
    # Growth policy decides every turn: each gets a preview-vs-actual analysis.
    assert [d["turn"] for d in data["decisions"]] == [1, 2, 3, 4, 5, 6]
    for d in data["decisions"]:
        assert d["directionAgreement"] is None or 0 <= d["directionAgreement"] <= 1
    # No forecasts were stored in these engine-only records.
    assert data["forecasts"] == [] and data["forecastAccuracy"]["pairs"] == 0


def test_forecast_versus_actual(client, config) -> None:
    records = play(config, 3, SEED, "steady")
    f = {
        "available": True,
        "targetTurn": 2,
        "modelVersion": "m",
        "revenue": 1000,
        "customers": 10,
        "churnRate": 0.05,
    }
    body = {
        "initialState": dump(engine.create_initial_state(config, SEED)),
        "records": [dump(records[0]) | {"forecast": f}, dump(records[1]), dump(records[2])],
        "seed": SEED,
        "configuration": dump(config),
    }
    data = client.post("/analytics/simulation", json=body).json()
    [point] = data["forecasts"]
    actual = records[1].state_after
    assert point["actual"]["revenue"] == actual.revenue
    assert point["revenueErrorPercent"] == pytest.approx(
        abs(1000 - actual.revenue) / actual.revenue * 100, abs=0.01
    )
    assert data["forecastAccuracy"]["pairs"] == 1


def scenario_body(config, state, a, b, horizon=3) -> dict:
    return {
        "state": dump(state),
        "configuration": dump(config),
        "seed": SEED,
        "horizon": horizon,
        "branches": [{"label": "₹799", "decisions": a}, {"label": "₹699", "decisions": b}],
    }


def test_scenario_branches_differ_only_by_the_decisions(client, config) -> None:
    state = engine.create_initial_state(config, SEED)
    same = [{"type": "MARKETING", "value": 5_000_000}]
    data = client.post("/engine/scenario", json=scenario_body(config, state, same, same)).json()
    assert data["label"] == "Simulation estimate" and data["agentMode"] == "rules"
    assert data["branches"][0]["turns"] == data["branches"][1]["turns"]
    assert all(d["difference"] == 0 for d in data["differences"])

    a = [*same, {"type": "PRICING", "value": 79_900}]
    b = [*same, {"type": "PRICING", "value": 69_900}]
    data = client.post("/engine/scenario", json=scenario_body(config, state, a, b, 6)).json()
    assert data["startTurn"] == 1 and data["horizon"] == 6
    assert [t["turn"] for t in data["branches"][0]["turns"]] == [1, 2, 3, 4, 5, 6]
    revenue = next(d for d in data["differences"] if d["metric"] == "revenue")
    assert revenue["difference"] == revenue["alternative"] - revenue["baseline"]
    # The first branch equals simply playing those turns for real.
    real = engine.run_turn(state, [Decision.model_validate(x) for x in a], config, SEED, 1)
    assert data["branches"][0]["turns"][0]["cash"] == real.state_after.cash


def test_scenario_reports_rejected_decisions(client, config) -> None:
    state = engine.create_initial_state(config, SEED)
    bad = [{"type": "PRICING", "value": -1}]
    data = client.post("/engine/scenario", json=scenario_body(config, state, [], bad)).json()
    assert data["branches"][1]["rejections"][0]["reason"] == "price cannot be negative"
    assert data["branches"][1]["totals"] is None
    assert data["differences"] == []


def test_engine_info(client) -> None:
    info = client.get("/engine/info").json()
    assert info["engineVersion"] == engine.ENGINE_VERSION
    assert info["llmConfigured"] is False
    assert info["modelVersion"] is None


def test_decisions_that_change_nothing_are_not_analysed(client, config) -> None:
    initial = engine.create_initial_state(config, SEED)
    restated = [
        Decision(type=DecisionType.pricing, value=initial.price),
        Decision(type=DecisionType.hiring, value=initial.employees),
    ]
    first = engine.run_turn(initial, restated, config, SEED, 1)
    changed = [Decision(type=DecisionType.marketing, value=5_000_000)]
    second = engine.run_turn(first.state_after, restated[:1] + changed, config, SEED, 2)
    body = {
        "initialState": dump(initial),
        "records": [dump(first), dump(second)],
        "seed": SEED,
        "configuration": dump(config),
    }
    data = client.post("/analytics/simulation", json=body).json()
    assert [d["turn"] for d in data["decisions"]] == [2]
    assert [x["decision"]["type"] for x in data["decisions"][0]["decisions"]] == ["MARKETING"]
