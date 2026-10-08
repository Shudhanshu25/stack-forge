# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import user_schema


class AuthResponse(BaseModel):
    """
    Returned by register, login and refresh. The refresh token travels only in an httpOnly cookie.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    user: user_schema.User
    access_token: str = Field(..., alias='accessToken')
    access_token_expires_in: int = Field(
        ..., alias='accessTokenExpiresIn', description='Seconds.', ge=1
    )
