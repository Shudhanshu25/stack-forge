# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, RootModel

from . import enums_schema


class CityId(RootModel[str]):
    root: str = Field(
        ...,
        description='Id of a listed city, e.g. bengaluru.',
        pattern='^[a-z0-9-]{2,40}$',
    )


class LocationProfileRequest(BaseModel):
    """
    Resolve a location profile: a listed city by its id, or any other city by state and tier.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    state: str = Field(
        ...,
        description='ISO 3166-2:IN state or union territory code, e.g. KA.',
        pattern='^[A-Z]{2}$',
    )
    city_id: CityId | None = Field(None, alias='cityId')
    city: str | None = Field(
        None,
        description='Name of an unlisted city (with tier).',
        max_length=60,
        min_length=2,
    )
    tier: enums_schema.LocationTier | None = None
