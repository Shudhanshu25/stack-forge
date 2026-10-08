# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from . import enums_schema


class Source(StrEnum):
    """
    rules_fallback means the LLM was attempted and rule-based effects were used instead.
    """

    rules = 'rules'
    llm = 'llm'
    rules_fallback = 'rules_fallback'


class AgentOutput(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    source: Source = Field(
        ...,
        description='rules_fallback means the LLM was attempted and rule-based effects were used instead.',
    )
    sentiment_change: float = Field(..., alias='sentimentChange', ge=-1.0, le=1.0)
    demand_modifier: float = Field(..., alias='demandModifier', ge=-1.0, le=1.0)
    competitor_threat: float = Field(
        ...,
        alias='competitorThreat',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    reasoning_summary: str = Field(..., alias='reasoningSummary', max_length=2000)
    fallback_reason: str | None = Field(None, alias='fallbackReason')
    cached: bool | None = Field(
        None,
        description='Served from the agent cache (same prompt version and input as an earlier call).',
    )


class AgentEffects(BaseModel):
    """
    Bounded modifiers from the customer and competitor agents, stored in the turn record so replay never calls an LLM.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    mode: enums_schema.AgentMode
    customer: AgentOutput
    competitor: AgentOutput
