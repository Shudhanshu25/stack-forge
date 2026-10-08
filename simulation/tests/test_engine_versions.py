"""Engine versioning: every retained version replays its stored fixture exactly, and a frozen
copy of the engine is self-contained, so old simulations keep their original formulas."""

import importlib
import json
import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import engine
import engines
from app.config import Settings
from app.main import create_app
from engine.models import SimulationState, SimulationTurn, StartupConfiguration
from engine_freeze import FIXTURES, build_fixture


def fixture_for(version: str) -> dict:
    path = FIXTURES / f"{version}.json"
    assert path.exists(), f"no replay fixture for engine {version}: run python -m engine_freeze"
    return json.loads(path.read_text(encoding="utf-8"))


def test_the_current_version_is_retained() -> None:
    assert engines.CURRENT in engines.retained()
    assert engines.get_engine() is engine
    assert engines.get_engine(None) is engines.get_engine(engines.CURRENT)


@pytest.mark.parametrize("version", engines.retained())
def test_each_retained_version_replays_its_stored_fixture(version: str) -> None:
    eng = engines.get_engine(version)
    stored = fixture_for(version)
    assert stored["engineVersion"] == version
    for run in stored["runs"]:
        records = [SimulationTurn.model_validate(r) for r in run["records"]]
        assert records, "fixture run has no turns"
        mismatches = eng.replay_mismatches(
            SimulationState.model_validate(run["initialState"]),
            records,
            run["seed"],
            StartupConfiguration.model_validate(run["configuration"]),
        )
        assert mismatches == []
        assert {r.engine_version for r in records} == {version}


def test_an_unknown_version_is_refused() -> None:
    with pytest.raises(engines.UnsupportedEngineVersionError, match=r"0.0.1"):
        engines.get_engine("0.0.1")


def test_a_frozen_copy_is_self_contained_and_identical(tmp_path: Path) -> None:
    """What engine_freeze produces: the copy imports nothing from engine/ and computes the same."""
    shutil.copytree(
        Path(engine.__file__).parent,
        tmp_path / "engine_vfrozen",
        ignore=shutil.ignore_patterns("__pycache__"),
    )
    sys.path.insert(0, str(tmp_path))
    try:
        frozen = importlib.import_module("engine_vfrozen")
        assert frozen.run_turn.__module__ == "engine_vfrozen.turn"
        loaded = {m.split(".")[0] for m in sys.modules if m.startswith("engine")}
        assert "engine_vfrozen" in loaded
        assert build_fixture(frozen) == build_fixture(engine)
    finally:
        sys.path.remove(str(tmp_path))
        for name in [m for m in sys.modules if m.startswith("engine_vfrozen")]:
            del sys.modules[name]


def test_the_api_refuses_an_unavailable_engine_version() -> None:
    client = TestClient(create_app(Settings(app_env="test", llm_provider="none")))
    stored = fixture_for(engines.CURRENT)["runs"][0]
    body = {
        "initialState": stored["initialState"],
        "records": stored["records"],
        "seed": stored["seed"],
        "configuration": stored["configuration"],
    }
    assert client.post("/engine/replay", json=body).json()["mismatches"] == []
    res = client.post("/engine/replay", json={**body, "engineVersion": "0.0.1"})
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "ENGINE_VERSION_UNSUPPORTED"
