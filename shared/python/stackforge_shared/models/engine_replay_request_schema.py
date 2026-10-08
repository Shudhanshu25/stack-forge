# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import (
    simulation_state_schema,
    simulation_turn_schema,
    startup_configuration_schema,
)


class EngineReplayRequest(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    initial_state: simulation_state_schema.SimulationState = Field(
        ..., alias='initialState'
    )
    records: list[simulation_turn_schema.SimulationTurn]
    seed: int = Field(
        ...,
        description="Seed for every random draw in the simulation. Stays within JavaScript's safe integer range.",
        ge=0,
        le=9007199254740991,
    )
    configuration: startup_configuration_schema.StartupConfiguration
    engine_version: str | None = Field(
        None,
        alias='engineVersion',
        description='Engine version the simulation was created with; it is computed by that version. Defaults to the current version.',
        pattern='^[0-9]+\\.[0-9]+\\.[0-9]+$',
    )
