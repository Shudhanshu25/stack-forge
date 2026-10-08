# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import difficulty_modifiers_schema


class DifficultyPresets(BaseModel):
    """
    Shape of shared/templates/difficulty.json.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    easy: difficulty_modifiers_schema.DifficultyModifiers = Field(..., alias='EASY')
    normal: difficulty_modifiers_schema.DifficultyModifiers = Field(..., alias='NORMAL')
    hard: difficulty_modifiers_schema.DifficultyModifiers = Field(..., alias='HARD')
