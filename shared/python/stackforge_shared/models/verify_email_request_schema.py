# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class VerifyEmailRequest(BaseModel):
    """
    The token from the verification link.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    token: str = Field(..., max_length=200, min_length=20, pattern='^[A-Za-z0-9_-]+$')
