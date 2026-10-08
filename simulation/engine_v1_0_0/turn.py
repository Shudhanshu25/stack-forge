"""run_turn: one month of the simulation, in the order of operations from the specification."""

import math

from . import profiles as pf
from .agents import applied_agent_modifiers, founder_moves, rule_based_effects
from .competitors import (
    competitor_intensity,
    initial_competitors,
    react,
    total_competitor_share,
)
from .decisions import DecisionValidationError, apply_decisions, validate_decisions
from .events import advance, combined_effects, resolve_events
from .finance import compute_financials
from .market import MarketConditions, paid_weights, segment_outcome
from .models import (
    AgentEffects,
    CustomerSegment,
    Decision,
    DecisionStatus,
    Expenses,
    MarketEvent,
    SimulationState,
    SimulationTurn,
    StartupConfiguration,
)
from .rng import MAX_SEED, rng_for
from .version import ENGINE_VERSION


class EngineInputError(ValueError):
    """The state, turn number or seed cannot produce a turn."""


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _check_seed(seed: int) -> None:
    if not isinstance(seed, int) or isinstance(seed, bool) or not 0 <= seed <= MAX_SEED:
        raise EngineInputError(f"seed must be an integer between 0 and {MAX_SEED}")


def create_initial_state(config: StartupConfiguration, seed: int) -> SimulationState:
    """Turn 0: the startup before any decisions, with competitors drawn from the seed."""
    _check_seed(seed)
    p = config.parameters
    competitors = initial_competitors(config, rng_for(seed, 0, "competitors"))
    segments = [
        CustomerSegment(
            type=segment_type,
            population=round(config.market_size * getattr(p.segment_mix, profile.mix_key)),
            customers=0,
            price_sensitivity=profile.price_sensitivity,
            quality_sensitivity=profile.quality_sensitivity,
            brand_loyalty=profile.brand_loyalty,
            conversion_rate=0.0,
            churn_probability=0.0,
        )
        for segment_type, profile in pf.SEGMENTS.items()
    ]
    return SimulationState(
        turn=0,
        cash=config.initial_capital,
        revenue=0,
        expenses=Expenses(total=0, variable=0, fixed=0, marketing=0, employees=0, product=0),
        profit=0,
        customers=0,
        new_customers=0,
        churned_customers=0,
        price=config.initial_price,
        marketing_budget=0,
        employees=p.initial_employees,
        product_quality=p.initial_product_quality,
        market_share=0.0,
        customer_satisfaction=pf.INITIAL_SATISFACTION,
        brand_awareness=p.initial_brand_awareness,
        competitor_pressure=round(competitor_intensity(config), 6),
        customer_segments=segments,
        competitors=competitors,
        active_events=[],
    )


def seasonality(config: StartupConfiguration, month: int) -> float:
    """Demand multiplier for a month index (0 = January). Unwraps the generated item model."""
    item = config.parameters.seasonality[month]
    return float(getattr(item, "root", item))


def invest_in_quality(quality: float, investment: int, config: StartupConfiguration) -> float:
    """Diminishing returns: investment closes part of the gap to perfect quality."""
    scale = max(1, config.parameters.salary_per_employee_monthly * pf.QUALITY_SCALE_SALARIES)
    return quality + (1 - quality) * (1 - math.exp(-investment / scale))


def rule_based_agent_effects(
    state: SimulationState, decisions: list[Decision], config: StartupConfiguration
) -> AgentEffects:
    """The rule-based customer and competitor effects run_turn uses when given none.

    Decisions must already be valid. Exposed so the pipeline can fall back per agent.
    """
    applied = apply_decisions(state, decisions)
    quality = invest_in_quality(state.product_quality, applied.product_investment, config)
    return rule_based_effects(state, applied, quality, state.competitors)


def turn_events(
    state: SimulationState, config: StartupConfiguration, seed: int, turn_number: int
) -> list[MarketEvent]:
    """Events that start in this turn. Uses the same seeded stream as run_turn, so the
    simulation core applies exactly these."""
    _check_seed(seed)
    _, started = resolve_events(
        state.active_events, config, turn_number, rng_for(seed, turn_number, "events")
    )
    return started


def run_turn(
    state: SimulationState,
    decisions: list[Decision],
    config: StartupConfiguration,
    seed: int,
    turn_number: int,
    agent_effects: AgentEffects | None = None,
) -> SimulationTurn:
    """Computes one turn. Pure: same inputs, same record.

    Raises DecisionValidationError if any decision is rejected and EngineInputError if the
    turn cannot run (wrong turn number, bad seed, bankrupt startup).
    """
    _check_seed(seed)
    if turn_number != state.turn + 1:
        raise EngineInputError(f"turn_number must be {state.turn + 1}, got {turn_number}")
    if state.cash < 0:
        raise EngineInputError("the startup is bankrupt; no further turns can be played")
    p = config.parameters
    mods = config.difficulty_modifiers
    model = pf.BUSINESS_MODELS[config.business_model]

    # 1. Validate decisions.
    results = validate_decisions(state, decisions, config)
    rejected = [r for r in results if r.status == DecisionStatus.rejected]
    if rejected:
        raise DecisionValidationError(rejected)

    # 2. Apply decisions. Product investment raises quality immediately.
    applied = apply_decisions(state, decisions)
    invested_quality = invest_in_quality(state.product_quality, applied.product_investment, config)
    if agent_effects is None:
        agent_effects = rule_based_effects(state, applied, invested_quality, state.competitors)
    agent_demand, agent_sentiment = applied_agent_modifiers(agent_effects)

    # 3. Resolve events.
    active, started = resolve_events(
        state.active_events, config, turn_number, rng_for(seed, turn_number, "events")
    )
    fx = combined_effects(active)

    # 4. Competitor reactions.
    moves = founder_moves(state, applied, invested_quality)
    competitors, actions = react(
        state.competitors,
        agent_effects.competitor.competitor_threat,
        moves,
        applied.price,
        config,
        rng_for(seed, turn_number, "competitors"),
    )

    # 5-6. Demand, acquisition and churn per segment.
    month = (turn_number - 1) % 12
    quality = _clamp(invested_quality + fx.product_quality, pf.MIN_QUALITY, 1.0)
    awareness = _clamp(state.brand_awareness + fx.brand_awareness)
    satisfaction = _clamp(state.customer_satisfaction + agent_sentiment + fx.customer_satisfaction)
    capacity = max(1, applied.employees * p.customers_per_employee)
    lo, hi = pf.DEMAND_MULTIPLIER_BOUNDS
    conditions = MarketConditions(
        price=applied.price,
        quality=quality,
        awareness=awareness,
        satisfaction=satisfaction,
        marketing_budget=applied.marketing_budget,
        cac=max(1.0, p.base_cac * mods.cac_multiplier * (1 + fx.cac) * (1 + fx.marketing_cost)),
        conversion_rate=p.base_conversion_rate * mods.conversion_multiplier,
        churn_rate=p.base_churn_rate * mods.churn_multiplier,
        elasticity=p.price_elasticity * model.elasticity_multiplier,
        demand_multiplier=_clamp(
            seasonality(config, month) * (1 + fx.demand) * (1 + agent_demand), lo, hi
        ),
        churn_event_multiplier=max(0.0, 1 + fx.churn),
        competitor_pressure=state.competitor_pressure,
        service_load=state.customers / capacity,
        organic_multiplier=model.organic_multiplier,
        model_churn_multiplier=model.churn_multiplier,
        paid_weights=paid_weights(state.customer_segments),
        saturation_spend=max(1.0, p.base_cac * config.market_size * pf.MARKETING_SATURATION_FACTOR),
    )
    demand_rng = rng_for(seed, turn_number, "demand")
    outcomes = [
        segment_outcome(s, competitors, conditions, config, demand_rng)
        for s in state.customer_segments
    ]
    customers = sum(o.segment.customers for o in outcomes)

    # 7-11. Revenue, costs, profit and cash.
    purchase_multiplier = seasonality(config, month) if model.seasonal_purchases else 1.0
    fin = compute_financials(customers, applied, p, purchase_multiplier, fx)
    cash = state.cash + fin.profit

    # 12. Market state.
    growth = 1 + p.market_growth_rate_monthly
    segments = [
        o.segment.model_copy(
            update={"population": max(o.segment.customers, round(o.segment.population * growth))}
        )
        for o in outcomes
    ]
    total_population = sum(s.population for s in segments) or 1
    start_population = sum(s.population for s in state.customer_segments) or 1
    market_share = customers / total_population

    target_total = total_competitor_share(config)
    shares = []
    for i, c in enumerate(competitors):
        target = (
            sum(o.segment.population * o.competitor_shares[i] for o in outcomes)
            / start_population
            * target_total
        )
        shares.append(c.market_share + pf.COMPETITOR_SHARE_ADJUSTMENT * (target - c.market_share))
    room = 1 - market_share
    if sum(shares) > room:  # founder growth comes out of competitors' share
        shares = [s * room / sum(shares) for s in shares]
    competitors = [
        c.model_copy(update={"market_share": round(s, 6)})
        for c, s in zip(competitors, shares, strict=True)
    ]
    avg_founder_share = (
        sum(o.segment.population * o.founder_share for o in outcomes) / start_population
    )
    pressure = competitor_intensity(config) * (1 - avg_founder_share)

    awareness_scale = max(1.0, p.base_cac * config.market_size * pf.AWARENESS_SCALE_FACTOR)
    awareness_next = _clamp(
        awareness * (1 - pf.AWARENESS_DECAY)
        + (1 - awareness) * (1 - math.exp(-applied.marketing_budget / awareness_scale))
        + (1 - awareness) * pf.AWARENESS_WORD_OF_MOUTH * market_share
    )
    value_for_money = _clamp(1.5 - applied.price / max(1, p.reference_price))
    service_penalty = min(0.3, max(0.0, customers / capacity - 1) * 0.3)
    satisfaction_target = _clamp(0.2 + 0.6 * quality + 0.2 * value_for_money - service_penalty)
    satisfaction_next = _clamp(
        satisfaction + pf.SATISFACTION_ADJUSTMENT * (satisfaction_target - satisfaction)
    )
    team_ratio = applied.employees / max(1, p.initial_employees)
    quality_next = _clamp(
        quality - pf.QUALITY_DECAY + pf.QUALITY_TEAM_EFFECT * (min(team_ratio, 2.0) - 1),
        pf.MIN_QUALITY,
        1.0,
    )

    # 13. Build the record.
    state_after = SimulationState(
        turn=turn_number,
        cash=cash,
        revenue=fin.revenue,
        expenses=fin.expenses,
        profit=fin.profit,
        customers=customers,
        new_customers=sum(o.new_customers for o in outcomes),
        churned_customers=sum(o.churned_customers for o in outcomes),
        price=applied.price,
        marketing_budget=applied.marketing_budget,
        employees=applied.employees,
        product_quality=round(quality_next, 6),
        market_share=round(market_share, 6),
        customer_satisfaction=round(satisfaction_next, 6),
        brand_awareness=round(awareness_next, 6),
        competitor_pressure=round(_clamp(pressure), 6),
        customer_segments=segments,
        competitors=competitors,
        active_events=advance(active),
    )
    return SimulationTurn(
        turn_number=turn_number,
        state_before=state.model_copy(deep=True),
        decisions=[d.model_copy() for d in decisions],
        events=started,
        competitor_actions=actions,
        agent_effects=agent_effects,
        state_after=state_after,
        engine_version=ENGINE_VERSION,
    )
