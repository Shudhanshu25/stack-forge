# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import (
    enums_schema,
    simulation_turn_schema,
    startup_profile_schema,
    turn_summary_schema,
)


class AdvisorRequest(BaseModel):
    """
    Node -> FastAPI: everything the advisor may cite. The forecast travels inside the turn record.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    mode: enums_schema.AdviceMode
    question: str | None = Field(None, max_length=500)
    industry: enums_schema.Industry
    business_model: enums_schema.BusinessModel = Field(..., alias='businessModel')
    turn: simulation_turn_schema.SimulationTurn
    history: list[turn_summary_schema.TurnSummary] = Field(..., max_length=6)
    startup_profile: startup_profile_schema.StartupProfile | None = Field(
        None, alias='startupProfile'
    )
    token_allowance: int | None = Field(
        None,
        alias='tokenAllowance',
        description='LLM tokens the user may still spend today (null: no daily limit). 0 means the daily quota is exhausted: no LLM call is made.',
        ge=0,
    )
