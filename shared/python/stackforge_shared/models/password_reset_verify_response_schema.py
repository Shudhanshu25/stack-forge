# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class PasswordResetVerifyResponse(BaseModel):
    """
    The code was right: a single-use token for POST /auth/password-reset/confirm.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    reset_token: str = Field(
        ...,
        alias='resetToken',
        max_length=200,
        min_length=20,
        pattern='^[A-Za-z0-9_-]+$',
    )
    expires_in_seconds: int = Field(..., alias='expiresInSeconds', ge=1)
