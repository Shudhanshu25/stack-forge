# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from . import (
    agent_effects_schema,
    ai_advice_schema,
    decision_result_schema,
    decision_schema,
    forecast_schema,
    llm_call_schema,
    market_event_schema,
    simulation_state_schema,
)


class Action(StrEnum):
    price_change = 'PRICE_CHANGE'
    marketing_change = 'MARKETING_CHANGE'
    product_investment = 'PRODUCT_INVESTMENT'
    none = 'NONE'


class CompetitorAction(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    competitor_id: str = Field(..., alias='competitorId')
    action: Action
    change: float = Field(
        ...,
        description='Relative price change, or absolute change in marketing power or product quality; 0 for NONE.',
    )
    reason: str


class PromptVersions(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    customer_agent: str | None = Field(None, alias='customerAgent')
    competitor_agent: str | None = Field(None, alias='competitorAgent')
    advisor: str | None = None


class TurnLlmUsage(BaseModel):
    """
    Which prompts the turn used and what its LLM calls cost.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    prompt_versions: PromptVersions = Field(..., alias='promptVersions')
    calls: list[llm_call_schema.LlmCall]
    daily_quota_exhausted: bool = Field(
        ...,
        alias='dailyQuotaExhausted',
        description="The user's daily token quota was used up: agents ran on rules and the AI CEO was skipped.",
    )
    turn_budget_exhausted: bool = Field(
        ...,
        alias='turnBudgetExhausted',
        description='The per-turn token budget ran out before every LLM call was made.',
    )


class SimulationTurn(BaseModel):
    """
    An immutable turn record. Written once, never updated.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    id: str | None = None
    simulation_id: str | None = Field(None, alias='simulationId')
    turn_number: int = Field(..., alias='turnNumber', ge=1)
    state_before: simulation_state_schema.SimulationState = Field(
        ..., alias='stateBefore'
    )
    decisions: list[decision_schema.Decision]
    decision_results: list[decision_result_schema.DecisionResult] | None = Field(
        None, alias='decisionResults'
    )
    events: list[market_event_schema.MarketEvent] = Field(
        ..., description='Events that started this turn.'
    )
    agent_effects: agent_effects_schema.AgentEffects = Field(..., alias='agentEffects')
    state_after: simulation_state_schema.SimulationState = Field(
        ..., alias='stateAfter'
    )
    engine_version: str = Field(..., alias='engineVersion')
    forecast: forecast_schema.Forecast | None = None
    advice: ai_advice_schema.AIAdvice | None = None
    created_at: AwareDatetime | None = Field(None, alias='createdAt')
    competitor_actions: list[CompetitorAction] = Field(
        ...,
        alias='competitorActions',
        description="Each competitor's response this turn, including NONE.",
    )
    llm_usage: TurnLlmUsage | None = Field(None, alias='llmUsage')
