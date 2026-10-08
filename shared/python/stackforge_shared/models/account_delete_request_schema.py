# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AccountDeleteRequest(BaseModel):
    """
    Permanently delete the account and all its data. `password` is required when the account has one.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    confirm: Literal['DELETE MY ACCOUNT']
    password: str | None = Field(None, max_length=128)
