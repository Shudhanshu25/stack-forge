# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from . import enums_schema, simulation_state_schema, startup_configuration_schema


class Simulation(BaseModel):
    """
    A simulation of one startup. The configuration is snapshotted when it starts. currentState is the stateAfter of the latest turn, or the initial state before turn 1.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    id: str
    owner_id: str = Field(..., alias='ownerId')
    startup_id: str = Field(..., alias='startupId')
    seed: int = Field(
        ...,
        description="Seed for every random draw in the simulation. Stays within JavaScript's safe integer range.",
        ge=0,
        le=9007199254740991,
    )
    agent_mode: enums_schema.AgentMode = Field(..., alias='agentMode')
    status: enums_schema.SimulationStatus
    engine_version: str = Field(
        ...,
        alias='engineVersion',
        description='Engine version that created the initial state.',
    )
    current_turn: int = Field(..., alias='currentTurn', ge=0)
    configuration: startup_configuration_schema.StartupConfiguration
    current_state: simulation_state_schema.SimulationState = Field(
        ..., alias='currentState'
    )
    active_job_id: str | None = Field(..., alias='activeJobId')
    created_at: AwareDatetime = Field(..., alias='createdAt')
    updated_at: AwareDatetime = Field(..., alias='updatedAt')
    startup_name: str = Field(..., alias='startupName')
    product_name: str = Field(..., alias='productName')
