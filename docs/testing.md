# Testing and evaluation

## Test suites

| Suite | Command | What it covers |
| --- | --- | --- |
| Shared contracts | `npm test -w shared` | Every schema compiles; templates and examples validate. |
| Backend | `npm test -w backend` | Auth, ownership, startups, simulations, jobs, idempotency keys, engine-version propagation, OpenAPI (every catalogued route exists, every `$ref` resolves), migrations, tracing and metrics, WebSocket, reports, admin, reliability, end-to-end. MongoDB is in-memory (`mongodb-memory-server`). |
| Backend + Redis | `TEST_REDIS_URL=redis://127.0.0.1:6379/15 npm test -w backend` | Adds the BullMQ + pub/sub test. It flushes that Redis database, so do not point it at one a running worker uses. |
| Frontend | `npm test -w frontend` | Decision building, money parsing, formatting, the wizard, socket URLs, the pipeline checklist, fuzzy search, no hardcoded colours; component tests (jsdom, Testing Library) for theme persistence and the system fallback, reduced motion and the KPI count-up, the command palette by keyboard, every empty, loading and error state, toasts, event cards and comparison bars. |
| Simulation | `cd simulation && .venv/Scripts/python -m pytest` | Engine unit tests, property tests (Hypothesis) for invariants, determinism and replay, pipeline with fake LLMs, agents, advisor faithfulness check, ML dataset/training/forecast, routes, engine purity (no forbidden imports). |

Tests never call a real LLM: Python tests use `FakeLLMClient` (scripted answers and errors), and the end-to-end test runs FastAPI with `LLM_PROVIDER=stub`, a deterministic offline client that is refused when `APP_ENV=production`.

The simulation suite also replays every retained engine version's stored fixture (`tests/test_engine_versions.py`) and checks that one turn is one trace through the pipeline and that LLM calls and tokens are counted (`tests/test_observability.py`).

All of these run on every pull request in `.github/workflows/ci.yml`, together with the stale-generated-types check and a CI-sized consistency evaluation ([deployment.md](deployment.md#cicd)).

**Load tests** (k6, `evaluation/load/`: auth, playing turns, WebSocket subscribers) run against the Docker stack; results and observed limits are in [performance.md](performance.md).

**Milestone 8 coverage.** Backend: `account.test.ts` (verification, password reset by emailed code (wrong, reused, expired and replaced codes, five-try limit including parallel guesses), Google sign-in with PKCE and state checks, sessions, migration 003), `data-rights.test.ts` (export contents, deletion with password and confirmation, anonymous admin totals, queued-turn cancellation), `llm-usage.test.ts` (allowance sent with turns and advice, usage recorded once, daily reset). Simulation: `test_llm_safeguards.py` (prompt versions recorded, per-turn budget, an exhausted quota means no LLM call and rules mode, agent cache hits and replay, injection attempts through the startup profile and the advisor question). Email, Google and the LLM are always fakes in tests (`MemoryEmailSender`, `FakeGoogleOAuth`, `FakeLLMClient`).

**Milestone 10 coverage.** Simulation: `test_location.py` (profile resolution for a listed city, another city and the neutral profile; every data value has a source and an estimate flag; each engine effect in isolation; local demand weighting; idempotence; event conditions and draw alignment; determinism and replay for a located startup; two cities differ on the same seed; engine 1.1.0 replays every engine 1.0.0 fixture run unchanged; the service's location endpoints and analytics panel). The 1.1.0 replay fixture includes a run located in Pune. Backend: `locations.test.ts` (catalog and profile preview, creation in a listed or another city, unknown places, the location lock once a simulation starts, migration 005). Frontend: the wizard's location step and summary, the picker, the profile card's wording and estimate labels, the header and the analytics panel; the accessibility check covers the location step and the Location tab in both themes.

**City comparison:** `simulation/.venv/Scripts/python evaluation/location_comparison.py` runs the same industry template, seed and decision policy in all 20 cities for twelve turns (Food & Beverage and SaaS side by side) and writes `evaluation/results/location-comparison.md`.

**Accessibility:** `npm run test:a11y -w frontend` (axe on the main routes in both themes at desktop and phone width, keyboard flows, the command palette, theme persistence, reduced motion); see [frontend.md](frontend.md#accessibility).

**Prompt evals:** `simulation/.venv/Scripts/python evaluation/prompts/run_evals.py` (fake client, in CI) or `--provider gemini` (manual workflow); see [agents.md](agents.md#prompt-regression-evals).

### End to end

`backend/tests/e2e.test.ts` starts the real simulation service (`simulation/.venv`, stub LLM) on a free port and drives the real backend against it: register → create NovaTech → start an `llm`-mode simulation → preview a decision → play the turn through the worker's processor → read the simulation, turns and analytics → ask the AI CEO. Only Redis is replaced (by the in-process queue). It is skipped if the Python environment is missing; set `SIM_PYTHON` to point at another interpreter.

## Reliability

Every failure below gives the user a clear error and never writes a partial turn: a turn record is either written whole, once, or not at all.

| Failure | Behaviour | Test |
| --- | --- | --- |
| **LLM timeout or error** | Each agent falls back to its rule-based effects (`source: rules_fallback`, `fallbackReason` shown in the Market panel); the turn completes. The AI CEO returns `available: false` with the reason. | `test_pipeline_llm.py::test_unreachable_llm_still_completes_the_turn_on_rules`, `test_bad_agent_output_falls_back_to_rules_and_says_why` |
| **LLM invents figures** | Advice is retried once with feedback, then withheld (`unsupported_figures`). | `test_advice_with_invented_figures_is_retried_then_withheld` |
| **ML model missing** | Forecast `available: false`, reason "No trained forecasting model"; the turn completes. | `test_missing_model_gives_an_unavailable_forecast` |
| **ML model corrupt or failing** | Forecast `available: false` ("could not be loaded" / "failed"); the turn completes. | `test_corrupt_model_gives_an_unavailable_forecast`, `test_a_failing_prediction_gives_an_unavailable_forecast` |
| **Redis unavailable** | Playing a turn returns 503 `QUEUE_UNAVAILABLE` within 3 s; the job is marked FAILED, the simulation lock is released, no turn is written. Reads keep working. Live events are best-effort; the UI falls back to polling the job. | `reliability.test.ts` › Redis unavailable |
| **MongoDB unavailable** | Requests fail within 2.5 s with 503 `SERVICE_UNAVAILABLE`. If the turn record cannot be saved the job fails with `DATABASE_UNAVAILABLE` and nothing is written. If even that cannot be recorded the job throws, BullMQ retries it (4 attempts, exponential backoff from 5 s) and the worker's reconcile loop re-queues it once MongoDB is back; the idempotent processor never writes a turn twice. A worker started while MongoDB is down waits for it. | `reliability.test.ts` › MongoDB unavailable (4 tests) |
| **FastAPI unavailable** | Start, preview, scenarios, analytics and advice return 503 `SIMULATION_ENGINE_UNAVAILABLE`; a turn job fails with `ENGINE_UNAVAILABLE` (or `ENGINE_TIMEOUT` after the pipeline timeout), no turn is written and the simulation is unlocked. | `reliability.test.ts` › FastAPI unavailable, `engine-client.test.ts` |

If Redis goes down *after* a job was queued, a job still QUEUED after 15 s is failed with `QUEUE_UNAVAILABLE` the next time it is read (the UI polls it once live events stop), the simulation is unlocked and nothing is written; if Redis later delivers the job, the worker skips it because it only claims QUEUED jobs. A queued job can be cancelled while Redis is down. Tests: `reliability.test.ts` › Redis lost after a turn was queued.

## Evaluation

Scripts in `/evaluation` write Markdown and CSV tables to `evaluation/results/`. Run them with the simulation virtual environment from the repository root:

```bash
simulation/.venv/Scripts/python evaluation/run_all.py --skip-training       # everything in-process
simulation/.venv/Scripts/python evaluation/consistency.py --seeds 20 --turns 24
simulation/.venv/Scripts/python evaluation/model_comparison.py              # = python -m ml.train
simulation/.venv/Scripts/python evaluation/advisor_faithfulness.py         # needs LLM_API_KEY; 18 questions at 4/min fit the free tier
simulation/.venv/Scripts/python evaluation/agents_vs_rules.py               # needs LLM_API_KEY; paced to 12 req/min (--rpm 0 on a paid key)
simulation/.venv/Scripts/python evaluation/performance.py --api http://localhost:4000/api/v1 --concurrent 10
```

| Evaluation | Result file | Method |
| --- | --- | --- |
| Simulation consistency | `consistency.md` | 8 industries × 3 difficulties × 3 policies × N seeds, up to 24 turns. Checks accounting invariants after every turn, plays every run twice (must be identical) and replays it from stored records (every `stateAfter` must match). |
| ML model comparison | `model-comparison.md` | Linear Regression, Random Forest and XGBoost per target on held-out runs (split by run), with a persistence reference row. See [ml.md](ml.md). |
| Advisor faithfulness | `advisor-faithfulness.md` | Seeded simulations; the AI CEO is asked about every second turn in each mode. Every figure in the model's raw answers is checked against the data it was given. Reports claim accuracy, first-answer faithfulness, retry and withheld rates. |
| Agents vs rules | `agents-vs-rules.md` | Same seeds and decisions through the full pipeline in `rules` and `llm` mode; final-turn revenue/customer/cash gaps, mean modifiers, fallback rate. |
| Performance | `performance.md` | Engine turn, ML forecast, rules-mode pipeline, LLM call latency in-process; with `--api`: request latency, submit-to-completed turn time and N concurrent simulations against the running stack. |

**Gemini free tier.** A free key allows 15 requests/minute for the agent model and only 20 requests/day for the AI CEO model; over the limit Gemini returns HTTP 429, agents fall back to rules and advice is unavailable (the reason, with the status code, is recorded). The LLM evaluations therefore pace their calls (`--rpm`, default 12) and tabulate failure reasons, and the faithfulness run should be sized to the daily limit (`--sims 2` = 18 questions). In the app, a free key gives about 20 turns of AI CEO advice per day.

The two LLM evaluations write a "not run" table when no key is configured. `--provider stub` exercises their mechanics offline, but those numbers describe the test double, not a model, and should not be reported.
