# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import (
    difficulty_modifiers_schema,
    enums_schema,
    location_profile_schema,
    market_event_schema,
    simulation_parameters_schema,
)


class StartupConfiguration(BaseModel):
    """
    Everything the engine needs to initialise a startup. Snapshotted from the industry template and difficulty presets when the startup is created or its economics are edited, so later template changes do not alter existing startups.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    industry: enums_schema.Industry
    business_model: enums_schema.BusinessModel = Field(..., alias='businessModel')
    difficulty: enums_schema.Difficulty
    initial_capital: int = Field(
        ..., alias='initialCapital', description='Paise.', ge=0
    )
    initial_price: int = Field(
        ...,
        alias='initialPrice',
        description='Paise per unit (per month for subscriptions).',
        ge=0,
    )
    market_size: int = Field(
        ...,
        alias='marketSize',
        description='Number of potential customers in the addressable market.',
        ge=1,
    )
    template_version: str = Field(..., alias='templateVersion')
    parameters: simulation_parameters_schema.SimulationParameters
    difficulty_modifiers: difficulty_modifiers_schema.DifficultyModifiers = Field(
        ..., alias='difficultyModifiers'
    )
    events_version: str = Field(..., alias='eventsVersion')
    events: list[market_event_schema.MarketEvent] = Field(
        ..., description='Event catalog snapshotted from shared/templates/events.json.'
    )
    location_profile: location_profile_schema.LocationProfile | None = Field(
        None,
        alias='locationProfile',
        description='Resolved at creation. Absent (configurations from before Milestone 10) means the neutral profile.',
    )
