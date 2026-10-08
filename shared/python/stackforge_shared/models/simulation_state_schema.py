# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from . import enums_schema, market_event_schema


class Expenses(BaseModel):
    """
    Costs for the turn in paise. total is the sum of the other fields, so cash change equals revenue minus total.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    total: int = Field(..., ge=0)
    variable: int = Field(..., ge=0)
    fixed: int = Field(..., ge=0)
    marketing: int = Field(..., ge=0)
    employees: int = Field(..., ge=0)
    product: int = Field(
        ..., description='One-off product quality investment this turn.', ge=0
    )


class CustomerSegment(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    type: enums_schema.CustomerSegmentType
    population: int = Field(..., ge=0)
    customers: int = Field(..., ge=0)
    price_sensitivity: float = Field(
        ...,
        alias='priceSensitivity',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    quality_sensitivity: float = Field(
        ...,
        alias='qualitySensitivity',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    brand_loyalty: float = Field(
        ...,
        alias='brandLoyalty',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    conversion_rate: float = Field(
        ...,
        alias='conversionRate',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    churn_probability: float = Field(
        ...,
        alias='churnProbability',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )


class PricingStrategy(StrEnum):
    undercut = 'UNDERCUT'
    match = 'MATCH'
    premium = 'PREMIUM'
    penetration = 'PENETRATION'


class Competitor(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    id: str
    name: str
    archetype: enums_schema.CompetitorArchetype
    pricing_strategy: PricingStrategy = Field(..., alias='pricingStrategy')
    price: int = Field(..., ge=0)
    marketing_power: float = Field(
        ...,
        alias='marketingPower',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    market_share: float = Field(
        ...,
        alias='marketShare',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    reaction_tendency: float = Field(
        ...,
        alias='reactionTendency',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    product_quality: float = Field(
        ...,
        alias='productQuality',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    cash_strength: float = Field(
        ...,
        alias='cashStrength',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )


class ActiveEvent(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    event: market_event_schema.MarketEvent
    started_turn: int = Field(..., alias='startedTurn', ge=0)
    remaining_turns: int = Field(..., alias='remainingTurns', ge=0)


class SimulationState(BaseModel):
    """
    The full state of a startup at the end of a turn. Produced only by the simulation engine. Money in paise.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    turn: int = Field(..., ge=0)
    cash: int
    revenue: int = Field(..., ge=0)
    expenses: Expenses
    profit: int
    customers: int = Field(..., ge=0)
    new_customers: int = Field(..., alias='newCustomers', ge=0)
    churned_customers: int = Field(..., alias='churnedCustomers', ge=0)
    price: int = Field(..., ge=0)
    marketing_budget: int = Field(..., alias='marketingBudget', ge=0)
    employees: int = Field(..., ge=0)
    product_quality: float = Field(
        ...,
        alias='productQuality',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    market_share: float = Field(
        ...,
        alias='marketShare',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    customer_satisfaction: float = Field(
        ...,
        alias='customerSatisfaction',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    brand_awareness: float = Field(
        ...,
        alias='brandAwareness',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    competitor_pressure: float = Field(
        ...,
        alias='competitorPressure',
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    customer_segments: list[CustomerSegment] = Field(..., alias='customerSegments')
    competitors: list[Competitor]
    active_events: list[ActiveEvent] = Field(..., alias='activeEvents')
