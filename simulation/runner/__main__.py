"""Run a multi-turn simulation from the command line.

python -m runner --industry SAAS --turns 10 --seed 42
python -m runner --industry all --turns 12 --policy growth
python -m runner --industry ECOMMERCE --json records.json
"""

import argparse
import json
import sys
from pathlib import Path

from stackforge_shared.models.enums_schema import Difficulty, Industry
from stackforge_shared.templates import build_configuration

from engine import ENGINE_VERSION, create_initial_state, run_turn
from engine.models import SimulationTurn, StartupConfiguration
from runner.policies import POLICIES, accepted_only


def simulate(
    config: StartupConfiguration, turns: int, seed: int, policy_name: str
) -> list[SimulationTurn]:
    """Plays up to `turns` turns, stopping early if the startup goes bankrupt."""
    policy = POLICIES[policy_name]
    state = create_initial_state(config, seed)
    records = []
    for turn in range(1, turns + 1):
        if state.cash < 0:
            break
        decisions = accepted_only(state, config, policy(state, config, turn, seed))
        record = run_turn(state, decisions, config, seed, turn)
        records.append(record)
        state = record.state_after
    return records


def inr(paise: int) -> str:
    """Compact Indian format: ₹8.45L, ₹1.2Cr."""
    rupees = paise / 100
    sign = "-" if rupees < 0 else ""
    value = abs(rupees)
    for size, suffix in ((1e7, "Cr"), (1e5, "L"), (1e3, "K")):
        if value >= size:
            return f"{sign}₹{value / size:.2f}".rstrip("0").rstrip(".") + suffix
    return f"{sign}₹{value:.0f}"


def describe_decisions(record: SimulationTurn) -> str:
    parts = []
    for d in record.decisions:
        kind = d.type.value
        if kind == "HIRING":
            parts.append(f"hire->{d.value}")
        elif kind == "PRICING":
            parts.append(f"price {inr(d.value)}")
        elif kind == "MARKETING":
            parts.append(f"mkt {inr(d.value)}")
        else:
            parts.append(f"product {inr(d.value)}")
    return ", ".join(parts) or "-"


def print_run(config: StartupConfiguration, records: list[SimulationTurn], seed: int) -> None:
    print(
        f"\n{config.industry.value} | {config.business_model.value} | {config.difficulty.value}"
        f" | capital {inr(config.initial_capital)} | price {inr(config.initial_price)}"
        f" | market {config.market_size:,} | seed {seed} | engine {ENGINE_VERSION}"
    )
    header = (
        f"{'T':>2} {'cash':>9} {'revenue':>8} {'expenses':>8} {'profit':>9} "
        f"{'cust':>6} {'+new':>5} {'-churn':>6} {'share%':>7} {'sat':>5} {'aware':>5} "
        f"{'qual':>5} {'press':>5}  decisions | events | competitor moves"
    )
    print(header)
    print("-" * len(header))
    for r in records:
        s = r.state_after
        events = ", ".join(e.type.value for e in r.events) or "-"
        moves = (
            ", ".join(
                f"{a.competitor_id.removeprefix('competitor-')}:{a.action.value.split('_')[0].lower()}"
                for a in r.competitor_actions
                if a.action.value != "NONE"
            )
            or "-"
        )
        print(
            f"{r.turn_number:>2} {inr(s.cash):>9} {inr(s.revenue):>8} {inr(s.expenses.total):>8} "
            f"{inr(s.profit):>9} {s.customers:>6} {s.new_customers:>5} {s.churned_customers:>6} "
            f"{s.market_share * 100:>7.3f} {s.customer_satisfaction:>5.2f} "
            f"{s.brand_awareness:>5.2f} {s.product_quality:>5.2f} {s.competitor_pressure:>5.2f}"
            f"  {describe_decisions(r)} | {events} | {moves}"
        )
    if records and records[-1].state_after.cash < 0:
        print(f"Bankrupt after turn {records[-1].turn_number}.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a Stack Forge simulation.")
    parser.add_argument("--industry", default="SAAS", help="industry enum value, or 'all'")
    parser.add_argument("--turns", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--difficulty", default="NORMAL", choices=[d.value for d in Difficulty])
    parser.add_argument("--policy", default="steady", choices=sorted(POLICIES))
    parser.add_argument("--json", type=Path, help="write the turn records to this file")
    args = parser.parse_args(argv)

    industries = list(Industry) if args.industry.lower() == "all" else [Industry(args.industry)]
    dump = {}
    for industry in industries:
        config = build_configuration(industry, args.difficulty)
        records = simulate(config, args.turns, args.seed, args.policy)
        print_run(config, records, args.seed)
        dump[industry.value] = [r.model_dump(mode="json", by_alias=True) for r in records]
    if args.json:
        args.json.write_text(json.dumps(dump, indent=2), encoding="utf-8")
        print(f"\nRecords written to {args.json}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
