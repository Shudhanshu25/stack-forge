# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import enums_schema


class SimulationStartRequest(BaseModel):
    """
    Both fields are optional; the seed is random when omitted.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    seed: int | None = Field(
        None,
        description="Seed for every random draw in the simulation. Stays within JavaScript's safe integer range.",
        ge=0,
        le=9007199254740991,
    )
    agent_mode: enums_schema.AgentMode | None = Field(None, alias='agentMode')
