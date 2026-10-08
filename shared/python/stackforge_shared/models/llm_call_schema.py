# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class Purpose(StrEnum):
    customer_agent = 'customer_agent'
    competitor_agent = 'competitor_agent'
    advisor = 'advisor'


class LlmCall(BaseModel):
    """
    One LLM call (or cache hit) made while computing a turn or advice.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    purpose: Purpose
    model: str
    prompt_version: str = Field(
        ..., alias='promptVersion', description='e.g. customer_agent@v1'
    )
    prompt_tokens: int = Field(..., alias='promptTokens', ge=0)
    completion_tokens: int = Field(..., alias='completionTokens', ge=0)
    cached: bool = Field(
        ..., description='Served from the agent cache: no provider call, no tokens.'
    )
    outcome: str = Field(
        ...,
        description='ok, or the failure kind (timeout, provider_error, invalid_output, ...).',
    )
    latency_ms: float | None = Field(None, alias='latencyMs', ge=0.0)
