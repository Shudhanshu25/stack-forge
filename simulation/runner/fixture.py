"""Writes a real engine run (and its analytics) as JSON fixtures for the backend tests.

python -m runner.fixture ../backend/tests/fixtures/saas-run.json
(also writes saas-analytics.json next to it)
"""

import json
import sys
from pathlib import Path

from stackforge_shared.models.engine_analytics_request_schema import EngineAnalyticsRequest
from stackforge_shared.templates import build_configuration

import locations
from app.analytics.analytics import build_analytics
from engine import ENGINE_VERSION, create_initial_state
from runner.__main__ import simulate

SEED = 2024
TURNS = 12


def main(argv: list[str]) -> int:
    # Located in Bengaluru, like the backend tests' NovaTech startup.
    config = build_configuration(
        "SAAS", "NORMAL", location_profile=locations.city_profile("bengaluru")
    )
    records = simulate(config, TURNS, SEED, "growth")
    fixture = {
        "engineVersion": ENGINE_VERSION,
        "seed": SEED,
        "configuration": config.model_dump(mode="json", by_alias=True, exclude_none=True),
        "initialState": create_initial_state(config, SEED).model_dump(
            mode="json", by_alias=True, exclude_none=True
        ),
        "records": [r.model_dump(mode="json", by_alias=True, exclude_none=True) for r in records],
    }
    Path(argv[0]).write_text(json.dumps(fixture, indent=1) + "\n", encoding="utf-8")
    analytics = build_analytics(
        EngineAnalyticsRequest(
            initial_state=create_initial_state(config, SEED),
            records=records,
            seed=SEED,
            configuration=config,
        )
    )
    Path(argv[0]).with_name("saas-analytics.json").write_text(
        analytics.model_dump_json(by_alias=True, indent=1), encoding="utf-8"
    )
    print(f"wrote {len(records)} turns (and their analytics) to {argv[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
