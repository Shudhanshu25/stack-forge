"""Template viability check: can a disciplined founder survive on NORMAL difficulty?

For each industry, tries fixed monthly marketing budgets (a share of initial capital) with
hiring whenever support capacity is 90% used, over several seeds. Reports the best budget's
survival rate after `turns` turns. Templates are calibrated so the best strategy survives on
most seeds without the game being trivially winnable.

    python -m runner.viability --turns 24 --seeds 10
"""

import argparse
import sys

from stackforge_shared.models.enums_schema import Industry
from stackforge_shared.templates import build_configuration

from engine import create_initial_state, run_turn
from engine.models import Decision, DecisionType, StartupConfiguration
from runner.policies import accepted_only

BUDGET_SHARES = (0.0, 0.02, 0.05, 0.10, 0.15)


def survives(config: StartupConfiguration, budget: int, seed: int, turns: int) -> tuple[bool, int]:
    state = create_initial_state(config, seed)
    capacity_per_employee = config.parameters.customers_per_employee
    for turn in range(1, turns + 1):
        if state.cash < 0:
            return False, state.customers
        decisions = [Decision(type=DecisionType.marketing, value=budget)]
        if state.customers > 0.9 * state.employees * capacity_per_employee:
            decisions.append(Decision(type=DecisionType.hiring, value=state.employees + 1))
        decisions = accepted_only(state, config, decisions)
        state = run_turn(state, decisions, config, seed, turn).state_after
    return state.cash >= 0, state.customers


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--turns", type=int, default=24)
    parser.add_argument("--seeds", type=int, default=10)
    parser.add_argument("--difficulty", default="NORMAL")
    args = parser.parse_args(argv)
    print(f"{'industry':18} " + " ".join(f"{s:>7.0%}" for s in BUDGET_SHARES) + "   (survival)")
    for industry in Industry:
        config = build_configuration(industry, args.difficulty)
        rates = []
        for share in BUDGET_SHARES:
            budget = round(config.initial_capital * share / 100_000) * 100_000
            alive = sum(survives(config, budget, seed, args.turns)[0] for seed in range(args.seeds))
            rates.append(alive / args.seeds)
        print(f"{industry.value:18} " + " ".join(f"{r:>7.0%}" for r in rates))
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
