# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from . import enums_schema, simulation_job_schema


class Type(StrEnum):
    ready = 'ready'
    subscribed = 'subscribed'
    unsubscribed = 'unsubscribed'
    stage = 'stage'
    job = 'job'
    error = 'error'
    pong = 'pong'


class WsError(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    code: str
    message: str


class WsServerMessage(BaseModel):
    """
    Messages the API sends on /api/v1/ws: stage progress and job status changes for subscribed simulations.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    type: Type
    simulation_id: str | None = Field(None, alias='simulationId')
    job_id: str | None = Field(None, alias='jobId')
    turn_number: int | None = Field(None, alias='turnNumber', ge=1)
    stage: enums_schema.PipelineStage | None = None
    progress: float | None = Field(None, ge=0.0, le=100.0)
    job: simulation_job_schema.SimulationJob | None = None
    error: WsError | None = Field(None, title='WsError')
