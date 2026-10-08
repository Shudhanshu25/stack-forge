"""Model data: segment profiles, competitor archetypes, business-model modifiers and tunables.

These belong to the engine's model rather than to an industry, so they are versioned with
ENGINE_VERSION. Industry economics live in shared/templates and arrive through the configuration.
Every number here is documented in docs/simulation.md.
"""

from dataclasses import dataclass

from .models import (
    BusinessModel,
    CompetitorArchetype,
    CustomerSegmentType,
    PricingStrategy,
)


@dataclass(frozen=True)
class SegmentProfile:
    mix_key: str  # attribute of SimulationParameters.segment_mix
    price_sensitivity: float
    quality_sensitivity: float
    brand_loyalty: float
    conversion_multiplier: float
    churn_multiplier: float
    willingness_to_pay: float  # multiple of the reference price the segment considers fair


SEGMENTS: dict[CustomerSegmentType, SegmentProfile] = {
    CustomerSegmentType.price_sensitive: SegmentProfile(
        "price_sensitive", 0.9, 0.3, 0.2, 1.2, 1.4, 0.8
    ),
    CustomerSegmentType.premium: SegmentProfile("premium", 0.2, 0.9, 0.5, 0.7, 0.7, 1.6),
    CustomerSegmentType.loyal: SegmentProfile("loyal", 0.4, 0.5, 0.9, 0.8, 0.4, 1.1),
    CustomerSegmentType.occasional: SegmentProfile("occasional", 0.6, 0.4, 0.2, 0.6, 1.6, 0.9),
    CustomerSegmentType.enterprise: SegmentProfile("enterprise", 0.3, 0.8, 0.7, 0.3, 0.5, 2.0),
}


@dataclass(frozen=True)
class ArchetypeProfile:
    name: str
    price_multiplier: float  # of the reference price
    product_quality: float
    marketing_power: float
    reaction_tendency: float
    cash_strength: float
    pricing_strategy: PricingStrategy
    share_weight: float  # share of the initial competitor market


ARCHETYPES: dict[CompetitorArchetype, ArchetypeProfile] = {
    CompetitorArchetype.budget: ArchetypeProfile(
        "ValueMart", 0.75, 0.45, 0.4, 0.6, 0.5, PricingStrategy.undercut, 0.30
    ),
    CompetitorArchetype.premium: ArchetypeProfile(
        "Prestige Co", 1.40, 0.80, 0.5, 0.3, 0.7, PricingStrategy.premium, 0.25
    ),
    CompetitorArchetype.aggressive: ArchetypeProfile(
        "Blitz Labs", 0.95, 0.55, 0.85, 0.9, 0.6, PricingStrategy.penetration, 0.25
    ),
    CompetitorArchetype.innovative: ArchetypeProfile(
        "Novum", 1.10, 0.75, 0.6, 0.5, 0.55, PricingStrategy.match, 0.20
    ),
}


@dataclass(frozen=True)
class ModelProfile:
    organic_multiplier: float
    churn_multiplier: float
    seasonal_purchases: bool  # whether seasonality also changes purchase frequency
    elasticity_multiplier: float


BUSINESS_MODELS: dict[BusinessModel, ModelProfile] = {
    BusinessModel.subscription: ModelProfile(1.0, 1.0, False, 1.0),
    BusinessModel.transactional: ModelProfile(1.0, 1.0, True, 1.0),
    BusinessModel.freemium: ModelProfile(1.5, 1.1, False, 1.0),
    BusinessModel.marketplace: ModelProfile(1.2, 1.0, True, 1.0),
    BusinessModel.advertising: ModelProfile(1.5, 1.0, True, 0.5),
}

# Demand
DEMAND_NOISE_SIGMA = 0.12
CHURN_NOISE_SIGMA = 0.10
MAX_ACQUISITION_SHARE_OF_POTENTIAL = 0.3
MARKETING_SATURATION_FACTOR = 0.01  # saturation spend = baseCac * marketSize * factor
VISIBILITY_WEIGHT = 0.4  # weight of ln(visibility) in choice utility
QUALITY_UTILITY_SCALE = 4.0
REFERRAL_RATE = 0.03
ORGANIC_EVALUATION_RATE = 0.2  # share of aware prospects actively evaluating in a month
MAX_CHURN_RATE = 0.9
DEMAND_MULTIPLIER_BOUNDS = (0.1, 5.0)

# Brand awareness
AWARENESS_DECAY = 0.03
AWARENESS_SCALE_FACTOR = 0.02  # awareness scale = baseCac * marketSize * factor
AWARENESS_WORD_OF_MOUTH = 0.5

# Product quality and satisfaction
QUALITY_SCALE_SALARIES = 20  # investment of this many monthly salaries closes ~63% of the gap
QUALITY_DECAY = 0.003
QUALITY_TEAM_EFFECT = 0.005
MIN_QUALITY = 0.05
INITIAL_SATISFACTION = 0.6
SATISFACTION_ADJUSTMENT = 0.35

# Costs
RECRUITING_COST_SALARY_SHARE = 0.25

# Location (docs/simulation.md#location). Indices are clamped to these bounds before use.
LOCATION_INDEX_BOUNDS = (0.3, 2.5)
# Compliance (filings, registrations, inspections) as a share of baseline fixed costs; the
# location adds or saves (regulatoryBurden - 1) times this. A modelling estimate.
COMPLIANCE_SHARE_OF_FIXED_COSTS = 0.1
# Below baseline talent, at most floor(this x talentAvailability) hires per turn (estimate).
HIRES_PER_TURN_AT_BASELINE = 8
# Price elasticity scales with purchasingPower ** -(this x localDemandWeight).
PURCHASING_POWER_EXPONENT = 0.5

# Competitors
COMPETITOR_SHARE_BASE = 0.15
COMPETITOR_SHARE_SLOPE = 0.35  # total competitor share = base + slope * competitor intensity
COMPETITOR_SHARE_ADJUSTMENT = 0.1
COMPETITOR_DRIFT = 0.1
COMPETITOR_MIN_CASH_TO_ACT = 0.1
COMPETITOR_ACTION_COST = 0.05
COMPETITOR_CASH_RECOVERY = 0.01
COMPETITOR_PRICE_FLOOR = 0.6  # of the archetype's anchor price

# Events
MAX_NEW_EVENTS_PER_TURN = 2

# Agent effects: last-resort caps applied by the engine, whatever the source.
AGENT_DEMAND_CAP = 0.3
AGENT_SENTIMENT_CAP = 0.2

# Decisions
MIN_PRICE = 100  # one rupee
MAX_PRICE = 1_000_000_000
MAX_EMPLOYEES = 10_000
