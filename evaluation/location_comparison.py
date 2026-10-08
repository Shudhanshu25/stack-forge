"""The same startup in every listed city: evidence that location has a measurable, explainable
effect.

    simulation/.venv/Scripts/python evaluation/location_comparison.py
    simulation/.venv/Scripts/python evaluation/location_comparison.py --seed 7 --policy growth

Each city runs the same industry template, seed and decision policy for twelve turns; only the
location profile differs. Two industries are compared side by side: Food & Beverage, whose
customers are local (localDemandWeight 0.9), and SaaS, whose customers are national (0.1), so
the table shows demand effects scaling with the weight while cost effects apply to both.
Writes evaluation/results/location-comparison.md and .csv.
"""

import argparse

import locations
from common import write_table

from engine import create_initial_state, run_turn
from runner.policies import POLICIES, accepted_only
from stackforge_shared.templates import build_configuration

INDUSTRIES = ("FOOD_AND_BEVERAGE", "SAAS")
LAKH = 100 * 100_000  # paise in one lakh rupees


def play(industry: str, profile, seed: int, policy: str, turns: int):
    config = build_configuration(industry, location_profile=profile)
    state = create_initial_state(config, seed)
    bankrupt_at = None
    for turn in range(1, turns + 1):
        if state.cash < 0:
            bankrupt_at = state.turn
            break
        decisions = accepted_only(state, config, POLICIES[policy](state, config, turn, seed))
        state = run_turn(state, decisions, config, seed, turn).state_after
    if state.cash < 0 and bankrupt_at is None:
        bankrupt_at = state.turn
    return state, bankrupt_at


def cells(state, bankrupt_at) -> list[object]:
    cash = round(state.cash / LAKH, 2)
    return [
        f"{cash} (bankrupt, turn {bankrupt_at})" if bankrupt_at else cash,
        round(state.profit / LAKH, 2),
        state.customers,
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--policy", choices=sorted(POLICIES), default="steady")
    parser.add_argument("--turns", type=int, default=12)
    args = parser.parse_args(argv)

    places = [("National baseline (no location)", "-", locations.neutral_profile())]
    places += [
        (p.city, p.tier.value, p)
        for p in (locations.city_profile(cid) for cid in locations.listed_city_ids())
    ]
    rows = []
    for name, tier, profile in places:
        row: list[object] = [
            name,
            tier,
            profile.indices.salary_index.value,
            profile.indices.operating_cost_index.value,
            profile.indices.purchasing_power.value,
            profile.indices.local_market_size.value,
        ]
        for industry in INDUSTRIES:
            row += cells(*play(industry, profile, args.seed, args.policy, args.turns))
        rows.append(row)

    headers = ["City", "Tier", "Salaries", "Overheads", "Purchasing power", "Market size"]
    for label in ("F&B", "SaaS"):
        headers += [
            f"{label} cash (₹ lakh)",
            f"{label} last-month profit (₹ lakh)",
            f"{label} customers",
        ]
    notes = [
        f"Same template, seed {args.seed}, '{args.policy}' decision policy and difficulty NORMAL "
        f"for {args.turns} turns in every city; only the location profile differs. "
        "Values after the last turn (or at bankruptcy).",
        "Index columns are relative to the national baseline (1.0); docs/locations.md gives every "
        "value's source, and which are estimates.",
        "Costs (salaries, overheads, compliance, recruiting, logistics) apply in full to every "
        "industry. Demand effects (market size, price sensitivity, competition) are scaled by the "
        "industry's localDemandWeight: 0.9 for Food & Beverage, 0.1 for SaaS.",
        "Location-specific events (state incentives, monsoon floods, festivals, talent wars, "
        "outages) can only occur in the places they apply to, so with one seed some differences "
        "also come from which events fired. The baseline row has no location and so gets none.",
    ]
    write_table("location-comparison", "Same startup, twenty cities", headers, rows, notes)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
