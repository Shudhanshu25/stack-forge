# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import enums_schema, location_schema, product_schema


class StartupCreateRequest(BaseModel):
    """
    The creation wizard's fields. Money in paise.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    name: str = Field(..., max_length=80, min_length=1)
    industry: enums_schema.Industry
    business_model: enums_schema.BusinessModel = Field(..., alias='businessModel')
    initial_capital: int = Field(
        ...,
        alias='initialCapital',
        description='Paise; between 1 lakh and 1,000 crore rupees.',
        ge=10000000,
        le=100000000000,
    )
    product: product_schema.Product
    initial_price: int = Field(
        ...,
        alias='initialPrice',
        description='Paise; at least 1 rupee.',
        ge=100,
        le=1000000000,
    )
    market_size: int = Field(..., alias='marketSize', ge=100, le=2000000000)
    difficulty: enums_schema.Difficulty
    location: location_schema.Location
