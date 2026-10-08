# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class PasswordResetConfirmRequest(BaseModel):
    """
    Set a new password with the reset token returned by POST /auth/password-reset/verify. The token works once and expires shortly. Signs out every session.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    token: str = Field(..., max_length=200, min_length=20, pattern='^[A-Za-z0-9_-]+$')
    password: str = Field(..., max_length=128)
