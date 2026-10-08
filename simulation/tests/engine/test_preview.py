from engine import preview
from engine.models import DecisionStatus, Direction, Magnitude
from tests.engine.helpers import SEED, decision, dump


def effects_of(result) -> dict:
    return {e.metric: (e.direction, e.magnitude) for e in result}


def test_preview_is_labelled_and_records_nothing(state, config) -> None:
    before = dump(state)
    result = preview(state, [decision("MARKETING", 10_000_000)], config, SEED, 1)
    assert result.label == "Simulation estimate"
    assert result.turn_number == 1
    assert dump(state) == before


def test_marketing_preview_points_up_for_customers_and_down_for_cash(state, config) -> None:
    result = preview(state, [decision("MARKETING", 10_000_000)], config, SEED, 1)
    effects = effects_of(result.decision_results[0].effects)
    assert effects["newCustomers"][0] == Direction.up
    assert effects["cash"][0] == Direction.down
    assert effects["brandAwareness"][0] == Direction.up


def test_each_decision_is_previewed_alone_and_combined(state, config) -> None:
    result = preview(
        state,
        [decision("MARKETING", 10_000_000), decision("PRODUCT_QUALITY", 5_000_000)],
        config,
        SEED,
        1,
    )
    product = effects_of(result.decision_results[1].effects)
    assert product["productQuality"][0] == Direction.up
    assert effects_of(result.decision_results[0].effects)["productQuality"][1] == Magnitude.none
    assert effects_of(result.combined_effects)["productQuality"][0] == Direction.up


def test_rejected_decisions_are_reported_not_raised(state, config) -> None:
    result = preview(state, [decision("PRICING", -5), decision("FUNDING", 1)], config, SEED, 1)
    assert [r.status for r in result.decision_results] == [DecisionStatus.rejected] * 2
    assert all(r.effects == [] for r in result.decision_results)
    assert all(e.magnitude == Magnitude.none for e in result.combined_effects)


def test_a_no_op_decision_has_no_effect(state, config) -> None:
    result = preview(state, [decision("PRICING", state.price)], config, SEED, 1)
    assert all(e.direction == Direction.flat for e in result.decision_results[0].effects)
