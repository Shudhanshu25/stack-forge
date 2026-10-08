# Same startup, twenty cities

Generated 2026-10-08 03:37 UTC · engine 1.1.0 · Python 3.12.3 on Windows

| City | Tier | Salaries | Overheads | Purchasing power | Market size | F&B cash (₹ lakh) | F&B last-month profit (₹ lakh) | F&B customers | SaaS cash (₹ lakh) | SaaS last-month profit (₹ lakh) | SaaS customers |
|---|---|---|---|---|---|---|---|---|---|---|---|
| National baseline (no location) | - | 1.00 | 1.00 | 1.00 | 1.00 | 1.32 | 0.820 | 674 | 2.52 | 0.060 | 364 |
| Bengaluru | METRO | 1.26 | 1.29 | 1.80 | 1.52 | -1.09 (bankrupt, turn 7) | -1.61 | 451 | 0.510 | 0.030 | 416 |
| Mumbai | METRO | 1.21 | 1.51 | 1.48 | 2.24 | -0.12 (bankrupt, turn 6) | -2.09 | 380 | 0.080 | 0.000 | 420 |
| Delhi NCR | METRO | 1.12 | 1.28 | 2.43 | 2.11 | -0.56 (bankrupt, turn 8) | -0.980 | 487 | 1.56 | 0.120 | 420 |
| Hyderabad | METRO | 1.17 | 1.12 | 1.83 | 1.45 | -0.46 (bankrupt, turn 8) | -1.02 | 463 | 1.74 | 0.130 | 417 |
| Pune | METRO | 1.21 | 1.13 | 1.48 | 1.17 | -0.2 (bankrupt, turn 7) | -1.47 | 435 | 1.25 | 0.090 | 414 |
| Chennai | METRO | 1.18 | 1.09 | 1.67 | 1.54 | -0.47 (bankrupt, turn 8) | -1.01 | 459 | 1.63 | 0.120 | 414 |
| Kolkata | METRO | 0.869 | 0.884 | 0.792 | 1.96 | 7.20 | 1.62 | 788 | 5.07 | 0.400 | 422 |
| Ahmedabad | METRO | 1.21 | 0.856 | 1.58 | 1.32 | 2.67 | 1.26 | 763 | 2.59 | 0.180 | 415 |
| Jaipur | TIER_2 | 0.737 | 0.793 | 0.882 | 0.911 | 8.77 | 1.65 | 767 | 6.34 | 0.500 | 419 |
| Kochi | TIER_2 | 1.09 | 0.806 | 1.48 | 0.760 | 4.05 | 1.34 | 762 | 3.55 | 0.270 | 415 |
| Indore | TIER_2 | 1.06 | 0.764 | 0.740 | 0.769 | 4.90 | 1.39 | 766 | 4.15 | 0.320 | 420 |
| Chandigarh | TIER_2 | 0.914 | 0.806 | 2.28 | 0.529 | 6.49 | 1.53 | 768 | 4.89 | 0.380 | 417 |
| Coimbatore | TIER_2 | 0.892 | 0.795 | 1.67 | 0.763 | 7.33 | 1.65 | 766 | 5.02 | 0.390 | 415 |
| Lucknow | TIER_2 | 0.638 | 0.891 | 0.495 | 0.889 | 10.26 | 1.88 | 766 | 6.84 | 0.550 | 423 |
| Bhubaneswar | TIER_2 | 0.925 | 0.806 | 0.874 | 0.491 | 6.19 | 1.53 | 771 | 4.73 | 0.370 | 416 |
| Nagpur | TIER_2 | 0.840 | 0.806 | 1.48 | 0.825 | 7.81 | 1.68 | 770 | 5.34 | 0.420 | 415 |
| Surat | TIER_2 | 0.891 | 0.806 | 1.58 | 1.12 | 7.36 | 1.64 | 772 | 5.05 | 0.390 | 416 |
| Visakhapatnam | TIER_2 | 0.814 | 0.829 | 1.26 | 0.686 | 7.64 | 1.64 | 768 | 5.45 | 0.420 | 415 |
| Thiruvananthapuram | TIER_2 | 1.11 | 0.766 | 1.48 | 0.677 | 4.21 | 1.37 | 765 | 3.56 | 0.270 | 415 |
| Guwahati | TIER_2 | 0.862 | 0.806 | 0.740 | 0.514 | 7.13 | 1.62 | 773 | 5.20 | 0.410 | 417 |

Same template, seed 42, 'steady' decision policy and difficulty NORMAL for 12 turns in every city; only the location profile differs. Values after the last turn (or at bankruptcy).
Index columns are relative to the national baseline (1.0); docs/locations.md gives every value's source, and which are estimates.
Costs (salaries, overheads, compliance, recruiting, logistics) apply in full to every industry. Demand effects (market size, price sensitivity, competition) are scaled by the industry's localDemandWeight: 0.9 for Food & Beverage, 0.1 for SaaS.
Location-specific events (state incentives, monsoon floods, festivals, talent wars, outages) can only occur in the places they apply to, so with one seed some differences also come from which events fired. The baseline row has no location and so gets none.
