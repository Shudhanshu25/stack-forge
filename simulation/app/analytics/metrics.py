"""Derived business metrics, computed from engine state. Definitions match the UI glossary."""

import engine
from engine.models import ActiveEvent, MarketEvent, SimulationState, StartupConfiguration
from ml.features import churn_rate


def gross_margin(state: SimulationState) -> float | None:
    """(revenue - variable costs) / revenue."""
    if state.revenue <= 0:
        return None
    return round((state.revenue - state.expenses.variable) / state.revenue, 6)


def burn_rate(state: SimulationState) -> int:
    """Cash lost this turn, in paise; 0 when profitable."""
    return max(0, -state.profit)


def runway_months(state: SimulationState) -> float | None:
    """Months of cash left at this turn's burn; None when not burning or already out of cash."""
    burn = burn_rate(state)
    if burn == 0 or state.cash < 0:
        return None
    return round(state.cash / burn, 2)


def cac(state: SimulationState) -> int | None:
    """Marketing spend per new customer, paise."""
    if state.new_customers <= 0:
        return None
    return round(state.expenses.marketing / state.new_customers)


def arpu(state: SimulationState) -> int | None:
    """Revenue per customer this turn, paise."""
    if state.customers <= 0:
        return None
    return round(state.revenue / state.customers)


def ltv(state: SimulationState) -> int | None:
    """Lifetime value: ARPU x gross margin / monthly churn rate, paise."""
    per_customer, margin, churn = arpu(state), gross_margin(state), churn_rate(state)
    if per_customer is None or margin is None or churn <= 0:
        return None
    return max(0, round(per_customer * margin / churn))


def _demand_effect(events: list[MarketEvent]) -> float:
    return sum(e.effects.demand or 0.0 for e in events)


def demand_index(
    config: StartupConfiguration, turn: int, events: list[MarketEvent], eng=engine
) -> float:
    """Seasonality for the turn's month times the active events' demand effects (1 = normal),
    using the simulation's engine version."""
    month = (turn - 1) % 12
    return round(max(0.0, eng.seasonality(config, month) * (1 + _demand_effect(events))), 4)


def events_during(state_before: SimulationState, started: list[MarketEvent]) -> list[MarketEvent]:
    return [a.event for a in state_before.active_events] + list(started)


def still_active(active: list[ActiveEvent]) -> list[MarketEvent]:
    return [a.event for a in active]
