"""Property tests: invariants hold for any industry, difficulty, seed and decision sequence."""

from hypothesis import given, settings
from hypothesis import strategies as st
from stackforge_shared.models.enums_schema import Difficulty, Industry
from stackforge_shared.templates import build_configuration

from engine import create_initial_state, run_turn
from engine.models import Decision, DecisionType
from runner.policies import accepted_only

turn_decisions = st.fixed_dictionaries(
    {
        "price_factor": st.none() | st.floats(0.3, 3.0),
        "marketing_share": st.none() | st.floats(0.0, 0.5),
        "hires": st.none() | st.integers(0, 4),
        "invest_share": st.none() | st.floats(0.0, 0.3),
    }
)


def to_decisions(spec: dict, state) -> list[Decision]:
    cash = max(0, state.cash)
    out = []
    if spec["price_factor"] is not None:
        out.append(
            Decision(type=DecisionType.pricing, value=round(state.price * spec["price_factor"]))
        )
    if spec["marketing_share"] is not None:
        out.append(
            Decision(type=DecisionType.marketing, value=round(cash * spec["marketing_share"]))
        )
    if spec["hires"] is not None:
        out.append(Decision(type=DecisionType.hiring, value=state.employees + spec["hires"]))
    if spec["invest_share"]:
        out.append(
            Decision(
                type=DecisionType.product_quality, value=max(1, round(cash * spec["invest_share"]))
            )
        )
    return out


@settings(max_examples=60, deadline=None)
@given(
    industry=st.sampled_from(list(Industry)),
    difficulty=st.sampled_from(list(Difficulty)),
    seed=st.integers(0, 2**53 - 1),
    turns=st.lists(turn_decisions, min_size=1, max_size=12),
)
def test_invariants(industry, difficulty, seed, turns) -> None:
    config = build_configuration(industry, difficulty)
    state = create_initial_state(config, seed)
    for turn, spec in enumerate(turns, start=1):
        if state.cash < 0:
            break
        decisions = accepted_only(state, config, to_decisions(spec, state))
        after = run_turn(state, decisions, config, seed, turn).state_after

        assert after.customers >= 0
        assert after.new_customers >= 0 and after.churned_customers >= 0
        assert after.customers == state.customers + after.new_customers - after.churned_customers
        assert after.customers == sum(s.customers for s in after.customer_segments)
        for segment in after.customer_segments:
            assert 0 <= segment.customers <= segment.population

        assert after.cash - state.cash == after.profit
        assert after.profit == after.revenue - after.expenses.total
        e = after.expenses
        assert e.total == e.variable + e.fixed + e.marketing + e.employees + e.product

        shares = after.market_share + sum(c.market_share for c in after.competitors)
        assert shares <= 1 + 1e-9
        for rate in (
            after.market_share,
            after.product_quality,
            after.customer_satisfaction,
            after.brand_awareness,
            after.competitor_pressure,
        ):
            assert 0 <= rate <= 1
        state = after
