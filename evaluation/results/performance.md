# Performance

Generated 2026-10-04 17:05 UTC · engine 1.0.0 · Python 3.12.3 on Windows

| Measurement | Samples | Mean ms | p50 ms | p95 ms | Notes |
|---|---|---|---|---|---|
| Engine turn (run_turn) | 202 | 0.380 | 0.340 | 0.590 | pure computation |
| ML forecast | 200 | 22.44 | 21.88 | 26.76 | forecast-20261004-160112 |
| Pipeline turn, rules mode | 12 | 28.40 | 27.49 | 33.55 | LangGraph, 7 stages |
| LLM agent call | 0 | n/a | n/a | n/a | not run: no LLM configured |
| API GET /simulations/:id | 50 | 4.46 | 4.31 | 5.94 |  |
| API POST /simulations/:id/preview | 50 | 8.92 | 8.53 | 10.79 |  |
| API turn, submit to completed | 6 | 214.96 | 215.17 | 216.43 | queue + worker + pipeline |
| API GET /simulations/:id/analytics | 20 | 15.91 | 12.12 | 21.96 |  |
| 10 concurrent simulations, turn latency | 60 | 501.25 | 437.75 | 654.59 | 60 turns in 3.3s = 18.1 turns/s |

All times in milliseconds.
API measured against http://localhost:4000 from the same machine.
