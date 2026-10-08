# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from . import (
    ai_advice_schema,
    enums_schema,
    session_schema,
    simulation_schema,
    simulation_turn_schema,
    startup_schema,
    user_schema,
)


class LlmUsageRecord(BaseModel):
    """
    One LLM call made for the user.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    simulation_id: str | None = Field(..., alias='simulationId')
    turn_number: int | None = Field(..., alias='turnNumber')
    purpose: str
    model: str
    prompt_version: str = Field(..., alias='promptVersion')
    prompt_tokens: int = Field(..., alias='promptTokens', ge=0)
    completion_tokens: int = Field(..., alias='completionTokens', ge=0)
    cached: bool
    outcome: str
    created_at: AwareDatetime = Field(..., alias='createdAt')


class AdviceRecord(BaseModel):
    """
    An on-demand AI CEO question and its answer.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    simulation_id: str = Field(..., alias='simulationId')
    turn_number: int = Field(..., alias='turnNumber', ge=1)
    mode: enums_schema.AdviceMode
    question: str | None
    advice: ai_advice_schema.AIAdvice
    created_at: AwareDatetime = Field(..., alias='createdAt')


class DataExport(BaseModel):
    """
    Everything stored about a user, as downloaded from GET /account/export. Password hashes and token hashes are never included.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    exported_at: AwareDatetime = Field(..., alias='exportedAt')
    user: user_schema.User
    startups: list[startup_schema.Startup]
    simulations: list[simulation_schema.Simulation]
    turns: list[simulation_turn_schema.SimulationTurn]
    advice: list[AdviceRecord]
    sessions: list[session_schema.Session]
    llm_usage: list[LlmUsageRecord] = Field(..., alias='llmUsage')
