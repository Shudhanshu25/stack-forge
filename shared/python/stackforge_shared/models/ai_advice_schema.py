# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import enums_schema, llm_call_schema


class AIAdvice(BaseModel):
    """
    AI CEO advisor output. May only cite figures present in its input. When available is false the other fields may be empty.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    available: bool
    mode: enums_schema.AdviceMode
    question: str | None = Field(None, max_length=1000)
    summary: str
    positive_factors: list[str] = Field(..., alias='positiveFactors')
    negative_factors: list[str] = Field(..., alias='negativeFactors')
    key_risk: str = Field(..., alias='keyRisk')
    key_opportunity: str = Field(..., alias='keyOpportunity')
    recommendation: str
    reasoning: str
    confidence: float = Field(
        ...,
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    model_version: str | None = Field(None, alias='modelVersion')
    unavailable_reason: str | None = Field(None, alias='unavailableReason')
    prompt_version: str | None = Field(
        None,
        alias='promptVersion',
        description='Advisor prompt version, e.g. advisor@v1.',
    )
    llm_calls: list[llm_call_schema.LlmCall] | None = Field(None, alias='llmCalls')
