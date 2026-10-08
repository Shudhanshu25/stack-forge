# Performance and load testing

Load tests are [k6](https://k6.io) scripts in `evaluation/load/`. They exercise three flows against the production Docker stack and their raw summaries are in `evaluation/results/load/*.json`. In-process timings (engine, forecast, pipeline) are in [evaluation/results/performance.md](../evaluation/results/performance.md).

## How the numbers were taken

- **Stack:** `infrastructure/docker-compose.prod.yml`, one container per service: API (1 Node process), worker (concurrency 4), simulation service (1 uvicorn process), MongoDB, Redis, plus monitoring.
- **Machine:** one laptop: 16 logical CPUs (AMD Zen 4), 7.4 GiB given to Docker Desktop on Windows 11 (WSL 2). The load generator ran on the same machine, inside the Docker network, so it competes for the same CPUs.
- **Target:** the API directly (`http://api:4000/api/v1`), so the numbers describe the application, not Caddy or TLS.
- **LLM:** off (no key) for the duration, so the results measure this system's capacity, not the Gemini free tier's limits. With the LLM on, a turn adds the agent and AI CEO calls, roughly 1 to 3 s each and bounded by the provider's quotas.
- **Simulations:** started with ₹100 crore so they do not go bankrupt mid-test (a bankrupt simulation correctly refuses further turns).

Run them yourself:

```bash
docker run --rm --network stackforge_edge -v "$PWD/evaluation/load:/scripts:ro" \
  -e VUS=20 -e DURATION=60s grafana/k6 run /scripts/auth.js
docker run --rm --network stackforge_edge -v "$PWD/evaluation/load:/scripts:ro" \
  -e VUS=10 -e DURATION=90s grafana/k6 run /scripts/turns.js
docker run --rm --network stackforge_edge -v "$PWD/evaluation/load:/scripts:ro" \
  -e SUBSCRIBERS=200 -e SIMULATIONS=10 -e DURATION=60s grafana/k6 run /scripts/websocket.js
```

## Results (2026-10-06, engine 1.0.0)

### Auth: log in, read the current user, rotate the refresh token

| Concurrent users | Flows/s | Login p50 | Login p95 | Failures |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 13.0 | 69 ms | 79 ms | 0 |
| 4 | 32.8 | 105 ms | 128 ms | 0 |
| 20 | 33.7 | 558 ms | 605 ms | 0 |

Every iteration poses as a different client so the per-IP limit does not apply; the limit itself was checked separately: **one client gets 20 auth requests per 15 minutes, then 429** (exactly 20 allowed, 5 of 25 refused).

### Playing turns in `rules` mode (submit, poll until completed)

| Concurrent simulations | Turns/s | Completion p50 | Completion p95 | Failures |
| ---: | ---: | ---: | ---: | ---: |
| 3 | 10.0 | 331 ms | 345 ms | 0 |
| 10 | 11.1 | 863 ms | 1.06 s | 0 |
| 30 | 10.6 | 2.68 s | 2.89 s | 0 |

Every request in these runs used an `Idempotency-Key`; no turn was lost or duplicated, and HTTP latency for the other endpoints stayed around 4 ms median, 15 ms p95.

### WebSocket subscribers (live turn events while turns are played)

| Subscribers | Simulations | Connect p95 | Subscribe p95 | Messages delivered | Completion seen p95 | Errors |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 200 | 10 | 181 ms | 185 ms | 92,987 | 474 ms | 0 |
| 1,000 | 10 | 956 ms | 960 ms | 393,226 | 350 ms | 0 |

"Completion seen" is the time from a turn being queued to a subscriber receiving its `COMPLETED` job event.

## Observed limits

1. **Turns: about 10-11 per second for the whole system**, independent of how many simulations play. Beyond that, extra load only queues: completion time grows linearly (30 concurrent simulations wait ~2.7 s) and nothing fails. The bottleneck is the **forecast stage in the single simulation-service process**: under load its median is ~300 ms while every other pipeline stage takes ~2.5 ms (`pipeline_stage_duration_seconds` on the dashboard). The Random Forest and XGBoost models predict on CPU-bound Python inside one process. To raise the limit: run more simulation-service replicas or uvicorn workers (the service is stateless), or serve a lighter forecasting model.
2. **Logins: about 33 per second.** Argon2 hashing runs on Node's libuv thread pool (4 threads by default), so 4 concurrent logins saturate it and more only queue (20 concurrent: 34/s at 560 ms). `UV_THREADPOOL_SIZE` or more API replicas raise it; the cost per hash is deliberate.
3. **Per-client auth limit: 20 requests per 15 minutes** (`AUTH_RATE_LIMIT_MAX`), by design.
4. **WebSockets: no limit reached at 1,000 concurrent subscribers.** Delivery stayed fast; only the connection burst slowed (1,000 handshakes in ~1 s, p95 under 1 s). The API used ~160 MiB of memory with 1,000 sockets open.
5. **With the LLM on**, the provider is the limit: the free Gemini tier allows 15 agent requests per minute and 20 AI CEO requests per day; over quota, agents fall back to rules and advice is unavailable (both recorded), and turns still complete.
