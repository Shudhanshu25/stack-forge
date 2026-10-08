"""Train and compare forecasting models, save the best one per target, write the table.

    python -m ml.train                       # generates the dataset if needed
    python -m ml.train --sims 500 --quick    # small run for development

Compares linear regression (baseline), random forest and XGBoost on held-out simulation runs:
the split is by run, so turns from one simulation never appear in both train and test.
Writes evaluation/results/model-comparison.{md,csv} and saves models under ml/artifacts/.
"""

import argparse
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from xgboost import XGBRegressor

from engine import ENGINE_VERSION
from ml.dataset import Dataset, load_or_generate
from ml.features import FEATURES, TARGETS

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
RESULTS_DIR = Path(__file__).resolve().parents[2] / "evaluation" / "results"


def candidates(quick: bool) -> dict:
    trees = 60 if quick else 200
    return {
        "linear_regression": lambda: LinearRegression(),
        "random_forest": lambda: RandomForestRegressor(
            n_estimators=trees, max_depth=18, min_samples_leaf=2, n_jobs=-1, random_state=0
        ),
        "xgboost": lambda: XGBRegressor(
            n_estimators=trees * 2,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            n_jobs=-1,
            random_state=0,
        ),
    }


def metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def fmt(target: str, value: float) -> str:
    if target == "churnRate":
        return f"{value:.4f}"
    if target == "revenue":
        return f"₹{value / 100:,.0f}"
    return f"{value:,.1f}"


def write_table(results: dict, selected: dict, meta: dict, results_dir: Path = RESULTS_DIR) -> Path:
    results_dir.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Forecast model comparison",
        "",
        f"Dataset `{meta['trainingDatasetVersion']}`: {meta['rows']['train']:,} training rows and "
        f"{meta['rows']['test']:,} test rows from {meta['simulations']['train']:,} / "
        f"{meta['simulations']['test']:,} simulation runs (split by run). "
        f"Engine {meta['engineVersion']}, model version `{meta['modelVersion']}`.",
        "",
        "| Target | Model | MAE | RMSE | R² | Fit time (s) | Selected |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    csv = ["target,model,mae,rmse,r2,fit_seconds,selected"]
    for target in TARGETS:
        for model, m in results[target].items():
            chosen = "✓" if selected[target] == model else ""
            lines.append(
                f"| {target} | {model} | {fmt(target, m['mae'])} | {fmt(target, m['rmse'])} | "
                f"{m['r2']:.4f} | {m['fitSeconds']:.1f} | {chosen} |"
            )
            csv.append(
                f"{target},{model},{m['mae']:.6f},{m['rmse']:.6f},{m['r2']:.6f},"
                f"{m['fitSeconds']:.2f},{int(bool(chosen))}"
            )
    lines += [
        "",
        "Revenue errors are in rupees; churnRate is a monthly fraction. The persistence row is a",
        "reference, not a candidate: it predicts that next month equals this month.",
    ]
    md = results_dir / "model-comparison.md"
    md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    (results_dir / "model-comparison.csv").write_text("\n".join(csv) + "\n", encoding="utf-8")
    return md


def split_by_run(groups: np.ndarray, test_size: float = 0.2, seed: int = 42):
    """Train/test row indices such that each simulation run is entirely on one side."""
    split = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
    train_idx, test_idx = next(split.split(np.zeros(len(groups)), groups=groups))
    assert not set(groups[train_idx]) & set(groups[test_idx])
    return train_idx, test_idx


# Reference row: "next month equals this month" for each target (not a trained model).
PERSISTENCE_FEATURE = {"revenue": "revenue", "customers": "customers", "churnRate": "churnRate"}


def train_and_save(
    dataset: Dataset,
    *,
    quick: bool = False,
    artifacts_dir: Path = ARTIFACTS_DIR,
    results_dir: Path = RESULTS_DIR,
    log=print,
) -> dict:
    """Fits every candidate per target, keeps the lowest-RMSE one, saves it with metadata,
    and writes the comparison table. Returns the shared metadata."""
    train_idx, test_idx = split_by_run(dataset.groups)
    X_train, X_test = dataset.X[train_idx], dataset.X[test_idx]
    trained_at = datetime.now(UTC)
    model_version = f"forecast-{trained_at:%Y%m%d-%H%M%S}"
    results: dict[str, dict] = {}
    selected: dict[str, str] = {}
    fitted: dict[str, object] = {}
    for t, target in enumerate(TARGETS):
        y_test = dataset.y[test_idx, t]
        results[target] = {
            "persistence (reference)": {
                **metrics(y_test, X_test[:, FEATURES.index(PERSISTENCE_FEATURE[target])]),
                "fitSeconds": 0.0,
            }
        }
        best = None
        for name, make in candidates(quick).items():
            model = make()
            t0 = time.perf_counter()
            model.fit(X_train, dataset.y[train_idx, t])
            m = metrics(y_test, model.predict(X_test))
            m["fitSeconds"] = time.perf_counter() - t0
            results[target][name] = m
            log(f"  {target:10} {name:18} rmse {m['rmse']:>14,.4f}  r2 {m['r2']:.4f}")
            if best is None or m["rmse"] < results[target][best]["rmse"]:
                best = name
                fitted[target] = model
        selected[target] = best

    meta = {
        "modelVersion": model_version,
        "trainingDatasetVersion": dataset.version,
        "trainedAt": trained_at.isoformat(),
        "engineVersion": ENGINE_VERSION,
        "features": FEATURES,
        "targets": TARGETS,
        "rows": {"train": len(train_idx), "test": len(test_idx)},
        "simulations": {
            "train": len(set(dataset.groups[train_idx])),
            "test": len(set(dataset.groups[test_idx])),
        },
    }
    out = artifacts_dir / model_version
    out.mkdir(parents=True, exist_ok=True)
    for target in TARGETS:
        joblib.dump(fitted[target], out / f"{target}.joblib", compress=3)
        model_meta = {
            **meta,
            "target": target,
            "algorithm": selected[target],
            "metrics": results[target][selected[target]],
            "comparison": results[target],
        }
        (out / f"{target}.json").write_text(json.dumps(model_meta, indent=2))
    (artifacts_dir / "CURRENT").write_text(model_version)
    meta["table"] = str(write_table(results, selected, meta, results_dir))
    return meta


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sims", type=int, default=3000)
    parser.add_argument("--turns", type=int, default=24)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--quick", action="store_true", help="fewer trees, for development")
    parser.add_argument("--regenerate", action="store_true")
    args = parser.parse_args(argv)

    started = time.perf_counter()
    dataset = load_or_generate(args.sims, args.turns, args.seed, regenerate=args.regenerate)
    print(
        f"dataset {dataset.version}: {len(dataset.X):,} rows ({time.perf_counter() - started:.0f}s)"
    )
    meta = train_and_save(dataset, quick=args.quick)
    print(
        f"saved {meta['modelVersion']}; table at {meta['table']} "
        f"({time.perf_counter() - started:.0f}s total)"
    )
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
