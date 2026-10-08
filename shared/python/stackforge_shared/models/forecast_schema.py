# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Forecast(BaseModel):
    """
    ML prediction for the next turn. Shown to the user and passed to the advisor; never fed back into simulation state.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    available: bool
    target_turn: int = Field(..., alias='targetTurn', ge=1)
    model_version: str | None = Field(None, alias='modelVersion')
    training_dataset_version: str | None = Field(None, alias='trainingDatasetVersion')
    revenue: int | None = Field(None, description='Paise.', ge=0)
    customers: int | None = Field(None, ge=0)
    churn_rate: float | None = Field(
        None,
        alias='churnRate',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    unavailable_reason: str | None = Field(None, alias='unavailableReason')
