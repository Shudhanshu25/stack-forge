import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from stackforge_shared.templates import build_configuration

from app.config import Settings
from app.main import create_app

NO_MODEL = Path(__file__).parent / "no-forecast-model"
client = TestClient(create_app(Settings(app_env="test", forecast_model_dir=NO_MODEL), llm=None))
SEED = 99


@pytest.fixture(scope="module")
def config() -> dict:
    return build_configuration("SAAS").model_dump(mode="json", by_alias=True)


@pytest.fixture(scope="module")
def initial(config) -> dict:
    response = client.post("/engine/start", json={"configuration": config, "seed": SEED})
    assert response.status_code == 200
    return response.json()["state"]


def stream(body: dict) -> list[dict]:
    response = client.post("/pipeline/turn", json=body)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    return [json.loads(line) for line in response.text.splitlines() if line]


def turn_body(config, state, decisions, turn=1, mode="rules") -> dict:
    return {
        "state": state,
        "decisions": decisions,
        "configuration": config,
        "seed": SEED,
        "turnNumber": turn,
        "agentMode": mode,
    }


def test_start_returns_turn_zero_and_the_engine_version(config) -> None:
    body = client.post("/engine/start", json={"configuration": config, "seed": SEED}).json()
    assert body["state"]["turn"] == 0
    assert body["state"]["cash"] == config["initialCapital"]
    assert body["engineVersion"]
    assert "null" not in json.dumps(body)


def test_start_validates_the_body(config) -> None:
    response = client.post("/engine/start", json={"configuration": config, "seed": -1})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_preview_returns_an_estimate(config, initial) -> None:
    response = client.post(
        "/engine/preview",
        json={
            "state": initial,
            "decisions": [{"type": "MARKETING", "value": 5_000_000}],
            "configuration": config,
            "seed": SEED,
            "turnNumber": 1,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["label"] == "Simulation estimate"
    assert body["decisionResults"][0]["status"] == "ACCEPTED"


def test_preview_reports_engine_input_errors(config, initial) -> None:
    response = client.post(
        "/engine/preview",
        json={
            "state": initial,
            "decisions": [],
            "configuration": config,
            "seed": SEED,
            "turnNumber": 3,
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "ENGINE_INPUT_ERROR"


def test_pipeline_streams_stages_then_the_record(config, initial) -> None:
    events = stream(turn_body(config, initial, [{"type": "MARKETING", "value": 5_000_000}]))
    assert [e["type"] for e in events] == ["stage"] * 7 + ["result"]
    assert [e["stage"] for e in events[:7]] == [
        "PROCESSING_DECISION",
        "ANALYZING_CUSTOMERS",
        "ANALYZING_COMPETITORS",
        "APPLYING_MARKET_EVENT",
        "UPDATING_FINANCIAL_MODEL",
        "GENERATING_FORECAST",
        "AI_CEO_ANALYSIS",
    ]
    progress = [e["progress"] for e in events[:7]]
    assert progress == sorted(progress) and progress[-1] < 100
    record = events[-1]["record"]
    assert record["turnNumber"] == 1
    assert record["stateBefore"] == initial
    assert "competitorActions" in record


def test_pipeline_reports_rejected_decisions_without_a_record(config, initial) -> None:
    events = stream(turn_body(config, initial, [{"type": "PRICING", "value": -5}]))
    assert [e["type"] for e in events] == ["error"]
    error = events[0]["error"]
    assert error["code"] == "DECISIONS_REJECTED"
    assert error["details"] == [
        {"field": "decisions[0].value", "reason": "price cannot be negative"}
    ]


@pytest.mark.parametrize(
    ("overrides", "code"),
    [({"turnNumber": 2}, "TURN_OUT_OF_ORDER")],
)
def test_pipeline_refuses_invalid_turns(config, initial, overrides, code) -> None:
    events = stream({**turn_body(config, initial, []), **overrides})
    assert [e["type"] for e in events] == ["error"]
    assert events[0]["error"]["code"] == code


def test_replay_round_trip_through_the_api(config, initial) -> None:
    state, records = initial, []
    for turn in range(1, 6):
        decisions = [{"type": "MARKETING", "value": 5_000_000}] if turn == 1 else []
        record = stream(turn_body(config, state, decisions, turn))[-1]["record"]
        records.append(record)
        state = record["stateAfter"]
    body = {"initialState": initial, "records": records, "seed": SEED, "configuration": config}
    response = client.post("/engine/replay", json=body).json()
    assert response["mismatches"] == []
    assert [r["stateAfter"] for r in response["records"]] == [r["stateAfter"] for r in records]

    records[2]["decisions"] = [{"type": "PRICING", "value": 39_900}]
    assert client.post("/engine/replay", json=body).json()["mismatches"] == [3, 4, 5]
