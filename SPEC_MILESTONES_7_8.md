# Stack Forge Specification: Milestones 7 and 8

Append this to `docs/SPEC.md`. Rules and conventions in `CLAUDE.md` still apply.

## Fill in before starting

- **Deploy target:** `<e.g. a single VPS running docker-compose.prod.yml>`
- **Container registry:** `<e.g. GitHub Container Registry>`
- **Email provider:** `<e.g. Resend, SES>`, key in `EMAIL_API_KEY`
- **Error tracking:** `<e.g. Sentry>`, DSN in `SENTRY_DSN`

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
