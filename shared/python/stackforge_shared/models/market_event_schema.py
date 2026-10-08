# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, RootModel

from . import enums_schema


class MarketEventEffects(BaseModel):
    """
    demand, marketingCost, cac, churn, unitCost and fixedCosts are fractional multipliers (0.08 = +8%); brandAwareness, customerSatisfaction and productQuality are added to the score each active turn.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    demand: float | None = Field(None, ge=-1.0, le=3.0)
    marketing_cost: float | None = Field(None, alias='marketingCost', ge=-1.0, le=3.0)
    cac: float | None = Field(None, ge=-1.0, le=3.0)
    churn: float | None = Field(None, ge=-1.0, le=3.0)
    unit_cost: float | None = Field(None, alias='unitCost', ge=-1.0, le=3.0)
    fixed_costs: float | None = Field(None, alias='fixedCosts', ge=-1.0, le=3.0)
    brand_awareness: float | None = Field(None, alias='brandAwareness', ge=-1.0, le=1.0)
    customer_satisfaction: float | None = Field(
        None, alias='customerSatisfaction', ge=-1.0, le=1.0
    )
    product_quality: float | None = Field(
        None,
        alias='productQuality',
        description='Added to product quality each active turn.',
        ge=-1.0,
        le=1.0,
    )
    salaries: float | None = Field(
        None,
        description='Fractional change to salary costs while active (0.1 = +10%).',
        ge=-1.0,
        le=3.0,
    )


class State(RootModel[str]):
    root: str = Field(
        ...,
        description='ISO 3166-2:IN state or union territory code, e.g. KA.',
        pattern='^[A-Z]{2}$',
    )


class City(RootModel[str]):
    root: str = Field(
        ...,
        description='Id of a listed city, e.g. bengaluru.',
        pattern='^[a-z0-9-]{2,40}$',
    )


class Conditions(BaseModel):
    """
    Where the event can happen. Every list given must contain the startup's value; an event without conditions can happen anywhere. Startups without a location only get unconditional events.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    states: list[State] | None = Field(None, min_length=1)
    tiers: list[enums_schema.LocationTier] | None = Field(None, min_length=1)
    cities: list[City] | None = Field(None, min_length=1)


class MarketEvent(BaseModel):
    """
    A data-driven market event definition. Effects are fractional modifiers (0.08 = +8%) applied while the event is active.
    """

    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    type: enums_schema.EventType
    polarity: enums_schema.EventPolarity
    title: str | None = None
    description: str | None = None
    probability: float = Field(
        ...,
        description='A rate or score in [0, 1].',
        ge=0.0,
        le=1.0,
        title='UnitInterval',
    )
    duration: int = Field(..., description='Turns.', ge=1, le=24)
    effects: MarketEventEffects = Field(
        ...,
        description='demand, marketingCost, cac, churn, unitCost and fixedCosts are fractional multipliers (0.08 = +8%); brandAwareness, customerSatisfaction and productQuality are added to the score each active turn.',
        title='MarketEventEffects',
    )
    conditions: Conditions | None = Field(
        None,
        description="Where the event can happen. Every list given must contain the startup's value; an event without conditions can happen anywhere. Startups without a location only get unconditional events.",
    )
