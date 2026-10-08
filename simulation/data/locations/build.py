# ruff: noqa: E501  (source citations are long strings by nature)
"""Builds india.json (the location data the simulation uses) from research/sources.json.

    cd simulation && .venv/Scripts/python data/locations/build.py

Every index is relative to a national baseline of 1.0. The rules below are the whole method:
each published figure becomes an index by the stated formula, and where no published figure
exists the value is a reasoned estimate and is flagged isEstimate. docs/locations.md (written
by docs.py from the output) lists every value with its source.
"""

import json
import math
from pathlib import Path
from statistics import fmean, geometric_mean

HERE = Path(__file__).resolve().parent
SOURCES = json.loads((HERE / "research" / "sources.json").read_text(encoding="utf-8"))
DATA_VERSION = "1.0.0"
LO, HI = 0.3, 2.5

# ISO 3166-2:IN codes (2023 revision) and the names the sources use for each state or UT.
STATES = {
    "AN": ["Andaman and Nicobar Islands", "Andaman & Nicobar Islands"],
    "AP": ["Andhra Pradesh"],
    "AR": ["Arunachal Pradesh"],
    "AS": ["Assam"],
    "BR": ["Bihar"],
    "CH": ["Chandigarh"],
    "CG": ["Chhattisgarh"],
    "DH": ["Dadra and Nagar Haveli and Daman and Diu"],
    "DL": ["Delhi"],
    "GA": ["Goa"],
    "GJ": ["Gujarat"],
    "HR": ["Haryana"],
    "HP": ["Himachal Pradesh"],
    "JK": ["Jammu and Kashmir", "Jammu & Kashmir"],
    "JH": ["Jharkhand"],
    "KA": ["Karnataka"],
    "KL": ["Kerala"],
    "LA": ["Ladakh"],
    "LD": ["Lakshadweep"],
    "MP": ["Madhya Pradesh"],
    "MH": ["Maharashtra"],
    "MN": ["Manipur"],
    "ML": ["Meghalaya"],
    "MZ": ["Mizoram"],
    "NL": ["Nagaland"],
    "OD": ["Odisha"],
    "PY": ["Puducherry"],
    "PB": ["Punjab"],
    "RJ": ["Rajasthan"],
    "SK": ["Sikkim"],
    "TN": ["Tamil Nadu"],
    "TS": ["Telangana"],
    "TR": ["Tripura"],
    "UP": ["Uttar Pradesh"],
    "UK": ["Uttarakhand"],
    "WB": ["West Bengal"],
}
DISPLAY = {code: names[0] for code, names in STATES.items()}

CITIES = [
    ("bengaluru", "Bengaluru", "KA"),
    ("mumbai", "Mumbai", "MH"),
    ("delhi-ncr", "Delhi NCR", "DL"),
    ("hyderabad", "Hyderabad", "TS"),
    ("pune", "Pune", "MH"),
    ("chennai", "Chennai", "TN"),
    ("kolkata", "Kolkata", "WB"),
    ("ahmedabad", "Ahmedabad", "GJ"),
    ("jaipur", "Jaipur", "RJ"),
    ("kochi", "Kochi", "KL"),
    ("indore", "Indore", "MP"),
    ("chandigarh", "Chandigarh", "CH"),
    ("coimbatore", "Coimbatore", "TN"),
    ("lucknow", "Lucknow", "UP"),
    ("bhubaneswar", "Bhubaneswar", "OD"),
    ("nagpur", "Nagpur", "MH"),
    ("surat", "Surat", "GJ"),
    ("visakhapatnam", "Visakhapatnam", "AP"),
    ("thiruvananthapuram", "Thiruvananthapuram", "KL"),
    ("guwahati", "Guwahati", "AS"),
]
TIER_OF_CLASS = {"X": "METRO", "Y": "TIER_2", "Z": "TIER_3"}


def clamp(x: float) -> float:
    return round(min(HI, max(LO, x)), 3)


def value(datum):
    return None if datum is None else datum.get("value") if isinstance(datum, dict) else datum


def cite(datum, fallback: str = "") -> str:
    """'Publisher, document (year) <url>' from a research datum."""
    if not isinstance(datum, dict):
        return fallback
    parts = [datum.get("source") or fallback]
    if datum.get("url"):
        parts.append(datum["url"])
    return " | ".join(p for p in parts if p)


def by_state(table: dict, code: str):
    for name in STATES[code]:
        if name in table:
            return table[name]
    return None


def index(v: float, source: str, estimate: bool) -> dict:
    return {"value": clamp(v), "isEstimate": estimate, "source": source[:400]}


# ---------------------------------------------------------------------------------------------
# State-level: purchasing power and regulatory burden.
nsdp = SOURCES["per_capita_nsdp"]
nni = value(nsdp["all_india_per_capita_nni"])
NSDP_SRC = f"{nsdp['table']} ({nsdp['year']})"

# Estimates for the three UTs the RBI table does not cover.
PP_ESTIMATES = {
    "LA": (
        0.9,
        "Estimate: not in the RBI table; set near Jammu and Kashmir's level (0.74) and Himachal Pradesh's (1.24).",
    ),
    "LD": (1.0, "Estimate: not in the RBI table; national baseline."),
    "DH": (
        1.4,
        "Estimate: not in the RBI table; an industrial UT, set between Gujarat (1.58) and the baseline.",
    ),
}

SSR = SOURCES["states_startup_ranking"]["edition_5_2026"]
# States' Startup Ranking 5.0 category -> regulatory burden (an estimate: the ranking measures
# state support for startups, which includes regulatory facilitation, not compliance cost itself).
SSR_BURDEN = {
    "Best Performer": 0.85,
    "Top Performer": 0.9,
    "Leader": 0.95,
    "Aspiring Leader": 1.05,
    "Emerging Startup Ecosystem": 1.1,
}


def ssr_source(datum) -> str:
    return cite(datum, "DPIIT States' Startup Ranking 5.0")


states = []
for code in STATES:
    income = value(by_state(nsdp["states"], code))
    if income:
        pp = index(
            income / nni,
            f"Per capita NSDP {income:,} / all-India per capita NNI {nni:,} (INR, {nsdp['year']}, current prices). {NSDP_SRC}. {cite(by_state(nsdp['states'], code))}",
            False,
        )
    else:
        v, note = PP_ESTIMATES[code]
        pp = index(v, note, True)
    ranked = by_state(SSR, code)
    category = value(ranked)
    if category:
        burden = index(
            SSR_BURDEN[category],
            f"States' Startup Ranking 5.0: {category}; category mapped to an index (Best 0.85, Top 0.9, Leader 0.95, Aspiring 1.05, Emerging 1.1). {ssr_source(ranked)}",
            True,
        )
    else:
        burden = index(
            1.0,
            "Estimate: did not take part in States' Startup Ranking 5.0; national baseline.",
            True,
        )
    states.append(
        {
            "code": code,
            "name": DISPLAY[code],
            "indices": {"purchasingPower": pp, "regulatoryBurden": burden},
        }
    )
state_by_code = {s["code"]: s for s in states}

# ---------------------------------------------------------------------------------------------
# City-level indices.
pop = SOURCES["city_population_census_2011"]
hra = SOURCES["hra_city_class"]["cities"]
salary = SOURCES["salary_randstad_2024_25"]["middle_6_14_years"]
rents_kf = SOURCES["office_rent"]["knight_frank_h2_2025"]
rents_cre = SOURCES["office_rent"]["cre_matrix_2026"]
leads = SOURCES["leads_2025"]
talent = SOURCES["tech_talent_colliers_2025"]
funding = SOURCES["startup_funding_by_city"]["inc42_2025"]

pop_baseline = geometric_mean([value(pop[name]) for _, name, _ in CITIES])
salary_baseline = fmean([value(salary[name]) for _, name, _ in CITIES])

# Rents: Knight Frank (8 metros) is the scale; CRE Matrix (tier-2 cities) is rescaled to it
# through Ahmedabad, the one city in both reports.
cre_to_kf = value(rents_kf["Ahmedabad"]) / value(rents_cre["Ahmedabad"])
rents = {}
for _, name, _ in CITIES:
    if value(rents_kf.get(name)) is not None:
        rents[name] = (value(rents_kf[name]), cite(rents_kf[name]))
    elif value(rents_cre.get(name)) is not None:
        rents[name] = (
            value(rents_cre[name]) * cre_to_kf,
            f"CRE Matrix {value(rents_cre[name])} INR/sq ft/month x {cre_to_kf:.3f} (rescaled to Knight Frank via Ahmedabad). {cite(rents_cre[name])}",
        )
rent_baseline = fmean(r for r, _ in rents.values())
RENT_SHARE = 0.5  # rent's share of fixed overheads: an estimate

LEADS_INFRA = {"Exemplar": 1.1, "High Performer": 1.05, "Accelerator": 1.0, "Growth-Seeker": 0.9}
TIER_INFRA = {"METRO": 1.05, "TIER_2": 0.95, "TIER_3": 0.85}

# Talent: Colliers 2025 tech-talent scores for six metros map to 0.7 + 0.2 x score; other cities
# are estimates by tier and known tech parks.
TALENT_ESTIMATES = {
    "kolkata": (
        1.0,
        "Estimate: a metro without a Colliers score; large graduate base, smaller tech workforce.",
    ),
    "ahmedabad": (
        0.95,
        "Estimate: a metro without a Colliers score; growing GIFT City and IT services base.",
    ),
    "kochi": (0.85, "Estimate: Infopark Kochi tech park; tier-2 city."),
    "thiruvananthapuram": (
        0.85,
        "Estimate: Technopark (one of India's largest IT parks); tier-2 city.",
    ),
    "coimbatore": (0.85, "Estimate: engineering colleges and a growing IT sector; tier-2 city."),
    "indore": (0.85, "Estimate: IIT and IIM campuses, emerging IT hub; tier-2 city."),
    "chandigarh": (0.85, "Estimate: IT parks in the Chandigarh tricity; tier-2 city."),
    "jaipur": (0.85, "Estimate: emerging IT and startup hub; tier-2 city."),
    "lucknow": (0.75, "Estimate: tier-2 city with a small tech workforce."),
    "bhubaneswar": (0.8, "Estimate: Infocity and IIT Bhubaneswar; tier-2 city."),
    "nagpur": (0.75, "Estimate: tier-2 city; MIHAN SEZ IT units."),
    "surat": (0.75, "Estimate: tier-2 city; manufacturing and trade rather than tech."),
    "visakhapatnam": (0.8, "Estimate: tier-2 city with a growing IT sector."),
    "guwahati": (0.7, "Estimate: tier-2 city; smallest tech workforce among the listed cities."),
}

# Competition (local startup density): estimates informed by DPIIT-recognised startups by state
# and Inc42 funding by city.
COMPETITION = {
    "bengaluru": 1.5,
    "mumbai": 1.4,
    "delhi-ncr": 1.4,
    "hyderabad": 1.25,
    "pune": 1.25,
    "chennai": 1.2,
    "kolkata": 1.0,
    "ahmedabad": 1.05,
    "jaipur": 0.85,
    "kochi": 0.85,
    "indore": 0.85,
    "chandigarh": 0.85,
    "coimbatore": 0.8,
    "lucknow": 0.8,
    "bhubaneswar": 0.75,
    "nagpur": 0.75,
    "surat": 0.8,
    "visakhapatnam": 0.75,
    "thiruvananthapuram": 0.8,
    "guwahati": 0.7,
}
DPIIT = SOURCES["dpiit_startups_by_state"]["states"]

# Funding access: estimates ordered by Inc42 2025 funding where published; reserved (unused).
FUNDING = {
    "bengaluru": 1.8,
    "delhi-ncr": 1.6,
    "mumbai": 1.6,
    "pune": 1.2,
    "chennai": 1.2,
    "hyderabad": 1.15,
    "kolkata": 0.9,
    "ahmedabad": 0.95,
}

cities = []
for cid, name, code in CITIES:
    tier = TIER_OF_CLASS[value(hra[name])]
    population = value(pop[name])
    pay = value(salary[name])
    rent, rent_src = rents.get(name, (None, None))
    leads_cat = value(by_state(leads, code))
    if rent is not None:
        operating = index(
            (1 - RENT_SHARE) + RENT_SHARE * rent / rent_baseline,
            f"Office rent {rent:.1f} INR/sq ft/month vs {rent_baseline:.1f} (mean of {len(rents)} cities); rent assumed to be {RENT_SHARE:.0%} of overheads. {rent_src}",
            False,
        )
    else:
        operating = None  # filled with the tier mean below
    t_score = value(talent.get(name))
    if t_score is not None:
        tal = index(
            0.7 + 0.2 * t_score,
            f"Colliers 2025 tech-talent score {t_score} mapped as 0.7 + 0.2 x score (mapping is an estimate). {cite(talent[name])}",
            True,
        )
    else:
        tal = index(*TALENT_ESTIMATES[cid], True)
    dp = value(by_state(DPIIT, code))
    fund = value(funding.get(name))
    cities.append(
        {
            "id": cid,
            "name": name,
            "state": code,
            "tier": tier,
            "tierSource": f"House rent allowance class {value(hra[name])}. {cite(hra[name])}",
            "indices": {
                "salaryIndex": index(
                    pay / salary_baseline,
                    f"Average CTC (6-14 years) INR {pay} lakh vs {salary_baseline:.2f} lakh (mean of the 20 cities). {cite(salary[name])}",
                    False,
                ),
                "operatingCostIndex": operating,
                "purchasingPower": dict(
                    state_by_code[code]["indices"]["purchasingPower"],
                    source=(
                        "State figure used for the city. "
                        + state_by_code[code]["indices"]["purchasingPower"]["source"]
                    )[:400],
                ),
                "localMarketSize": index(
                    math.sqrt(population / pop_baseline),
                    f"sqrt(Census 2011 population {population:,} / {pop_baseline:,.0f}, the geometric mean of the 20 cities). {cite(pop[name])}",
                    False,
                ),
                "talentAvailability": tal,
                "competitionDensity": index(
                    COMPETITION[cid],
                    f"Estimate informed by DPIIT-recognised startups in the state ({dp:,} in {DISPLAY[code]})"
                    + (f" and Inc42 2025 funding (USD {fund} million)" if fund else "")
                    + ".",
                    True,
                ),
                "fundingAccess": index(
                    FUNDING.get(cid, 0.75 if tier == "TIER_2" else 0.9),
                    (
                        f"Estimate ordered by Inc42 2025 startup funding (USD {fund} million). "
                        if fund
                        else "Estimate: no published city funding figure. "
                    )
                    + "Reserved for the funding decision; unused by the engine.",
                    True,
                ),
                "infrastructure": index(
                    LEADS_INFRA[leads_cat] * TIER_INFRA[tier],
                    f"LEADS 2025 {DISPLAY[code]}: {leads_cat} ({LEADS_INFRA[leads_cat]}) x city tier ({TIER_INFRA[tier]}); category values are estimates. {cite(by_state(leads, code))}",
                    True,
                ),
                "regulatoryBurden": state_by_code[code]["indices"]["regulatoryBurden"],
            },
        }
    )

# Tier defaults for unlisted cities: the mean of the listed cities in that tier; TIER_3 (no
# listed city is class Z) is an estimate throughout.
NAMES = [
    "salaryIndex",
    "operatingCostIndex",
    "localMarketSize",
    "talentAvailability",
    "competitionDensity",
    "fundingAccess",
    "infrastructure",
]
tiers = {}
for tier in ("METRO", "TIER_2"):
    members = [c for c in cities if c["tier"] == tier]
    defaults = {}
    for n in NAMES:
        values = [c["indices"][n]["value"] for c in members if c["indices"][n] is not None]
        estimate = any(
            c["indices"][n]["isEstimate"] for c in members if c["indices"][n] is not None
        )
        defaults[n] = index(
            fmean(values),
            f"Mean of the {len(values)} listed {tier.replace('_', ' ').title()} cities.",
            estimate,
        )
    tiers[tier] = defaults
# Cities without a rent figure use their tier's mean operating cost (an estimate).
for c in cities:
    if c["indices"]["operatingCostIndex"] is None:
        c["indices"]["operatingCostIndex"] = dict(
            tiers[c["tier"]]["operatingCostIndex"],
            isEstimate=True,
            source=f"Estimate: no published office rent; mean of the listed {c['tier'].replace('_', ' ').title()} cities.",
        )
TIER3 = {
    "salaryIndex": (
        0.65,
        "Estimate: below the listed tier-2 mean, in line with smaller cities' lower pay.",
    ),
    "operatingCostIndex": (0.7, "Estimate: lower rents than tier-2 cities."),
    "localMarketSize": (
        0.35,
        "Estimate: a city of about half a million people on the same square-root scale.",
    ),
    "talentAvailability": (0.6, "Estimate: small local talent pool; hiring is slow."),
    "competitionDensity": (0.6, "Estimate: few local startups."),
    "fundingAccess": (0.5, "Estimate: little local investor presence."),
    "infrastructure": (0.85, "Estimate: tier factor 0.85 at an average state."),
}
tiers["TIER_3"] = {n: index(v, s, True) for n, (v, s) in TIER3.items()}

TIER_TEXT = {
    "METRO": ("Metro", "Class X city for house rent allowance (8 largest metros)."),
    "TIER_2": ("Tier 2", "Class Y city: large cities beyond the metros."),
    "TIER_3": ("Tier 3", "Class Z: any smaller city or town."),
}
data = {
    "dataVersion": DATA_VERSION,
    "country": "IN",
    "baseline": "Every index is relative to a national baseline of 1.0. See docs/locations.md for the method and sources.",
    "tiers": {
        t: {"label": TIER_TEXT[t][0], "description": TIER_TEXT[t][1], "defaults": tiers[t]}
        for t in ("METRO", "TIER_2", "TIER_3")
    },
    "states": states,
    "cities": cities,
    "method": {
        "salaryBaselineLakh": round(salary_baseline, 3),
        "populationBaseline": round(pop_baseline),
        "rentBaseline": round(rent_baseline, 2),
        "rentShareOfOverheads": RENT_SHARE,
        "creToKnightFrank": round(cre_to_kf, 4),
        "allIndiaPerCapitaNni": nni,
    },
}
(HERE / "india.json").write_text(
    json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
)
print(f"wrote india.json: {len(states)} states, {len(cities)} cities")
