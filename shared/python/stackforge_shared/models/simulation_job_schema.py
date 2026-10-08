# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from typing import Any

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from . import enums_schema


class JobError(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    code: str
    message: str
    details: Any | None = None


class SimulationJob(BaseModel):
    """
    A queued turn. Only one job per simulation can be QUEUED or RUNNING at a time.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    job_id: str = Field(..., alias='jobId')
    simulation_id: str = Field(..., alias='simulationId')
    turn_number: int = Field(..., alias='turnNumber', ge=1)
    status: enums_schema.JobStatus
    progress: float = Field(..., ge=0.0, le=100.0)
    stage: enums_schema.PipelineStage | None
    started_at: AwareDatetime | None = Field(..., alias='startedAt')
    completed_at: AwareDatetime | None = Field(..., alias='completedAt')
    error: JobError | None
    created_at: AwareDatetime = Field(..., alias='createdAt')
