# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import (
    decision_schema,
    enums_schema,
    simulation_state_schema,
    startup_configuration_schema,
    startup_profile_schema,
    turn_summary_schema,
)


class PipelineTurnRequest(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    state: simulation_state_schema.SimulationState
    decisions: list[decision_schema.Decision] = Field(..., max_length=9)
    configuration: startup_configuration_schema.StartupConfiguration
    seed: int = Field(
        ...,
        description="Seed for every random draw in the simulation. Stays within JavaScript's safe integer range.",
        ge=0,
        le=9007199254740991,
    )
    turn_number: int = Field(..., alias='turnNumber', ge=1)
    agent_mode: enums_schema.AgentMode = Field(..., alias='agentMode')
    memory: list[turn_summary_schema.TurnSummary] | None = Field(
        None,
        description='Recent turns of this simulation, oldest first (bounded agent memory).',
        max_length=6,
    )
    engine_version: str | None = Field(
        None,
        alias='engineVersion',
        description='Engine version the simulation was created with; it is computed by that version. Defaults to the current version.',
        pattern='^[0-9]+\\.[0-9]+\\.[0-9]+$',
    )
    startup_profile: startup_profile_schema.StartupProfile | None = Field(
        None, alias='startupProfile'
    )
    token_allowance: int | None = Field(
        None,
        alias='tokenAllowance',
        description='LLM tokens the user may still spend today (null: no daily limit). 0 means the daily quota is exhausted: no LLM call is made.',
        ge=0,
    )
