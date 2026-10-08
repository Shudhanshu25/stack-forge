"""Runs every evaluation and writes its table to evaluation/results/.

    python evaluation/run_all.py                       # in-process evaluations
    python evaluation/run_all.py --api http://localhost:4000/api/v1  # + API latency, concurrency
    python evaluation/run_all.py --skip-training      # keep the current model comparison

The LLM evaluations (advisor faithfulness, agents vs rules) run only when LLM_API_KEY is set;
otherwise their result files say they were not run.
"""

import argparse

import advisor_faithfulness
import agents_vs_rules
import consistency
import location_comparison
import model_comparison  # noqa: F401  (import paths)
import performance
from ml.train import main as train


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api")
    parser.add_argument("--insecure", action="store_true")
    parser.add_argument("--skip-training", action="store_true")
    args = parser.parse_args()

    failures = 0
    print("== consistency")
    failures += consistency.main([])
    failures += location_comparison.main([])
    if not args.skip_training:
        print("== model comparison")
        failures += train([])
    print("== advisor faithfulness")
    failures += advisor_faithfulness.main([])
    print("== agents vs rules")
    failures += agents_vs_rules.main([])
    print("== performance")
    perf_args = ["--api", args.api] if args.api else []
    failures += performance.main(perf_args + (["--insecure"] if args.insecure else []))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
