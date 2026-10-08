# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from . import enums_schema


class Tier(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    tier: enums_schema.LocationTier
    label: str
    description: str


class City(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    id: str = Field(
        ...,
        description='Id of a listed city, e.g. bengaluru.',
        pattern='^[a-z0-9-]{2,40}$',
    )
    name: str
    tier: enums_schema.LocationTier


class State(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    code: str = Field(
        ...,
        description='ISO 3166-2:IN state or union territory code, e.g. KA.',
        pattern='^[A-Z]{2}$',
    )
    name: str
    cities: list[City]


class LocationCatalog(BaseModel):
    """
    States, their listed cities and the tiers, for choosing a startup's location.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    data_version: str = Field(..., alias='dataVersion')
    country: Literal['IN']
    tiers: list[Tier]
    states: list[State]
