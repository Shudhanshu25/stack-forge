# Location data: sources and caveats

Compiled 2026-10-08. All values with citations are in `sources.json`. Each datum has `verified: true` only when the figure was seen in the source or in a search snippet quoting it. Categorical datasets (HRA class, startup ranking, LEADS tier) store a string `value`.

## Coverage

| # | Dataset | Coverage | Source |
|---|---|---|---|
| 1 | Per capita NSDP, current prices | All 33 states/UTs in the table, 2023-24 and 2022-23; all-India per capita NNI | RBI Handbook of Statistics on Indian Economy, Table 9 (base 2011-12, NSO data) |
| 2 | Population, Census 2011 | 20/20 | Census A-04 via Wikipedia (17 cities); citypopulation.de via Wikipedia (Chandigarh, Bhubaneswar, Guwahati) |
| 3 | HRA city class | 20/20: 8 X, 12 Y | DoE OM 2/5/2017-E.II(B), 7 Jul 2017 (annexure from the 2015 OM) |
| 4 | Office rent | 8 metros (Knight Frank H2 2025); 6 smaller cities (CRE Matrix 2026) | See caveats |
| 5 | Salary by city | 20/20 at junior and middle level; 18/20 at senior level | Randstad India Annual Salary Trends Report 2024-25 |
| 6 | DPIIT startups by state | All 36 states/UTs, as of 31 Oct 2024 | Lok Sabha USQ 3465 (17 Dec 2024), Annexure-I |
| 6 | States' Startup Ranking | 34 participants, fifth edition (2026); fourth edition (2022) kept | Startup India SSR 5.0 results page |
| 7 | Startup funding by city, 2025 | 6/20 | Inc42 Annual Indian Startup Trends Report 2025 |
| 8 | Ease of Living Index 2020 | Scores for 7 cities; rank only for 3; Bhubaneswar ranked in the under-1-million category | MoHUA EoLI 2020 via news reports |
| 8 | LEADS 2025 tier | All 36 states/UTs | DPIIT LEADS 2025, PIB release PRID 2260854 (via snippets and secondary summaries) |
| 9 | Tech talent | 6 cities, scores rather than headcounts | Colliers Global Tech Markets 2025 |

## Caveats to state in the report

- **NSDP.** The values were read from RBI's HTML table; the XLSX and PDF downloads were blocked by a bot check. Eleven 2023-24 values were cross-checked against an independent search snippet of the same table. Ladakh, Lakshadweep and DNH&DD have no NSDP figure.
- **Delhi NCR.** Population is the Census 2011 *Delhi UA*, not the whole NCR. NSDP, DPIIT count and rankings are for the NCT of Delhi. Rents (Knight Frank "NCR") and funding (Inc42 "Delhi NCR") cover the wider region.
- **Population.** Kochi and Thiruvananthapuram UA figures are inflated by Kerala's 2011 change to the UA definition. Visakhapatnam is the municipal corporation (GVMC), not a UA. The figures for Bhubaneswar (885,363) and Guwahati (968,549) are secondary and were not checked against censusindia.gov.in. Chandigarh's 1,026,459 matches an MHA urban-population figure.
- **HRA class.** This comes from a reproduction of the OM annexure (staffnews.in), not from the doe.gov.in PDF. It matches the known X list: Ahmedabad, Bengaluru, Chennai, Delhi, Hyderabad, Kolkata, Mumbai, Pune. All 12 other cities are Y, so no city in the set is Z (TIER_3).
- **Rents.** Knight Frank reports *average transacted rent*, not Grade A only. CRE Matrix reports weighted average rent, grade unstated, and its methodology differs: Ahmedabad is 60.6 there versus 44 at Knight Frank. Do not mix the two series without scaling. Kochi, Chandigarh, Nagpur, Surat, Bhubaneswar and Guwahati have no rent.
- **Salaries.** These are average CTC across all roles and industries in Randstad's sample, not a single role. At the junior level, several tier-2 cities exceed metros (Lucknow 6.52 vs Mumbai 5.36 lakh), which is a sample-mix effect. The middle level (6-14 years) shows the expected metro premium and is the safer band for a city salary index. The tier-2 tables were extracted from a two-column PDF layout and re-paired using the variance column.
- **DPIIT counts.** These are cumulative recognitions, not active firms; about 6,385 had closed by Oct 2025. The rows sum exactly to the stated total of 1,52,139. A newer partial set (top 5 states, 31 Mar 2026) is stored separately.
- **Funding.** The amounts are verified. The national shares are computed here against Inc42's approx. USD 11 Bn total and are not published figures. Tracxn's different total (USD 10.5 Bn) gives Bengaluru 32%, against Inc42's ~41%.
- **Ease of Living 2020.** The report PDF link was dead, so scores come from news coverage. Kolkata, Jaipur, Kochi, Lucknow, Nagpur, Chandigarh, Visakhapatnam, Thiruvananthapuram and Guwahati are null. The full table is on the MoHUA EoL dashboard.
- **LEADS 2025.** The PIB page returned 403. Tiers come from snippets of the PIB text and secondary summaries. The Growth-Seekers are West Bengal, Rajasthan, Sikkim and (unverified) Andaman & Nicobar; the last is consistent by elimination across the 36 states/UTs. LEADS 2025 replaced the older Achievers / Fast Movers / Aspirers labels.

## Least certain numbers

- Bhubaneswar and Guwahati UA population (secondary source).
- Randstad tier-2 national averages and the middle-level pairing (layout-inferred).
- LEADS: Andaman & Nicobar as Growth-Seeker, and the coastal/landlocked group labels (snippet-level).
- CRE Matrix rents: the period is stated only for Indore.
