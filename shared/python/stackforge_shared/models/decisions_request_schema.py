# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import decision_schema


class DecisionsRequest(BaseModel):
    """
    Body of preview and turn requests.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    decisions: list[decision_schema.Decision] = Field(..., max_length=9)
