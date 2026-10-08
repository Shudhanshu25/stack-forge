"""AI CEO faithfulness: the share of numeric claims in advice that match the turn record.

Plays seeded simulations, then asks the AI CEO about sampled turns in every mode. Every figure
in every answer the model gives (before the service's own check) is compared with the data the
advisor was given; the table reports how often first answers are faithful, how often the
one-retry rule rescues an answer, and how often advice is withheld.

Requires a configured LLM (LLM_API_KEY in the environment or simulation/.env). Without one the
result file says the evaluation was not run.

    python evaluation/advisor_faithfulness.py [--sims 2] [--turns 6] [--provider gemini|stub]
"""

import argparse
import time
from collections import Counter

from common import (
    add_rpm_argument,
    llm_client,
    mean,
    settings,
    summary_of,
    write_not_run,
    write_table,
)

from app.advisor.advisor import AdvisorResponse, _texts, advise, advisor_context
from app.advisor.faithfulness import check
from app.llm import client as llm_client_module
from engine import create_initial_state, run_turn
from runner.policies import POLICIES, accepted_only
from stackforge_shared.models.enums_schema import AdviceMode, Industry
from stackforge_shared.templates import build_configuration

NAME, TITLE = "advisor-faithfulness", "AI CEO faithfulness"
INDUSTRIES = [Industry.saas, Industry.ecommerce, Industry.food_and_beverage, Industry.edtech]


class Recorder:
    """Wraps the LLM client and keeps every raw advisor answer."""

    def __init__(self, inner) -> None:
        self.inner = inner
        self.answers: list[dict] = []
        self.latencies: list[float] = []

    def generate_json(self, **kwargs):
        started = time.perf_counter()
        try:
            raw = self.inner.generate_json(**kwargs)
        finally:
            self.latencies.append(1000 * (time.perf_counter() - started))
        self.answers.append(raw)
        return raw


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sims", type=int, default=2)  # 18 questions: fits 20/day free tier
    parser.add_argument("--turns", type=int, default=6)
    parser.add_argument("--provider", choices=["gemini", "stub"], default=None)
    # The AI CEO model's free tier has a per-minute limit well below the agent model's.
    add_rpm_argument(parser, default=4)
    args = parser.parse_args(argv)

    # Each question costs exactly one request: no transparent 5xx retry. A 5xx is recorded as an
    # error instead, which keeps the run inside the free tier's daily quota.
    llm_client_module.SERVER_ERROR_RETRIES = 0

    s = settings()
    client, label = llm_client(args.provider, s, args.rpm)
    if client is None:
        write_not_run(NAME, TITLE, "No LLM configured: set LLM_API_KEY (Google Gemini).")
        return 0

    per_mode = {
        m: {
            "asked": 0,
            "claims": 0,
            "supported": 0,
            "first_ok": 0,
            "retried": 0,
            "delivered": 0,
            "withheld": 0,
            "errors": 0,
        }
        for m in AdviceMode
    }
    recorder = Recorder(client)
    failures: Counter[str] = Counter()
    for i in range(args.sims):
        industry = INDUSTRIES[i % len(INDUSTRIES)]
        config = build_configuration(industry)
        seed = 500 + i
        state, records = create_initial_state(config, seed), []
        for turn in range(1, args.turns + 1):
            decisions = accepted_only(state, config, POLICIES["growth"](state, config, turn, seed))
            records.append(run_turn(state, decisions, config, seed, turn))
            state = records[-1].state_after
        for record in records[1::2]:  # every second turn
            history = [summary_of(r) for r in records if r.turn_number < record.turn_number][-5:]
            context = advisor_context(record, history, config.industry, config.business_model)
            for mode in AdviceMode:
                stats = per_mode[mode]
                start = len(recorder.answers)
                advice = advise(
                    recorder,
                    s,
                    mode=mode,
                    question=None,
                    turn=record,
                    history=history,
                    industry=config.industry,
                    business_model=config.business_model,
                )
                answers = recorder.answers[start:]
                stats["asked"] += 1
                if not answers:
                    stats["errors"] += 1
                    failures[(advice.unavailable_reason or "unknown").split(" from ")[0]] += 1
                    continue
                for n, raw in enumerate(answers):
                    try:
                        report = check(_texts(AdvisorResponse.model_validate(raw)), context)
                    except Exception:
                        stats["errors"] += 1
                        continue
                    if n == 0:
                        total = len(report.claims)
                        stats["claims"] += total
                        stats["supported"] += total - len(report.unsupported)
                        stats["first_ok"] += not report.unsupported
                stats["retried"] += len(answers) > 1
                if advice.available:
                    stats["delivered"] += 1
                elif (advice.unavailable_reason or "").startswith("unsupported_figures"):
                    stats["withheld"] += 1
                else:
                    stats["errors"] += 1
                    failures[(advice.unavailable_reason or "unknown").split(" from ")[0]] += 1
        print(f"simulation {i + 1}/{args.sims} done")

    rows = []
    for mode, st in per_mode.items():
        asked = max(1, st["asked"])
        rows.append(
            [
                mode.value,
                st["asked"],
                st["claims"],
                f"{100 * st['supported'] / st['claims']:.1f}%" if st["claims"] else "n/a",
                f"{100 * st['first_ok'] / asked:.1f}%",
                f"{100 * st['retried'] / asked:.1f}%",
                f"{100 * st['delivered'] / asked:.1f}%",
                f"{100 * st['withheld'] / asked:.1f}%",
                st["errors"],
            ]
        )
    used = ", ".join(i.value for i in INDUSTRIES[: args.sims])
    write_table(
        NAME,
        TITLE,
        [
            "Mode",
            "Questions",
            "Numeric claims (first answers)",
            "Claims matching the record",
            "First answers fully faithful",
            "Retried",
            "Delivered",
            "Withheld (unsupported figures)",
            "Errors",
        ],
        rows,
        [
            f"LLM: {label}. {args.sims} seeded simulations ({used}), growth policy, "
            f"{args.turns} turns; the AI CEO was asked about every second turn "
            "in each mode with its default question.",
            "A claim matches when the figure (in any Indian format or unit) appears in the data "
            "the advisor was given (the turn record and recent history), within rounding. Small "
            "counts (<= 10) are not claims. Delivered advice is faithful by construction: the "
            "service retries once and withholds advice that still cites unsupported figures.",
            f"Mean advisor LLM latency {mean(recorder.latencies):,.0f} ms over "
            f"{len(recorder.latencies)} calls.",
            "Errors (no usable answer): "
            + (", ".join(f"{k} x{v}" for k, v in failures.most_common()) or "none")
            + ".",
        ],
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
