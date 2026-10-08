# Stack Forge

Stack Forge is a turn-based startup simulator. A user creates a startup, makes monthly decisions (pricing, marketing, hiring, product quality), and a simulation engine computes what happens. LLM agents and an AI advisor sit on top of the computed numbers. It is a final-year engineering project, so reproducibility and measurable evaluation matter as much as features.

The full specification is `docs/SPEC.md`. Read it before starting a milestone; it is the source of truth for scope and behavior. If the spec conflicts with itself or with the code, say so in a sentence and state which reading you took.

## Stack

- `/frontend`: React, Vite, TypeScript
- `/backend`: Node.js, Express, TypeScript, MongoDB, BullMQ on Redis, WebSocket
- `/simulation`: Python, FastAPI, the simulation engine, ML forecasting, LLM agents
- `/shared`: JSON Schema contracts and the types generated from them
- `/infrastructure`: Docker Compose for MongoDB, Redis and the services
- `/docs`, `/evaluation`

## Architecture rules

1. **Python calculates, LLMs interpret.** Revenue, profit, customers, cash, expenses, churn and market share come only from the simulation engine. An LLM may produce bounded modifiers that the engine consumes and text that explains results; it never writes financial state.
2. **The engine is pure.** Code under `/simulation/engine` imports nothing from FastAPI, MongoDB, Redis or any LLM SDK, and does no I/O. This is what makes it testable and reproducible.
3. **Same inputs, same outputs.** Initial state, decisions, seed and stored agent effects fully determine a run. All randomness comes from a generator derived from the simulation seed and turn number; never call an unseeded random source or read the clock inside the engine.
4. **Turns are immutable.** A turn record is written once and never updated. Current state is the `stateAfter` of the latest turn.
5. **Handlers are thin.** React components, Express controllers and FastAPI routes hold no business or simulation logic; they validate, call a service, and return.
6. **Contracts are shared.** Every payload that crosses a service boundary is defined in `/shared/schemas` and validated at runtime on both sides. Change the schema first, regenerate types, then change code.
7. **LLM output is untrusted input.** Parse it against a schema, clamp or reject out-of-range values, and fall back to rule-based behavior on failure or timeout.
8. **Ownership is enforced server-side.** Every startup, simulation, turn and job query is scoped to the authenticated user.
9. **No secrets in code or logs.** Configuration comes from environment variables; passwords, tokens and API keys are never logged.
10. **Features ship with tests** for their behavior, and `/docs` is updated when architecture or API changes.
11. **Add a dependency only when it removes real work**, and say why in your final summary.

## Conventions

- JSON on the wire uses camelCase; Python uses snake_case internally and converts at the boundary.
- Money is an integer number of paise. Rates and scores are floats in a documented range.
- One turn is one month.
- Structured JSON logs carry `requestId`, `userId`, `startupId`, `simulationId`, `turn`, `jobId`, `engineVersion` and `modelVersion` where they apply.
- API errors use one shape: `{ "error": { "code", "message", "details" } }`.

## Commands

Keep this section current as the project grows: how to install, start each service, start everything with Docker Compose, run each test suite, regenerate shared types, and train the forecasting model.

Prerequisites: Node 22+, Python 3.12, and Docker (for MongoDB and Redis). Run commands from the repo root unless a `cd` is shown.

```bash
# Install
npm install                                            # all Node workspaces: shared, backend, frontend
python -m venv simulation/.venv
cd simulation && .venv/Scripts/python -m pip install -r requirements-dev.txt   # from simulation/ (the shared package path is relative); macOS/Linux: .venv/bin/python
cp backend/.env.example backend/.env                   # then set JWT_ACCESS_SECRET (32+ chars)
cp frontend/.env.example frontend/.env
cp simulation/.env.example simulation/.env

# Dependencies (MongoDB on 27017, Redis on 6379)
docker compose -f infrastructure/docker-compose.dev.yml up -d
docker compose -f infrastructure/docker-compose.dev.yml down

# Start each service (separate terminals)
cd simulation && .venv/Scripts/python -m app.main      # FastAPI on http://127.0.0.1:8000
npm run dev:backend                                    # API on http://localhost:4000/api/v1, WebSocket /api/v1/ws (tsx watch)
npm run worker -w backend                              # turn worker (BullMQ); needs Redis, MongoDB and FastAPI
npm run dev:frontend                                   # React on http://localhost:5173

# Health
curl localhost:4000/health
curl localhost:4000/health/services

# Tests
npm test                                               # shared contracts + backend + frontend
npm test -w shared                                     # schemas compile, templates valid
npm test -w backend                                    # API tests; in-memory MongoDB (downloads mongod on first run)
                                                       # also starts FastAPI from simulation/.venv for the contract test
TEST_REDIS_URL=redis://127.0.0.1:6379/15 npm test -w backend   # adds the BullMQ test (flushes that Redis db)
npm test -w frontend
cd simulation && .venv/Scripts/python -m pytest              # includes engine unit, property, determinism and replay tests

# Simulation engine from the command line (see docs/simulation.md)
cd simulation && .venv/Scripts/python -m runner --industry SAAS --turns 10 --seed 42
cd simulation && .venv/Scripts/python -m runner --industry all --turns 12 --policy growth --json records.json
cd simulation && .venv/Scripts/python -m runner.viability --turns 24 --seeds 10   # template calibration check

# Lint and format
npm run lint                                           # ESLint + Prettier check
npm run format
cd simulation && .venv/Scripts/python -m ruff check . && .venv/Scripts/python -m ruff format --check .

# Typecheck and build
npm run typecheck -w backend && npm run typecheck -w frontend
npm run build                                          # backend -> backend/dist, frontend -> frontend/dist

# Shared contracts: edit shared/schemas, then regenerate TS and Python types
npm run generate

# Forecasting: generate the dataset, train and compare models, save the best (about 40 s).
# Writes evaluation/results/model-comparison.{md,csv}; models go to simulation/ml/artifacts (git-ignored).
cd simulation && .venv/Scripts/python -m ml.train            # --sims 500 --quick for a fast run

# LLM agents and AI CEO: set LLM_API_KEY (Gemini) in simulation/.env. Without it, llm-mode agents
# fall back to rules and advice is unavailable. Tests never need a key (they use FakeLLMClient).

# Backend test fixture: a real engine run that the fake engine replays (regenerate after engine changes)
cd simulation && .venv/Scripts/python -m runner.fixture ../backend/tests/fixtures/saas-run.json

# Make a user an admin
npm run promote-admin -w backend -- user@example.com

# MongoDB migrations (backend/src/migrations; the deploy runs them; dev also auto-indexes)
npm run migrate -w backend
npm run migrate -w backend -- --status

# Location data: rebuild india.json from the research sources, then docs/locations.md from it
cd simulation && .venv/Scripts/python data/locations/build.py && .venv/Scripts/python data/locations/docs.py

# Engine versions: freeze the current engine before changing formulas (docs/simulation.md)
cd simulation && .venv/Scripts/python -m engine_freeze            # then edit engine/, bump ENGINE_VERSION
cd simulation && .venv/Scripts/python -m engine_freeze --fixture  # replay fixture for the new version

# API reference on a running stack: http://localhost:4000/api/v1/docs

# Monitoring in development: Prometheus :9090, Tempo OTLP :4318, Grafana :3000; then set
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 for the API, worker and simulation service
docker compose -f infrastructure/docker-compose.dev.yml --profile observability up -d

# Production stack (Docker): Caddy on 80/443 is the only published service (docs/deployment.md)
cp infrastructure/.env.prod.example infrastructure/.env.prod      # fill in the secrets
docker compose -f infrastructure/docker-compose.prod.yml --env-file infrastructure/.env.prod up -d --build
docker compose -f infrastructure/docker-compose.prod.yml --env-file infrastructure/.env.prod down
docker compose -f infrastructure/docker-compose.prod.yml --env-file infrastructure/.env.prod run --rm --no-deps api node dist/migrate.js
IMAGE_PREFIX=ghcr.io/<owner>/stackforge infrastructure/deploy/deploy.sh <sha>   # on the server; CI runs this
infrastructure/backup/restore.sh                    # restore the newest backup (or pass a dump; --now to take one)
ssh -L 3000:localhost:3000 <server>                 # Grafana on the server (bound to localhost)

# CI/CD: .github/workflows/ci.yml (pull requests) and deploy.yml (merge to main); see docs/deployment.md

# Load tests (k6) against the running prod stack; results in docs/performance.md
docker run --rm --network stackforge_edge -v "$PWD/evaluation/load:/scripts:ro" grafana/k6 run /scripts/turns.js

# Evaluation: tables go to evaluation/results/{name}.md and .csv (docs/testing.md)
simulation/.venv/Scripts/python evaluation/run_all.py --skip-training       # all in-process evaluations
simulation/.venv/Scripts/python evaluation/consistency.py                   # invariants, determinism, replay
simulation/.venv/Scripts/python evaluation/location_comparison.py          # the same startup in all 20 cities
simulation/.venv/Scripts/python evaluation/model_comparison.py              # same as python -m ml.train
simulation/.venv/Scripts/python evaluation/advisor_faithfulness.py         # needs LLM_API_KEY; 18 questions at 4/min fit the free tier
simulation/.venv/Scripts/python evaluation/agents_vs_rules.py               # needs LLM_API_KEY; paced to 12 req/min (--rpm 0 on a paid key)
simulation/.venv/Scripts/python evaluation/performance.py --api http://localhost:4000/api/v1 --concurrent 10
cd evaluation && ../simulation/.venv/Scripts/python -m ruff check . && ../simulation/.venv/Scripts/python -m ruff format --check .

# Demo: NovaTech through the running API (dev default http://localhost:4000/api/v1)
simulation/.venv/Scripts/python demo/novatech.py
simulation/.venv/Scripts/python demo/novatech.py --api https://localhost/api/v1 --insecure   # production proxy
# DEMO_EMAIL / DEMO_PASSWORD reuse an account you can then open in the browser. New accounts are
# confirmed from the development email outbox (backend/.outbox; STACKFORGE_OUTBOX to override).

# Accessibility check (axe in both themes + keyboard flows on the main routes; installs Chromium once)
cd frontend && npx playwright install chromium && npm run test:a11y
cd frontend && SHOT_DIR=../screenshots npx playwright test e2e/screenshots.spec.ts   # both themes, for review (run after a build)

# Prompt evals: fixed eval set through the current prompts (fake client; CI) or the real model
simulation/.venv/Scripts/python evaluation/prompts/run_evals.py
simulation/.venv/Scripts/python evaluation/prompts/run_evals.py --provider gemini --rpm 4
simulation/.venv/Scripts/python evaluation/prompts/build_cases.py     # rebuild the eval set (on purpose only)

# Emails in development go to backend/.outbox/*.html (EMAIL_PROVIDER=outbox): open the link there.
# Real delivery from a Gmail account: EMAIL_PROVIDER=smtp plus SMTP_USER / SMTP_PASSWORD (a Google
# App Password) and EMAIL_FROM in backend/.env, then restart the API (docs/deployment.md).

# Stub LLM (tests and offline smoke runs only; refused when APP_ENV=production)
LLM_PROVIDER=stub .venv/Scripts/python -m app.main                  # from simulation/
```


## How to work

Deliver what was asked, at the scope intended. Make routine judgment calls yourself, and check in only when different readings of the request would lead to materially different work. If the request seems mistaken or a better approach exists, say so in a sentence and continue with the task as asked rather than quietly narrowing, widening, or transforming it. Finish the whole task, and stop short of actions that are clearly beyond what was asked.

Before your first tool call, say in one sentence what you're about to do. While working, give a brief update only when you find something important or change direction. When you finish, lead with the outcome: your first sentence should answer "what happened" or "what did you find," with supporting detail after it for readers who want it.

Delegate to a subagent only for large tasks that are genuinely independent and parallelizable, such as a wide multi-file investigation. Do not delegate work you can finish yourself in a handful of tool calls, and do not use subagents to verify or double-check your own work. If one subagent can complete the task, use one rather than several, and keep spawn counts low.

Match the length of written documents to what the task needs: cover the substance, but do not pad with filler sections, redundant summaries, or boilerplate.
