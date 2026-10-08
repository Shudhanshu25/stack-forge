# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class Type(StrEnum):
    auth = 'auth'
    subscribe = 'subscribe'
    unsubscribe = 'unsubscribe'
    ping = 'ping'


class WsClientMessage(BaseModel):
    """
    Messages the browser sends on /api/v1/ws. The first must be auth with an access token.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    type: Type
    token: str | None = Field(None, max_length=4096)
    simulation_id: str | None = Field(None, alias='simulationId', max_length=64)
