import pytest

from engine import DecisionValidationError, run_turn, validate_decisions
from engine.decisions import apply_decisions
from engine.models import DecisionStatus
from tests.engine.helpers import SEED, decision


def rejection(state, config, *decisions):
    results = validate_decisions(state, list(decisions), config)
    return [(r.rejection.field, r.rejection.reason) for r in results if r.rejection]


@pytest.mark.parametrize(
    ("kind", "value", "reason"),
    [
        ("PRICING", -1, "price cannot be negative"),
        ("PRICING", 50, "price must be at least ₹1"),
        ("MARKETING", -100, "marketing budget cannot be negative"),
        ("HIRING", -1, "employee count cannot be negative"),
        ("PRODUCT_QUALITY", 0, "product investment must be positive"),
    ],
)
def test_invalid_values_are_rejected_with_field_and_reason(state, config, kind, value, reason):
    assert rejection(state, config, decision(kind, value)) == [("decisions[0].value", reason)]


def test_marketing_above_available_cash_is_rejected(state, config) -> None:
    [(field, reason)] = rejection(state, config, decision("MARKETING", state.cash + 1))
    assert field == "decisions[0].value"
    assert "exceeds available cash" in reason


def test_reserved_decision_types_are_not_yet_supported(state, config) -> None:
    for kind in ("FIRING", "R_AND_D", "EXPANSION", "COST_CUTTING", "FUNDING"):
        assert rejection(state, config, decision(kind, 1)) == [
            ("decisions[0].type", f"{kind} is not yet supported")
        ]


def test_duplicate_decision_types_are_rejected(state, config) -> None:
    found = rejection(state, config, decision("PRICING", 40_000), decision("PRICING", 45_000))
    assert found == [("decisions[1].type", "PRICING appears more than once")]


def test_reducing_headcount_needs_firing(state, config) -> None:
    [(_, reason)] = rejection(state, config, decision("HIRING", state.employees - 1))
    assert "FIRING" in reason


def test_hiring_beyond_a_month_of_salaries_is_rejected(state, config) -> None:
    [(_, reason)] = rejection(state, config, decision("HIRING", 1000))
    assert "a month of salaries" in reason


def test_marketing_plus_product_investment_must_fit_in_cash(state, config) -> None:
    half = state.cash // 2 + 1
    found = rejection(state, config, decision("MARKETING", half), decision("PRODUCT_QUALITY", half))
    [(field, reason)] = found
    assert field == "decisions[1].value"
    assert reason.startswith("marketing budget plus product investment exceeds available cash")


def test_bankrupt_state_rejects_every_decision(state, config) -> None:
    broke = state.model_copy(update={"cash": -1})
    assert rejection(broke, config, decision("PRICING", 40_000)) == [
        ("cash", "the startup is bankrupt; no further decisions are possible")
    ]


def test_no_op_decisions_are_accepted(state, config) -> None:
    results = validate_decisions(
        state,
        [decision("PRICING", state.price), decision("HIRING", state.employees)],
        config,
    )
    assert all(r.status == DecisionStatus.accepted for r in results)


def test_run_turn_raises_with_every_rejection(state, config) -> None:
    with pytest.raises(DecisionValidationError) as err:
        run_turn(state, [decision("PRICING", -1), decision("FUNDING", 5)], config, SEED, 1)
    assert [r.rejection.field for r in err.value.rejections] == [
        "decisions[0].value",
        "decisions[1].type",
    ]


def test_apply_keeps_unmentioned_levers(state) -> None:
    applied = apply_decisions(state, [decision("HIRING", state.employees + 2)])
    assert applied.price == state.price
    assert applied.marketing_budget == state.marketing_budget
    assert (applied.employees, applied.hires) == (state.employees + 2, 2)
    assert applied.product_investment == 0
