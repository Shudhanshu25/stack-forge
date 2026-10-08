# API

Every public route is under **`/api/v1`**: `http://localhost:4000/api/v1` in development, `https://<site>/api/v1` behind the production proxy. Paths below are relative to that prefix. `GET /health` also answers at the root for container health checks; `/metrics` (Prometheus) is served at the root on the internal network only.

**Interactive documentation** is served at `/api/v1/docs`, with the OpenAPI 3.1 documents at `/api/v1/openapi.json` (this API, assembled from the route catalog in `backend/src/openapi/catalog.ts` and the shared schemas) and `/api/v1/openapi/simulation.json` (the internal simulation service, whose models are generated from the same schemas). A test fails if a catalogued route is not served.

Request and response bodies are JSON in camelCase and are defined by the schemas in `shared/schemas`; the API validates requests against them and checks its own responses before sending. Money is integer paise.

## Errors

Every error has one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [{ "path": "/email", "message": "must match format \"email\"" }] } }
```

| Status | Codes |
| --- | --- |
| 400 | `VALIDATION_ERROR` (details list each failing JSON pointer), `WEAK_PASSWORD`, `INVALID_JSON`, `INVALID_IDEMPOTENCY_KEY`, `INVALID_OR_EXPIRED_TOKEN`, `INVALID_CODE`, `UNKNOWN_LOCATION` |
| 401 | `UNAUTHORIZED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN` |
| 404 | `NOT_FOUND` (also returned for another user's resources) |
| 403 | `FORBIDDEN`, `EMAIL_NOT_VERIFIED`, `GOOGLE_EMAIL_NOT_VERIFIED` |
| 409 | `EMAIL_TAKEN`, `TURN_IN_PROGRESS`, `SIMULATION_NOT_ACTIVE`, `JOB_FINISHED`, `ENGINE_VERSION_UNSUPPORTED`, `LOCATION_LOCKED` |
| 422 | `IDEMPOTENCY_KEY_REUSED` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 429 | `RATE_LIMITED`: details `{ action, retryAfterSeconds }` and a `Retry-After` header. Each auth action (sign-in, sign-up, email confirmation, confirmation email, password reset, new password, Google sign-in) has its own per-client counter of `AUTH_RATE_LIMIT_MAX` per 15 minutes, so failed logins never block a password reset; only failed logins count towards the sign-in limit. |
| 500 | `INTERNAL_ERROR`, `CONTRACT_VIOLATION` (details are logged, never sent) |
| 502 | `SIMULATION_ENGINE_ERROR` |
| 503 | `SERVICE_UNAVAILABLE` (MongoDB unreachable), `SIMULATION_ENGINE_UNAVAILABLE`, `QUEUE_UNAVAILABLE` (Redis unreachable) |

Every response carries `X-Request-Id`; send one to correlate logs across services.

## Authentication

Access tokens are HS256 JWTs (default 15 minutes) sent as `Authorization: Bearer <token>`. The refresh token is an opaque random string in an `httpOnly`, `SameSite=Strict` cookie named `sf_refresh` scoped to `/api/v1/auth` (`COOKIE_PATH`); only its SHA-256 hash is stored. Each refresh rotates it. Presenting a token that was already rotated or revoked revokes every token in that login's family, which logs out both the legitimate user and anyone who stole the token.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/auth/register` | `RegisterRequest` | 201 `AuthResponse` + cookie |
| POST | `/auth/login` | `LoginRequest` | 200 `AuthResponse` + cookie |
| POST | `/auth/refresh` | (cookie) | 200 `AuthResponse` + rotated cookie |
| POST | `/auth/logout` | (cookie) | 204, cookie cleared, token family revoked |
| GET | `/auth/me` | | 200 `User` (`emailVerified`, `hasPassword`, `googleLinked`) |
| GET | `/auth/options` | | 200 `AuthOptions` (`google`: whether Google sign-in is configured) |
| POST | `/auth/verify-email` | `VerifyEmailRequest` (`token`) | 200 `User`; 400 `INVALID_OR_EXPIRED_TOKEN` |
| POST | `/auth/verify-email/resend` | | 202 (nothing sent if already verified) |
| POST | `/auth/password-reset` | `PasswordResetRequest` (`email`) | 202 always (no account enumeration); emails a 6-digit code if the account exists |
| POST | `/auth/password-reset/verify` | `PasswordResetVerifyRequest` (`email`, `code`) | 200 `PasswordResetVerifyResponse` (`resetToken`, `expiresInSeconds`); 400 `INVALID_CODE` for a wrong, used or expired code or an unknown email |
| POST | `/auth/password-reset/confirm` | `PasswordResetConfirmRequest` (`token` from verify, `password`) | 204; every session signed out; 400 `WEAK_PASSWORD` or `INVALID_OR_EXPIRED_TOKEN` |
| GET | `/auth/google/start` | | 302 to Google (404 when not configured) |
| GET | `/auth/google/callback` | (Google redirect) | 302 to `APP_URL/auth/google/done` with the refresh cookie set, or to `APP_URL/login?error=google` |
| GET | `/auth/sessions` | (cookie marks the current one) | 200 `SessionListResponse` |
| DELETE | `/auth/sessions/:id` | | 204; that session's refresh tokens revoked; 404 if not yours |

**Email verification.** Registration sends a link to `APP_URL/verify-email?token=…` (single use, `EMAIL_VERIFICATION_TTL_HOURS`, default 24; a resend invalidates the previous link). Unverified accounts can sign in and set up startups, but starting a simulation returns 403 `EMAIL_NOT_VERIFIED`. Accounts that existed before Milestone 8 were marked verified by migration `003`.

**Password reset (one-time code).** `POST /auth/password-reset` emails a 6-digit code, valid for `PASSWORD_RESET_CODE_TTL_MINUTES` (default 10). A new request cancels the previous code. `POST /auth/password-reset/verify` checks it: each code allows five tries (claimed atomically, so parallel guesses cannot exceed them), after which it is cancelled; a wrong, used or expired code and an unknown email all get the same `INVALID_CODE`. A right code is exchanged for a single-use reset token valid for `PASSWORD_RESET_TTL_MINUTES` (default 30), which `POST /auth/password-reset/confirm` uses to set the new password; that confirms the email (the code proved inbox access) and revokes every session. Codes are stored only as SHA-256 hashes salted with the user id, tokens as SHA-256 hashes, and the code check has its own rate limit on top of the per-code tries.

**Google sign-in** is the OAuth 2.0 authorization code flow with PKCE. The state and code verifier travel in a short-lived signed `sf_oauth` cookie (`SameSite=Lax`, because Google's redirect back is a cross-site navigation). The ID token comes directly from Google's token endpoint, so its claims (issuer, audience, expiry, `email_verified`) are checked rather than its signature. The account linked to that Google id signs in; otherwise the account with the same email is linked (Google verified it); otherwise a password-less account is created. A Google email Google has not verified is refused.

**Sessions** are refresh-token families: each sign-in, with its browser and OS (from the User-Agent) and the time it last refreshed.

Passwords need at least 10 characters with an upper-case letter, a lower-case letter and a digit, and are hashed with Argon2id. `register` and `login` allow `AUTH_RATE_LIMIT_MAX` requests per IP per 15 minutes (default 20); `refresh`, `logout` and `me` allow five times that.

## Startups

All routes require a token and are scoped to the caller.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/startups` | | 200 `StartupListResponse` |
| POST | `/startups` | `StartupCreateRequest` | 201 `Startup` |
| GET | `/startups/:id` | | 200 `Startup` |
| PATCH | `/startups/:id` | `StartupUpdateRequest` | 200 `Startup` |
| DELETE | `/startups/:id` | | 204 |
| GET | `/industry-templates` | | 200 `IndustryTemplateListResponse` |
| GET | `/locations` | | 200 `LocationCatalog`: states, their listed cities, and the tiers |
| POST | `/locations/profile` | `LocationProfileRequest` (`state` with `cityId`, or `state` with `city` and `tier`) | 200 `LocationProfile`; 400 `UNKNOWN_LOCATION` |

On create, the API copies the industry template's `parameters`, the difficulty preset and the event catalog (`shared/templates/events.json`) into `configuration`, so later edits to the templates never change an existing startup. A PATCH that changes `industry` or `difficulty` copies them again; other edits keep the stored parameters. Simulations take their own copy when they start, so editing a startup never changes a game in progress. **Location.** `StartupCreateRequest.location` (`country` IN, `state`, `city`, `cityId` for a listed city or null, `tier`) is required. The API resolves it through the simulation service and stores the result as `configuration.locationProfile`; a listed city's name and tier come from the data, not the request. A PATCH may change the location only while the startup has no simulation (409 `LOCATION_LOCKED` afterwards). Startups created before locations have `location: null` and the neutral profile. Deleting a startup also deletes its simulations, turns and jobs, and is refused (409 `TURN_IN_PROGRESS`) while a turn is queued or running.

## Simulations and turns

All routes require a token. Another user's simulations and jobs are reported as 404.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/startups/:id/simulation` | `SimulationStartRequest` (`seed`, `agentMode`, both optional) | 201 `Simulation` |
| GET | `/startups/:id/simulations` | | 200 `SimulationListResponse` (newest first) |
| GET | `/simulations/:id` | | 200 `Simulation`, including `currentState` |
| GET | `/simulations/:id/turns` | | 200 `TurnListResponse` (turn 1 first) |
| POST | `/simulations/:id/preview` | `DecisionsRequest` | 200 `DecisionPreview` |
| POST | `/simulations/:id/turns` | `DecisionsRequest`; optional `Idempotency-Key` header | 202 `SimulationJob` (status `QUEUED`) |
| GET | `/jobs/:id` | | 200 `SimulationJob` |
| POST | `/jobs/:id/cancel` | | 202 `SimulationJob` |
| POST | `/simulations/:id/advice` | `AdviceRequest` (`mode`, `question?`, `turnNumber?`) | 200 `AIAdvice` |
| GET | `/simulations/:id/analytics` | | 200 `SimulationAnalytics` |
| POST | `/simulations/:id/scenarios` | `ScenarioRequest` (`horizon` 1-6, `baseline`, `alternative`) | 200 `ScenarioComparison` |
| GET | `/simulations/:id/report?format=json\|csv\|pdf` | | 200 file download (`Content-Disposition: attachment`) |

- **Starting a simulation.** The seed is stored; a random one below 2^48 is chosen when it is omitted. `agentMode` is `rules` (the default) or `llm` (LLM customer and competitor agents, with rule-based fallback; see [agents.md](agents.md)). The startup's configuration and the engine's initial state are snapshotted.
- **Asking the AI CEO.** `POST /simulations/:id/advice` asks about the latest turn, or `turnNumber`, in EXPLAIN, ANALYZE or SCENARIO mode ([ai-advisor.md](ai-advisor.md)). It returns 409 `NO_TURNS_YET` before turn 1 and is limited to 30 requests per user per 15 minutes (429 `RATE_LIMITED`). Advisor failures come back as 200 with `available: false` and a reason.
- **Analytics** are computed by the simulation service from the stored records on every request:
  - KPIs with their previous value and change;
  - a per-turn series with derived metrics (gross margin, burn rate, runway, CAC, LTV, ARPU, demand index);
  - segment and competitor series;
  - forecast against actual, with MAPE;
  - for each turn that changed a lever, the preview against the actual movement. Decisions that only restate the current value are ignored.
- **Scenarios** run two decision sets from the current state for 1-6 turns with the simulation's seed and rules agents. The decisions apply in the first turn, and levers persist after that. The response lists each branch's per-turn figures, totals, rejections and the turn it went bankrupt, if any. Differences are given as alternative minus baseline, with no recommendation. Nothing is stored.
- **Reports** come in three formats:
  - JSON: the simulation, the analytics and every turn;
  - CSV: one row per turn, with rupee columns and the decisions and events;
  - PDF: a summary, a revenue and profit chart, the turn table and the latest AI CEO summary. Amounts are written as "Rs", because PDF core fonts lack the rupee sign.
- **Turn records** now carry `forecast` (next-turn ML estimate) and `advice` (the AI CEO's ANALYZE reading) alongside the engine's fields.
- **Current state.** This is the `stateAfter` of the latest turn record, or the initial state before turn 1.
- **Playing a turn.** The decisions are not validated synchronously. Rejected decisions fail the job with `DECISIONS_REJECTED`, and `error.details` lists each `{ field, reason }`. Use preview first to see rejections without spending a turn.
- **Idempotency.** Send an `Idempotency-Key` header (1-128 of `A-Z a-z 0-9 . _ : -`) with `POST /simulations/:id/turns` to make retries safe: a repeated key for the same simulation returns the job the first request created (202, with `Idempotent-Replayed: true`) instead of playing another turn, whether that job is still queued or long finished. Reusing a key with different decisions is 422 `IDEMPOTENCY_KEY_REUSED`. Keys are scoped to the user and simulation. The web app sends a fresh key per Play click.
- **Engine version.** Every simulation is computed by the engine version it was created with (`engineVersion`), including previews, scenarios, analytics and replay. If the simulation service no longer has that version the request fails with 409 `ENGINE_VERSION_UNSUPPORTED` ([simulation.md](simulation.md#engine-versions)).
- **One active job.** Only one job per simulation may be `QUEUED` or `RUNNING`. A second request gets 409 `TURN_IN_PROGRESS`. A unique partial index in MongoDB enforces this, not just a check in code.
- **Job lifecycle.** `QUEUED` -> `RUNNING` -> `COMPLETED` / `FAILED` / `CANCELLED`. Each job records `progress` (0-100), `stage`, `startedAt`, `completedAt` and `error`. A failed or cancelled job writes no turn, so the simulation stays at its previous turn.
- **Cancelling.** A queued job is removed from the queue and cancelled at once. A running job is flagged, and the worker stops before writing its record; the response is still `RUNNING`, and the final status arrives as a job event. Finished jobs return 409 `JOB_FINISHED`.
- **Bankruptcy.** When cash goes negative after a turn, the simulation becomes `BANKRUPT`. Further previews and turns return 409 `SIMULATION_NOT_ACTIVE`.

## Onboarding and admin

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/auth/me/onboarding` | | 200 `User` with `onboardingCompleted: true` |
| GET | `/admin/stats` | | 200 `AdminStats`; 403 `FORBIDDEN` unless the token's role is `ADMIN` |

`User.onboardingCompleted` tells the frontend whether to run the first-launch walkthrough.

`AdminStats.aiRequests` counts requests that actually reached the LLM:
- llm-mode agent calls, excluding those that fell back because no LLM was configured;
- per-turn AI CEO analyses that were attempted;
- on-demand advisor questions.

`mlPredictions` counts turns with an available forecast. The engine and model versions come from FastAPI `GET /engine/info`.

## Account and data rights

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/account/llm-usage` | | 200 `LlmUsageSummary`: tokens used today (UTC), the daily quota, remaining, whether exhausted, when it resets |
| GET | `/account/export` | | 200 `DataExport` as a download (`stackforge-export-<date>.json`): profile, startups, simulations, every turn, AI CEO answers, sessions, LLM usage; no password or token hashes |
| DELETE | `/account` | `AccountDeleteRequest` (`confirm: "DELETE MY ACCOUNT"`, `password` when the account has one) | 204; cookie cleared |

Deletion cancels queued or running turns, removes the user's startups, simulations, turns, jobs, advice, sessions and email tokens, then the user. Their contribution to admin metrics is first added to anonymous counters (`platformcounters`), so platform totals stay complete; their LLM usage rows are kept for cost accounting with the user and simulation removed. Export and deletion allow 10 requests per user per 15 minutes.

## WebSocket `/api/v1/ws`

The API serves a WebSocket at `/api/v1/ws`, on the same port. The browser's `Origin` must equal `CORS_ORIGIN`. Messages are JSON, defined by `WsClientMessage` and `WsServerMessage`.

1. **Authenticate.** Within 10 s the client sends `{ "type": "auth", "token": "<access token>" }`, and the server replies `{ "type": "ready" }`. The server closes the socket with code 4001 when the token expires; the client refreshes and reconnects.
2. **Subscribe.** The client sends `{ "type": "subscribe", "simulationId": "..." }` and gets `subscribed`, or `error` with `NOT_FOUND` if the simulation isn't the caller's. There is one room per simulation.
3. **Receive events.**
   - `{ "type": "stage", simulationId, jobId, turnNumber, stage, progress }` as each pipeline stage completes;
   - `{ "type": "job", simulationId, jobId, turnNumber, job }` on every status change.

   Stages arrive in pipeline order: `PROCESSING_DECISION`, `ANALYZING_CUSTOMERS`, `ANALYZING_COMPETITORS`, `APPLYING_MARKET_EVENT`, `UPDATING_FINANCIAL_MODEL`, `GENERATING_FORECAST`, `AI_CEO_ANALYSIS`, then `COMPLETE`.
4. **Other messages.** `{ "type": "ping" }` gets `pong`, and `unsubscribe` leaves a room. Invalid messages get `{ "type": "error", "error": { code, message } }`.

Events are best effort: job status in MongoDB is authoritative. A client that may have missed events (it was disconnected, or a fast turn finished before the POST returned) reconciles with `GET /jobs/:id`.

## Health

| Method | Path | Response |
| --- | --- | --- |
| GET | `/health` | 200 `{ "status": "ok" }` |
| GET | `/health/services` | `{ api, mongodb, redis, simulationEngine }`, each `ok` or `down`; 200 when all are `ok`, otherwise 503 |

Each dependency check times out after 1.5 seconds. The simulation engine is checked through its own `GET /health`.

## Simulation service (FastAPI)

The service listens on `http://127.0.0.1:8000`. Only Node calls it, and it is stateless: every request carries the state it needs. Every engine request (`preview`, `replay`, `pipeline/turn`, `analytics/simulation`, `engine/scenario`) accepts `engineVersion`; an unavailable version is 409 `ENGINE_VERSION_UNSUPPORTED` (in the pipeline, an `error` event with that code). It uses the same error shape, honours `X-Request-Id`, and omits null fields from responses.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/health` | | `{ "status": "ok" }` |
| GET | `/metrics` | | Prometheus metrics |
| GET | `/openapi.json` | | OpenAPI document (proxied by the API at `/api/v1/openapi/simulation.json`) |
| POST | `/engine/start` | `EngineStartRequest` (`configuration`, `seed`) | `EngineStartResponse` (`state`, `engineVersion`) |
| POST | `/engine/preview` | `EnginePreviewRequest` | `DecisionPreview` |
| POST | `/engine/replay` | `EngineReplayRequest` | `EngineReplayResponse` (`records`, `mismatches`) |
| POST | `/pipeline/turn` | `PipelineTurnRequest` (including `memory`, up to 6 `TurnSummary`) | NDJSON stream of `PipelineEvent` |
| POST | `/analytics/simulation` | `EngineAnalyticsRequest` (`initialState`, `records`, `seed`, `configuration`) | `SimulationAnalytics` |
| POST | `/engine/scenario` | `EngineScenarioRequest` (`state`, `configuration`, `seed`, `horizon`, two `branches`) | `ScenarioComparison` |
| GET | `/engine/info` | | `EngineInfoResponse` (engine, model and dataset versions; whether an LLM is configured) |
| GET | `/locations` | | `LocationCatalog` |
| POST | `/locations/profile` | `LocationProfileRequest` | `LocationProfile`; 400 `UNKNOWN_LOCATION` |
| POST | `/advisor/ask` | `AdvisorRequest` (`mode`, `question?`, `industry`, `businessModel`, `turn`, `history`) | `AIAdvice` |

**`/pipeline/turn`** streams one JSON object per line:

- a `stage` event as each stage finishes;
- then exactly one `result` event (carrying the turn record) or one `error` event.

The pipeline is a LangGraph graph of seven stages ([agents.md](agents.md)). Pipeline error codes are `DECISIONS_REJECTED`, `TURN_OUT_OF_ORDER`, `SIMULATION_BANKRUPT`, `ENGINE_INPUT_ERROR` and `INTERNAL_ERROR`. Agent, forecast and advisor failures are not errors: they fall back or are marked unavailable inside the record. Node sends `COMPLETE` itself, once the record is stored.

**Errors outside the stream.** Engine input errors return 400 `ENGINE_INPUT_ERROR`, and replay sequence errors return 400 `REPLAY_ERROR`.
