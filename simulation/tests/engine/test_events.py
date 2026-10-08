import pytest

from engine import profiles as pf
from engine.events import advance, combined_effects, event_probability, resolve_events
from engine.models import ActiveEvent, EventPolarity, MarketEvent
from engine.rng import rng_for


def event(type_: str, polarity: str, probability: float, duration: int = 2, **effects):
    return MarketEvent.model_validate(
        {
            "type": type_,
            "polarity": polarity,
            "probability": probability,
            "duration": duration,
            "effects": effects,
        }
    )


def with_events(config, events):
    return config.model_copy(update={"events": events})


def test_probability_scales_with_industry_difficulty_and_polarity(config) -> None:
    hard = config.model_copy(
        update={
            "difficulty_modifiers": config.difficulty_modifiers.model_copy(
                update={"event_probability_multiplier": 1.25, "negative_event_weight": 1.5}
            )
        }
    )
    bad = event("bad_review", "NEGATIVE", 0.04)
    good = event("positive_review", "POSITIVE", 0.04)
    multiplier = config.parameters.event_probability_multiplier
    assert event_probability(bad, hard) == pytest.approx(0.04 * multiplier * 1.25 * 1.5)
    assert event_probability(good, hard) == pytest.approx(0.04 * multiplier * 1.25 / 1.5)
    assert event_probability(event("seasonality", "NEUTRAL", 1.0), hard) == 1.0


def test_certain_events_start_but_at_most_the_per_turn_limit(config) -> None:
    catalog = [
        event("viral_exposure", "POSITIVE", 1.0),
        event("bad_review", "NEGATIVE", 1.0),
        event("market_trend", "NEUTRAL", 1.0),
    ]
    neutral = config.model_copy(
        update={
            "difficulty_modifiers": config.difficulty_modifiers.model_copy(
                update={"negative_event_weight": 1.0}
            )
        }
    )
    active, started = resolve_events([], with_events(neutral, catalog), 3, rng_for(1, 3, "e"))
    assert len(started) == pf.MAX_NEW_EVENTS_PER_TURN
    assert [a.started_turn for a in active] == [3, 3]


def test_impossible_events_never_start(config) -> None:
    catalog = [event("bad_review", "NEGATIVE", 0.0)]
    for turn in range(1, 50):
        _, started = resolve_events([], with_events(config, catalog), turn, rng_for(9, turn, "e"))
        assert started == []


def test_an_active_event_does_not_restart(config) -> None:
    review = event("bad_review", "NEGATIVE", 1.0)
    running = [ActiveEvent(event=review, started_turn=1, remaining_turns=1)]
    active, started = resolve_events(running, with_events(config, [review]), 2, rng_for(1, 2, "e"))
    assert started == []
    assert active == running


def test_events_persist_for_their_duration_then_expire() -> None:
    a = ActiveEvent(
        event=event("economic_slowdown", "NEGATIVE", 0.1, 3), started_turn=1, remaining_turns=3
    )
    after_one = advance([a])
    assert [e.remaining_turns for e in after_one] == [2]
    assert advance(advance(after_one)) == []


def test_effects_of_active_events_add_up() -> None:
    active = [
        ActiveEvent(
            event=event("bad_review", "NEGATIVE", 0.1, demand=-0.1, churn=0.1),
            started_turn=1,
            remaining_turns=1,
        ),
        ActiveEvent(
            event=event("market_trend", "NEUTRAL", 0.1, demand=0.06),
            started_turn=1,
            remaining_turns=1,
        ),
    ]
    fx = combined_effects(active)
    assert fx.demand == pytest.approx(-0.04)
    assert fx.churn == pytest.approx(0.1)
    assert fx.unit_cost == 0.0


def test_catalog_polarities_are_valid(config) -> None:
    assert {e.polarity for e in config.events} == set(EventPolarity)
