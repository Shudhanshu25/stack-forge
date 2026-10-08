"""Builds everything the dashboard and analytics views show from stored turn records.

Python calculates: Node only gathers the records and passes this result through.
"""

from stackforge_shared.models.engine_analytics_request_schema import EngineAnalyticsRequest
from stackforge_shared.models.simulation_analytics_schema import (
    ActiveEventSummary,
    CompetitorPoint,
    DecisionAnalysis,
    ForecastAccuracy,
    ForecastPoint,
    ForecastValues,
    Kpi,
    Kpis,
    MarketSnapshot,
    PreviewedDecision,
    SegmentPoint,
    SimulationAnalytics,
    TurnMetrics,
)

from app.analytics import metrics as m
from app.analytics.location import location_impact
from app.services.engine_service import engine_for
from engine.models import (
    Decision,
    DecisionType,
    Direction,
    SimulationState,
    SimulationTurn,
    StartupConfiguration,
)
from engine.preview import compare
from ml.features import churn_rate


def turn_metrics(state: SimulationState, demand: float) -> TurnMetrics:
    e = state.expenses
    return TurnMetrics(
        turn=state.turn,
        revenue=state.revenue,
        expenses_total=e.total,
        variable_costs=e.variable,
        fixed_costs=e.fixed,
        marketing_costs=e.marketing,
        employee_costs=e.employees,
        product_costs=e.product,
        profit=state.profit,
        cash=state.cash,
        customers=state.customers,
        new_customers=state.new_customers,
        churned_customers=state.churned_customers,
        churn_rate=round(churn_rate(state), 6),
        market_share=state.market_share,
        customer_satisfaction=state.customer_satisfaction,
        competitor_pressure=state.competitor_pressure,
        brand_awareness=state.brand_awareness,
        product_quality=state.product_quality,
        price=state.price,
        marketing_budget=state.marketing_budget,
        employees=state.employees,
        gross_margin=m.gross_margin(state),
        burn_rate=m.burn_rate(state),
        runway_months=m.runway_months(state),
        cac=m.cac(state),
        ltv=m.ltv(state),
        arpu=m.arpu(state),
        demand_index=demand,
    )


def _kpi(value: float, previous: float | None) -> Kpi:
    return Kpi(
        value=value,
        previous=previous,
        change=None if previous is None else round(value - previous, 6),
    )


def _forecasts(records: list[SimulationTurn]) -> tuple[list[ForecastPoint], ForecastAccuracy]:
    by_turn = {r.turn_number: r.state_after for r in records}
    points: list[ForecastPoint] = []
    revenue_errors, customer_errors, churn_errors = [], [], []
    for r in records:
        f = r.forecast
        if not f or not f.available:
            continue
        predicted = ForecastValues(
            revenue=f.revenue or 0, customers=f.customers or 0, churn_rate=f.churn_rate or 0.0
        )
        actual_state = by_turn.get(f.target_turn)
        actual = rev_err = cust_err = churn_err = None
        if actual_state is not None:
            actual = ForecastValues(
                revenue=actual_state.revenue,
                customers=actual_state.customers,
                churn_rate=round(churn_rate(actual_state), 6),
            )
            if actual.revenue > 0:
                rev_err = round(abs(predicted.revenue - actual.revenue) / actual.revenue * 100, 2)
                revenue_errors.append(rev_err)
            if actual.customers > 0:
                cust_err = round(
                    abs(predicted.customers - actual.customers) / actual.customers * 100, 2
                )
                customer_errors.append(cust_err)
            churn_err = round(abs(predicted.churn_rate - actual.churn_rate), 6)
            churn_errors.append(churn_err)
        points.append(
            ForecastPoint(
                target_turn=f.target_turn,
                model_version=f.model_version,
                predicted=predicted,
                actual=actual,
                revenue_error_percent=rev_err,
                customers_error_percent=cust_err,
                churn_rate_error=churn_err,
            )
        )

    def mean(xs: list[float]) -> float | None:
        return round(sum(xs) / len(xs), 4) if xs else None

    return points, ForecastAccuracy(
        pairs=len(churn_errors),
        revenue_mape=mean(revenue_errors),
        customers_mape=mean(customer_errors),
        churn_rate_mae=mean(churn_errors),
    )


def _changes_something(decision: Decision, state: SimulationState) -> bool:
    """False for decisions that only restate the current value (accepted as no-ops)."""
    current = {
        DecisionType.pricing: state.price,
        DecisionType.marketing: state.marketing_budget,
        DecisionType.hiring: state.employees,
    }
    return decision.type not in current or decision.value != current[decision.type]


def _decisions(
    records: list[SimulationTurn], config: StartupConfiguration, seed: int, eng
) -> list[DecisionAnalysis]:
    """For each turn with decisions: what the preview estimated (rules agents, same seed)
    against how each metric actually moved."""
    out = []
    for r in records:
        decisions = [d for d in r.decisions if _changes_something(d, r.state_before)]
        if not decisions:
            continue
        preview = eng.preview(r.state_before, decisions, config, seed, r.turn_number)
        actual = compare(r.state_before, r.state_after)
        moved = {e.metric: e.direction for e in actual}
        expected = [e for e in preview.combined_effects if e.direction != Direction.flat]
        agreement = (
            round(sum(moved[e.metric] == e.direction for e in expected) / len(expected), 4)
            if expected
            else None
        )
        out.append(
            DecisionAnalysis(
                turn=r.turn_number,
                decisions=[
                    PreviewedDecision(decision=d.decision, previewed=d.effects)
                    for d in preview.decision_results
                ],
                combined_preview=preview.combined_effects,
                actual=actual,
                direction_agreement=agreement,
            )
        )
    return out


def build_analytics(request: EngineAnalyticsRequest) -> SimulationAnalytics:
    eng = engine_for(request.engine_version)
    config, records = request.configuration, request.records
    states = [request.initial_state] + [r.state_after for r in records]
    demand = [m.demand_index(config, 1, m.still_active(request.initial_state.active_events), eng)]
    demand += [
        m.demand_index(config, r.turn_number, m.events_during(r.state_before, r.events), eng)
        for r in records
    ]
    series = [turn_metrics(s, d) for s, d in zip(states, demand, strict=True)]

    latest, previous = states[-1], (states[-2] if len(states) > 1 else None)
    last, prior = series[-1], (series[-2] if len(series) > 1 else None)

    def pick(attr: str):
        return getattr(prior, attr) if prior else None

    kpis = Kpis(
        cash=_kpi(last.cash, pick("cash")),
        revenue=_kpi(last.revenue, pick("revenue")),
        profit=_kpi(last.profit, pick("profit")),
        customers=_kpi(last.customers, pick("customers")),
        churn_rate=_kpi(last.churn_rate, pick("churn_rate")),
        market_share=_kpi(last.market_share, pick("market_share")),
    )
    market = MarketSnapshot(
        customer_sentiment=latest.customer_satisfaction,
        sentiment_change=None
        if previous is None
        else round(latest.customer_satisfaction - previous.customer_satisfaction, 6),
        competitor_pressure=latest.competitor_pressure,
        pressure_change=None
        if previous is None
        else round(latest.competitor_pressure - previous.competitor_pressure, 6),
        demand_index=demand[-1],
        demand_index_next=m.demand_index(
            config, latest.turn + 1, m.still_active(latest.active_events), eng
        ),
        active_events=[
            ActiveEventSummary(
                type=a.event.type,
                title=a.event.title or a.event.type.value,
                polarity=a.event.polarity,
                turns_left=a.remaining_turns,
            )
            for a in latest.active_events
        ],
    )
    segments = [
        SegmentPoint(
            turn=s.turn,
            segment=seg.type,
            customers=seg.customers,
            population=seg.population,
            churn_probability=seg.churn_probability,
            conversion_rate=seg.conversion_rate,
        )
        for s in states
        for seg in s.customer_segments
    ]
    competitors = [
        CompetitorPoint(
            turn=s.turn,
            id=c.id,
            name=c.name,
            archetype=c.archetype,
            price=c.price,
            market_share=c.market_share,
            product_quality=c.product_quality,
            marketing_power=c.marketing_power,
        )
        for s in states
        for c in s.competitors
    ]
    forecasts, accuracy = _forecasts(records)
    return SimulationAnalytics(
        current_turn=latest.turn,
        kpis=kpis,
        market=market,
        series=series,
        segments=segments,
        competitors=competitors,
        forecasts=forecasts,
        forecast_accuracy=accuracy,
        decisions=_decisions(records, config, request.seed, eng),
        location=location_impact(eng, config, records),
    )
