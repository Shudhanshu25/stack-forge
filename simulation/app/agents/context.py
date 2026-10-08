"""Structured, compact input for the LLM agents and the advisor. Money is in whole rupees."""

from stackforge_shared.models.pipeline_turn_request_schema import PipelineTurnRequest
from stackforge_shared.models.startup_profile_schema import StartupProfile
from stackforge_shared.models.turn_summary_schema import TurnSummary

from engine.models import Decision, SimulationState, StartupConfiguration


def rupees(paise: int) -> int:
    return round(paise / 100)


def percent(rate: float) -> float:
    return round(rate * 100, 2)


def decision_view(decisions: list[Decision], state: SimulationState) -> list[dict]:
    previous = {
        "PRICING": rupees(state.price),
        "MARKETING": rupees(state.marketing_budget),
        "HIRING": state.employees,
    }
    out = []
    for d in decisions:
        kind = d.type.value
        value = d.value if kind == "HIRING" else rupees(d.value)
        entry = {"type": kind, "value": value}
        if kind in previous:
            entry["previous"] = previous[kind]
        out.append(entry)
    return out


def state_view(state: SimulationState, config: StartupConfiguration | None = None) -> dict:
    view: dict = {"turn": state.turn}
    if config is not None:
        view |= {
            "industry": config.industry.value,
            "businessModel": config.business_model.value,
            "referencePriceRupees": rupees(config.parameters.reference_price),
        }
    return view | {
        "cashRupees": rupees(state.cash),
        "revenueRupees": rupees(state.revenue),
        "expensesRupees": rupees(state.expenses.total),
        "profitRupees": rupees(state.profit),
        "customers": state.customers,
        "newCustomers": state.new_customers,
        "churnedCustomers": state.churned_customers,
        "priceRupees": rupees(state.price),
        "marketingBudgetRupees": rupees(state.marketing_budget),
        "employees": state.employees,
        "productQualityPercent": percent(state.product_quality),
        "customerSatisfactionPercent": percent(state.customer_satisfaction),
        "brandAwarenessPercent": percent(state.brand_awareness),
        "marketSharePercent": percent(state.market_share),
        "competitorPressurePercent": percent(state.competitor_pressure),
    }


def market_view(state: SimulationState) -> dict:
    return {
        "segments": [
            {
                "segment": s.type.value,
                "population": s.population,
                "customers": s.customers,
                "monthlyChurnPercent": percent(s.churn_probability),
            }
            for s in state.customer_segments
        ],
        "activeEvents": [
            {"type": a.event.type.value, "title": a.event.title, "turnsLeft": a.remaining_turns}
            for a in state.active_events
        ],
    }


def competitors_view(state: SimulationState) -> list[dict]:
    return [
        {
            "name": c.name,
            "archetype": c.archetype.value,
            "priceRupees": rupees(c.price),
            "productQualityPercent": percent(c.product_quality),
            "marketingPowerPercent": percent(c.marketing_power),
            "marketSharePercent": percent(c.market_share),
        }
        for c in state.competitors
    ]


def memory_view(memory: list[TurnSummary]) -> list[dict]:
    return [
        {
            "turn": m.turn_number,
            "decisions": [{"type": d.type.value, "value": d.value} for d in m.decisions],
            "revenueRupees": rupees(m.revenue),
            "profitRupees": rupees(m.profit),
            "cashRupees": rupees(m.cash),
            "customers": m.customers,
            "newCustomers": m.new_customers,
            "churnedCustomers": m.churned_customers,
            "customerSatisfactionPercent": percent(m.customer_satisfaction),
            "events": [e.value for e in m.events],
            **({"agentNotes": m.agent_summary} if m.agent_summary else {}),
        }
        for m in memory
    ]


#: Founder-written text is cut to these lengths before it reaches any prompt (the schemas allow
#: more for display); it is always passed inside the prompt's <data> block.
MAX_NAME = 80
MAX_DESCRIPTION = 300


def profile_view(profile: StartupProfile | None) -> dict:
    """The founder's own words about the startup: untrusted, length-limited data."""
    if profile is None:
        return {}
    view = {"name": profile.name[:MAX_NAME], "productName": profile.product_name[:MAX_NAME]}
    if profile.product_description:
        view["productDescription"] = profile.product_description[:MAX_DESCRIPTION]
    return view


def agent_context(request: PipelineTurnRequest) -> dict:
    """The structured state the spec gives agents: startup, market, competitors, decision."""
    return {
        "startup": profile_view(request.startup_profile)
        | state_view(request.state, request.configuration),
        "market": market_view(request.state),
        "competitors": competitors_view(request.state),
        "decision": decision_view(request.decisions, request.state),
        "recentTurns": memory_view(request.memory or []),
    }
