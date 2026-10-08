# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class StartupProfile(BaseModel):
    """
    User-written text about the startup that the agents and the advisor may read. It is untrusted: the prompts pass it as delimited data, never as instructions.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    name: str = Field(..., max_length=80)
    product_name: str = Field(..., alias='productName', max_length=80)
    product_description: str | None = Field(
        None, alias='productDescription', max_length=1000
    )
