# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, RootModel

from . import simulation_turn_schema


class Mismatch(RootModel[int]):
    root: int = Field(..., ge=1)


class EngineReplayResponse(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    records: list[simulation_turn_schema.SimulationTurn]
    mismatches: list[Mismatch] = Field(
        ...,
        description='Turn numbers whose recomputed stateAfter differs from the stored one.',
    )
