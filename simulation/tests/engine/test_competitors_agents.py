import pytest

from engine import profiles as pf
from engine.agents import (
    FounderMoves,
    applied_agent_modifiers,
    founder_moves,
    rule_based_effects,
)
from engine.competitors import anchor_price, react, total_competitor_share
from engine.decisions import AppliedDecisions
from engine.models import AgentEffects, CompetitorActionType, CompetitorArchetype
from engine.rng import rng_for

PRICE_WAR = FounderMoves(price_cut=True, price_change=-0.3, marketing_up=False, quality_change=0.0)


def test_one_competitor_per_archetype_with_the_configured_total_share(state, config) -> None:
    assert {c.archetype for c in state.competitors} == set(CompetitorArchetype)
    assert len({c.id for c in state.competitors}) == 4
    total = sum(c.market_share for c in state.competitors)
    assert total == pytest.approx(total_competitor_share(config), abs=1e-5)


def test_no_threat_means_no_reaction(state, config) -> None:
    _, actions = react(state.competitors, 0.0, PRICE_WAR, 30_000, config, rng_for(1, 1, "c"))
    assert {a.action for a in actions} == {CompetitorActionType.none}


def test_full_threat_triggers_archetype_responses(state, config) -> None:
    eager = [
        c.model_copy(update={"reaction_tendency": 1.0, "cash_strength": 1.0})
        for c in state.competitors
    ]
    updated, actions = react(eager, 1.0, PRICE_WAR, 30_000, config, rng_for(1, 1, "c"))
    by_archetype = {c.archetype: a.action for c, a in zip(eager, actions, strict=True)}
    assert by_archetype[CompetitorArchetype.budget] == CompetitorActionType.price_change
    assert by_archetype[CompetitorArchetype.aggressive] == CompetitorActionType.price_change
    assert by_archetype[CompetitorArchetype.innovative] == CompetitorActionType.product_investment
    for before, after in zip(eager, updated, strict=True):
        if before.archetype == CompetitorArchetype.budget:
            floor = round(anchor_price(before.archetype, config) * pf.COMPETITOR_PRICE_FLOOR)
            assert floor <= after.price < before.price
        assert after.cash_strength < before.cash_strength


def test_competitors_without_cash_cannot_respond(state, config) -> None:
    broke = [c.model_copy(update={"cash_strength": 0.0}) for c in state.competitors]
    _, actions = react(broke, 1.0, PRICE_WAR, 30_000, config, rng_for(1, 1, "c"))
    assert all(a.reason == "Not enough cash to respond" for a in actions)


def test_customers_dislike_price_rises_and_like_cuts(state) -> None:
    def effects(price: int) -> AgentEffects:
        applied = AppliedDecisions(price, 0, state.employees, 0, 0)
        return rule_based_effects(state, applied, state.product_quality, state.competitors)

    assert effects(round(state.price * 1.2)).customer.sentiment_change < 0
    cut = effects(round(state.price * 0.7))
    assert cut.customer.sentiment_change > 0
    assert cut.competitor.competitor_threat > effects(state.price).competitor.competitor_threat


def test_founder_moves_detects_marketing_increase(state) -> None:
    moves = founder_moves(state, AppliedDecisions(state.price, 5_000_000, 3, 0, 0), 0.6)
    assert moves.marketing_up
    assert not moves.price_cut


def test_engine_caps_agent_modifiers(state) -> None:
    base = rule_based_effects(
        state, AppliedDecisions(state.price, 0, 3, 0, 0), state.product_quality, state.competitors
    )
    extreme = base.model_copy(
        update={
            "customer": base.customer.model_copy(
                update={"demand_modifier": 1.0, "sentiment_change": -1.0}
            )
        }
    )
    assert applied_agent_modifiers(extreme) == (pf.AGENT_DEMAND_CAP, -pf.AGENT_SENTIMENT_CAP)
