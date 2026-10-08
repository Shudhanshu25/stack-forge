# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import (
    scenario_branch_input_schema,
    simulation_state_schema,
    startup_configuration_schema,
)


class EngineScenarioRequest(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    state: simulation_state_schema.SimulationState
    configuration: startup_configuration_schema.StartupConfiguration
    seed: int = Field(..., ge=0, le=9007199254740991)
    horizon: int = Field(..., ge=1, le=6)
    branches: list[scenario_branch_input_schema.ScenarioBranchInput] = Field(
        ..., max_length=2, min_length=2
    )
    engine_version: str | None = Field(
        None,
        alias='engineVersion',
        description='Engine version the simulation was created with; it is computed by that version. Defaults to the current version.',
        pattern='^[0-9]+\\.[0-9]+\\.[0-9]+$',
    )
