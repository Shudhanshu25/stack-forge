# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class DifficultyModifiers(BaseModel):
    """
    Multipliers the engine applies to SimulationParameters for a difficulty level. 1.0 means unchanged.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    cac_multiplier: float = Field(..., alias='cacMultiplier', ge=0.1, le=5.0)
    churn_multiplier: float = Field(..., alias='churnMultiplier', ge=0.1, le=5.0)
    conversion_multiplier: float = Field(
        ..., alias='conversionMultiplier', ge=0.1, le=5.0
    )
    competitor_intensity_multiplier: float = Field(
        ..., alias='competitorIntensityMultiplier', ge=0.1, le=5.0
    )
    event_probability_multiplier: float = Field(
        ..., alias='eventProbabilityMultiplier', ge=0.0, le=5.0
    )
    negative_event_weight: float = Field(
        ...,
        alias='negativeEventWeight',
        description='Relative weight of negative events against positive ones.',
        ge=0.0,
        le=5.0,
    )
