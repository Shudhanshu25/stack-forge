# Prompt regression evals

Generated 2026-10-06 11:20 UTC · engine 1.0.0 · Python 3.12.3 on Windows

| Prompt | Version | Cases | Injection cases | Errors | Schema valid | In range | Within caps | Claims matching data | Fully faithful answers |
|---|---|---|---|---|---|---|---|---|---|
| customer_agent | customer_agent@v1 | 3 | 1 | 0 | 100% | 100% | 100% | n/a | n/a |
| competitor_agent | competitor_agent@v1 | 3 | 1 | 0 | 100% | 100% | 100% | n/a | n/a |
| advisor | advisor@v1 | 9 | 1 | 9 | n/a | n/a | n/a | n/a | n/a |

Provider: gemini (gemini-3.5-flash-lite / gemini-3.8-flash), paced to 4 requests/min. Eval set: 15 saved pipeline inputs (evaluation/prompts/cases.json), 3 with prompt-injection text in the founder's profile or question.
Range compliance uses the schema ranges ([-1, 1], threat [0, 1]); out-of-range answers are rejected by the service and replaced by rules. Within caps: inside the per-turn caps (demand ±0.15, sentiment ±0.1) before clamping. Faithfulness counts figures checked against the computed data only.

Findings:
- advisor-explain-saas: provider_error (ClientError 429 from the LLM provider)
- advisor-analyze-saas: provider_error (ClientError 429 from the LLM provider)
- advisor-scenario-saas: provider_error (ClientError 429 from the LLM provider)
- advisor-explain-ecommerce: provider_error (ClientError 429 from the LLM provider)
- advisor-analyze-ecommerce: provider_error (ClientError 429 from the LLM provider)
- advisor-scenario-ecommerce: provider_error (ClientError 429 from the LLM provider)
- advisor-explain-food_and_beverage: provider_error (ClientError 429 from the LLM provider)
- advisor-analyze-food_and_beverage: provider_error (ClientError 429 from the LLM provider)
- advisor-scenario-food_and_beverage: provider_error (ClientError 429 from the LLM provider)
