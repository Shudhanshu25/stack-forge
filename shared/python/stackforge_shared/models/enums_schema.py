# Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import Field, RootModel


class Enums(RootModel[Any]):
    root: Any = Field(
        ...,
        description='Shared enumerations. Referenced from other schemas via enums.schema.json#/definitions/<Name>.',
        title='Enums',
    )


class DecisionType(StrEnum):
    """
    PRICING, MARKETING, HIRING and PRODUCT_QUALITY are implemented. The rest are reserved and rejected as not yet supported.
    """

    pricing = 'PRICING'
    marketing = 'MARKETING'
    hiring = 'HIRING'
    product_quality = 'PRODUCT_QUALITY'
    firing = 'FIRING'
    r_and_d = 'R_AND_D'
    expansion = 'EXPANSION'
    cost_cutting = 'COST_CUTTING'
    funding = 'FUNDING'


class SimulationStatus(StrEnum):
    active = 'ACTIVE'
    bankrupt = 'BANKRUPT'
    completed = 'COMPLETED'
    archived = 'ARCHIVED'


class JobStatus(StrEnum):
    queued = 'QUEUED'
    running = 'RUNNING'
    completed = 'COMPLETED'
    failed = 'FAILED'
    cancelled = 'CANCELLED'


class EventType(StrEnum):
    viral_exposure = 'viral_exposure'
    positive_review = 'positive_review'
    influencer_mention = 'influencer_mention'
    supplier_discount = 'supplier_discount'
    unexpected_demand = 'unexpected_demand'
    competitor_price_war = 'competitor_price_war'
    supply_disruption = 'supply_disruption'
    bad_review = 'bad_review'
    economic_slowdown = 'economic_slowdown'
    employee_turnover = 'employee_turnover'
    regulatory_cost = 'regulatory_cost'
    market_trend = 'market_trend'
    seasonality = 'seasonality'
    new_technology = 'new_technology'
    customer_preference_shift = 'customer_preference_shift'
    state_startup_incentive = 'state_startup_incentive'
    state_regulatory_change = 'state_regulatory_change'
    local_festival_demand = 'local_festival_demand'
    monsoon_disruption = 'monsoon_disruption'
    local_talent_war = 'local_talent_war'
    infrastructure_outage = 'infrastructure_outage'


class EventPolarity(StrEnum):
    positive = 'POSITIVE'
    negative = 'NEGATIVE'
    neutral = 'NEUTRAL'


class Industry(StrEnum):
    saas = 'SAAS'
    ecommerce = 'ECOMMERCE'
    food_and_beverage = 'FOOD_AND_BEVERAGE'
    edtech = 'EDTECH'
    healthtech = 'HEALTHTECH'
    fintech = 'FINTECH'
    gaming = 'GAMING'
    consumer_app = 'CONSUMER_APP'


class BusinessModel(StrEnum):
    subscription = 'SUBSCRIPTION'
    transactional = 'TRANSACTIONAL'
    freemium = 'FREEMIUM'
    marketplace = 'MARKETPLACE'
    advertising = 'ADVERTISING'


class Difficulty(StrEnum):
    easy = 'EASY'
    normal = 'NORMAL'
    hard = 'HARD'


class UserRole(StrEnum):
    user = 'USER'
    admin = 'ADMIN'


class AgentMode(StrEnum):
    rules = 'rules'
    llm = 'llm'


class CustomerSegmentType(StrEnum):
    price_sensitive = 'PRICE_SENSITIVE'
    premium = 'PREMIUM'
    loyal = 'LOYAL'
    occasional = 'OCCASIONAL'
    enterprise = 'ENTERPRISE'


class CompetitorArchetype(StrEnum):
    budget = 'BUDGET'
    premium = 'PREMIUM'
    aggressive = 'AGGRESSIVE'
    innovative = 'INNOVATIVE'


class AdviceMode(StrEnum):
    explain = 'EXPLAIN'
    analyze = 'ANALYZE'
    scenario = 'SCENARIO'


class PipelineStage(StrEnum):
    """
    Turn pipeline stages in order. Stages a milestone has not built yet are not emitted.
    """

    processing_decision = 'PROCESSING_DECISION'
    analyzing_customers = 'ANALYZING_CUSTOMERS'
    analyzing_competitors = 'ANALYZING_COMPETITORS'
    applying_market_event = 'APPLYING_MARKET_EVENT'
    updating_financial_model = 'UPDATING_FINANCIAL_MODEL'
    generating_forecast = 'GENERATING_FORECAST'
    ai_ceo_analysis = 'AI_CEO_ANALYSIS'
    complete = 'COMPLETE'


class LocationTier(StrEnum):
    """
    City tier, following the house rent allowance classification of cities (X = METRO, Y = TIER_2, Z = TIER_3).
    """

    metro = 'METRO'
    tier_2 = 'TIER_2'
    tier_3 = 'TIER_3'


class LocationBasis(StrEnum):
    """
    How a location profile was built: a listed city's own values, a state's values with tier defaults (any other city), or the neutral baseline (startups created before locations existed).
    """

    listed_city = 'LISTED_CITY'
    state_and_tier = 'STATE_AND_TIER'
    neutral = 'NEUTRAL'
