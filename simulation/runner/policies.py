"""Scripted founder decision policies for command-line runs and dataset generation.

A policy proposes decisions; only those the engine accepts are played, so every policy is
valid by construction.
"""

from collections.abc import Callable

from engine import validate_decisions
from engine.models import (
    Decision,
    DecisionStatus,
    DecisionType,
    SimulationState,
    StartupConfiguration,
)
from engine.rng import rng_for

Policy = Callable[[SimulationState, StartupConfiguration, int, int], list[Decision]]


def _round_thousand_rupees(paise: float) -> int:
    return max(0, round(paise / 100_000) * 100_000)


def steady(state: SimulationState, config: StartupConfiguration, turn: int, seed: int):
    """Spend 5% of initial capital on marketing every month; change nothing else."""
    budget = _round_thousand_rupees(config.initial_capital * 0.05)
    if state.marketing_budget == budget:
        return []
    return [Decision(type=DecisionType.marketing, value=budget)]


def growth(state: SimulationState, config: StartupConfiguration, turn: int, seed: int):
    """Reinvest: marketing at 8% of cash, hire when support is stretched, invest in product."""
    p = config.parameters
    decisions = [
        Decision(type=DecisionType.marketing, value=_round_thousand_rupees(state.cash * 0.08))
    ]
    if state.customers > 0.8 * state.employees * p.customers_per_employee:
        decisions.append(Decision(type=DecisionType.hiring, value=state.employees + 1))
    if turn % 2 == 0:
        decisions.append(
            Decision(
                type=DecisionType.product_quality,
                value=_round_thousand_rupees(state.cash * 0.02),
            )
        )
    return decisions


def random_policy(state: SimulationState, config: StartupConfiguration, turn: int, seed: int):
    """Random but plausible decisions, from a seeded generator (for training data)."""
    rng = rng_for(seed, turn, "policy")
    reference = config.parameters.reference_price
    draws = [rng.random() for _ in range(8)]  # fixed number of draws per turn
    decisions = []
    if draws[0] < 0.4:
        price = state.price * (0.8 + 0.4 * draws[1])
        decisions.append(
            Decision(
                type=DecisionType.pricing,
                value=round(min(2 * reference, max(0.5 * reference, price))),
            )
        )
    if draws[2] < 0.6:
        budget = _round_thousand_rupees(max(0, state.cash) * 0.12 * draws[3])
        decisions.append(Decision(type=DecisionType.marketing, value=budget))
    if draws[4] < 0.2:
        decisions.append(
            Decision(type=DecisionType.hiring, value=state.employees + 1 + int(draws[5] * 2))
        )
    if draws[6] < 0.3:
        investment = _round_thousand_rupees(max(0, state.cash) * 0.04 * draws[7])
        if investment > 0:
            decisions.append(Decision(type=DecisionType.product_quality, value=investment))
    return decisions


POLICIES: dict[str, Policy] = {"steady": steady, "growth": growth, "random": random_policy}


def accepted_only(
    state: SimulationState, config: StartupConfiguration, decisions: list[Decision]
) -> list[Decision]:
    results = validate_decisions(state, decisions, config)
    return [r.decision for r in results if r.status == DecisionStatus.accepted]
