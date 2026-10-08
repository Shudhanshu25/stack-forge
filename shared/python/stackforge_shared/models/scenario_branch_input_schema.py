# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import decision_schema


class ScenarioBranchInput(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    label: str | None = Field(None, max_length=40)
    decisions: list[decision_schema.Decision] = Field(..., max_length=9)
