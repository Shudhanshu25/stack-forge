# LLM agents vs rule-based agents

Generated 2026-10-05 03:04 UTC · engine 1.0.0 · Python 3.12.3 on Windows

| Industry | Seed | Turns | Revenue ₹ (rules) | Revenue ₹ (agents) | Revenue gap | Customers (rules) | Customers (agents) | Customer gap | Cash gap | Mean demand modifier | Mean sentiment change | Mean competitor threat | Fallback rate | Agents turn ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SAAS | 9,000 | 6 | 83,981 | 88,427 | 5.3% | 170 | 179 | 5.3% | 3.4% | 0.005 | 0.017 | 0.055 | 0% | 9,334 |
| ECOMMERCE | 9,001 | 6 | 330,168 | 333,590 | 1.0% | 579 | 585 | 1.0% | 0.2% | 0.002 | 0.007 | 0.045 | 0% | 9,975 |
| FOOD_AND_BEVERAGE | 9,002 | 6 | 361,950 | 372,755 | 3.0% | 469 | 483 | 3.0% | 3.3% | 0.010 | 0.012 | 0.093 | 0% | 10,440 |
| EDTECH | 9,003 | 6 | 105,624 | 107,562 | 1.8% | 109 | 111 | 1.8% | 0.6% | 0.007 | 0.013 | 0.025 | 0% | 9,995 |
| HEALTHTECH | 9,004 | 6 | 418,132 | 435,359 | 4.1% | 534 | 556 | 4.1% | 1.8% | 0.012 | 0.017 | 0.053 | 0% | 9,907 |
| FINTECH | 9,005 | 6 | 160,049 | 160,793 | 0.5% | 646 | 649 | 0.5% | 0.1% | 0.002 | 0.008 | 0.042 | 0% | 9,951 |
| GAMING | 9,006 | 6 | 147,362 | 151,787 | 3.0% | 666 | 686 | 3.0% | 2.7% | 0.008 | 0.007 | 0.030 | 0% | 9,977 |
| CONSUMER_APP | 9,007 | 6 | 314,612 | 316,572 | 0.6% | 3,210 | 3,230 | 0.6% | 0.4% | 0.002 | 0.000 | 0.038 | 0% | 9,912 |

LLM: gemini (gemini-3.5-flash-lite / gemini-3.8-flash), paced to 12 requests/min. Same seed and same decisions (steady policy, taken from the rules run) on both sides; values are for the final turn. Gaps are relative to the rules run. Agent modifiers are clamped to the configured caps (demand ±0.15, sentiment ±0.1).
Fallback rate: share of agent calls whose output was rejected or timed out and replaced by the rule-based effects.
Fallback reasons: none.
