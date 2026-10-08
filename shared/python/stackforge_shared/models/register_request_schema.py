# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    """
    Password strength (10+ characters with lower case, upper case and a digit) is checked by the auth service so the error names the missing rule.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    email: EmailStr = Field(..., max_length=254)
    password: str = Field(..., max_length=128)
    name: str = Field(..., max_length=100, min_length=1)
