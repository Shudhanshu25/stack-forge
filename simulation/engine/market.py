"""Customer market: per-segment choice shares, acquisition and churn (cohorts, not individuals)."""

import math
import random
from dataclasses import dataclass

from . import profiles as pf
from .models import Competitor, CustomerSegment, StartupConfiguration
from .rng import noise_factor


@dataclass(frozen=True)
class Offer:
    price: int
    quality: float
    visibility: float  # founder: brand awareness; competitor: from marketing power


def competitor_offer(c: Competitor) -> Offer:
    return Offer(c.price, c.product_quality, 0.3 + 0.7 * c.marketing_power)


def choice_shares(
    profile: pf.SegmentProfile,
    offers: list[Offer],
    reference_price: int,
    elasticity: float,
) -> list[float]:
    """Multinomial-logit share of each offer's appeal within a segment (sums to 1).

    Utility = -a * ln(price / fair price) + b * 4 * (quality - 0.5) + w * ln(0.05 + visibility),
    where the fair price is reference price * willingness to pay, a = elasticity * (0.5 +
    price sensitivity) and b = quality sensitivity.
    """
    fair_price = max(1.0, reference_price * profile.willingness_to_pay)
    a = elasticity * (0.5 + profile.price_sensitivity)
    b = profile.quality_sensitivity * pf.QUALITY_UTILITY_SCALE
    utilities = [
        -a * math.log(max(1, o.price) / fair_price)
        + b * (o.quality - 0.5)
        + pf.VISIBILITY_WEIGHT * math.log(0.05 + o.visibility)
        for o in offers
    ]
    top = max(utilities)
    weights = [math.exp(u - top) for u in utilities]
    total = sum(weights)
    return [w / total for w in weights]


@dataclass(frozen=True)
class MarketConditions:
    """Everything segment demand depends on this turn."""

    price: int
    quality: float
    awareness: float
    satisfaction: float
    marketing_budget: int
    cac: float  # effective paise per acquired customer at parity
    conversion_rate: float
    churn_rate: float
    elasticity: float
    demand_multiplier: float
    churn_event_multiplier: float
    competitor_pressure: float  # start of turn
    service_load: float  # customers per unit of support capacity
    organic_multiplier: float
    model_churn_multiplier: float
    paid_weights: dict[str, float]  # share of paid leads reaching each segment
    saturation_spend: float


@dataclass(frozen=True)
class SegmentOutcome:
    segment: CustomerSegment
    new_customers: int
    churned_customers: int
    founder_share: float
    competitor_shares: list[float]


def segment_outcome(
    segment: CustomerSegment,
    competitors: list[Competitor],
    conditions: MarketConditions,
    config: StartupConfiguration,
    rng: random.Random,
) -> SegmentOutcome:
    """New and churned customers in one segment. Always draws two normals (four uniforms)."""
    profile = pf.SEGMENTS[segment.type]
    acquisition_noise = noise_factor(rng, pf.DEMAND_NOISE_SIGMA)
    churn_noise = noise_factor(rng, pf.CHURN_NOISE_SIGMA)

    reference = config.parameters.reference_price
    offers = [
        Offer(conditions.price, conditions.quality, conditions.awareness),
        *(competitor_offer(c) for c in competitors),
    ]
    shares = choice_shares(profile, offers, reference, conditions.elasticity)
    founder_share = shares[0]
    attractiveness = founder_share * len(offers)  # 1.0 at parity with every competitor

    population, customers = segment.population, segment.customers
    potential = max(0, population - customers)
    reach = potential / population if population else 0.0

    # Paid acquisition: spend / CAC at parity, with diminishing returns on large budgets.
    spend = conditions.marketing_budget
    effective_spend = spend / (1 + spend / conditions.saturation_spend)
    paid = (
        effective_spend
        * conditions.paid_weights[profile.mix_key]
        / conditions.cac
        * attractiveness
        * reach
    )
    conversion = min(1.0, conditions.conversion_rate * profile.conversion_multiplier)
    organic = (
        potential
        * conversion
        * conditions.awareness
        * founder_share
        * conditions.organic_multiplier
        * pf.ORGANIC_EVALUATION_RATE
    )
    referrals = customers * pf.REFERRAL_RATE * max(0.0, conditions.satisfaction - 0.5) * 2
    expected_new = (paid + organic + referrals) * conditions.demand_multiplier
    expected_new = min(expected_new, potential * pf.MAX_ACQUISITION_SHARE_OF_POTENTIAL)
    new = min(potential, max(0, round(expected_new * acquisition_noise)))

    churn_rate = segment_churn_rate(profile, competitors, conditions, reference)
    churned = min(customers, max(0, round(customers * churn_rate * churn_noise)))

    updated = segment.model_copy(
        update={
            "customers": customers - churned + new,
            "conversion_rate": round(min(1.0, conversion * founder_share), 6),
            "churn_probability": round(churn_rate, 6),
        }
    )
    return SegmentOutcome(updated, new, churned, founder_share, shares[1:])


def segment_churn_rate(
    profile: pf.SegmentProfile,
    competitors: list[Competitor],
    conditions: MarketConditions,
    reference_price: int,
) -> float:
    """Monthly churn probability for the segment's customers."""
    price_ratio = conditions.price / max(1.0, reference_price * profile.willingness_to_pay)
    price_pressure = min(3.0, max(0.5, price_ratio ** (0.8 * profile.price_sensitivity)))
    avg_quality = (
        sum(c.product_quality for c in competitors) / len(competitors)
        if competitors
        else conditions.quality
    )
    quality_pressure = min(
        2.0, max(0.5, 1 + 2 * profile.quality_sensitivity * (avg_quality - conditions.quality))
    )
    satisfaction_factor = 1.5 - conditions.satisfaction
    loyalty_factor = 1 + (1 - profile.brand_loyalty) * conditions.competitor_pressure * 0.5
    service_factor = 1 + 0.5 * min(1.0, max(0.0, conditions.service_load - 1))
    rate = (
        conditions.churn_rate
        * profile.churn_multiplier
        * conditions.model_churn_multiplier
        * price_pressure
        * quality_pressure
        * satisfaction_factor
        * loyalty_factor
        * service_factor
        * conditions.churn_event_multiplier
    )
    return min(pf.MAX_CHURN_RATE, max(0.0, rate))


def paid_weights(segments: list[CustomerSegment]) -> dict[str, float]:
    raw = {
        pf.SEGMENTS[s.type].mix_key: s.population * pf.SEGMENTS[s.type].conversion_multiplier
        for s in segments
    }
    total = sum(raw.values())
    return {k: (v / total if total else 0.0) for k, v in raw.items()}
