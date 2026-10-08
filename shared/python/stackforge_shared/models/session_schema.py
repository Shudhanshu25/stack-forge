# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class Session(BaseModel):
    """
    An active sign-in (one refresh-token family).
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    id: str = Field(..., description='Session id (the refresh-token family).')
    device: str = Field(
        ...,
        description='Browser and operating system from the User-Agent, e.g. "Chrome on Windows".',
        max_length=120,
    )
    signed_in_at: AwareDatetime = Field(..., alias='signedInAt')
    last_used_at: AwareDatetime = Field(
        ...,
        alias='lastUsedAt',
        description='When the session last refreshed its access token.',
    )
    current: bool = Field(
        ..., description='Whether this is the session making the request.'
    )
