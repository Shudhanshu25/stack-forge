"""Performance: engine and pipeline turn time, ML and LLM latency, API latency, concurrency.

In-process measurements always run. API latency and concurrent simulations need the running
stack (API, worker, simulation service, MongoDB, Redis); pass its base URL with --api.

    python evaluation/performance.py
    python evaluation/performance.py --api http://localhost:4000/api/v1 --concurrent 10
    python evaluation/performance.py --api https://localhost/api/v1 --insecure   (production proxy)
"""

import argparse
import time
from concurrent.futures import ThreadPoolExecutor

from common import (
    llm_client,
    mean,
    percentile,
    pipeline_turn,
    settings,
    write_table,
)

from app.pipeline.turn import PipelineDeps
from engine import create_initial_state, run_turn
from ml.forecast import forecast
from runner.policies import POLICIES, accepted_only
from stackforge_shared.templates import build_configuration

STARTUP = {
    "name": "PerfCo",
    "industry": "SAAS",
    "businessModel": "SUBSCRIPTION",
    "initialCapital": 100_000_000,
    "product": {"name": "Perf", "description": "Performance evaluation"},
    "initialPrice": 49_900,
    "marketSize": 200_000,
    "difficulty": "NORMAL",
    "location": {
        "country": "IN",
        "state": "KA",
        "city": "Bengaluru",
        "cityId": "bengaluru",
        "tier": "METRO",
    },
}
DECISIONS = [{"type": "MARKETING", "value": 5_000_000}]


def timed(fn, *args, **kwargs) -> tuple[object, float]:
    started = time.perf_counter()
    result = fn(*args, **kwargs)
    return result, 1000 * (time.perf_counter() - started)


def row(name: str, samples: list[float], note: str = "") -> list[object]:
    return [
        name,
        len(samples),
        round(mean(samples), 2),
        round(percentile(samples, 0.5), 2),
        round(percentile(samples, 0.95), 2),
        note,
    ]


def in_process(turns: int, provider: str | None) -> list[list[object]]:
    config = build_configuration("SAAS")
    rows = []

    # Engine: one turn of pure computation.
    engine_ms, state = [], create_initial_state(config, 1)
    for seed in range(1, 21):
        state = create_initial_state(config, seed)
        for turn in range(1, turns + 1):
            decisions = accepted_only(state, config, POLICIES["random"](state, config, turn, seed))
            record, ms = timed(run_turn, state, decisions, config, seed, turn)
            engine_ms.append(ms)
            state = record.state_after
            if state.cash < 0:
                break
    rows.append(row("Engine turn (run_turn)", engine_ms, "pure computation"))

    # Forecast: one next-turn prediction with the served model.
    probe = forecast(state, config.industry)
    if probe.available:
        samples = [timed(forecast, state, config.industry)[1] for _ in range(200)]
        rows.append(row("ML forecast", samples, probe.model_version or ""))
    else:
        rows.append(["ML forecast", 0, "n/a", "n/a", "n/a", probe.unavailable_reason])

    # Full pipeline, rules mode (validation, events, engine, forecast; no LLM calls).
    s = settings(advisor_on_turn=False)
    deps = PipelineDeps(settings=s, llm=None)
    pipe_ms, state, history = [], create_initial_state(config, 7), []
    for turn in range(1, turns + 1):
        decisions = accepted_only(state, config, POLICIES["steady"](state, config, turn, 7))
        record, ms = timed(pipeline_turn, state, decisions, config, 7, turn, "rules", history, deps)
        pipe_ms.append(ms)
        history.append(record)
        state = record.state_after
    rows.append(row("Pipeline turn, rules mode", pipe_ms, "LangGraph, 7 stages"))

    # LLM latency: one agent call per sample, if a model is configured.
    s = settings()
    client, label = llm_client(provider, s)
    if client is None:
        rows.append(["LLM agent call", 0, "n/a", "n/a", "n/a", "not run: no LLM configured"])
    else:
        latencies = []

        class Timing:
            def generate_json(self, **kwargs):
                result, ms = timed(client.generate_json, **kwargs)
                latencies.append(ms)
                return result

        deps = PipelineDeps(settings=s, llm=Timing())
        state, history = create_initial_state(config, 11), []
        for turn in range(1, min(turns, 5) + 1):
            record = pipeline_turn(state, [], config, 11, turn, "llm", history, deps)
            history.append(record)
            state = record.state_after
        rows.append(row("LLM call (agents + AI CEO)", latencies, label))
    return rows


def api_rows(base: str, verify: bool, requests_n: int, concurrent: int, turns: int):
    from api_client import StackForgeApi

    api = StackForgeApi(base, verify=verify)
    rows = []
    try:
        api.throwaway_user("perf")
        startup = api.request("POST", "/startups", STARTUP)
        sim = api.request(
            "POST", f"/startups/{startup['id']}/simulation", {"seed": 42, "agentMode": "rules"}
        )
        sid = sim["id"]
        for name, method, path, body in [
            ("GET /simulations/:id", "GET", f"/simulations/{sid}", None),
            (
                "POST /simulations/:id/preview",
                "POST",
                f"/simulations/{sid}/preview",
                {"decisions": DECISIONS},
            ),
        ]:
            samples = [timed(api.request, method, path, body)[1] for _ in range(requests_n)]
            rows.append(row(f"API {name}", samples))
        turn_ms = []
        for _ in range(min(turns, 6)):
            job, ms = timed(api.play_turn, sid, DECISIONS if not turn_ms else [])
            if job["status"] != "COMPLETED":
                raise RuntimeError(f"turn failed: {job.get('error')}")
            turn_ms.append(ms)
        rows.append(row("API turn, submit to completed", turn_ms, "queue + worker + pipeline"))
        samples = [timed(api.request, "GET", f"/simulations/{sid}/analytics")[1] for _ in range(20)]
        rows.append(row("API GET /simulations/:id/analytics", samples))

        # Concurrency: one user, `concurrent` simulations each playing `turns` turns at once.
        sims = []
        for i in range(concurrent):
            st = api.request("POST", "/startups", {**STARTUP, "name": f"PerfCo {i}"})
            sims.append(api.request("POST", f"/startups/{st['id']}/simulation", {"seed": i})["id"])

        def play(simulation_id: str) -> list[float]:
            out = []
            for t in range(turns):
                job, ms = timed(api.play_turn, simulation_id, DECISIONS if t == 0 else [])
                if job["status"] != "COMPLETED":
                    raise RuntimeError(f"turn failed: {job.get('error')}")
                out.append(ms)
            return out

        started = time.perf_counter()
        with ThreadPoolExecutor(max_workers=concurrent) as pool:
            results = list(pool.map(play, sims))
        wall = time.perf_counter() - started
        all_turns = [ms for r in results for ms in r]
        rows.append(
            row(
                f"{concurrent} concurrent simulations, turn latency",
                all_turns,
                f"{len(all_turns)} turns in {wall:.1f}s = {len(all_turns) / wall:.1f} turns/s",
            )
        )
    finally:
        api.close()
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--turns", type=int, default=12)
    parser.add_argument("--provider", choices=["gemini", "stub"], default=None)
    parser.add_argument("--api", help="API base URL, e.g. http://localhost:4000/api/v1")
    parser.add_argument("--insecure", action="store_true", help="accept a local CA certificate")
    parser.add_argument("--requests", type=int, default=50)
    parser.add_argument("--concurrent", type=int, default=10)
    args = parser.parse_args(argv)

    rows = in_process(args.turns, args.provider)
    notes = ["All times in milliseconds."]
    if args.api:
        rows += api_rows(
            args.api, not args.insecure, args.requests, args.concurrent, min(args.turns, 6)
        )
        notes.append(f"API measured against {args.api} from the same machine.")
    else:
        rows.append(
            [
                "API latency and concurrency",
                0,
                "n/a",
                "n/a",
                "n/a",
                "not run: pass --api with the running stack's URL",
            ]
        )
    write_table(
        "performance",
        "Performance",
        ["Measurement", "Samples", "Mean ms", "p50 ms", "p95 ms", "Notes"],
        rows,
        notes,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
