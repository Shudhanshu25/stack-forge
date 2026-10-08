# Simulation consistency

Generated 2026-10-06 04:59 UTC · engine 1.0.0 · Python 3.12.3 on Windows

| Industry | Runs | Turns | Invariant violations | Nondeterministic runs | Replay mismatches | Bankrupt runs | ms per turn |
|---|---|---|---|---|---|---|---|
| SAAS | 180 | 3,551 | 0 | 0 | 0 | 32.8% | 0.781 |
| ECOMMERCE | 180 | 3,706 | 0 | 0 | 0 | 32.2% | 0.819 |
| FOOD_AND_BEVERAGE | 180 | 2,933 | 0 | 0 | 0 | 50.6% | 0.847 |
| EDTECH | 180 | 3,775 | 0 | 0 | 0 | 23.9% | 0.875 |
| HEALTHTECH | 180 | 3,791 | 0 | 0 | 0 | 30.0% | 0.871 |
| FINTECH | 180 | 3,458 | 0 | 0 | 0 | 41.7% | 0.840 |
| GAMING | 180 | 3,502 | 0 | 0 | 0 | 30.6% | 0.836 |
| CONSUMER_APP | 180 | 3,086 | 0 | 0 | 0 | 42.2% | 0.857 |
| **All** | 1,440 | 27,802 | 0 | 0 | 0 |  |  |

Each industry: 3 difficulties x 3 policies (steady, growth, random) x 20 seeds, up to 24 turns (a run stops at bankruptcy).
Invariants checked after every turn: customer flow and segment totals, cash change = profit, profit = revenue - expenses, expense total, market shares <= 100%, rates in [0, 1], money in integer paise.
Nondeterministic runs: a second play with the same seed and decisions differed. Replay mismatches: recomputing from stored decisions and agent effects changed a stateAfter. ms per turn is the average of the three passes (play, replay check, second play).
Total time 70.1s.
