"""preview: the direction and rough size of each decision's effect, without recording anything."""

from .decisions import validate_decisions
from .models import (
    Decision,
    DecisionPreview,
    DecisionStatus,
    Direction,
    EstimatedEffect,
    Magnitude,
    SimulationState,
    StartupConfiguration,
)
from .turn import run_turn

# Metric -> smallest base value used as the denominator, so changes near zero are not inflated.
METRIC_FLOORS: dict[str, float] = {
    "revenue": 100_000,  # ₹1,000
    "profit": 100_000,
    "cash": 100_000,
    "customers": 10,
    "newCustomers": 10,
    "churnedCustomers": 10,
    "marketShare": 0.001,
    "customerSatisfaction": 0.05,
    "brandAwareness": 0.05,
    "productQuality": 0.05,
}
# Relative change thresholds: below the first is no effect, then small, medium, large.
THRESHOLDS = (0.005, 0.05, 0.15)


def _metrics(state: SimulationState) -> dict[str, float]:
    dumped = state.model_dump(by_alias=True)
    return {m: float(dumped[m]) for m in METRIC_FLOORS}


def compare(base: SimulationState, other: SimulationState) -> list[EstimatedEffect]:
    """Bins each metric's change from base to other into a direction and magnitude."""
    before, after = _metrics(base), _metrics(other)
    effects = []
    for metric, floor in METRIC_FLOORS.items():
        diff = after[metric] - before[metric]
        relative = abs(diff) / max(abs(before[metric]), floor)
        if relative < THRESHOLDS[0]:
            direction, magnitude = Direction.flat, Magnitude.none
        else:
            direction = Direction.up if diff > 0 else Direction.down
            magnitude = (
                Magnitude.small
                if relative < THRESHOLDS[1]
                else Magnitude.medium
                if relative < THRESHOLDS[2]
                else Magnitude.large
            )
        effects.append(EstimatedEffect(metric=metric, direction=direction, magnitude=magnitude))
    return effects


def preview(
    state: SimulationState,
    decisions: list[Decision],
    config: StartupConfiguration,
    seed: int,
    turn_number: int,
) -> DecisionPreview:
    """Runs the turn with and without the decisions, using the same seed, and compares.

    Because the draw sequence never depends on decisions, the baseline and each variant see
    the same events and noise, so differences come from the decisions. Rejected decisions are
    reported rather than raised. Agent effects are rule-based.
    """
    results = validate_decisions(state, decisions, config)
    baseline = run_turn(state, [], config, seed, turn_number).state_after
    accepted = [r.decision for r in results if r.status == DecisionStatus.accepted]
    with_effects = []
    for result in results:
        if result.status == DecisionStatus.accepted:
            alone = run_turn(state, [result.decision], config, seed, turn_number).state_after
            result = result.model_copy(update={"effects": compare(baseline, alone)})
        with_effects.append(result)
    combined = run_turn(state, accepted, config, seed, turn_number).state_after
    return DecisionPreview(
        turn_number=turn_number,
        label="Simulation estimate",
        decision_results=with_effects,
        combined_effects=compare(baseline, combined),
    )
