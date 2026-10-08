# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from . import decision_rejection_schema, decision_schema, estimated_effect_schema


class Status(StrEnum):
    accepted = 'ACCEPTED'
    rejected = 'REJECTED'


class DecisionResult(BaseModel):
    """
    Outcome of validating and applying one decision, with the estimated direction and size of its effects.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    decision: decision_schema.Decision
    status: Status
    rejection: decision_rejection_schema.DecisionRejection | None = None
    effects: list[estimated_effect_schema.EstimatedEffect]
