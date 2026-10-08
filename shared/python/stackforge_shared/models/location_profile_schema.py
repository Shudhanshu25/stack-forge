# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel

from . import enums_schema


class State(RootModel[str]):
    root: str = Field(
        ...,
        description='ISO 3166-2:IN state or union territory code, e.g. KA.',
        pattern='^[A-Z]{2}$',
    )


class CityId(RootModel[str]):
    root: str = Field(
        ...,
        description='Id of a listed city, e.g. bengaluru.',
        pattern='^[a-z0-9-]{2,40}$',
    )


class LocationIndex(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    value: float = Field(
        ..., description='Relative to the national baseline (1.0).', ge=0.2, le=3.0
    )
    is_estimate: bool = Field(
        ...,
        alias='isEstimate',
        description='True when no published figure exists and the value is a reasoned estimate.',
    )
    source: str = Field(..., max_length=400, min_length=1)


class Indices(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    salary_index: LocationIndex = Field(
        ..., alias='salaryIndex', description='Cost per employee.'
    )
    operating_cost_index: LocationIndex = Field(
        ..., alias='operatingCostIndex', description='Rent and fixed overheads.'
    )
    purchasing_power: LocationIndex = Field(
        ...,
        alias='purchasingPower',
        description='How much local customers can spend; higher means less price sensitive.',
    )
    local_market_size: LocationIndex = Field(
        ..., alias='localMarketSize', description='Addressable customers nearby.'
    )
    talent_availability: LocationIndex = Field(
        ...,
        alias='talentAvailability',
        description='How easily and quickly hires are made.',
    )
    competition_density: LocationIndex = Field(
        ...,
        alias='competitionDensity',
        description='Strength and number of local competitors.',
    )
    funding_access: LocationIndex = Field(
        ...,
        alias='fundingAccess',
        description='Reserved for the funding decision; stored, unused until that decision exists.',
    )
    infrastructure: LocationIndex = Field(
        ..., description='Logistics and connectivity quality.'
    )
    regulatory_burden: LocationIndex = Field(
        ..., alias='regulatoryBurden', description='State-level compliance cost.'
    )


class LocationProfile(BaseModel):
    """
    The resolved location indices the engine uses, each relative to a national baseline of 1.0, with its source and whether it is an estimate. Snapshotted into the startup configuration.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    data_version: str = Field(..., alias='dataVersion')
    basis: enums_schema.LocationBasis
    country: Literal['IN']
    state: State | None = None
    state_name: str | None = Field(None, alias='stateName')
    city: str | None = None
    city_id: CityId | None = Field(None, alias='cityId')
    tier: enums_schema.LocationTier | None = None
    indices: Indices
