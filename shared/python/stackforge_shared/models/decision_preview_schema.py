# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from . import decision_result_schema, estimated_effect_schema


class DecisionPreview(BaseModel):
    """
    A simulation estimate of a set of decisions: the direction and rough size of each effect, never exact figures. Nothing is recorded.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    turn_number: int = Field(..., alias='turnNumber', ge=1)
    label: Literal['Simulation estimate']
    decision_results: list[decision_result_schema.DecisionResult] = Field(
        ...,
        alias='decisionResults',
        description='Each decision on its own against keeping everything unchanged.',
    )
    combined_effects: list[estimated_effect_schema.EstimatedEffect] = Field(
        ..., alias='combinedEffects', description='All accepted decisions together.'
    )
