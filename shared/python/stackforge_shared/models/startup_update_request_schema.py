# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import enums_schema, location_schema, product_schema


class StartupUpdateRequest(BaseModel):
    """
    Partial update. Changing industry, businessModel or difficulty re-snapshots the template parameters.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    name: str | None = Field(None, max_length=80, min_length=1)
    industry: enums_schema.Industry | None = None
    business_model: enums_schema.BusinessModel | None = Field(
        None, alias='businessModel'
    )
    initial_capital: int | None = Field(
        None,
        alias='initialCapital',
        description='Paise; between 1 lakh and 1,000 crore rupees.',
        ge=10000000,
        le=100000000000,
    )
    product: product_schema.Product | None = None
    initial_price: int | None = Field(
        None,
        alias='initialPrice',
        description='Paise; at least 1 rupee.',
        ge=100,
        le=1000000000,
    )
    market_size: int | None = Field(None, alias='marketSize', ge=100, le=2000000000)
    difficulty: enums_schema.Difficulty | None = None
    location: location_schema.Location | None = Field(
        None,
        description='Allowed only while the startup has no simulation (409 LOCATION_LOCKED otherwise).',
    )
