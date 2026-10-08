# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PasswordResetVerifyRequest(BaseModel):
    """
    Check the 6-digit code emailed by POST /auth/password-reset. A wrong, used or expired code (or an email without an account) gets the same 400 INVALID_CODE; five wrong tries end the code.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    email: EmailStr = Field(..., max_length=254)
    code: str = Field(
        ..., description='The six digits from the email.', pattern='^[0-9]{6}$'
    )
