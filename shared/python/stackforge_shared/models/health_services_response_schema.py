# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class ServiceStatus(StrEnum):
    ok = 'ok'
    down = 'down'


class HealthServicesResponse(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    api: ServiceStatus
    mongodb: ServiceStatus
    redis: ServiceStatus
    simulation_engine: ServiceStatus = Field(..., alias='simulationEngine')
