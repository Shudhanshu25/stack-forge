# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PasswordResetRequest(BaseModel):
    """
    Ask for a password reset code. If the email has an account, a 6-digit code is emailed (valid for a few minutes; a new request replaces the previous code). Always answered with 202, whether or not the email has an account.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    email: EmailStr = Field(..., max_length=254)
