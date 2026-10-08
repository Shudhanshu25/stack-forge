"""Shared helpers for the evaluation scripts: import paths, settings, runs and result tables.

Every script runs with the simulation service's virtual environment, from any directory:
    simulation/.venv/Scripts/python evaluation/consistency.py      (Windows)
    simulation/.venv/bin/python evaluation/consistency.py          (Linux, macOS)
"""

import csv
import platform
import statistics
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SIMULATION_DIR = ROOT / "simulation"
RESULTS_DIR = ROOT / "evaluation" / "results"
sys.path.insert(0, str(SIMULATION_DIR))
sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]

from app.config import Settings  # noqa: E402
from app.llm.client import LLMClient, create_llm_client  # noqa: E402
from app.pipeline.turn import PipelineDeps, run_pipeline  # noqa: E402
from engine import ENGINE_VERSION  # noqa: E402
from engine.models import Decision, SimulationTurn  # noqa: E402
from stackforge_shared.models.pipeline_turn_request_schema import (  # noqa: E402
    PipelineTurnRequest,
)
from stackforge_shared.models.turn_summary_schema import TurnSummary  # noqa: E402

MEMORY_TURNS = 5  # as the backend: the last five turns are the agents' memory


def settings(**overrides) -> Settings:
    """The simulation service's settings, reading simulation/.env like the service does."""
    return Settings(_env_file=SIMULATION_DIR / ".env", **overrides)  # type: ignore[call-arg]


# Gemini's free tier allows 15 requests per minute per model; stay under it by default.
DEFAULT_RPM = 12


class Paced:
    """Spaces LLM calls so an evaluation stays within the provider's per-minute quota."""

    def __init__(self, inner: LLMClient, rpm: float) -> None:
        self.inner = inner
        self.interval = 60 / rpm if rpm > 0 else 0
        self.last = float("-inf")

    def generate_json(self, **kwargs):
        wait = self.last + self.interval - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        self.last = time.monotonic()
        return self.inner.generate_json(**kwargs)


def llm_client(provider: str | None, s: Settings, rpm: float = 0) -> tuple[LLMClient | None, str]:
    """The LLM client for an evaluation and a label for the result tables.

    rpm > 0 paces calls to at most that many per minute (stub calls are never paced).
    """
    provider = provider or s.llm_provider
    client = create_llm_client(provider, s.llm_api_key)
    if client is None:
        return None, "none"
    if provider == "stub":
        return client, "stub (offline test double, not a real model)"
    label = f"{provider} ({s.llm_agent_model} / {s.llm_advisor_model})"
    if rpm > 0:
        return Paced(client, rpm), f"{label}, paced to {rpm:g} requests/min"
    return client, label


def add_rpm_argument(parser, default: float = DEFAULT_RPM) -> None:
    parser.add_argument(
        "--rpm",
        type=float,
        default=default,
        help=f"max LLM requests per minute (default {default:g}: free tier; 0 = unpaced)",
    )


def summary_of(record: SimulationTurn) -> TurnSummary:
    """Python twin of backend toTurnSummary: what agents remember of a past turn."""
    s = record.state_after
    notes = " ".join(
        a.reasoning_summary
        for a in (record.agent_effects.customer, record.agent_effects.competitor)
        if a.source.value == "llm"
    )
    return TurnSummary(
        turn_number=record.turn_number,
        decisions=record.decisions,
        revenue=s.revenue,
        profit=s.profit,
        cash=s.cash,
        customers=s.customers,
        new_customers=s.new_customers,
        churned_customers=s.churned_customers,
        customer_satisfaction=s.customer_satisfaction,
        market_share=s.market_share,
        events=[e.type for e in record.events[:10]],
        **({"agent_summary": notes[:600]} if notes else {}),
    )


def pipeline_turn(
    state,
    decisions: list[Decision],
    config,
    seed: int,
    turn: int,
    mode: str,
    history: list[SimulationTurn],
    deps: PipelineDeps,
) -> SimulationTurn:
    """One turn through the full LangGraph pipeline, exactly as the service runs it."""
    request = PipelineTurnRequest(
        state=state,
        decisions=decisions,
        configuration=config,
        seed=seed,
        turn_number=turn,
        agent_mode=mode,
        memory=[summary_of(r) for r in history[-MEMORY_TURNS:]],
    )
    last = None
    for event in run_pipeline(request, deps):
        last = event
    if last is None or last.type.value != "result":
        error = last.error if last is not None else None
        raise RuntimeError(f"pipeline failed: {error}")
    return last.record


def percentile(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    k = (len(ordered) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (k - lo)


def mean(values: list[float]) -> float:
    return statistics.fmean(values) if values else float("nan")


def fmt(value: object, digits: int = 2) -> str:
    if isinstance(value, float):
        if value != value:
            return "n/a"
        return f"{value:.3f}" if abs(value) < 1 else f"{value:,.{digits}f}"
    if isinstance(value, int):
        return f"{value:,}"
    return str(value)


def write_table(
    name: str,
    title: str,
    headers: list[str],
    rows: list[list[object]],
    notes: list[str] | None = None,
) -> Path:
    """Writes evaluation/results/<name>.md (with context) and <name>.csv (raw values)."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    md = RESULTS_DIR / f"{name}.md"
    lines = [
        f"# {title}",
        "",
        f"Generated {datetime.now(UTC):%Y-%m-%d %H:%M} UTC · engine {ENGINE_VERSION} · "
        f"Python {platform.python_version()} on {platform.system()}",
        "",
        "| " + " | ".join(headers) + " |",
        "|" + "|".join("---" for _ in headers) + "|",
        *("| " + " | ".join(fmt(c) for c in row) + " |" for row in rows),
    ]
    if notes:
        lines += ["", *notes]
    md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    with (RESULTS_DIR / f"{name}.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"wrote {md.relative_to(ROOT)}")
    return md


def write_not_run(name: str, title: str, reason: str) -> Path:
    """A result file that says plainly why an evaluation was not run."""
    return write_table(name, title, ["status", "reason"], [["not run", reason]])
