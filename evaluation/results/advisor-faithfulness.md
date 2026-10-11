# AI CEO faithfulness

Generated 2026-10-11 14:01 UTC · engine 1.1.0 · Python 3.12.3 on Windows

| Mode | Questions | Numeric claims (first answers) | Claims matching the record | First answers fully faithful | Retried | Delivered | Withheld (unsupported figures) | Errors |
|---|---|---|---|---|---|---|---|---|
| EXPLAIN | 6 | 24 | 100.0% | 16.7% | 0.0% | 16.7% | 0.0% | 5 |
| ANALYZE | 6 | 0 | n/a | 0.0% | 0.0% | 0.0% | 0.0% | 6 |
| SCENARIO | 6 | 36 | 100.0% | 16.7% | 0.0% | 16.7% | 0.0% | 5 |

LLM: gemini (gemini-3.5-flash-lite / gemini-3.8-flash), paced to 4 requests/min. 2 seeded simulations (SAAS, ECOMMERCE), growth policy, 6 turns; the AI CEO was asked about every second turn in each mode with its default question.
A claim matches when the figure (in any Indian format or unit) appears in the data the advisor was given (the turn record and recent history), within rounding. Small counts (<= 10) are not claims. Delivered advice is faithful by construction: the service retries once and withholds advice that still cites unsupported figures.
Mean advisor LLM latency 14,673 ms over 18 calls.
Errors (no usable answer): timeout: ServerError 504 x12, provider_error: ServerError 503 x4.
