# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from . import enums_schema, simulation_turn_schema


class Type(StrEnum):
    stage = 'stage'
    result = 'result'
    error = 'error'


class PipelineError(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    code: str
    message: str
    details: Any | None = None


class PipelineEvent(BaseModel):
    """
    One line of the NDJSON stream returned by POST /pipeline/turn: stage events as each stage completes, then exactly one result or error.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    type: Type
    stage: enums_schema.PipelineStage | None = None
    progress: float | None = Field(None, ge=0.0, le=100.0)
    record: simulation_turn_schema.SimulationTurn | None = None
    error: PipelineError | None = None
