"""ML model comparison on held-out runs.

Generates (or reuses) the seeded simulation dataset, splits it by run so no simulation appears
on both sides, trains Linear Regression, Random Forest and XGBoost for each target, and writes
evaluation/results/model-comparison.md and .csv with RMSE, MAE and R² on the held-out runs and
a persistence reference row. The lowest-RMSE model per target becomes the served model.

    python evaluation/model_comparison.py [--sims 3000] [--turns 24] [--quick]

This is ml.train with the same arguments; see docs/ml.md.
"""

import sys

import common  # noqa: F401  (import paths)

from ml.train import main

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
