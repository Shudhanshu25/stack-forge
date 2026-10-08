"""Simulation consistency: accounting invariants, determinism and replay across many seeds.

For every industry x difficulty x decision policy x seed, plays up to --turns turns and checks
after each one that customers, cash and expenses add up and every rate stays in range. Each run
is then played a second time (it must be byte-identical) and replayed from its stored records
(every stateAfter must match).

    python evaluation/consistency.py [--seeds 20] [--turns 24]
"""

import argparse
import json
import time

from common import write_table

from engine import create_initial_state, replay_mismatches, run_turn
from runner.policies import POLICIES, accepted_only
from stackforge_shared.models.enums_schema import Difficulty, Industry
from stackforge_shared.templates import build_configuration

RATES = ("market_share", "product_quality", "customer_satisfaction", "brand_awareness")


def violations(before, after) -> list[str]:
    """Names of the invariants a turn breaks (empty when it is consistent)."""
    out = []
    if after.customers < 0 or after.new_customers < 0 or after.churned_customers < 0:
        out.append("negative customers")
    if after.customers != before.customers + after.new_customers - after.churned_customers:
        out.append("customer flow")
    if after.customers != sum(s.customers for s in after.customer_segments):
        out.append("segment total")
    if any(not 0 <= s.customers <= s.population for s in after.customer_segments):
        out.append("segment population")
    if after.cash - before.cash != after.profit:
        out.append("cash flow")
    if after.profit != after.revenue - after.expenses.total:
        out.append("profit")
    e = after.expenses
    if e.total != e.variable + e.fixed + e.marketing + e.employees + e.product:
        out.append("expense total")
    if after.market_share + sum(c.market_share for c in after.competitors) > 1 + 1e-9:
        out.append("market shares exceed 100%")
    if any(not 0 <= getattr(after, r) <= 1 for r in (*RATES, "competitor_pressure")):
        out.append("rate out of range")
    money = (after.cash, after.revenue, after.profit, e.total)
    if any(not isinstance(v, int) for v in money):
        out.append("money not integer paise")
    return out


def play(config, seed: int, turns: int, policy):
    state = create_initial_state(config, seed)
    initial, records, broken = state, [], []
    for turn in range(1, turns + 1):
        if state.cash < 0:
            break
        decisions = accepted_only(state, config, policy(state, config, turn, seed))
        record = run_turn(state, decisions, config, seed, turn)
        broken += [(turn, v) for v in violations(state, record.state_after)]
        records.append(record)
        state = record.state_after
    return initial, records, broken


def dump(records) -> str:
    return json.dumps([r.model_dump(mode="json") for r in records], sort_keys=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seeds", type=int, default=20, help="seeds per combination")
    parser.add_argument("--turns", type=int, default=24)
    args = parser.parse_args(argv)

    rows, examples = [], []
    totals = {"runs": 0, "turns": 0, "violations": 0, "nondeterministic": 0, "replay": 0}
    started = time.perf_counter()
    for industry in Industry:
        stats = {"runs": 0, "turns": 0, "violations": 0, "nondet": 0, "replay": 0, "bankrupt": 0}
        t0 = time.perf_counter()
        for difficulty in Difficulty:
            config = build_configuration(industry, difficulty)
            for name, policy in POLICIES.items():
                for i in range(args.seeds):
                    seed = 1_000 * i + 17
                    initial, records, broken = play(config, seed, args.turns, policy)
                    _, again, _ = play(config, seed, args.turns, policy)
                    stats["runs"] += 1
                    stats["turns"] += len(records)
                    stats["violations"] += len(broken)
                    stats["nondet"] += dump(records) != dump(again)
                    stats["replay"] += bool(replay_mismatches(initial, records, seed, config))
                    stats["bankrupt"] += records[-1].state_after.cash < 0
                    for turn, what in broken[:1]:
                        examples.append(
                            f"{industry.value}/{difficulty.value}/{name} seed {seed} "
                            f"turn {turn}: {what}"
                        )
        elapsed = time.perf_counter() - t0
        rows.append(
            [
                industry.value,
                stats["runs"],
                stats["turns"],
                stats["violations"],
                stats["nondet"],
                stats["replay"],
                f"{100 * stats['bankrupt'] / stats['runs']:.1f}%",
                round(1000 * elapsed / max(1, 3 * stats["turns"]), 3),
            ]
        )
        for key, stat in (
            ("runs", "runs"),
            ("turns", "turns"),
            ("violations", "violations"),
            ("nondeterministic", "nondet"),
            ("replay", "replay"),
        ):
            totals[key] += stats[stat]
        print(f"{industry.value}: {stats}")

    rows.append(
        [
            "**All**",
            totals["runs"],
            totals["turns"],
            totals["violations"],
            totals["nondeterministic"],
            totals["replay"],
            "",
            "",
        ]
    )
    notes = [
        f"Each industry: {len(Difficulty)} difficulties x {len(POLICIES)} policies "
        f"({', '.join(POLICIES)}) x {args.seeds} seeds, up to {args.turns} turns "
        "(a run stops at bankruptcy).",
        "Invariants checked after every turn: customer flow and segment totals, "
        "cash change = profit, profit = revenue - expenses, expense total, market shares "
        "<= 100%, rates in [0, 1], money in integer paise.",
        "Nondeterministic runs: a second play with the same seed and decisions differed. "
        "Replay mismatches: recomputing from stored decisions and agent effects changed a "
        "stateAfter. ms per turn is the average of the three passes "
        "(play, replay check, second play).",
        f"Total time {time.perf_counter() - started:.1f}s.",
    ]
    if examples:
        notes += ["", "First violations:", *(f"- {e}" for e in examples[:10])]
    write_table(
        "consistency",
        "Simulation consistency",
        [
            "Industry",
            "Runs",
            "Turns",
            "Invariant violations",
            "Nondeterministic runs",
            "Replay mismatches",
            "Bankrupt runs",
            "ms per turn",
        ],
        rows,
        notes,
    )
    failed = totals["violations"] + totals["nondeterministic"] + totals["replay"]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
