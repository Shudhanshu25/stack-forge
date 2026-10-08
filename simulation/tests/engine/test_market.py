import pytest

from engine import profiles as pf
from engine.market import (
    MarketConditions,
    Offer,
    choice_shares,
    segment_churn_rate,
    segment_outcome,
)
from engine.models import CustomerSegmentType
from engine.rng import rng_for

PRICE_SENSITIVE = pf.SEGMENTS[CustomerSegmentType.price_sensitive]
PREMIUM = pf.SEGMENTS[CustomerSegmentType.premium]


def conditions(**overrides) -> MarketConditions:
    base = dict(
        price=50_000,
        quality=0.6,
        awareness=0.65,
        satisfaction=0.6,
        marketing_budget=0,
        cac=100_000.0,
        conversion_rate=0.0,
        churn_rate=0.05,
        elasticity=1.2,
        demand_multiplier=1.0,
        churn_event_multiplier=1.0,
        competitor_pressure=0.5,
        service_load=0.5,
        organic_multiplier=1.0,
        model_churn_multiplier=1.0,
        paid_weights={k.mix_key: 1.0 for k in pf.SEGMENTS.values()},
        saturation_spend=1e15,
    )
    return MarketConditions(**{**base, **overrides})


def test_choice_shares_sum_to_one_and_respond_to_price_and_quality() -> None:
    rival = Offer(50_000, 0.6, 0.5)
    base = choice_shares(PRICE_SENSITIVE, [Offer(50_000, 0.6, 0.5), rival], 50_000, 1.2)
    assert sum(base) == pytest.approx(1.0)
    assert base[0] == pytest.approx(0.5)
    cheaper = choice_shares(PRICE_SENSITIVE, [Offer(40_000, 0.6, 0.5), rival], 50_000, 1.2)
    better = choice_shares(PRICE_SENSITIVE, [Offer(50_000, 0.8, 0.5), rival], 50_000, 1.2)
    assert cheaper[0] > base[0]
    assert better[0] > base[0]


def test_price_sensitive_segments_react_more_to_price_than_premium() -> None:
    offers = [Offer(60_000, 0.6, 0.5), Offer(50_000, 0.6, 0.5)]
    assert (
        choice_shares(PRICE_SENSITIVE, offers, 50_000, 1.2)[0]
        < choice_shares(PREMIUM, offers, 50_000, 1.2)[0]
    )


def _segment(state, kind=CustomerSegmentType.price_sensitive, **update):
    seg = next(s for s in state.customer_segments if s.type == kind)
    return seg.model_copy(update={"population": 100_000, "customers": 0, **update})


def _parity_competitors(state):
    # Same price, quality and visibility (0.3 + 0.7 * 0.5 = 0.65) as the founder.
    return [
        c.model_copy(update={"price": 50_000, "product_quality": 0.6, "marketing_power": 0.5})
        for c in state.competitors
    ]


def test_paid_acquisition_equals_spend_over_cac_at_parity(state, config, monkeypatch) -> None:
    monkeypatch.setattr(pf, "DEMAND_NOISE_SIGMA", 0.0)
    config = config.model_copy(
        update={"parameters": config.parameters.model_copy(update={"reference_price": 50_000})}
    )
    outcome = segment_outcome(
        _segment(state),
        _parity_competitors(state),
        conditions(marketing_budget=10_000_000),
        config,
        rng_for(1, 1, "t"),
    )
    assert outcome.founder_share == pytest.approx(1 / 5)
    assert outcome.new_customers == 100  # ₹1,00,000 / ₹1,000 CAC


def test_acquisition_never_exceeds_the_cap_on_potential(state, config) -> None:
    seg = _segment(state, population=1_000, customers=900)
    outcome = segment_outcome(
        seg, state.competitors, conditions(marketing_budget=10**12), config, rng_for(1, 1, "t")
    )
    assert outcome.new_customers <= 100 * pf.MAX_ACQUISITION_SHARE_OF_POTENTIAL * 1.5
    assert outcome.segment.customers <= seg.population


def test_churn_rises_with_price_and_falls_with_satisfaction(state) -> None:
    comps = state.competitors
    base = segment_churn_rate(PRICE_SENSITIVE, comps, conditions(), 50_000)
    assert segment_churn_rate(PRICE_SENSITIVE, comps, conditions(price=80_000), 50_000) > base
    assert segment_churn_rate(PRICE_SENSITIVE, comps, conditions(satisfaction=0.9), 50_000) < base
    overloaded = segment_churn_rate(PRICE_SENSITIVE, comps, conditions(service_load=3), 50_000)
    assert overloaded > base


def test_churn_rate_is_capped(state) -> None:
    rate = segment_churn_rate(
        PRICE_SENSITIVE,
        state.competitors,
        conditions(churn_rate=1.0, churn_event_multiplier=4.0, satisfaction=0.0),
        50_000,
    )
    assert rate == pf.MAX_CHURN_RATE


def test_churned_customers_never_exceed_customers(state, config) -> None:
    seg = _segment(state, customers=10)
    outcome = segment_outcome(
        seg,
        state.competitors,
        conditions(churn_rate=1.0, churn_event_multiplier=4.0),
        config,
        rng_for(1, 1, "t"),
    )
    assert 0 <= outcome.churned_customers <= 10
