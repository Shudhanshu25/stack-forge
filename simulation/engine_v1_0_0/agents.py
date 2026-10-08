"""Rule-based customer and competitor agent effects.

These are the default when run_turn receives no agent effects. In llm mode (Milestone 4) the
pipeline supplies validated effects instead; the engine treats both the same way, clamping them
to its own caps before use.
"""

from dataclasses import dataclass

from . import profiles as pf
from .decisions import AppliedDecisions
from .models import (
    AgentEffects,
    AgentMode,
    AgentOutput,
    AgentSource,
    Competitor,
    SimulationState,
)


@dataclass(frozen=True)
class FounderMoves:
    """What the founder changed this turn, as competitors and customers perceive it."""

    price_cut: bool
    price_change: float  # relative
    marketing_up: bool
    quality_change: float  # absolute, after this turn's investment


def founder_moves(
    before: SimulationState, applied: AppliedDecisions, quality: float
) -> FounderMoves:
    previous_budget = before.marketing_budget
    return FounderMoves(
        price_cut=applied.price < before.price * 0.98,
        price_change=(applied.price - before.price) / before.price if before.price else 0.0,
        marketing_up=applied.marketing_budget > max(previous_budget * 1.2, previous_budget + 1),
        quality_change=quality - before.product_quality,
    )


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def competitor_threat(
    before: SimulationState,
    applied: AppliedDecisions,
    quality: float,
    competitors: list[Competitor],
    moves: FounderMoves,
) -> tuple[float, list[str]]:
    """How threatened competitors feel by the founder, in [0, 1], with the reasons."""
    reasons: list[str] = []
    top_share = max((c.market_share for c in competitors), default=0.0)
    share_signal = 0.35 * min(1.0, before.market_share / max(0.01, top_share))
    if share_signal > 0.05:
        reasons.append("growing market share")
    avg_price = sum(c.price for c in competitors) / len(competitors) if competitors else 0
    price_signal = 0.0
    if avg_price > 0:
        price_signal = 0.6 * _clamp((avg_price - applied.price) / avg_price, 0.0, 0.5)
        if price_signal > 0:
            reasons.append("price below the competitor average")
    avg_quality = (
        sum(c.product_quality for c in competitors) / len(competitors) if competitors else 0
    )
    quality_signal = _clamp(quality - avg_quality, 0.0, 0.3)
    if quality_signal > 0:
        reasons.append("product quality above the competitor average")
    marketing_signal = 0.15 if moves.marketing_up else 0.0
    if marketing_signal:
        reasons.append("marketing increased")
    threat = _clamp(share_signal + price_signal + quality_signal + marketing_signal, 0.0, 1.0)
    return round(threat, 6), reasons


def rule_based_effects(
    before: SimulationState,
    applied: AppliedDecisions,
    quality: float,
    competitors: list[Competitor],
) -> AgentEffects:
    moves = founder_moves(before, applied, quality)

    sentiment = _clamp(-0.25 * moves.price_change + 0.8 * moves.quality_change, -0.2, 0.2)
    if moves.price_change > 0.005:
        customer_reason = f"Customers react negatively to a {moves.price_change:.0%} price rise."
    elif moves.price_change < -0.005:
        customer_reason = f"Customers welcome a {-moves.price_change:.0%} price cut."
    else:
        customer_reason = "Price unchanged."
    if moves.quality_change > 0.005:
        customer_reason += " Product improvements are noticed."

    threat, reasons = competitor_threat(before, applied, quality, competitors, moves)
    competitor_reason = (
        f"Competitor threat {threat:.2f}: " + ", ".join(reasons) + "."
        if reasons
        else f"Competitor threat {threat:.2f}: nothing in the founder's moves stands out."
    )
    return AgentEffects(
        mode=AgentMode.rules,
        customer=AgentOutput(
            source=AgentSource.rules,
            sentiment_change=round(sentiment, 6),
            demand_modifier=round(0.5 * sentiment, 6),
            competitor_threat=0.0,
            reasoning_summary=customer_reason,
        ),
        competitor=AgentOutput(
            source=AgentSource.rules,
            sentiment_change=0.0,
            demand_modifier=0.0,
            competitor_threat=threat,
            reasoning_summary=competitor_reason,
        ),
    )


def applied_agent_modifiers(effects: AgentEffects) -> tuple[float, float]:
    """Total (demand modifier, sentiment change), clamped to the engine's caps."""
    demand = effects.customer.demand_modifier + effects.competitor.demand_modifier
    sentiment = effects.customer.sentiment_change + effects.competitor.sentiment_change
    return (
        _clamp(demand, -pf.AGENT_DEMAND_CAP, pf.AGENT_DEMAND_CAP),
        _clamp(sentiment, -pf.AGENT_SENTIMENT_CAP, pf.AGENT_SENTIMENT_CAP),
    )
