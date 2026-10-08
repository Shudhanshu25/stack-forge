"""Market events: sampling from the configured catalog, persistence and combined effects."""

import random
from dataclasses import dataclass

from . import profiles as pf
from .location import matches
from .models import ActiveEvent, EventPolarity, MarketEvent, StartupConfiguration


@dataclass(frozen=True)
class EventEffects:
    """Sum of the effects of every event active this turn."""

    demand: float = 0.0
    marketing_cost: float = 0.0
    cac: float = 0.0
    churn: float = 0.0
    unit_cost: float = 0.0
    fixed_costs: float = 0.0
    brand_awareness: float = 0.0
    customer_satisfaction: float = 0.0
    product_quality: float = 0.0
    salaries: float = 0.0


def event_probability(event: MarketEvent, config: StartupConfiguration) -> float:
    """Base probability scaled by the industry, the difficulty and the event's polarity."""
    mods = config.difficulty_modifiers
    p = (
        event.probability
        * config.parameters.event_probability_multiplier
        * mods.event_probability_multiplier
    )
    if event.polarity == EventPolarity.negative:
        p *= mods.negative_event_weight
    elif event.polarity == EventPolarity.positive and mods.negative_event_weight > 0:
        p /= mods.negative_event_weight
    return min(1.0, max(0.0, p))


def resolve_events(
    active: list[ActiveEvent],
    config: StartupConfiguration,
    turn: int,
    rng: random.Random,
) -> tuple[list[ActiveEvent], list[MarketEvent]]:
    """Returns the events active this turn and those that started this turn.

    One uniform draw per catalog entry, always, so the draws do not depend on which events
    are active. An event already active cannot start again, an event whose location
    conditions do not hold never starts, and at most MAX_NEW_EVENTS_PER_TURN start in one turn
    (catalog order breaks ties).
    """
    active_types = {a.event.type for a in active}
    started: list[MarketEvent] = []
    for event in config.events:
        draw = rng.random()
        if event.type in active_types or len(started) >= pf.MAX_NEW_EVENTS_PER_TURN:
            continue
        if not matches(event.conditions, config):
            continue
        if draw < event_probability(event, config):
            started.append(event)
    now = [*active] + [
        ActiveEvent(event=e, started_turn=turn, remaining_turns=e.duration) for e in started
    ]
    return now, started


def combined_effects(active: list[ActiveEvent]) -> EventEffects:
    totals: dict[str, float] = {}
    for a in active:
        for key, value in a.event.effects.model_dump(exclude_none=True).items():
            totals[key] = totals.get(key, 0.0) + value
    return EventEffects(**totals)


def advance(active: list[ActiveEvent]) -> list[ActiveEvent]:
    """Events still to run next turn: each active event uses up one turn of its duration."""
    return [
        a.model_copy(update={"remaining_turns": a.remaining_turns - 1})
        for a in active
        if a.remaining_turns > 1
    ]
