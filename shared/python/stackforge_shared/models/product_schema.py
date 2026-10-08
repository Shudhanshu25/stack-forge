# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Product(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    name: str = Field(..., max_length=80, min_length=1)
    description: str = Field(..., max_length=1000)
