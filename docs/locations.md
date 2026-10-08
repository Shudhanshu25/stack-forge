# Startup locations

Where a startup is based changes its economics. This page lists every location value the simulation uses, with its source. It is generated from `simulation/data/locations/india.json` by `simulation/data/locations/docs.py`; `india.json` is itself built from the collected research (`research/sources.json`) by `build.py`, so every number can be traced and rebuilt.

**Every index is relative to a national baseline of 1.0.** Values marked `*` are estimates: no published figure exists for them in a usable form, or a published category or ranking was mapped to a number by judgement. Unmarked values are derived from a published figure by the formula given below. Indices are clamped to 0.3–2.5.

## How each index is derived

| Index | Engine effect | Method |
| --- | --- | --- |
| Salaries | Salary per employee × index (costs, in full) | Randstad India *Annual Salary Trends Report 2024-25*: average CTC for 6–14 years' experience in the city ÷ the mean of the 20 listed cities (₹15.16 lakh). The middle band is used because the junior band shows tier-2 cities above metros, which looks like a sampling artefact. All roles, not one job. |
| Overheads | Fixed costs × index (costs, in full) | Office rent ÷ the mean of the cities with a published rent (₹61.78/sq ft/month), with rent taken as 50% of overheads (an estimate): index = 0.5 + 0.5 × rent ratio. Rents: Knight Frank H2 2025 average transacted rent (8 metros); CRE Matrix 2026 weighted averages (tier-2) rescaled to Knight Frank's level through Ahmedabad, the one city in both (× 0.7261). Six cities without a published rent use the tier-2 mean (estimate). |
| Regulation | Fixed costs + 10% × (index − 1) as compliance (costs, in full) | DPIIT States' Startup Ranking 5.0 category, mapped: Best Performer 0.85, Top Performer 0.9, Leader 0.95, Aspiring Leader 1.05, Emerging 1.1 (estimate: the ranking measures startup support, including regulatory facilitation, not compliance cost directly). States that did not take part: 1.0. |
| Talent | Recruiting cost ÷ index; below 1.0 at most ⌊8 × index⌋ hires per turn (costs, in full) | Colliers 2025 tech-talent scores for six metros, mapped as 0.7 + 0.2 × score (estimate); other cities are estimates from tier and known tech parks. |
| Infrastructure | Logistics cost per order ÷ index, only for industries that ship goods (costs, in full) | LEADS 2025 state category (Exemplar 1.1, High Performer 1.05, Accelerator 1.0, Growth-Seeker 0.9) × city tier (metro 1.05, tier-2 0.95, tier-3 0.85); the mapping is an estimate. |
| Purchasing power | Price elasticity × index^(−0.5 × w) (demand) | Per capita NSDP of the state ÷ all-India per capita NNI (₹188,892), RBI *Handbook of Statistics on Indian Economy*, Table 9, 2023-24, current prices. A state figure, used for every city in the state. |
| Market size | Market size × (1 + w × (index − 1)) (demand) | √(Census 2011 population ÷ 3,669,575, the geometric mean of the 20 cities). Urban agglomeration figures; Delhi NCR is the Delhi UA. The square root (addressable customers grow more slowly than population) is a modelling choice. |
| Competition | Competitor intensity × (1 + w × (index − 1)) (demand) | Estimate informed by DPIIT-recognised startups by state (Lok Sabha USQ 3465, 31 Oct 2024) and Inc42 2025 funding by city. |
| Funding | Not used yet (reserved for the funding decision) | Estimate ordered by Inc42 2025 startup funding by city. |

**w** is the industry's `localDemandWeight`: Food & Beverage 0.9, Healthtech 0.5, E-commerce 0.4, Edtech 0.3, Fintech 0.25, Consumer app 0.2, SaaS 0.1, Gaming 0.05. These weights are modelling estimates of how local each industry's customers are. Cost effects ignore w and always apply in full.

**Tiers** follow the house rent allowance classification of cities (Department of Expenditure OM 2/5/2017-E.II(B), 7 July 2017): class X is METRO, class Y TIER_2. None of the 20 listed cities is class Z, so every TIER_3 default is an estimate.

**Any other city** uses its state's purchasing power and regulation, and its tier's defaults for everything else (the mean of the listed cities in that tier).

## Listed cities

| City | State | Tier | Salaries | Overheads | Purchasing power | Market size | Talent | Competition | Funding | Infrastructure | Regulation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bengaluru | KA | METRO | 1.26 | 1.29 | 1.80 | 1.52 | 1.38* | 1.50* | 1.80* | 1.05* | 0.90* |
| Mumbai | MH | METRO | 1.21 | 1.51 | 1.48 | 2.24 | 1.14* | 1.40* | 1.60* | 1.10* | 0.95* |
| Delhi NCR | DL | METRO | 1.12 | 1.28 | 2.43 | 2.11 | 1.08* | 1.40* | 1.60* | 1.16* | 1.10* |
| Hyderabad | TS | METRO | 1.17 | 1.12 | 1.83 | 1.45 | 1.22* | 1.25* | 1.15* | 1.10* | 0.95* |
| Pune | MH | METRO | 1.21 | 1.13 | 1.48 | 1.17 | 1.22* | 1.25* | 1.20* | 1.10* | 0.95* |
| Chennai | TN | METRO | 1.18 | 1.09 | 1.67 | 1.54 | 1.14* | 1.20* | 1.20* | 1.16* | 0.90* |
| Kolkata | WB | METRO | 0.87 | 0.88 | 0.79 | 1.96 | 1.00* | 1.00* | 0.90* | 0.94* | 1.00* |
| Ahmedabad | GJ | METRO | 1.21 | 0.86 | 1.58 | 1.32 | 0.95* | 1.05* | 0.95* | 1.10* | 0.85* |
| Jaipur | RJ | TIER_2 | 0.74 | 0.79 | 0.88 | 0.91 | 0.85* | 0.85* | 0.75* | 0.85* | 0.95* |
| Kochi | KL | TIER_2 | 1.09 | 0.81* | 1.48 | 0.76 | 0.85* | 0.85* | 0.75* | 1.00* | 0.95* |
| Indore | MP | TIER_2 | 1.06 | 0.76 | 0.74 | 0.77 | 0.85* | 0.85* | 0.75* | 0.95* | 0.95* |
| Chandigarh | CH | TIER_2 | 0.91 | 0.81* | 2.28 | 0.53 | 0.85* | 0.85* | 0.75* | 0.95* | 1.10* |
| Coimbatore | TN | TIER_2 | 0.89 | 0.80 | 1.67 | 0.76 | 0.85* | 0.80* | 0.75* | 1.04* | 0.90* |
| Lucknow | UP | TIER_2 | 0.64 | 0.89 | 0.49 | 0.89 | 0.75* | 0.80* | 0.75* | 1.04* | 0.90* |
| Bhubaneswar | OD | TIER_2 | 0.93 | 0.81* | 0.87 | 0.49 | 0.80* | 0.75* | 0.75* | 0.95* | 1.05* |
| Nagpur | MH | TIER_2 | 0.84 | 0.81* | 1.48 | 0.82 | 0.75* | 0.75* | 0.75* | 1.00* | 0.95* |
| Surat | GJ | TIER_2 | 0.89 | 0.81* | 1.58 | 1.12 | 0.75* | 0.80* | 0.75* | 1.00* | 0.85* |
| Visakhapatnam | AP | TIER_2 | 0.81 | 0.83 | 1.26 | 0.69 | 0.80* | 0.75* | 0.75* | 0.95* | 0.95* |
| Thiruvananthapuram | KL | TIER_2 | 1.11 | 0.77 | 1.48 | 0.68 | 0.85* | 0.80* | 0.75* | 1.00* | 0.95* |
| Guwahati | AS | TIER_2 | 0.86 | 0.81* | 0.74 | 0.51 | 0.70* | 0.70* | 0.75* | 0.95* | 1.05* |

## Tier defaults (any other city)

| Tier | Salaries | Overheads | Market size | Talent | Competition | Funding | Infrastructure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| METRO | 1.15 | 1.15 | 1.66 | 1.14* | 1.26* | 1.30* | 1.09* |
| TIER_2 | 0.90 | 0.81 | 0.74 | 0.80* | 0.80* | 0.75* | 0.97* |
| TIER_3 | 0.65* | 0.70* | 0.35* | 0.60* | 0.60* | 0.50* | 0.85* |

## States and union territories

| Code | State | Purchasing power | Regulation |
| --- | --- | --- | --- |
| AN | Andaman and Nicobar Islands | 1.46 | 1.05* |
| AP | Andhra Pradesh | 1.26 | 0.95* |
| AR | Arunachal Pradesh | 1.17 | 0.85* |
| AS | Assam | 0.74 | 1.05* |
| BR | Bihar | 0.32 | 1.05* |
| CH | Chandigarh | 2.28 | 1.10* |
| CG | Chhattisgarh | 0.79 | 1.10* |
| DH | Dadra and Nagar Haveli and Daman and Diu | 1.40* | 1.10* |
| DL | Delhi | 2.43 | 1.10* |
| GA | Goa | 2.50 | 0.85* |
| GJ | Gujarat | 1.58 | 0.85* |
| HR | Haryana | 1.69 | 0.95* |
| HP | Himachal Pradesh | 1.24 | 0.90* |
| JK | Jammu and Kashmir | 0.74 | 1.05* |
| JH | Jharkhand | 0.56 | 1.00* |
| KA | Karnataka | 1.80 | 0.90* |
| KL | Kerala | 1.48 | 0.95* |
| LA | Ladakh | 0.90* | 1.10* |
| LD | Lakshadweep | 1.00* | 1.10* |
| MP | Madhya Pradesh | 0.74 | 0.95* |
| MH | Maharashtra | 1.48 | 0.95* |
| MN | Manipur | 0.68 | 0.95* |
| ML | Meghalaya | 0.72 | 0.95* |
| MZ | Mizoram | 1.25 | 1.05* |
| NL | Nagaland | 0.84 | 0.95* |
| OD | Odisha | 0.87 | 1.05* |
| PY | Puducherry | 1.41 | 1.10* |
| PB | Punjab | 1.03 | 0.90* |
| RJ | Rajasthan | 0.88 | 0.95* |
| SK | Sikkim | 2.50 | 1.05* |
| TN | Tamil Nadu | 1.67 | 0.90* |
| TS | Telangana | 1.83 | 0.95* |
| TR | Tripura | 0.94 | 1.05* |
| UP | Uttar Pradesh | 0.49 | 0.90* |
| UK | Uttarakhand | 1.30 | 0.95* |
| WB | West Bengal | 0.79 | 1.00* |

## Values to check first

The values below rest on the weakest evidence; they are the ones to verify before relying on the comparison.

- **Tier-2 salaries.** Randstad's tier-2 tables were re-paired from a two-column PDF layout, and some results are surprising: Kochi (1.09), Thiruvananthapuram (1.11) and Indore (1.06) are above the national baseline, while Lucknow (0.64) is far below it.
- **Overheads for tier-2 cities.** These come from a different report (CRE Matrix) rescaled through one city (Ahmedabad), and six cities have no published rent at all. Lucknow's rent is the highest of the tier-2 cities, which deserves a check. The 50% rent share of overheads is an assumption.
- **Purchasing power for cities.** State per capita income stands in for the city. It understates rich metros in poorer states (Kolkata 0.79, Lucknow 0.50) and may overstate cities in rich small states and union territories (Chandigarh 2.28, Delhi 2.43). The RBI values were read from the web table, not the downloadable file; eleven were cross-checked.
- **Regulation, infrastructure, talent and competition** are category-to-number mappings or judgements (all marked `*`). The startup ranking is a proxy for compliance burden, not a measure of it.
- **Populations of Bhubaneswar and Guwahati** come from a secondary source. The Kerala urban agglomerations (Kochi, Thiruvananthapuram) are inflated by Kerala's 2011 change in definition. Visakhapatnam's figure is the municipal corporation, not an urban agglomeration.
- **Industry localDemandWeight values** are modelling estimates, not data.

## Sources

Each value's exact source note (with the URL) is stored with it in `india.json` and shown in the app's location card under *Sources*. The underlying research, with every figure, its unit and year, and whether it was verified against the source, is in `simulation/data/locations/research/` (`sources.json`, `notes.md`).

### City values

- Bengaluru, Salaries: Average CTC (6-14 years) INR 19.04 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Bengaluru, Overheads: Office rent 97.1 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. Knight Frank, India Real Estate: Office and Residential Market, July-December 2025 (24th edition), city office market summaries, 'Average transacted rent' \| https://content.knightfrank.com/research/3070/documents/en/india-real-estate-office-and-residential-market-h2-2025-12597.pdf
- Bengaluru, Purchasing power: State figure used for the city. Per capita NSDP 339,813 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Bengaluru, Market size: sqrt(Census 2011 population 8,520,435 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Bengaluru, Talent (estimate): Colliers 2025 tech-talent score 3.4 mapped as 0.7 + 0.2 x score (mapping is an estimate). Colliers, Global Tech Markets: Top Talent Locations 2025 (10 Jul 2025), 'Regional ranking of cities in India' \| https://www.india-briefing.com/news/indias-bengaluru-hyderabad-among-top-tech-talent-hubs-colliers-2025-report-38739.html/
- Bengaluru, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (16,093 in Karnataka) and Inc42 2025 funding (USD 4500 million).
- Bengaluru, Funding (estimate): Estimate ordered by Inc42 2025 startup funding (USD 4500 million). Reserved for the funding decision; unused by the engine.
- Bengaluru, Infrastructure (estimate): LEADS 2025 Karnataka: Accelerator (1.0) x city tier (1.05); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Bengaluru, Regulation (estimate): States' Startup Ranking 5.0: Top Performer; category mapped to an index (Best 0.85, Top 0.9, Leader 0.95, Aspiring 1.05, Emerging 1.1). DPIIT / Startup India, States' Startup Ranking 5.0 (fifth edition, results 2026; evaluation period 1 Jan 2023 - 30 Nov 2024) \| https://www.startupindia.gov.in/srf/index.html
- Mumbai, Salaries: Average CTC (6-14 years) INR 18.37 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Mumbai, Overheads: Office rent 125.0 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. Knight Frank, India Real Estate: Office and Residential Market, July-December 2025 (24th edition), city office market summaries, 'Average transacted rent' \| https://content.knightfrank.com/research/3070/documents/en/india-real-estate-office-and-residential-market-h2-2025-12597.pdf
- Mumbai, Purchasing power: State figure used for the city. Per capita NSDP 278,681 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Mumbai, Market size: sqrt(Census 2011 population 18,394,912 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Mumbai, Talent (estimate): Colliers 2025 tech-talent score 2.2 mapped as 0.7 + 0.2 x score (mapping is an estimate). Colliers, Global Tech Markets: Top Talent Locations 2025 (10 Jul 2025), 'Regional ranking of cities in India' \| https://www.india-briefing.com/news/indias-bengaluru-hyderabad-among-top-tech-talent-hubs-colliers-2025-report-38739.html/
- Mumbai, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (27,014 in Maharashtra) and Inc42 2025 funding (USD 2000 million).
- Mumbai, Funding (estimate): Estimate ordered by Inc42 2025 startup funding (USD 2000 million). Reserved for the funding decision; unused by the engine.
- Mumbai, Infrastructure (estimate): LEADS 2025 Maharashtra: High Performer (1.05) x city tier (1.05); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Mumbai, Regulation (estimate): States' Startup Ranking 5.0: Leader; category mapped to an index (Best 0.85, Top 0.9, Leader 0.95, Aspiring 1.05, Emerging 1.1). DPIIT / Startup India, States' Startup Ranking 5.0 (fifth edition, results 2026; evaluation period 1 Jan 2023 - 30 Nov 2024) \| https://www.startupindia.gov.in/srf/index.html
- Delhi NCR, Salaries: Average CTC (6-14 years) INR 17.06 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Delhi NCR, Overheads: Office rent 96.2 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. Knight Frank, India Real Estate: Office and Residential Market, July-December 2025 (24th edition), city office market summaries, 'Average transacted rent' \| https://content.knightfrank.com/research/3070/documents/en/india-real-estate-office-and-residential-market-h2-2025-12597.pdf
- Delhi NCR, Purchasing power: State figure used for the city. Per capita NSDP 459,408 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Delhi NCR, Market size: sqrt(Census 2011 population 16,349,831 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Delhi NCR, Talent (estimate): Colliers 2025 tech-talent score 1.9 mapped as 0.7 + 0.2 x score (mapping is an estimate). Colliers, Global Tech Markets: Top Talent Locations 2025 (10 Jul 2025), 'Regional ranking of cities in India' \| https://www.india-briefing.com/news/indias-bengaluru-hyderabad-among-top-tech-talent-hubs-colliers-2025-report-38739.html/
- Delhi NCR, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (15,645 in Delhi) and Inc42 2025 funding (USD 2200 million).
- Delhi NCR, Funding (estimate): Estimate ordered by Inc42 2025 startup funding (USD 2200 million). Reserved for the funding decision; unused by the engine.
- Delhi NCR, Infrastructure (estimate): LEADS 2025 Delhi: Exemplar (1.1) x city tier (1.05); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Delhi NCR, Regulation (estimate): States' Startup Ranking 5.0: Emerging Startup Ecosystem; category mapped to an index (Best 0.85, Top 0.9, Leader 0.95, Aspiring 1.05, Emerging 1.1). DPIIT / Startup India, States' Startup Ranking 5.0 (fifth edition, results 2026; evaluation period 1 Jan 2023 - 30 Nov 2024) \| https://www.startupindia.gov.in/srf/index.html
- Hyderabad, Salaries: Average CTC (6-14 years) INR 17.74 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Hyderabad, Overheads: Office rent 77.0 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. Knight Frank, India Real Estate: Office and Residential Market, July-December 2025 (24th edition), city office market summaries, 'Average transacted rent' \| https://content.knightfrank.com/research/3070/documents/en/india-real-estate-office-and-residential-market-h2-2025-12597.pdf
- Hyderabad, Purchasing power: State figure used for the city. Per capita NSDP 346,457 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Hyderabad, Market size: sqrt(Census 2011 population 7,677,018 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Hyderabad, Talent (estimate): Colliers 2025 tech-talent score 2.6 mapped as 0.7 + 0.2 x score (mapping is an estimate). Colliers, Global Tech Markets: Top Talent Locations 2025 (10 Jul 2025), 'Regional ranking of cities in India' \| https://www.india-briefing.com/news/indias-bengaluru-hyderabad-among-top-tech-talent-hubs-colliers-2025-report-38739.html/
- Hyderabad, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (7,918 in Telangana) and Inc42 2025 funding (USD 287 million).
- Hyderabad, Funding (estimate): Estimate ordered by Inc42 2025 startup funding (USD 287 million). Reserved for the funding decision; unused by the engine.
- Hyderabad, Infrastructure (estimate): LEADS 2025 Telangana: High Performer (1.05) x city tier (1.05); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Pune, Overheads: Office rent 78.0 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. Knight Frank, India Real Estate: Office and Residential Market, July-December 2025 (24th edition), city office market summaries, 'Average transacted rent' \| https://content.knightfrank.com/research/3070/documents/en/india-real-estate-office-and-residential-market-h2-2025-12597.pdf
- Pune, Market size: sqrt(Census 2011 population 5,057,709 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Pune, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (27,014 in Maharashtra) and Inc42 2025 funding (USD 450 million).
- Pune, Funding (estimate): Estimate ordered by Inc42 2025 startup funding (USD 450 million). Reserved for the funding decision; unused by the engine.
- Chennai, Salaries: Average CTC (6-14 years) INR 17.92 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Chennai, Overheads: Office rent 73.0 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. Knight Frank, India Real Estate: Office and Residential Market, July-December 2025 (24th edition), city office market summaries, 'Average transacted rent' \| https://content.knightfrank.com/research/3070/documents/en/india-real-estate-office-and-residential-market-h2-2025-12597.pdf
- Chennai, Purchasing power: State figure used for the city. Per capita NSDP 315,220 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Chennai, Market size: sqrt(Census 2011 population 8,653,521 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Chennai, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (10,053 in Tamil Nadu) and Inc42 2025 funding (USD 432 million).
- Chennai, Funding (estimate): Estimate ordered by Inc42 2025 startup funding (USD 432 million). Reserved for the funding decision; unused by the engine.
- Chennai, Infrastructure (estimate): LEADS 2025 Tamil Nadu: Exemplar (1.1) x city tier (1.05); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Kolkata, Salaries: Average CTC (6-14 years) INR 13.18 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Kolkata, Overheads: Office rent 47.5 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. Knight Frank, India Real Estate: Office and Residential Market, July-December 2025 (24th edition), city office market summaries, 'Average transacted rent' \| https://content.knightfrank.com/research/3070/documents/en/india-real-estate-office-and-residential-market-h2-2025-12597.pdf
- Kolkata, Purchasing power: State figure used for the city. Per capita NSDP 149,515 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Kolkata, Market size: sqrt(Census 2011 population 14,057,991 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Kolkata, Talent (estimate): Estimate: a metro without a Colliers score; large graduate base, smaller tech workforce.
- Kolkata, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (5,001 in West Bengal).
- Kolkata, Funding (estimate): Estimate: no published city funding figure. Reserved for the funding decision; unused by the engine.
- Kolkata, Infrastructure (estimate): LEADS 2025 West Bengal: Growth-Seeker (0.9) x city tier (1.05); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Kolkata, Regulation (estimate): Estimate: did not take part in States' Startup Ranking 5.0; national baseline.
- Ahmedabad, Salaries: Average CTC (6-14 years) INR 18.29 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Ahmedabad, Overheads: Office rent 44.0 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. Knight Frank, India Real Estate: Office and Residential Market, July-December 2025 (24th edition), city office market summaries, 'Average transacted rent' \| https://content.knightfrank.com/research/3070/documents/en/india-real-estate-office-and-residential-market-h2-2025-12597.pdf
- Ahmedabad, Purchasing power: State figure used for the city. Per capita NSDP 297,722 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Ahmedabad, Market size: sqrt(Census 2011 population 6,357,693 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Ahmedabad, Talent (estimate): Estimate: a metro without a Colliers score; growing GIFT City and IT services base.
- Ahmedabad, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (12,540 in Gujarat).
- Ahmedabad, Infrastructure (estimate): LEADS 2025 Gujarat: High Performer (1.05) x city tier (1.05); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Ahmedabad, Regulation (estimate): States' Startup Ranking 5.0: Best Performer; category mapped to an index (Best 0.85, Top 0.9, Leader 0.95, Aspiring 1.05, Emerging 1.1). DPIIT / Startup India, States' Startup Ranking 5.0 (fifth edition, results 2026; evaluation period 1 Jan 2023 - 30 Nov 2024) \| https://www.startupindia.gov.in/srf/index.html
- Jaipur, Salaries: Average CTC (6-14 years) INR 11.18 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Jaipur, Overheads: Office rent 36.2 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. CRE Matrix 49.8 INR/sq ft/month x 0.726 (rescaled to Knight Frank via Ahmedabad). CRE Matrix, 'Top 10 Most Affordable Office Markets in India (2026)' (blog, 29 Jul 2026) \| https://www.crematrix.com/blog/?p=3904
- Jaipur, Purchasing power: State figure used for the city. Per capita NSDP 166,647 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Jaipur, Market size: sqrt(Census 2011 population 3,046,163 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Jaipur, Talent (estimate): Estimate: emerging IT and startup hub; tier-2 city.
- Jaipur, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (5,395 in Rajasthan).
- Jaipur, Infrastructure (estimate): LEADS 2025 Rajasthan: Growth-Seeker (0.9) x city tier (0.95); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Kochi, Salaries: Average CTC (6-14 years) INR 16.49 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Kochi, Overheads (estimate): Estimate: no published office rent; mean of the listed Tier 2 cities.
- Kochi, Purchasing power: State figure used for the city. Per capita NSDP 279,751 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Kochi, Market size: sqrt(Census 2011 population 2,119,724 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Kochi, Talent (estimate): Estimate: Infopark Kochi tech park; tier-2 city.
- Kochi, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (6,173 in Kerala).
- Kochi, Infrastructure (estimate): LEADS 2025 Kerala: High Performer (1.05) x city tier (0.95); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Indore, Salaries: Average CTC (6-14 years) INR 16.04 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Indore, Overheads: Office rent 32.7 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. CRE Matrix 45 INR/sq ft/month x 0.726 (rescaled to Knight Frank via Ahmedabad). CRE Matrix, 'Top 10 Most Affordable Office Markets in India (2026)' (blog, 29 Jul 2026) \| https://www.crematrix.com/blog/?p=3904
- Indore, Purchasing power: State figure used for the city. Per capita NSDP 139,713 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Indore, Market size: sqrt(Census 2011 population 2,170,295 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Indore, Talent (estimate): Estimate: IIT and IIM campuses, emerging IT hub; tier-2 city.
- Indore, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (4,913 in Madhya Pradesh).
- Indore, Infrastructure (estimate): LEADS 2025 Madhya Pradesh: Accelerator (1.0) x city tier (0.95); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Chandigarh, Salaries: Average CTC (6-14 years) INR 13.86 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Chandigarh, Purchasing power: State figure used for the city. Per capita NSDP 430,119 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Chandigarh, Market size: sqrt(Census 2011 population 1,026,459 / 3,669,575, the geometric mean of the 20 cities). Wikipedia 'Urban agglomerations in India' (2011 column cites citypopulation.de 'India: Major Agglomerations') \| https://en.wikipedia.org/wiki/Urban_agglomerations_in_India
- Chandigarh, Talent (estimate): Estimate: IT parks in the Chandigarh tricity; tier-2 city.
- Chandigarh, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (521 in Chandigarh).
- Chandigarh, Infrastructure (estimate): LEADS 2025 Chandigarh: Accelerator (1.0) x city tier (0.95); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Coimbatore, Salaries: Average CTC (6-14 years) INR 13.53 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Coimbatore, Overheads: Office rent 36.4 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. CRE Matrix 50.2 INR/sq ft/month x 0.726 (rescaled to Knight Frank via Ahmedabad). CRE Matrix, 'Top 10 Most Affordable Office Markets in India (2026)' (blog, 29 Jul 2026) \| https://www.crematrix.com/blog/?p=3904
- Coimbatore, Market size: sqrt(Census 2011 population 2,136,916 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Coimbatore, Talent (estimate): Estimate: engineering colleges and a growing IT sector; tier-2 city.
- Coimbatore, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (10,053 in Tamil Nadu).
- Coimbatore, Infrastructure (estimate): LEADS 2025 Tamil Nadu: Exemplar (1.1) x city tier (0.95); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Lucknow, Salaries: Average CTC (6-14 years) INR 9.67 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Lucknow, Overheads: Office rent 48.3 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. CRE Matrix 66.5 INR/sq ft/month x 0.726 (rescaled to Knight Frank via Ahmedabad). CRE Matrix, 'Top 10 Most Affordable Office Markets in India (2026)' (blog, 29 Jul 2026) \| https://www.crematrix.com/blog/?p=3904
- Lucknow, Purchasing power: State figure used for the city. Per capita NSDP 93,422 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 2
- Lucknow, Market size: sqrt(Census 2011 population 2,902,920 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Lucknow, Talent (estimate): Estimate: tier-2 city with a small tech workforce.
- Lucknow, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (14,429 in Uttar Pradesh).
- Lucknow, Infrastructure (estimate): LEADS 2025 Uttar Pradesh: Exemplar (1.1) x city tier (0.95); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Bhubaneswar, Salaries: Average CTC (6-14 years) INR 14.03 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Bhubaneswar, Purchasing power: State figure used for the city. Per capita NSDP 165,068 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Bhubaneswar, Market size: sqrt(Census 2011 population 885,363 / 3,669,575, the geometric mean of the 20 cities). Wikipedia 'Urban agglomerations in India' (2011 column cites citypopulation.de 'India: Major Agglomerations') \| https://en.wikipedia.org/wiki/Urban_agglomerations_in_India
- Bhubaneswar, Talent (estimate): Estimate: Infocity and IIT Bhubaneswar; tier-2 city.
- Bhubaneswar, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (2,670 in Odisha).
- Bhubaneswar, Infrastructure (estimate): LEADS 2025 Odisha: Accelerator (1.0) x city tier (0.95); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Bhubaneswar, Regulation (estimate): States' Startup Ranking 5.0: Aspiring Leader; category mapped to an index (Best 0.85, Top 0.9, Leader 0.95, Aspiring 1.05, Emerging 1.1). DPIIT / Startup India, States' Startup Ranking 5.0 (fifth edition, results 2026; evaluation period 1 Jan 2023 - 30 Nov 2024) \| https://www.startupindia.gov.in/srf/index.html
- Nagpur, Salaries: Average CTC (6-14 years) INR 12.74 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Nagpur, Market size: sqrt(Census 2011 population 2,497,870 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Nagpur, Talent (estimate): Estimate: tier-2 city; MIHAN SEZ IT units.
- Nagpur, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (27,014 in Maharashtra).
- Nagpur, Infrastructure (estimate): LEADS 2025 Maharashtra: High Performer (1.05) x city tier (0.95); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Surat, Salaries: Average CTC (6-14 years) INR 13.51 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Surat, Market size: sqrt(Census 2011 population 4,591,246 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Surat, Talent (estimate): Estimate: tier-2 city; manufacturing and trade rather than tech.
- Surat, Infrastructure (estimate): LEADS 2025 Gujarat: High Performer (1.05) x city tier (0.95); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Visakhapatnam, Salaries: Average CTC (6-14 years) INR 12.34 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Visakhapatnam, Overheads: Office rent 40.7 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. CRE Matrix 56 INR/sq ft/month x 0.726 (rescaled to Knight Frank via Ahmedabad). CRE Matrix, 'Top 10 Most Affordable Office Markets in India (2026)' (blog, 29 Jul 2026) \| https://www.crematrix.com/blog/?p=3904
- Visakhapatnam, Purchasing power: State figure used for the city. Per capita NSDP 237,951 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Visakhapatnam, Market size: sqrt(Census 2011 population 1,728,128 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Visakhapatnam, Talent (estimate): Estimate: tier-2 city with a growing IT sector.
- Visakhapatnam, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (2,446 in Andhra Pradesh).
- Visakhapatnam, Infrastructure (estimate): LEADS 2025 Andhra Pradesh: Accelerator (1.0) x city tier (0.95); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
- Thiruvananthapuram, Salaries: Average CTC (6-14 years) INR 16.77 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Thiruvananthapuram, Overheads: Office rent 32.9 INR/sq ft/month vs 61.8 (mean of 14 cities); rent assumed to be 50% of overheads. CRE Matrix 45.3 INR/sq ft/month x 0.726 (rescaled to Knight Frank via Ahmedabad). CRE Matrix, 'Top 10 Most Affordable Office Markets in India (2026)' (blog, 29 Jul 2026) \| https://www.crematrix.com/blog/?p=3904
- Thiruvananthapuram, Market size: sqrt(Census 2011 population 1,679,754 / 3,669,575, the geometric mean of the 20 cities). Census of India 2011, A-04 Towns and urban agglomerations classified by population size class (as tabulated on Wikipedia 'List of million-plus urban agglomerations in India') \| https://en.wikipedia.org/wiki/List_of_million-plus_urban_agglomerations_in_India
- Thiruvananthapuram, Talent (estimate): Estimate: Technopark (one of India's largest IT parks); tier-2 city.
- Guwahati, Salaries: Average CTC (6-14 years) INR 13.07 lakh vs 15.16 lakh (mean of the 20 cities). Randstad India, Annual Salary Trends Report 2024-25, 'salary trends across tier-1 / tier-2 cities and job hierarchies' tables (pp. 14, 19-21) \| https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf
- Guwahati, Purchasing power: State figure used for the city. Per capita NSDP 139,783 / all-India per capita NNI 188,892 (INR, 2023-24, current prices). RBI Handbook of Statistics on Indian Economy, Table 9 (current prices, base 2011-12) (2023-24). Reserve Bank of India, Handbook of Statistics on Indian Economy (web table dated 29 Aug 2025), Table 9: Per Capita Net State Domestic Product - State-wise (At Current Prices), base 
- Guwahati, Market size: sqrt(Census 2011 population 968,549 / 3,669,575, the geometric mean of the 20 cities). Wikipedia 'Urban agglomerations in India' (2011 column cites citypopulation.de 'India: Major Agglomerations') \| https://en.wikipedia.org/wiki/Urban_agglomerations_in_India
- Guwahati, Talent (estimate): Estimate: tier-2 city; smallest tech workforce among the listed cities.
- Guwahati, Competition (estimate): Estimate informed by DPIIT-recognised startups in the state (1,434 in Assam).
- Guwahati, Infrastructure (estimate): LEADS 2025 Assam: Accelerator (1.0) x city tier (0.95); category values are estimates. DPIIT, LEADS 2025 (Logistics Ease Across Different States, seventh edition, FY 2024-25), PIB release PRID 2260854 \| https://www.pib.gov.in/PressReleasePage.aspx?PRID=2260854&reg=48&lang=2
