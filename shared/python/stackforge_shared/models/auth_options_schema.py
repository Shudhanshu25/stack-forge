# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AuthOptions(BaseModel):
    """
    Sign-in methods this deployment offers.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    google: bool = Field(..., description='Whether Google sign-in is configured.')
