"""Competitors: creation and rule-based reactions to the founder."""

import random

from . import profiles as pf
from .agents import FounderMoves
from .models import (
    Competitor,
    CompetitorAction,
    CompetitorActionType,
    CompetitorArchetype,
    StartupConfiguration,
)


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def competitor_intensity(config: StartupConfiguration) -> float:
    return _clamp(
        config.parameters.competitor_intensity
        * config.difficulty_modifiers.competitor_intensity_multiplier
    )


def total_competitor_share(config: StartupConfiguration) -> float:
    return pf.COMPETITOR_SHARE_BASE + pf.COMPETITOR_SHARE_SLOPE * competitor_intensity(config)


def anchor_price(archetype: CompetitorArchetype, config: StartupConfiguration) -> int:
    return round(config.parameters.reference_price * pf.ARCHETYPES[archetype].price_multiplier)


def initial_competitors(config: StartupConfiguration, rng: random.Random) -> list[Competitor]:
    """One competitor per archetype with attributes jittered by up to ±10%."""

    def jitter() -> float:
        return 1.0 + 0.2 * (rng.random() - 0.5)

    raw = []
    for archetype, profile in pf.ARCHETYPES.items():
        raw.append((archetype, profile, [jitter() for _ in range(6)]))
    weights = [p.share_weight * j[5] for _, p, j in raw]
    total_share = total_competitor_share(config)

    competitors = []
    for (archetype, profile, j), weight in zip(raw, weights, strict=True):
        competitors.append(
            Competitor(
                id=f"competitor-{archetype.value.lower()}",
                name=profile.name,
                archetype=archetype,
                pricing_strategy=profile.pricing_strategy,
                price=max(pf.MIN_PRICE, round(anchor_price(archetype, config) * j[0])),
                marketing_power=round(_clamp(profile.marketing_power * j[1]), 6),
                market_share=round(total_share * weight / sum(weights), 6),
                reaction_tendency=round(_clamp(profile.reaction_tendency * j[2]), 6),
                product_quality=round(_clamp(profile.product_quality * j[3]), 6),
                cash_strength=round(_clamp(profile.cash_strength * j[4]), 6),
            )
        )
    return competitors


def _choose_action(
    competitor: Competitor, moves: FounderMoves, founder_price: int
) -> CompetitorActionType:
    undercut = founder_price < competitor.price * 0.9
    match competitor.archetype:
        case CompetitorArchetype.budget:
            return CompetitorActionType.price_change
        case CompetitorArchetype.aggressive:
            if moves.price_cut or undercut:
                return CompetitorActionType.price_change
            return CompetitorActionType.marketing_change
        case CompetitorArchetype.premium:
            if moves.quality_change > 0.01 or not moves.marketing_up:
                return CompetitorActionType.product_investment
            return CompetitorActionType.marketing_change
        case _:
            return CompetitorActionType.product_investment


_REASONS = {
    CompetitorActionType.price_change: "Cut price in response to the founder",
    CompetitorActionType.marketing_change: "Raised marketing to defend share",
    CompetitorActionType.product_investment: "Invested in product to stay ahead",
}


def react(
    competitors: list[Competitor],
    threat: float,
    moves: FounderMoves,
    founder_price: int,
    config: StartupConfiguration,
    rng: random.Random,
) -> tuple[list[Competitor], list[CompetitorAction]]:
    """Each competitor reacts with probability reaction_tendency * threat, if it has the cash.

    Two uniforms are drawn per competitor whatever happens, so the draw sequence never depends
    on the founder's decisions. Competitors that do not react drift back toward their
    archetype's defaults.
    """
    updated: list[Competitor] = []
    actions: list[CompetitorAction] = []
    for c in competitors:
        react_draw, size_draw = rng.random(), rng.random()
        profile = pf.ARCHETYPES[c.archetype]
        anchor = anchor_price(c.archetype, config)
        price, marketing, quality, cash = (
            c.price,
            c.marketing_power,
            c.product_quality,
            c.cash_strength,
        )
        action, change = CompetitorActionType.none, 0.0

        can_act = cash >= pf.COMPETITOR_MIN_CASH_TO_ACT
        if can_act and react_draw < c.reaction_tendency * threat:
            action = _choose_action(c, moves, founder_price)
            cash -= pf.COMPETITOR_ACTION_COST
            if action == CompetitorActionType.price_change:
                floor = round(anchor * pf.COMPETITOR_PRICE_FLOOR)
                new_price = max(floor, pf.MIN_PRICE, round(price * (1 - (0.04 + 0.06 * size_draw))))
                change = (new_price - price) / price if price else 0.0
                price = new_price
            elif action == CompetitorActionType.marketing_change:
                new_marketing = _clamp(marketing + 0.04 + 0.06 * size_draw)
                change, marketing = new_marketing - marketing, new_marketing
            else:
                new_quality = _clamp(quality + 0.02 + 0.03 * size_draw)
                change, quality = new_quality - quality, new_quality
            reason = _REASONS[action]
        else:
            price = round(price + pf.COMPETITOR_DRIFT * (anchor - price))
            marketing += pf.COMPETITOR_DRIFT * (profile.marketing_power - marketing)
            quality += pf.COMPETITOR_DRIFT / 2 * (profile.product_quality - quality)
            reason = "Not enough cash to respond" if not can_act else "No response"

        cash = _clamp(cash + pf.COMPETITOR_CASH_RECOVERY)
        updated.append(
            c.model_copy(
                update={
                    "price": price,
                    "marketing_power": round(_clamp(marketing), 6),
                    "product_quality": round(_clamp(quality), 6),
                    "cash_strength": round(cash, 6),
                }
            )
        )
        actions.append(
            CompetitorAction(
                competitor_id=c.id, action=action, change=round(change, 6), reason=reason
            )
        )
    return updated, actions
