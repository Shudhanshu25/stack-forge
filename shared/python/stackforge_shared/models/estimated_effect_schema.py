# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class Direction(StrEnum):
    up = 'UP'
    down = 'DOWN'
    flat = 'FLAT'


class Magnitude(StrEnum):
    none = 'NONE'
    small = 'SMALL'
    medium = 'MEDIUM'
    large = 'LARGE'


class EstimatedEffect(BaseModel):
    """
    Direction and rough size of a decision's effect on one metric, relative to keeping everything unchanged.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    metric: str
    direction: Direction
    magnitude: Magnitude
