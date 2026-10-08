"""Stack Forge demo: NovaTech, a SaaS startup with ₹10,00,000, played through the real API.

    Turn 1: price ₹499, marketing ₹50,000, five employees
    Turn 2: price ₹799
    Turn 3: scenario comparison from here, ₹799 vs ₹699 (an estimate; no turn is played)

The script prints whatever the engine produces; nothing is tuned for the demo. The same seed
gives the same numbers every time.

Run against the running stack (development or production), with the simulation venv:
    simulation/.venv/Scripts/python demo/novatech.py                       # http://localhost:4000/api/v1
    simulation/.venv/Scripts/python demo/novatech.py --api https://localhost/api/v1 --insecure

Sign-in: with DEMO_EMAIL and DEMO_PASSWORD set, the demo logs into (or creates) that account so
you can open the result in the browser; otherwise it uses a fresh account with a random password.
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "evaluation"))
sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]

from api_client import ApiError, StackForgeApi  # noqa: E402

NOVATECH = {
    "name": "NovaTech",
    "industry": "SAAS",
    "businessModel": "SUBSCRIPTION",
    "initialCapital": 100_000_000,  # ₹10,00,000 in paise
    "product": {"name": "Nova CRM", "description": "CRM for small businesses"},
    "initialPrice": 49_900,
    "marketSize": 200_000,
    "difficulty": "NORMAL",
    "location": {
        "country": "IN",
        "state": "KA",
        "city": "Bengaluru",
        "cityId": "bengaluru",
        "tier": "METRO",
    },
}
TURNS = [
    (
        "Turn 1: price ₹499, marketing ₹50,000, five employees",
        [
            {"type": "PRICING", "value": 49_900},
            {"type": "MARKETING", "value": 5_000_000},
            {"type": "HIRING", "value": 5},
        ],
    ),
    ("Turn 2: price ₹799", [{"type": "PRICING", "value": 79_900}]),
]


def inr(paise: int) -> str:
    """Indian grouping: ₹10,00,000."""
    sign, rupees = ("-" if paise < 0 else ""), abs(paise) // 100
    digits = str(rupees)
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        digits = ",".join([head, *groups]) + "," + tail if head else ",".join(groups) + "," + tail
    return f"{sign}₹{digits}"


def pct(rate: float) -> str:
    return f"{100 * rate:.2f}%"


def show_turn(record: dict) -> None:
    s, e = record["stateAfter"], record["stateAfter"]["expenses"]
    print(f"  Revenue        {inr(s['revenue']):>14}")
    print(
        f"  Expenses       {inr(e['total']):>14}   (employees {inr(e['employees'])}, "
        f"marketing {inr(e['marketing'])}, fixed {inr(e['fixed'])}, variable {inr(e['variable'])}"
        f", product {inr(e['product'])})"
    )
    print(f"  Profit         {inr(s['profit']):>14}")
    print(f"  Cash           {inr(s['cash']):>14}")
    print(
        f"  Customers      {s['customers']:>14,}   (+{s['newCustomers']} new, "
        f"-{s['churnedCustomers']} churned)"
    )
    print(f"  Market share   {pct(s['marketShare']):>14}   employees {s['employees']}")
    for event in record["events"]:
        print(f"  Event: {event.get('title', event['type'])}")
    for action in record["competitorActions"]:
        print(f"  Competitor {action['competitorId']}: {action['action']} ({action['reason']})")
    agents = record["agentEffects"]
    print(
        f"  Agents ({agents['mode']}): customer {agents['customer']['source']}, "
        f"competitor {agents['competitor']['source']}"
    )
    forecast = record.get("forecast") or {}
    if forecast.get("available"):
        print(
            f"  Forecast for turn {forecast['targetTurn']}: revenue {inr(forecast['revenue'])}, "
            f"{forecast['customers']:,} customers ({forecast['modelVersion']})"
        )
    else:
        print(f"  Forecast: unavailable ({forecast.get('unavailableReason', 'not produced')})")
    advice = record.get("advice") or {}
    if advice.get("available"):
        print(f"  AI CEO: {advice['summary']}")
    else:
        print(f"  AI CEO: unavailable ({advice.get('unavailableReason', 'not produced')})")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--api", default="http://localhost:4000/api/v1", help="API base URL")
    parser.add_argument("--insecure", action="store_true", help="accept a local CA certificate")
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--agents", action="store_true", help="use LLM agents (needs a key)")
    parser.add_argument("--app", default="http://localhost:5173", help="frontend URL to print")
    args = parser.parse_args()

    api = StackForgeApi(args.api, verify=not args.insecure)
    try:
        email, password = os.environ.get("DEMO_EMAIL"), os.environ.get("DEMO_PASSWORD")
        if email and password:
            api.sign_in(email, password, "NovaTech Founder")
            print(f"Signed in as {email}")
        else:
            api.throwaway_user("novatech-demo")
            print("Signed in with a fresh demo account (set DEMO_EMAIL/DEMO_PASSWORD to reuse one)")

        startup = api.request("POST", "/startups", NOVATECH)
        sim = api.request(
            "POST",
            f"/startups/{startup['id']}/simulation",
            {"seed": args.seed, "agentMode": "llm" if args.agents else "rules"},
        )
        sid = sim["id"]
        print(
            f"\nNovaTech (SaaS) starts with {inr(NOVATECH['initialCapital'])}, price "
            f"{inr(NOVATECH['initialPrice'])}, seed {args.seed}, agents: {sim['agentMode']}"
        )

        for title, decisions in TURNS:
            print(f"\n{title}")
            preview = api.request("POST", f"/simulations/{sid}/preview", {"decisions": decisions})
            for result in preview["decisionResults"]:
                effects = ", ".join(
                    f"{e['metric']} {e['direction'].lower()} ({e['magnitude'].lower()})"
                    for e in result["effects"]
                    if e["direction"] != "FLAT"
                )
                print(
                    f"  Preview {result['decision']['type']} {result['status'].lower()}: "
                    f"{effects or 'no change'}"
                )
            job = api.play_turn(sid, decisions)
            if job["status"] != "COMPLETED":
                print(f"  Turn failed: {job.get('error')}")
                return 1
            turns = api.request("GET", f"/simulations/{sid}/turns")["turns"]
            show_turn(turns[-1])

        print("\nTurn 3: scenario comparison from the state after turn 2 (₹799 vs ₹699, 3 months)")
        comparison = api.request(
            "POST",
            f"/simulations/{sid}/scenarios",
            {
                "horizon": 3,
                "baseline": {"label": "Keep ₹799", "decisions": []},
                "alternative": {
                    "label": "Price ₹699",
                    "decisions": [{"type": "PRICING", "value": 69_900}],
                },
            },
        )
        for branch in comparison["branches"]:
            print(f"  {branch['label']}:")
            for t in branch["turns"]:
                print(
                    f"    turn {t['turn']}: revenue {inr(t['revenue']):>12}  profit "
                    f"{inr(t['profit']):>12}  customers {t['customers']:>6,}  cash {inr(t['cash'])}"
                )
            for r in branch["rejections"]:
                print(f"    rejected: {r}")
        print("  Differences (₹699 minus ₹799):")
        for d in comparison["differences"]:
            value = d["difference"]
            shown = (
                inr(value) if isinstance(value, int) and d["metric"] != "endCustomers" else value
            )
            print(f"    {d['metric']}: {shown}")
        print(f"  ({comparison['label']}; rule-based agents; no turn was played)")
        print(f"\nOpen it: {args.app.rstrip('/')}/simulations/{sid}")
        return 0
    except ApiError as exc:
        print(f"API error: {exc}")
        return 1
    finally:
        api.close()


if __name__ == "__main__":
    raise SystemExit(main())
