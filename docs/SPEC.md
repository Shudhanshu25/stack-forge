# Stack Forge Specification

This is the complete specification. It is organized into six milestones; each one ends with the project in a runnable state. Architecture rules and conventions are in `CLAUDE.md` and apply throughout.

## Fill in before starting

- **LLM provider and model:** Google Gemini / `gemini-3.5-flash-lite` for the customer and competitor agents and `gemini-3.8-flash` for the AI CEO (both configurable), key in `LLM_API_KEY`. All LLM calls go through one client module so the provider can be swapped.
- **Agent orchestration framework:** LangGraph.

## System overview

```text
React  ──REST + WebSocket──►  Node/Express  ──HTTP──►  FastAPI
                                │      │                  │
                             MongoDB  Redis/BullMQ     engine, agents, forecast, advisor
```

- **Node owns persistence and users.** Auth, startups, simulations, turn records, jobs and WebSocket delivery live here. MongoDB is accessed only from Node.
- **Python is stateless.** Every request carries the state it needs and returns a result; nothing is stored between calls except trained model artifacts on disk.
- **Turns run as jobs.** Node enqueues a BullMQ job, a Node worker calls the Python turn pipeline, relays stage progress over WebSocket, and writes the turn record.

---

## Milestone 1: Foundation

### Repository

Monorepo with the folders listed in `CLAUDE.md`. ESLint and Prettier for TypeScript, a formatter and linter for Python, environment variable loading with a committed `.env.example`, structured logging, and centralized error handling in both services. Docker Compose starts MongoDB and Redis for development.

`GET /health` returns `{ "status": "ok" }`. `GET /health/services` reports `api`, `mongodb`, `redis` and `simulationEngine`, each `ok` or `down`.

### Shared contracts

JSON Schema files in `/shared/schemas` are the source of truth. TypeScript types and Python models are generated from them, with a single command to regenerate both. Runtime validation happens at every service boundary.

Schemas: `User`, `Startup`, `StartupConfiguration`, `SimulationState`, `Decision`, `DecisionResult`, `SimulationTurn`, `MarketEvent`, `AgentEffects`, `Forecast`, `AIAdvice`, `SimulationJob`.

Enums: decision types, simulation status, job status, event types, startup industries, user roles, agent mode.

### Authentication

Register, login, logout, current user, JWT access token with short expiry, refresh token with rotation, protected-route middleware, roles `USER` and `ADMIN`. Passwords hashed with Argon2 or bcrypt. Email format and password strength validated. Rate limiting on auth routes, CORS restricted to the frontend origin, security headers, request size limits, and input sanitized against MongoDB operator injection.

Tests cover: registration, duplicate email, weak password, login, wrong credentials, expired token, protected endpoint without a token, refresh rotation, logout.

### Startups

CRUD for startups plus a creation wizard in the frontend with these steps: name, industry, business model, initial capital, product, initial pricing, market size, difficulty.

Each industry has a configuration template of default simulation parameters reflecting its economics: SaaS (high gross margin, subscription, churn and CAC dominate), E-commerce (inventory, COGS, logistics, returns), Food & Beverage, EdTech, HealthTech, FinTech, Gaming, Consumer App. Templates are data files, not code branches.

Tests cover ownership: user A cannot read, update or delete user B's startup.

**Done when:** all services start, health endpoints report `ok`, a user can register, log in, and create, list, edit and delete a startup through the UI, and the test suites pass.

---

## Milestone 2: Simulation engine

Pure Python under `/simulation/engine`. No FastAPI in this milestone.

### State

Cash, revenue, expenses, profit, customers, new customers, churned customers, price, marketing budget, employees, product quality, market share, customer satisfaction, brand awareness, competitor pressure, customer segments, competitors, active events.

### Entry point

```text
run_turn(state, decisions, config, seed, turn_number, agent_effects=None) -> TurnRecord
```

The random generator for a turn is derived from `(seed, turn_number)`, so any single turn can be replayed without replaying the ones before it. `agent_effects` defaults to rule-based values computed inside the engine.

Order of operations: validate decisions, apply decisions, resolve events, compute competitor reactions, compute demand per segment, compute acquisition and churn, compute revenue, compute variable, fixed, marketing and employee costs, compute profit, update cash, update market state, build the turn record.

### Turn record

`turnNumber`, `stateBefore`, `decisions`, `events`, `agentEffects`, `stateAfter`, `engineVersion`. Records are immutable. `replay(initial_state, records, seed)` reproduces every `stateAfter` exactly.

### Decisions

Implement pricing, marketing budget, hiring, and product quality investment. The enum also lists firing, R&D, expansion, cost cutting and funding; these are reserved and rejected as not yet supported.

Validation rejects a negative price, marketing spend above available cash, a negative employee count, and any decision that would be meaningless in the current state. Rejections name the field and the reason.

`preview(state, decisions, config, seed, turn_number)` runs the turn without recording it and returns the direction and rough size of each effect. The UI labels this a simulation estimate.

### Customer market

Cohorts, not individual agents. At least five segments: price sensitive, premium, loyal, occasional, enterprise. Each has population, price sensitivity, quality sensitivity, brand loyalty, conversion rate and churn probability. Demand per segment depends on price, marketing, product quality, brand awareness and competition.

### Competitors

Four archetypes: budget, premium, aggressive, innovative. Each has a pricing strategy, marketing power, market share, reaction tendency, product quality and cash strength. After a founder decision, each competitor evaluates the threat and responds with a price change, marketing change, product investment or nothing. Rule-based in this milestone.

### Events

Data-driven definitions with type, probability, duration and effects, for example:

```json
{ "type": "competitor_price_war", "probability": 0.04, "duration": 2,
  "effects": { "demand": -0.12, "marketingCost": 0.08 } }
```

Positive: viral exposure, positive review, influencer mention, supplier discount, unexpected demand. Negative: competitor price war, supply disruption, bad review, economic slowdown, employee turnover, regulatory cost. Neutral: market trend, seasonality, new technology, customer preference shift. Multi-turn events persist in state until they expire.

### Tests

Unit tests for each calculation. Property tests for invariants: customers never negative, cash change equals profit, market shares sum to at most one. A determinism test runs the same inputs twice and compares full turn records, and a replay test rebuilds a twenty-turn run from its records.

**Done when:** a script can run a multi-turn simulation for each industry template from the command line, and the tests pass.

---

## Milestone 3: Integration and live play

### FastAPI

A transport layer over the engine:

- `POST /engine/start`: startup configuration and seed in, initial state out
- `POST /engine/preview`
- `POST /engine/replay`
- `POST /pipeline/turn`: runs the turn pipeline and streams stage progress, ending with the turn record

In this milestone the pipeline is validate then engine. Later milestones add stages without changing the endpoint.

### Node API

- `POST /startups/:id/simulation`: start a simulation, store the seed
- `GET /simulations/:id`: current state
- `GET /simulations/:id/turns`: turn history
- `POST /simulations/:id/preview`
- `POST /simulations/:id/turns`: enqueue a turn job, return `jobId`
- `GET /jobs/:id`, `POST /jobs/:id/cancel`

Turn records are stored append-only. Only one turn job per simulation may be queued or running at a time.

### Jobs

BullMQ on Redis with a Node worker. States: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`. Each job stores `jobId`, `progress`, `startedAt`, `completedAt` and `error`. A failed job leaves the simulation at its previous turn.

### WebSocket

Authenticated connection, one room per simulation. The worker relays pipeline stages as they complete: processing decision, analyzing customers, analyzing competitors, applying market event, updating financial model, generating forecast, AI CEO analysis, complete. Stages that do not exist yet are simply not emitted.

### Minimal play screen

A plain screen that shows current state, accepts the four decisions, shows the preview, submits the turn, shows live stage progress, and lists turn history. It exists so the system is playable end to end; the designed dashboard comes in Milestone 5.

**Done when:** a logged-in user can start a simulation and play ten turns in the browser with live progress, and restarting the services loses nothing.

---

## Milestone 4: Forecasting, agents and advisor

### ML forecasting

A script generates a synthetic dataset by running thousands of simulations across industries, seeds and decision policies. Features: price, marketing, employees, customers, churn, competition, sentiment, quality, revenue, profit. Targets: next-turn revenue, customers and churn.

Train and compare linear regression as the baseline, random forest and XGBoost, reporting MAE, RMSE and R². Split by simulation run, not by row, so turns from one run never appear in both train and test.

Each saved model has a metadata file: `modelVersion`, `trainingDatasetVersion`, `trainedAt`, `metrics`, `features`. Forecasts are shown to the user and passed to the advisor; they never feed back into simulation state.

### LLM agents

A customer agent and a competitor agent receive structured state (`startup`, `market`, `competitors`, `decision`) and return structured effects:

```json
{ "sentimentChange": -0.08, "demandModifier": -0.05,
  "competitorThreat": 0.32, "reasoningSummary": "..." }
```

Every response passes schema validation, then range validation (for example `demandModifier` within -1 to 1, with tighter per-turn caps defined in configuration). On invalid output, timeout or provider error, the pipeline uses the rule-based effects and records that it did.

A simulation has an `agentMode` of `rules` or `llm`. Validated agent effects are stored in the turn record, and replay uses the stored effects rather than calling the LLM again. This keeps LLM-mode simulations reproducible.

### Pipeline

Built with the orchestration framework, in this order: state validator, customer agent, competitor agent, event generator, simulation core, forecast engine, AI CEO. Agent memory is a bounded summary of recent turns for that simulation, passed in by Node with the request.

### AI CEO advisor

Input: previous state, decisions, new state, events, forecast, recent history. Output:

```json
{ "summary": "", "positiveFactors": [], "negativeFactors": [], "keyRisk": "",
  "keyOpportunity": "", "recommendation": "", "reasoning": "", "confidence": 0.0 }
```

Three modes: Explain ("why did my profit decrease?"), Analyze ("what caused this month's performance?"), Scenario ("what should I consider before increasing marketing?"). The advisor may only cite figures present in its input. An advisor failure does not fail the turn; the turn completes and the advice is marked unavailable.

**Done when:** a turn in `llm` mode runs the full pipeline with every stage reported live, a turn with the LLM unreachable still completes on rules, replaying an `llm` simulation reproduces it exactly, and the model comparison table is generated by one command.

---

## Milestone 5: Product

### Dashboard

Header with product name, startup name and turn number. KPI cards for cash, revenue, profit, customers, churn and market share, each with change since last turn. Revenue and profit over time as the main chart. Decision panel for pricing, marketing, hiring and product. Market panel for customer sentiment, competitor pressure and market demand. AI CEO side panel with the three modes. Amounts display in Indian format (₹8.45L).

### Scenario comparison

From the current state, the user defines an alternative set of decisions. Both branches run for a chosen horizon of one to six turns with the same seed and `rules` agent mode, so the decision is the only difference. Show revenue, profit, customers, churn and cash side by side. Present the trade-offs without recommending a choice. Scenario runs are never written to turn history.

### Analytics and reports

Views for financial overview, customer analytics by segment, market analytics, decision analytics (previewed versus actual impact per decision) and forecast analytics (forecast versus actual). A turn timeline. Export of a simulation report as CSV, JSON and PDF.

### Onboarding

A first-launch walkthrough: create your startup, set pricing, allocate marketing, hire, observe the market reaction, analyze results. Tooltips define CAC, LTV, churn, burn rate, runway, market share and gross margin.

### Admin

For `ADMIN` only: total users, total startups, simulations run, average turn duration, AI requests, ML predictions, failed jobs, current engine version and model version.

**Done when:** every view above works against real simulation data and a new user can reach their first completed turn using only the onboarding.

---

## Milestone 6: Hardening, deployment and evaluation

### Reliability

Defined behavior and a test for each failure: LLM timeout, missing or failed ML model, Redis unavailable, MongoDB unavailable, FastAPI unavailable. In each case the user sees a clear error and no partial turn is written.

One end-to-end test covers register, create startup, make a decision, run a turn, view results, ask the CEO.

### Deployment

Dockerfiles for frontend, backend, worker and simulation. `docker-compose.dev.yml` and `docker-compose.prod.yml`. In production a reverse proxy terminates HTTPS and routes to frontend and backend; MongoDB, Redis and FastAPI are not exposed publicly.

### Documentation

`README.md` plus `docs/` files for architecture, database, API, simulation, agents, ML, AI advisor, deployment and testing. Diagrams as Mermaid in the docs: ER, system architecture, data flow, and a sequence diagram for one turn.

### Evaluation

Scripts in `/evaluation` that write result tables for the project report:

- **Simulation consistency:** invariant checks and determinism across many seeds
- **ML:** the model comparison on held-out runs
- **Advisor faithfulness:** share of numeric claims in advice that match the turn record
- **Agents versus rules:** how outcomes diverge between `llm` and `rules` mode on the same seeds and decisions
- **Performance:** average turn time, API latency, LLM latency, ML prediction latency, behavior under concurrent simulations

### Demo

A seeded script that sets up the demo startup NovaTech (SaaS, ₹10,00,000 initial capital) and plays three turns: turn 1 at price ₹499, marketing ₹50,000, five employees; turn 2 raises the price to ₹799; turn 3 opens a scenario comparison of ₹799 against ₹699. The demo shows whatever the engine actually produces for that seed. Do not tune the engine to hit particular figures.

**Done when:** the production compose file brings the whole system up from a clean machine, the evaluation scripts produce their tables, and the demo script runs start to finish.

---

## Milestones 7 and 8: fill in before starting


- **Deploy target:** a single Linux VPS running `infrastructure/docker-compose.prod.yml`, deployed over SSH.
- **Container registry:** GitHub Container Registry (`ghcr.io`).
- **Email provider:** Resend, key in `EMAIL_API_KEY`.
- **Error tracking:** Sentry, DSN in `SENTRY_DSN`.

---

## Milestone 7: Production operations

### CI/CD

GitHub Actions. On every pull request: lint, type check, unit and integration tests for backend, frontend and simulation, the shared-type regeneration check (fails if generated types are stale), and the engine determinism test. On merge to `main`: build and push images tagged with the commit SHA, deploy to the target, run a smoke test against `/health/services`, and roll back to the previous image if it fails.

### API hygiene

- All public routes move under `/api/v1`. The frontend is updated in the same change.
- `POST /simulations/:id/turns` accepts an `Idempotency-Key` header; a repeated key returns the original job instead of enqueuing a second turn.
- OpenAPI documents for the Node API and FastAPI are generated from the shared schemas and served at `/api/v1/docs`.

### Engine versioning

Each simulation records the `engineVersion` it was created with. A change to engine formulas bumps the version and keeps the previous version importable, so existing simulations continue and replay on their original version. A test replays a stored fixture from each retained version.

### Observability

- Error tracking in frontend, backend, worker and simulation, with `requestId` attached.
- Prometheus metrics from Node and FastAPI: request rate, latency and error rate per route, queue depth, job duration, turn pipeline stage durations, LLM calls, tokens and failures, forecast latency.
- OpenTelemetry tracing with context propagated Node → worker → FastAPI → LLM client, so one turn is one trace.
- Prometheus and Grafana added to the Compose files, with one provisioned dashboard covering the metrics above.

### Data safety

- Versioned MongoDB migrations with a command to run them, executed in the deploy step.
- A scheduled backup job that dumps MongoDB to a configured location with retention, and a documented, scripted restore.
- Indexes reviewed for every query that filters by user, startup or simulation.

### Load testing

k6 scripts in `/evaluation/load` for three flows: auth, playing turns in `rules` mode, and concurrent WebSocket subscribers. Results and the observed limits are written to `docs/performance.md`.

**Done when:** a pull request runs the full pipeline, a merge deploys and rolls back on a failed smoke test, one turn is visible as a single trace and on the dashboard, a backup can be restored into an empty database by one command, and the load test results are documented.

---

## Milestone 8: LLM safeguards and account basics

### LLM cost controls

- A per-turn token budget and a per-user daily token quota, both configurable. When the quota is exhausted, turns run in `rules` mode and the UI says so.
- Token usage is recorded per call with user, simulation and prompt version.
- Agent calls are cached in Redis by a hash of prompt version and input; cache hits are recorded in the turn record like any other agent effects.

### Prompt versioning and regression evals

Prompts live in versioned files, not inline strings. Every turn record and advice record stores the `promptVersion` used. A fixed eval set of saved pipeline inputs lives in `/evaluation/prompts`, with checks for schema validity, range compliance, and advisor numeric faithfulness. It runs against the fake client in CI and against the real provider through a manual workflow.

### Prompt-injection defence

User-supplied text that reaches an LLM (startup name, product description, advisor questions) is length-limited, passed as clearly delimited data, and never placed in the instruction portion of a prompt. Tests submit injection attempts and assert that agent effects stay in range and the advisor cites only figures from its input.

### Account lifecycle

- Email verification on registration; unverified accounts can log in but cannot start simulations.
- Password reset by emailed single-use token with a short expiry.
- Google sign-in, linked to an existing account when the verified email matches.
- A sessions view listing active refresh tokens with device and last-used time, and the ability to revoke each.

### Data rights

- Export: a user can download all their data (profile, startups, simulations, turns, advice) as JSON.
- Deletion: a user can delete their account, which removes or anonymizes all their data and revokes all sessions. Admin metrics keep aggregate counts only.
- A short privacy page describing what is stored and what is sent to the LLM provider.

### Accessibility and responsive layout

The dashboard, wizard and play flow work by keyboard alone, have labelled controls and visible focus, meet WCAG AA contrast, and are usable at phone width. Charts have a text or table alternative. An automated accessibility check runs in CI on the main routes.

**Done when:** a quota-exhausted user can still play in `rules` mode, the prompt eval set runs in CI, injection tests pass, the full account lifecycle works through the UI with real emails, a user can export and delete their data, and the accessibility check passes on the main routes.
Append this to `docs/SPEC.md`. Rules and conventions in `CLAUDE.md` still apply.

## Milestone 9: Interface polish

This milestone changes presentation only. No API, schema or engine changes.

### Theming

- All colors, shadows and chart colors come from design tokens defined as CSS variables. No component contains a hardcoded color.
- Two themes, dark and light. The default follows the operating system setting; a toggle in the header overrides it, and the choice is remembered per browser and applied before first paint so the page never flashes the wrong theme.
- Each theme has its own chart palette. Positive and negative values stay distinguishable in both themes and are never signalled by color alone (pair with an arrow or sign).
- Both themes meet WCAG AA contrast for text, controls and chart labels.

### Motion

Motion shows that data changed; nothing animates for decoration. Durations are 150 to 300 ms with one shared easing curve, defined as tokens. Animate transform and opacity only, so layout does not shift.

- **KPI cards:** when a turn completes, each value counts from the old figure to the new one, with a brief positive or negative highlight on the change indicator.
- **Charts:** a new turn extends the existing line; the chart does not redraw from empty. Switching views or ranges transitions between states.
- **Turn pipeline:** stages appear as a checklist that ticks off as each WebSocket stage event arrives, with the active stage indicated. Timing follows the real events; no artificial delays.
- **Market events:** an event card slides in when an event fires and can be dismissed. Active multi-turn events remain visible with turns remaining.
- **Scenario comparison:** the two branches' bars grow side by side from zero when results arrive.
- **Navigation:** view changes use a short fade; panels and dialogs open from their trigger.

When the user's system requests reduced motion, all of the above are replaced by instant state changes. Values still update; they just do not animate.

### Loading, empty and feedback states

- **Skeletons** shaped like the content they replace, for the dashboard, analytics views and turn history. Spinners remain only inside buttons.
- **Toasts** for turn complete, job failed, job cancelled, token quota reached (with the note that the turn ran in rules mode), export ready, and network loss and recovery. Toasts are announced to screen readers, stack without covering the decision panel, and errors persist until dismissed.
- **Empty states** for: no startups yet, a simulation with no turns, analytics with too little history, advisor unavailable, and no scenario run. Each says what will appear there and offers the one action that fills it.
- **Error states** per panel, so one failed request does not blank the dashboard, each with a retry.

### Command palette

Opened with Ctrl+K or Cmd+K, and from a visible button in the header. Commands: go to each view, switch startup, submit turn, open scenario comparison, ask the AI CEO in each of its three modes, toggle theme, export report, log out. Fuzzy search over command names, full keyboard operation, focus trapped while open and returned to the trigger on close. Commands that are unavailable in the current state are shown disabled with the reason.

### Tests

Component tests for theme persistence and system-preference fallback, reduced-motion behavior, command palette keyboard flow, and each empty and error state. The Milestone 8 accessibility check runs on the main routes in both themes.

**Done when:** every view is correct in both themes with no hardcoded colors left, a turn plays through with live pipeline ticks and KPI count-up, reduced-motion mode shows no animation, every listed empty, loading and error state is reachable, the command palette runs every listed command by keyboard alone, and the accessibility check passes in both themes.
Append this to `docs/SPEC.md`. Rules and conventions in `CLAUDE.md` still apply.

## Milestone 10: Startup location

A startup has a location, and the location changes its economics. Coverage is India. Location effects come from a curated data file; no LLM is involved.

### Data model

`Startup` gains a `location` object: `country` (fixed to `IN` for now; the field exists so other countries can be added later), `state`, `city`, and `tier` (`METRO`, `TIER_2`, `TIER_3`). `StartupConfiguration` gains the resolved `locationProfile` that the engine uses. Both are added to the shared schemas first.

Location is set at creation and cannot change once a simulation has started.

### Location data

A data file under `/simulation/data/locations`, treated like the industry templates: data, not code branches.

**Listed cities (20):** Bengaluru, Mumbai, Delhi NCR, Hyderabad, Pune, Chennai, Kolkata, Ahmedabad, Jaipur, Kochi, Indore, Chandigarh, Coimbatore, Lucknow, Bhubaneswar, Nagpur, Surat, Visakhapatnam, Thiruvananthapuram, Guwahati.

**Fallback:** for any other city the user picks a state and a tier, and the profile is built from that state's values combined with tier defaults.

Each profile holds indices relative to a national baseline of 1.0:

- `salaryIndex`: cost per employee
- `operatingCostIndex`: rent and fixed overheads
- `purchasingPower`: how price sensitive local customers are
- `localMarketSize`: addressable customers nearby
- `talentAvailability`: how easily and quickly hires are made
- `competitionDensity`: strength and number of local competitors
- `fundingAccess`: reserved for the funding decision; stored now, unused until that decision exists
- `infrastructure`: logistics and connectivity quality
- `regulatoryBurden`: state-level compliance cost

Every value carries a `source` note and an `isEstimate` flag. Where a published figure exists (salary surveys, state GDP per capita, commercial rent reports, startup ecosystem rankings), derive the index from it and cite it. Where none exists, set a reasoned estimate and mark it. Do not present estimates as measured data. `docs/locations.md` lists every value with its source.

### Engine effects

The location profile adjusts the industry template when the initial state is built, and the engine reads the adjusted configuration from then on.

- **Costs:** employee cost scales with `salaryIndex`; fixed costs with `operatingCostIndex`; a recurring compliance cost with `regulatoryBurden`.
- **Hiring:** low `talentAvailability` caps hires per turn and raises cost per hire.
- **Demand:** `purchasingPower` shifts segment price sensitivity; `localMarketSize` scales segment populations.
- **Competition:** `competitionDensity` scales initial competitor strength and market share.
- **Logistics:** `infrastructure` affects variable costs for industries that ship physical goods.

How much location matters depends on the industry. Each industry template gains a `localDemandWeight` from 0 to 1: Food & Beverage is near 1 because its customers are local, SaaS is near 0 because its customers are national while its costs remain local. Demand-side effects are scaled by this weight; cost-side effects always apply in full.

### Location-specific events

Event definitions gain optional conditions on state, tier or city. Add: state startup-policy incentive, state regulatory change, local festival demand surge, monsoon or flood disruption, local talent war in startup hubs, infrastructure outage. Events without conditions behave as before.

### Compatibility

This changes engine formulas, so it is a new `engineVersion`. Existing startups are migrated to a neutral location profile with every index at 1.0 and `localDemandWeight` effects disabled, and their simulations continue and replay on their original engine version with identical results. A test asserts this against a stored fixture.

### Interface

- A location step in the creation wizard: state, then city filtered by state, with an "other city" option that asks for the tier.
- Before confirming, a location profile card shows each index as higher, lower or near the national baseline, in plain language ("Salaries: high", "Talent: easy to hire"), with estimates labelled.
- The dashboard header shows city and state. Analytics gains a location panel showing how much of the cost base and demand the location accounts for compared with the neutral baseline.
- A tooltip in onboarding explains why location matters.

### Evaluation

A script in `/evaluation` runs the same industry, seed and decision policy across all 20 cities and writes a comparison table of cash, profit and customers after twelve turns. This is the evidence for the report that location has a measurable, explainable effect.

### Tests

Unit tests for profile resolution (listed city, fallback, neutral), each engine effect in isolation, `localDemandWeight` scaling, and event conditions. A determinism test covers a located startup. The compatibility fixture test above.

**Done when:** a new startup can be created in any listed city or by fallback, two otherwise identical startups in different cities produce different and explainable results on the same seed, simulations created before this milestone replay unchanged, every location value has a source or an estimate flag in `docs/locations.md`, and the city comparison table is generated by one command.
