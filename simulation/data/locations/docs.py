# ruff: noqa: E501, RUF001  (prose with math symbols and citations)
"""Writes docs/locations.md from india.json, so the documented values are always the ones used.

cd simulation && .venv/Scripts/python data/locations/docs.py
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = json.loads((HERE / "india.json").read_text(encoding="utf-8"))
OUT = HERE.parents[2] / "docs" / "locations.md"

NAMES = [
    ("salaryIndex", "Salaries"),
    ("operatingCostIndex", "Overheads"),
    ("purchasingPower", "Purchasing power"),
    ("localMarketSize", "Market size"),
    ("talentAvailability", "Talent"),
    ("competitionDensity", "Competition"),
    ("fundingAccess", "Funding"),
    ("infrastructure", "Infrastructure"),
    ("regulatoryBurden", "Regulation"),
]


def cell(entry: dict) -> str:
    return f"{entry['value']:.2f}{'*' if entry['isEstimate'] else ''}"


def esc(text: str) -> str:
    return text.replace("|", "\\|")


m = DATA["method"]
lines = [
    "# Startup locations",
    "",
    "Where a startup is based changes its economics. This page lists every location value the simulation uses, with its source. It is generated from `simulation/data/locations/india.json` by `simulation/data/locations/docs.py`; `india.json` is itself built from the collected research (`research/sources.json`) by `build.py`, so every number can be traced and rebuilt.",
    "",
    "**Every index is relative to a national baseline of 1.0.** Values marked `*` are estimates: no published figure exists for them in a usable form, or a published category or ranking was mapped to a number by judgement. Unmarked values are derived from a published figure by the formula given below. Indices are clamped to 0.3–2.5.",
    "",
    "## How each index is derived",
    "",
    "| Index | Engine effect | Method |",
    "| --- | --- | --- |",
    f"| Salaries | Salary per employee × index (costs, in full) | Randstad India *Annual Salary Trends Report 2024-25*: average CTC for 6–14 years' experience in the city ÷ the mean of the 20 listed cities (₹{m['salaryBaselineLakh']} lakh). The middle band is used because the junior band shows tier-2 cities above metros, which looks like a sampling artefact. All roles, not one job. |",
    f"| Overheads | Fixed costs × index (costs, in full) | Office rent ÷ the mean of the cities with a published rent (₹{m['rentBaseline']}/sq ft/month), with rent taken as {int(m['rentShareOfOverheads'] * 100)}% of overheads (an estimate): index = 0.5 + 0.5 × rent ratio. Rents: Knight Frank H2 2025 average transacted rent (8 metros); CRE Matrix 2026 weighted averages (tier-2) rescaled to Knight Frank's level through Ahmedabad, the one city in both (× {m['creToKnightFrank']}). Six cities without a published rent use the tier-2 mean (estimate). |",
    "| Regulation | Fixed costs + 10% × (index − 1) as compliance (costs, in full) | DPIIT States' Startup Ranking 5.0 category, mapped: Best Performer 0.85, Top Performer 0.9, Leader 0.95, Aspiring Leader 1.05, Emerging 1.1 (estimate: the ranking measures startup support, including regulatory facilitation, not compliance cost directly). States that did not take part: 1.0. |",
    "| Talent | Recruiting cost ÷ index; below 1.0 at most ⌊8 × index⌋ hires per turn (costs, in full) | Colliers 2025 tech-talent scores for six metros, mapped as 0.7 + 0.2 × score (estimate); other cities are estimates from tier and known tech parks. |",
    "| Infrastructure | Logistics cost per order ÷ index, only for industries that ship goods (costs, in full) | LEADS 2025 state category (Exemplar 1.1, High Performer 1.05, Accelerator 1.0, Growth-Seeker 0.9) × city tier (metro 1.05, tier-2 0.95, tier-3 0.85); the mapping is an estimate. |",
    f"| Purchasing power | Price elasticity × index^(−0.5 × w) (demand) | Per capita NSDP of the state ÷ all-India per capita NNI (₹{m['allIndiaPerCapitaNni']:,}), RBI *Handbook of Statistics on Indian Economy*, Table 9, 2023-24, current prices. A state figure, used for every city in the state. |",
    f"| Market size | Market size × (1 + w × (index − 1)) (demand) | √(Census 2011 population ÷ {m['populationBaseline']:,}, the geometric mean of the 20 cities). Urban agglomeration figures; Delhi NCR is the Delhi UA. The square root (addressable customers grow more slowly than population) is a modelling choice. |",
    "| Competition | Competitor intensity × (1 + w × (index − 1)) (demand) | Estimate informed by DPIIT-recognised startups by state (Lok Sabha USQ 3465, 31 Oct 2024) and Inc42 2025 funding by city. |",
    "| Funding | Not used yet (reserved for the funding decision) | Estimate ordered by Inc42 2025 startup funding by city. |",
    "",
    "**w** is the industry's `localDemandWeight`: Food & Beverage 0.9, Healthtech 0.5, E-commerce 0.4, Edtech 0.3, Fintech 0.25, Consumer app 0.2, SaaS 0.1, Gaming 0.05. These weights are modelling estimates of how local each industry's customers are. Cost effects ignore w and always apply in full.",
    "",
    "**Tiers** follow the house rent allowance classification of cities (Department of Expenditure OM 2/5/2017-E.II(B), 7 July 2017): class X is METRO, class Y TIER_2. None of the 20 listed cities is class Z, so every TIER_3 default is an estimate.",
    "",
    "**Any other city** uses its state's purchasing power and regulation, and its tier's defaults for everything else (the mean of the listed cities in that tier).",
    "",
    "## Listed cities",
    "",
    "| City | State | Tier | " + " | ".join(label for _, label in NAMES) + " |",
    "| --- | --- | --- | " + " | ".join("---" for _ in NAMES) + " |",
]
for c in DATA["cities"]:
    lines.append(
        f"| {c['name']} | {c['state']} | {c['tier']} | "
        + " | ".join(cell(c["indices"][k]) for k, _ in NAMES)
        + " |"
    )
lines += [
    "",
    "## Tier defaults (any other city)",
    "",
    "| Tier | "
    + " | ".join(label for k, label in NAMES if k not in ("purchasingPower", "regulatoryBurden"))
    + " |",
    "| --- | "
    + " | ".join("---" for k, _ in NAMES if k not in ("purchasingPower", "regulatoryBurden"))
    + " |",
]
for tier, t in DATA["tiers"].items():
    lines.append(
        f"| {tier} | "
        + " | ".join(
            cell(t["defaults"][k])
            for k, _ in NAMES
            if k not in ("purchasingPower", "regulatoryBurden")
        )
        + " |"
    )
lines += [
    "",
    "## States and union territories",
    "",
    "| Code | State | Purchasing power | Regulation |",
    "| --- | --- | --- | --- |",
]
for s in sorted(DATA["states"], key=lambda s: s["name"]):
    lines.append(
        f"| {s['code']} | {s['name']} | {cell(s['indices']['purchasingPower'])} | {cell(s['indices']['regulatoryBurden'])} |"
    )
lines += [
    "",
    "## Values to check first",
    "",
    "The values below rest on the weakest evidence; they are the ones to verify before relying on the comparison.",
    "",
    "- **Tier-2 salaries.** Randstad's tier-2 tables were re-paired from a two-column PDF layout, and some results are surprising: Kochi (1.09), Thiruvananthapuram (1.11) and Indore (1.06) are above the national baseline, while Lucknow (0.64) is far below it.",
    "- **Overheads for tier-2 cities.** These come from a different report (CRE Matrix) rescaled through one city (Ahmedabad), and six cities have no published rent at all. Lucknow's rent is the highest of the tier-2 cities, which deserves a check. The 50% rent share of overheads is an assumption.",
    "- **Purchasing power for cities.** State per capita income stands in for the city. It understates rich metros in poorer states (Kolkata 0.79, Lucknow 0.50) and may overstate cities in rich small states and union territories (Chandigarh 2.28, Delhi 2.43). The RBI values were read from the web table, not the downloadable file; eleven were cross-checked.",
    "- **Regulation, infrastructure, talent and competition** are category-to-number mappings or judgements (all marked `*`). The startup ranking is a proxy for compliance burden, not a measure of it.",
    "- **Populations of Bhubaneswar and Guwahati** come from a secondary source. The Kerala urban agglomerations (Kochi, Thiruvananthapuram) are inflated by Kerala's 2011 change in definition. Visakhapatnam's figure is the municipal corporation, not an urban agglomeration.",
    "- **Industry localDemandWeight values** are modelling estimates, not data.",
    "",
    "## Sources",
    "",
    "Each value's exact source note (with the URL) is stored with it in `india.json` and shown in the app's location card under *Sources*. The underlying research, with every figure, its unit and year, and whether it was verified against the source, is in `simulation/data/locations/research/` (`sources.json`, `notes.md`).",
    "",
]
sources = []
seen = set()
for c in DATA["cities"]:
    for k, label in NAMES:
        src = c["indices"][k]["source"]
        if src not in seen:
            seen.add(src)
            sources.append(
                f"- {c['name']}, {label}{' (estimate)' if c['indices'][k]['isEstimate'] else ''}: {esc(src)}"
            )
lines += ["### City values", "", *sources, ""]
OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {OUT}")
