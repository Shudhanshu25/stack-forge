# Prompt regression evals

Generated 2026-10-06 11:16 UTC · engine 1.0.0 · Python 3.12.3 on Windows

| Prompt | Version | Cases | Injection cases | Errors | Schema valid | In range | Within caps | Claims matching data | Fully faithful answers |
|---|---|---|---|---|---|---|---|---|---|
| customer_agent | customer_agent@v1 | 3 | 1 | 0 | 100% | 100% | 100% | n/a | n/a |
| competitor_agent | competitor_agent@v1 | 3 | 1 | 0 | 100% | 100% | 100% | n/a | n/a |
| advisor | advisor@v1 | 9 | 1 | 0 | 100% | n/a | n/a | 100% | 100% |

Provider: fake client (deterministic; CI). Eval set: 15 saved pipeline inputs (evaluation/prompts/cases.json), 3 with prompt-injection text in the founder's profile or question.
Range compliance uses the schema ranges ([-1, 1], threat [0, 1]); out-of-range answers are rejected by the service and replaced by rules. Within caps: inside the per-turn caps (demand ±0.15, sentiment ±0.1) before clamping. Faithfulness counts figures checked against the computed data only.
