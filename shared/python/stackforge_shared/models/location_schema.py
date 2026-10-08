# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel

from . import enums_schema


class CityId(RootModel[str]):
    root: str = Field(
        ...,
        description='Id of a listed city, e.g. bengaluru.',
        pattern='^[a-z0-9-]{2,40}$',
    )


class Location(BaseModel):
    """
    Where a startup is based. Set at creation; it cannot change once a simulation has started.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    country: Literal['IN'] = Field(
        ...,
        description='Only India for now; the field lets other countries be added later.',
    )
    state: str = Field(
        ...,
        description='ISO 3166-2:IN state or union territory code, e.g. KA.',
        pattern='^[A-Z]{2}$',
    )
    city: str = Field(
        ...,
        description="City name: a listed city's name, or any other city the founder typed.",
        max_length=60,
        min_length=2,
    )
    city_id: CityId | None = Field(
        None,
        alias='cityId',
        description="The listed city's id, or null for any other city (profile from state and tier).",
    )
    tier: enums_schema.LocationTier
