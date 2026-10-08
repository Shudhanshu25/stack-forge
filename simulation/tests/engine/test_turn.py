import pytest

from engine import ENGINE_VERSION, EngineInputError, run_turn
from engine.models import AgentEffects, CompetitorActionType, MarketEvent
from engine.turn import invest_in_quality
from tests.engine.helpers import SEED, decision, dump


def test_turn_record_has_the_specified_fields(state, config) -> None:
    record = run_turn(state, [decision("MARKETING", 5_000_000)], config, SEED, 1)
    body = dump(record)
    for key in ("turnNumber", "stateBefore", "decisions", "events", "agentEffects", "stateAfter"):
        assert key in body
    assert record.engine_version == ENGINE_VERSION
    assert record.state_before == state
    assert record.state_after.turn == 1
    assert len(record.competitor_actions) == 4


def test_turn_number_must_follow_the_state(state, config) -> None:
    with pytest.raises(EngineInputError, match="turn_number must be 1"):
        run_turn(state, [], config, SEED, 2)


def test_bad_seed_is_rejected(state, config) -> None:
    with pytest.raises(EngineInputError):
        run_turn(state, [], config, -1, 1)
    with pytest.raises(EngineInputError):
        run_turn(state, [], config, 2**60, 1)


def test_a_bankrupt_startup_cannot_play(state, config) -> None:
    with pytest.raises(EngineInputError, match="bankrupt"):
        run_turn(state.model_copy(update={"cash": -1}), [], config, SEED, 1)


def test_inputs_are_not_mutated(state, config) -> None:
    before = dump(state)
    decisions = [decision("PRICING", 39_900), decision("MARKETING", 5_000_000)]
    run_turn(state, decisions, config, SEED, 1)
    assert dump(state) == before
    assert [d.value for d in decisions] == [39_900, 5_000_000]


def test_marketing_brings_more_customers_than_none(state, config) -> None:
    idle = run_turn(state, [], config, SEED, 1).state_after
    spend = run_turn(state, [decision("MARKETING", 10_000_000)], config, SEED, 1).state_after
    assert spend.new_customers > idle.new_customers
    assert spend.brand_awareness > idle.brand_awareness
    assert spend.expenses.marketing == 10_000_000


def test_lower_price_wins_more_customers(state, config) -> None:
    budget = decision("MARKETING", 10_000_000)
    high = run_turn(state, [budget, decision("PRICING", 79_900)], config, SEED, 1).state_after
    low = run_turn(state, [budget, decision("PRICING", 29_900)], config, SEED, 1).state_after
    assert low.new_customers > high.new_customers


def test_hiring_costs_salary_plus_recruiting(state, config) -> None:
    salary = config.parameters.salary_per_employee_monthly
    idle = run_turn(state, [], config, SEED, 1).state_after
    hired = run_turn(state, [decision("HIRING", state.employees + 2)], config, SEED, 1).state_after
    assert hired.employees == state.employees + 2
    assert hired.expenses.employees - idle.expenses.employees == round(2 * salary * 1.25)


def test_product_investment_raises_quality_with_diminishing_returns(state, config) -> None:
    small = invest_in_quality(0.6, 100_000_00, config) - 0.6
    double = invest_in_quality(0.6, 200_000_00, config) - 0.6
    assert 0 < small < double < 2 * small
    idle = run_turn(state, [], config, SEED, 1).state_after
    invested = run_turn(state, [decision("PRODUCT_QUALITY", 20_000_000)], config, SEED, 1)
    assert invested.state_after.product_quality > idle.product_quality
    assert invested.state_after.expenses.product == 20_000_000


def test_supplied_agent_effects_are_used_and_recorded(state, config) -> None:
    rules = run_turn(state, [], config, SEED, 1)
    gloomy = AgentEffects.model_validate(
        {
            "mode": "llm",
            "customer": {
                "source": "llm",
                "sentimentChange": -0.2,
                "demandModifier": -0.3,
                "competitorThreat": 0.0,
                "reasoningSummary": "test",
            },
            "competitor": {
                "source": "llm",
                "sentimentChange": 0.0,
                "demandModifier": 0.0,
                "competitorThreat": 0.0,
                "reasoningSummary": "test",
            },
        }
    )
    llm = run_turn(state, [], config, SEED, 1, gloomy)
    assert llm.agent_effects == gloomy
    assert llm.state_after.customer_satisfaction < rules.state_after.customer_satisfaction
    assert llm.state_after.new_customers <= rules.state_after.new_customers


def test_multi_turn_events_persist_until_they_expire(state, config) -> None:
    slowdown = MarketEvent.model_validate(
        {
            "type": "economic_slowdown",
            "polarity": "NEGATIVE",
            "probability": 1.0,
            "duration": 3,
            "effects": {"demand": -0.1},
        }
    )
    certain = config.model_copy(update={"events": [slowdown]})
    first = run_turn(state, [], certain, SEED, 1)
    assert [e.type.value for e in first.events] == ["economic_slowdown"]
    assert first.state_after.active_events[0].remaining_turns == 2
    second = run_turn(first.state_after, [], certain, SEED, 2)
    assert second.events == []  # still running, not restarted
    third = run_turn(second.state_after, [], certain, SEED, 3)
    assert third.state_after.active_events == []
    fourth = run_turn(third.state_after, [], certain, SEED, 4)
    assert [e.type.value for e in fourth.events] == ["economic_slowdown"]


def test_competitor_actions_cover_every_competitor(state, config) -> None:
    record = run_turn(state, [decision("PRICING", 19_900)], config, SEED, 1)
    assert {a.competitor_id for a in record.competitor_actions} == {c.id for c in state.competitors}
    assert all(isinstance(a.action, CompetitorActionType) for a in record.competitor_actions)
