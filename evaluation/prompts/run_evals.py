"""Prompt regression evals: runs the fixed eval set (cases.json) through the current prompts.

    python evaluation/prompts/run_evals.py                    # fake client (CI; no key)
    python evaluation/prompts/run_evals.py --provider gemini  # the real model (needs LLM_API_KEY)

Every case is rendered with the same prompt builders the service uses, so a prompt change is
tested exactly as it will run. Checks per answer:
  - schema validity: the answer parses as the agent's or advisor's response schema;
  - range compliance: agent values inside their ranges (and how often inside the per-turn caps);
  - numeric faithfulness: the advisor cites only figures present in its computed input (not
    figures from the founder's question or profile, which the injection cases try to plant).
Writes evaluation/results/prompt-evals-<provider>.{md,csv}. With the fake client every check
must pass (exit 1 otherwise); with a real provider the table reports the rates.
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from common import add_rpm_argument, llm_client, settings, write_table
from pydantic import ValidationError

from app import prompts
from app.advisor.advisor import AdvisorResponse, _texts, advisor_prompt
from app.advisor.faithfulness import check
from app.agents.agents import COMPETITOR, CUSTOMER, agent_prompt
from app.llm.client import FakeLLMClient, LLMError
from stackforge_shared.models.startup_profile_schema import StartupProfile

CASES = Path(__file__).resolve().parent / "cases.json"
SPECS = {"customer_agent": CUSTOMER, "competitor_agent": COMPETITOR}
RANGES = {
    "sentimentChange": (-1.0, 1.0),
    "demandModifier": (-1.0, 1.0),
    "competitorThreat": (0.0, 1.0),
}


def fake_client() -> FakeLLMClient:
    """Deterministic, well-behaved answers built from each case's own data, so CI checks the
    eval machinery and the prompts' plumbing (rendering, parsing, checks), not a model."""

    def data(prompt: str) -> dict:
        return json.loads(prompt.split("<data>\n", 1)[1].rsplit("\n</data>", 1)[0])

    def agent(kind: str):
        def answer(prompt: str) -> dict:
            out = {"demandModifier": 0.02, "reasoningSummary": f"{kind} react calmly."}
            if kind == "Customers":
                return {**out, "sentimentChange": -0.01}
            return {**out, "competitorThreat": 0.2}

        return answer

    def advisor(prompt: str) -> dict:
        revenue = data(prompt)["simulation"]["newState"]["revenueRupees"]
        digits = str(revenue)
        head, tail = digits[:-3], digits[-3:]
        grouped = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", head) + "," + tail if head else tail
        return {
            "summary": f"Revenue was ₹{grouped} this month.",
            "positiveFactors": ["Steady demand"],
            "negativeFactors": ["Costs are high"],
            "keyRisk": "Cash runway",
            "keyOpportunity": "Word of mouth",
            "recommendation": "Watch costs before raising spend",
            "reasoning": "Based on this month's computed results.",
            "confidence": 0.6,
        }

    return FakeLLMClient(
        responses={
            "customer_agent": [agent("Customers")],
            "competitor_agent": [agent("Competitors")],
            "advisor": [advisor],
        }
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", choices=["fake", "gemini", "stub"], default="fake")
    add_rpm_argument(parser, default=4)
    args = parser.parse_args(argv)

    s = settings()
    if args.provider == "fake":
        client, label = fake_client(), "fake client (deterministic; CI)"
    else:
        client, label = llm_client(args.provider, s, args.rpm)
        if client is None:
            print("No LLM configured: set LLM_API_KEY", file=sys.stderr)
            return 2

    cases = json.loads(CASES.read_text(encoding="utf-8"))
    stats = defaultdict(lambda: defaultdict(int))
    failures: list[str] = []
    for case in cases:
        purpose = case["purpose"]
        st = stats[purpose]
        st["cases"] += 1
        st["injection"] += case["injection"]
        if case["kind"] == "agent":
            spec = SPECS[purpose]
            system, prompt, schema = (
                spec.prompt.system,
                agent_prompt(case["context"]),
                spec.response,
            )
            model = s.llm_agent_model
        else:
            profile = StartupProfile.model_validate(case["profile"])
            system = prompts.load("advisor").system
            prompt = advisor_prompt(case["mode"], case["question"], profile, case["context"])
            schema, model = AdvisorResponse, s.llm_advisor_model
        try:
            raw = client.generate_json(
                purpose=purpose,
                model=model,
                system=system,
                prompt=prompt,
                response_schema=schema,
                timeout_s=max(s.llm_timeout_s, 20),
            )
        except LLMError as exc:
            st["errors"] += 1
            failures.append(f"{case['id']}: {exc.kind} ({exc})")
            continue
        try:
            parsed = schema.model_validate(raw)
        except ValidationError as exc:
            failures.append(f"{case['id']}: schema: {exc.errors()[0]['msg']}")
            continue
        st["schema_ok"] += 1
        if case["kind"] == "agent":
            values = {k: raw.get(k) for k in RANGES if k in raw}
            in_range = all(
                lo <= float(values[k]) <= hi for k, (lo, hi) in RANGES.items() if k in values
            )
            within_caps = (
                abs(raw.get("demandModifier", 0)) <= s.agent_demand_cap
                and abs(raw.get("sentimentChange", 0)) <= s.agent_sentiment_cap
            )
            st["range_ok"] += in_range
            st["within_caps"] += within_caps
            if not in_range:
                failures.append(f"{case['id']}: out of range {values}")
        else:
            report = check(_texts(parsed), case["context"])
            st["claims"] += len(report.claims)
            st["supported"] += len(report.claims) - len(report.unsupported)
            st["faithful_answers"] += not report.unsupported
            if report.unsupported:
                cited = ", ".join(c.text for c in report.unsupported[:5])
                failures.append(f"{case['id']}: unsupported figures {cited}")

    rows = []
    for purpose, st in stats.items():
        version = prompts.load(purpose).version
        answered = st["cases"] - st["errors"]
        pct = lambda n, d: f"{100 * n / d:.0f}%" if d else "n/a"  # noqa: E731
        is_agent = purpose != "advisor"
        rows.append(
            [
                purpose,
                version,
                st["cases"],
                st["injection"],
                st["errors"],
                pct(st["schema_ok"], answered),
                pct(st["range_ok"], st["schema_ok"]) if is_agent else "n/a",
                pct(st["within_caps"], st["schema_ok"]) if is_agent else "n/a",
                "n/a" if is_agent else pct(st["supported"], st["claims"]),
                "n/a" if is_agent else pct(st["faithful_answers"], st["schema_ok"]),
            ]
        )
    notes = [
        f"Provider: {label}. Eval set: {len(cases)} saved pipeline inputs "
        f"(evaluation/prompts/cases.json), 3 with prompt-injection text in the founder's "
        "profile or question.",
        "Range compliance uses the schema ranges ([-1, 1], threat [0, 1]); out-of-range answers "
        "are rejected by the service and replaced by rules. Within caps: inside the per-turn "
        f"caps (demand ±{s.agent_demand_cap}, sentiment ±{s.agent_sentiment_cap}) before "
        "clamping. Faithfulness counts figures checked against the computed data only.",
    ]
    if failures:
        notes += ["", "Findings:", *(f"- {f}" for f in failures)]
    write_table(
        f"prompt-evals-{args.provider}",
        "Prompt regression evals",
        ["Prompt", "Version", "Cases", "Injection cases", "Errors", "Schema valid",
         "In range", "Within caps", "Claims matching data", "Fully faithful answers"],
        rows,
        notes,
    )  # fmt: skip
    for f in failures:
        print(f"FAIL {f}")
    return 1 if failures and args.provider == "fake" else 0


if __name__ == "__main__":
    raise SystemExit(main())
