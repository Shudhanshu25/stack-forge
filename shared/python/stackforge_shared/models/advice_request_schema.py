# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import enums_schema


class AdviceRequest(BaseModel):
    """
    Ask the AI CEO about a turn. EXPLAIN answers a why-question, ANALYZE reviews the month, SCENARIO weighs a possible decision.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    mode: enums_schema.AdviceMode
    question: str | None = Field(None, max_length=500, min_length=1)
    turn_number: int | None = Field(
        None,
        alias='turnNumber',
        description='Turn to discuss; defaults to the latest.',
        ge=1,
    )
