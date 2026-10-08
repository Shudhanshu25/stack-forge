# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import enums_schema, simulation_parameters_schema


class IndustryDefaults(BaseModel):
    """
    Values the creation wizard pre-fills. Money in paise.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    business_model: enums_schema.BusinessModel = Field(..., alias='businessModel')
    initial_capital: int = Field(..., alias='initialCapital', ge=0)
    initial_price: int = Field(..., alias='initialPrice', ge=0)
    market_size: int = Field(..., alias='marketSize', ge=1)


class IndustryTemplate(BaseModel):
    """
    A data file in shared/templates/industries describing one industry's default economics.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    industry: enums_schema.Industry
    template_version: str = Field(
        ..., alias='templateVersion', pattern='^[0-9]+\\.[0-9]+\\.[0-9]+$'
    )
    display_name: str = Field(..., alias='displayName')
    description: str
    defaults: IndustryDefaults = Field(
        ...,
        description='Values the creation wizard pre-fills. Money in paise.',
        title='IndustryDefaults',
    )
    parameters: simulation_parameters_schema.SimulationParameters
