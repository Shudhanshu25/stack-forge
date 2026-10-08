"""Freeze the current engine before changing its formulas, and keep a replay fixture per version.

    python -m engine_freeze             # copy engine/ to engine_v<x>_<y>_<z>/ and write its fixture
    python -m engine_freeze --fixture   # only (re)write the fixture for the current version

Release steps for a formula change:
    1. python -m engine_freeze          (the old version stays importable and replayable)
    2. edit engine/, bump ENGINE_VERSION in engine/version.py
    3. python -m engine_freeze --fixture
    4. pytest (tests/test_engine_versions.py replays every retained version's fixture)
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

from stackforge_shared.templates import build_configuration

import engine
import locations
from runner.policies import POLICIES, accepted_only

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "tests" / "engine_fixtures"
# (industry, policy, seed, listed city or None). The located run covers Milestone 10's effects.
RUNS = [
    ("SAAS", "growth", 2024, None),
    ("ECOMMERCE", "random", 7, None),
    ("FOOD_AND_BEVERAGE", "steady", 99, None),
    ("ECOMMERCE", "growth", 314, "pune"),
]
TURNS = 10


def package_name(version: str) -> str:
    return "engine_v" + version.replace(".", "_")


def build_fixture(eng=engine) -> dict:
    """Recorded runs for one version, including one with LLM-style stored agent effects."""
    runs = []
    for index, (industry, policy, seed, city) in enumerate(RUNS):
        profile = locations.city_profile(city) if city else None
        config = build_configuration(industry, location_profile=profile)
        state = initial = eng.create_initial_state(config, seed)
        records = []
        for turn in range(1, TURNS + 1):
            if state.cash < 0:
                break
            decisions = accepted_only(state, config, POLICIES[policy](state, config, turn, seed))
            effects = None
            if index == 0:
                # Stored agent effects that differ from the rules, as an llm-mode turn would.
                rules = eng.rule_based_agent_effects(state, decisions, config)
                customer = rules.customer.model_copy(
                    update={"demand_modifier": 0.04 if turn % 2 else -0.03}
                )
                effects = rules.model_copy(
                    update={"mode": type(rules.mode)("llm"), "customer": customer}
                )
            record = eng.run_turn(state, decisions, config, seed, turn, effects)
            records.append(record)
            state = record.state_after
        runs.append(
            {
                "seed": seed,
                "configuration": config.model_dump(mode="json", by_alias=True, exclude_none=True),
                "initialState": initial.model_dump(mode="json", by_alias=True, exclude_none=True),
                "records": [
                    r.model_dump(mode="json", by_alias=True, exclude_none=True) for r in records
                ],
            }
        )
    return {"engineVersion": eng.ENGINE_VERSION, "runs": runs}


def write_fixture(eng=engine) -> Path:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    path = FIXTURES / f"{eng.ENGINE_VERSION}.json"
    path.write_text(json.dumps(build_fixture(eng), indent=1) + "\n", encoding="utf-8")
    return path


def freeze() -> Path:
    target = ROOT / package_name(engine.ENGINE_VERSION)
    if target.exists():
        raise SystemExit(f"{target.name} already exists; bump ENGINE_VERSION before freezing again")
    shutil.copytree(ROOT / "engine", target, ignore=shutil.ignore_patterns("__pycache__"))
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", action="store_true", help="only write the fixture")
    args = parser.parse_args(argv)
    if not args.fixture:
        print(f"froze engine {engine.ENGINE_VERSION} as {freeze().name}/")
    print(f"wrote {write_fixture().relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
