# ML forecasting

`simulation/ml` predicts next-turn **revenue**, **customers** and **churn rate** from the state after a turn. Forecasts are shown to the user and passed to the AI CEO. They never feed back into simulation state: the forecast stage runs after the simulation core, and the forecast is attached to the turn record as a separate field.

## One command

```bash
cd simulation && .venv/Scripts/python -m ml.train
```

This command:

1. generates the dataset, if it doesn't already exist;
2. trains and compares the three models;
3. saves the best model per target;
4. writes `evaluation/results/model-comparison.md` and `.csv`.

It takes about 40 seconds. Add `--sims 500 --quick` for a fast development run.

## Dataset (`ml/dataset.py`)

- **Runs.** There are 3,000 seeded simulations of up to 24 turns. They cycle through all 8 industries and 3 difficulties, and through the decision policies in `runner/policies.py` (random ×3, growth, steady). Runs that go bankrupt end early, which yields about 48,000 rows.
- **Rows.** Each row pairs the state after turn *t* with the outcome of turn *t+1*.
- **Features** (the spec's list):
  - `price`, `marketingBudget`, `employees`, `customers`;
  - `churnRate`: churned ÷ customers at the start of the turn;
  - `competitorPressure` (competition), `customerSatisfaction` (sentiment), `productQuality`;
  - `revenue`, `profit`.

  Eight industry indicator columns are added, because industries differ by orders of magnitude.
- **Version.** The dataset version is a hash of the engine version, generation parameters, features and policies (for example `ds-b8c87480e064`). The data is cached in `ml/data/` (git-ignored).

## Training and selection (`ml/train.py`)

- **Split.** The split is by simulation run (`GroupShuffleSplit`, 80/20), so turns from one run never appear on both sides. A test checks this.
- **Candidates.** Linear regression (the baseline), random forest (200 trees, depth 18) and XGBoost (400 rounds, depth 6).
- **Metrics.** Each candidate gets MAE, RMSE and R² on the held-out runs.
- **Selection.** The candidate with the lowest RMSE is selected per target.
- **Persistence reference.** A reference row is also reported: "next month equals this month". It shows how much of a high R² is just month-to-month persistence. It is never selected.
- **Saved files.** Selected models go to `ml/artifacts/<modelVersion>/<target>.joblib`, each with a `<target>.json` metadata file. The metadata holds `modelVersion`, `trainingDatasetVersion`, `trainedAt`, `metrics`, `features`, the algorithm and the full comparison. `ml/artifacts/CURRENT` names the version in use. Artifacts are git-ignored; a fresh clone needs one `ml.train` run.

### Results (engine 1.0.0, dataset `ds-b8c87480e064`)

| Target | Persistence | Linear regression | Random forest | XGBoost | Selected |
| --- | --- | --- | --- | --- | --- |
| Revenue RMSE (₹) | 9,85,346 | 5,88,542 | **5,25,715** | 7,98,497 | random forest |
| Customers RMSE | 5,230.7 | 2,858.0 | **2,504.2** | 3,795.5 | random forest |
| Churn rate RMSE | 0.0489 | 0.0836 | 0.0179 | **0.0175** | XGBoost |

- **Revenue and customers.** Both are dominated by persistence (R² 0.97). The trees roughly halve persistence's error.
- **Churn.** Churn depends non-linearly on price ratios, satisfaction and service load. Linear regression does worse than persistence here, while the tree models reach R² 0.96.

`evaluation/results/model-comparison.md` has the full table, including MAE and R².

## Inference (`ml/forecast.py`)

The pipeline's forecast stage calls `forecast(stateAfter, industry)`, which loads the current artifacts once and caches them.

- **Missing or broken model.** If the artifacts are missing, have different features, or fail to load or predict, the result is `{ available: false, unavailableReason }`. The turn still completes.
- **Clamping.** Predictions are clamped to valid ranges: non-negative counts, churn in [0, 1].
- **Logging.** Each forecast is logged with `modelVersion` and its latency.
- **Threads.** Models train with all cores (`n_jobs=-1`) but are switched to one thread when loaded: a forecast is a single row, and starting a thread pool per prediction cost more than it saved (about 76 ms → 22 ms per forecast; see `evaluation/results/performance.md`).
- **In production** the simulation image trains the model during `docker build`, so a container always has one.
