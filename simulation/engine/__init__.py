"""Stack Forge simulation engine.

Pure Python: no FastAPI, database, Redis or LLM imports, no I/O, no clock, no unseeded
randomness. The formulas are documented in docs/simulation.md.
"""

from .decisions import DecisionValidationError, validate_decisions
from .location import LocationFactors, localize, location_factors
from .preview import preview
from .replay import ReplayError, replay, replay_mismatches
from .turn import (
    EngineInputError,
    create_initial_state,
    rule_based_agent_effects,
    run_turn,
    seasonality,
    turn_events,
)
from .version import ENGINE_VERSION

__all__ = [
    "ENGINE_VERSION",
    "DecisionValidationError",
    "EngineInputError",
    "LocationFactors",
    "ReplayError",
    "create_initial_state",
    "localize",
    "location_factors",
    "preview",
    "replay",
    "replay_mismatches",
    "rule_based_agent_effects",
    "run_turn",
    "seasonality",
    "turn_events",
    "validate_decisions",
]
