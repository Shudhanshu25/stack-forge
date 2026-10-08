"""Agents vs rules: how far LLM agents move outcomes from the rule-based baseline.

Each simulation is played twice through the full turn pipeline with the same seed and the same
decisions: once with rule-based agent effects and once with the LLM customer and competitor
agents. The decisions come from the rules run (steady policy) and are replayed unchanged on the
agents run. The table reports how far revenue, customers and cash diverge by the final turn,
the agents' modifiers, and how often the agents fell back to rules.

Requires a configured LLM (LLM_API_KEY in the environment or simulation/.env). Without one the
result file says the evaluation was not run.

    python evaluation/agents_vs_rules.py [--sims 8] [--turns 6] [--provider gemini|stub]
"""

import argparse
import time
from collections import Counter

from common import (
    add_rpm_argument,
    llm_client,
    mean,
    pipeline_turn,
    settings,
    write_not_run,
    write_table,
)

from app.pipeline.turn import PipelineDeps
from engine import create_initial_state
from engine.decisions import DecisionValidationError
from runner.policies import POLICIES, accepted_only
from stackforge_shared.models.enums_schema import Industry
from stackforge_shared.templates import build_configuration

NAME, TITLE = "agents-vs-rules", "LLM agents vs rule-based agents"


def relative_gap(a: int, b: int) -> float:
    """|a - b| as a share of the rules value (0 when both are 0)."""
    return abs(a - b) / max(abs(b), 1)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sims", type=int, default=8)
    parser.add_argument("--turns", type=int, default=6)
    parser.add_argument("--provider", choices=["gemini", "stub"], default=None)
    add_rpm_argument(parser)
    args = parser.parse_args(argv)

    s = settings(advisor_on_turn=False)
    client, label = llm_client(args.provider, s, args.rpm)
    if client is None:
        write_not_run(NAME, TITLE, "No LLM configured: set LLM_API_KEY (Google Gemini).")
        return 0
    rules_deps = PipelineDeps(settings=s, llm=None)
    agent_deps = PipelineDeps(settings=s, llm=client)

    rows = []
    reasons: Counter[str] = Counter()
    industries = list(Industry)
    for i in range(args.sims):
        industry = industries[i % len(industries)]
        config = build_configuration(industry)
        seed = 9_000 + i
        rules_state = agent_state = create_initial_state(config, seed)
        rules_hist, agent_hist = [], []
        demand, sentiment, threat, fallbacks, agent_calls, turn_ms = [], [], [], 0, 0, []
        for turn in range(1, args.turns + 1):
            if rules_state.cash < 0 or agent_state.cash < 0:
                break
            plan = POLICIES["steady"](rules_state, config, turn, seed)
            decisions = accepted_only(rules_state, config, plan)
            rules_rec = pipeline_turn(
                rules_state, decisions, config, seed, turn, "rules", rules_hist, rules_deps
            )
            started = time.perf_counter()
            try:
                agent_rec = pipeline_turn(
                    agent_state, decisions, config, seed, turn, "llm", agent_hist, agent_deps
                )
            except (RuntimeError, DecisionValidationError):
                break
            turn_ms.append(1000 * (time.perf_counter() - started))
            for effect in (agent_rec.agent_effects.customer, agent_rec.agent_effects.competitor):
                agent_calls += 1
                if effect.source.value == "rules_fallback":
                    fallbacks += 1
                    reasons[(effect.fallback_reason or "unknown").split(" from ")[0]] += 1
            c, k = agent_rec.agent_effects.customer, agent_rec.agent_effects.competitor
            demand.append(c.demand_modifier + k.demand_modifier)
            sentiment.append(c.sentiment_change)
            threat.append(k.competitor_threat)
            rules_hist.append(rules_rec)
            agent_hist.append(agent_rec)
            rules_state, agent_state = rules_rec.state_after, agent_rec.state_after
        r, a = rules_state, agent_state
        rows.append(
            [
                industry.value,
                seed,
                len(agent_hist),
                r.revenue // 100,
                a.revenue // 100,
                f"{100 * relative_gap(a.revenue, r.revenue):.1f}%",
                r.customers,
                a.customers,
                f"{100 * relative_gap(a.customers, r.customers):.1f}%",
                f"{100 * relative_gap(a.cash, r.cash):.1f}%",
                round(mean(demand), 4),
                round(mean(sentiment), 4),
                round(mean(threat), 3),
                f"{100 * fallbacks / max(1, agent_calls):.0f}%",
                round(mean(turn_ms)),
            ]
        )
        print(f"{industry.value} seed {seed}: {rows[-1][2]} turns")

    write_table(
        NAME,
        TITLE,
        [
            "Industry",
            "Seed",
            "Turns",
            "Revenue ₹ (rules)",
            "Revenue ₹ (agents)",
            "Revenue gap",
            "Customers (rules)",
            "Customers (agents)",
            "Customer gap",
            "Cash gap",
            "Mean demand modifier",
            "Mean sentiment change",
            "Mean competitor threat",
            "Fallback rate",
            "Agents turn ms",
        ],
        rows,
        [
            f"LLM: {label}. Same seed and same decisions (steady policy, taken from the rules "
            "run) on both sides; values are for the final turn. Gaps are relative to the rules "
            "run. Agent modifiers are clamped to the configured caps "
            f"(demand ±{s.agent_demand_cap}, sentiment ±{s.agent_sentiment_cap}).",
            "Fallback rate: share of agent calls whose output was rejected or timed out and "
            "replaced by the rule-based effects.",
            "Fallback reasons: "
            + (", ".join(f"{k} x{v}" for k, v in reasons.most_common()) or "none")
            + ".",
        ],
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
