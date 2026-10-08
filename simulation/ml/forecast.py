"""Forecast inference. A missing or broken model yields an unavailable forecast, never an error."""

import json
import logging
import time
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
from stackforge_shared.models.enums_schema import Industry
from stackforge_shared.models.forecast_schema import Forecast

from engine.models import SimulationState
from ml.features import FEATURES, TARGETS, feature_vector

logger = logging.getLogger("ml.forecast")
DEFAULT_ARTIFACTS = Path(__file__).resolve().parent / "artifacts"


class ForecastModel:
    def __init__(self, models: dict, meta: dict) -> None:
        self.models = models
        self.meta = meta

    @property
    def version(self) -> str:
        return self.meta["modelVersion"]

    @classmethod
    def load(cls, artifacts: Path) -> "ForecastModel":
        version = (artifacts / "CURRENT").read_text().strip()
        directory = artifacts / version
        metas = {t: json.loads((directory / f"{t}.json").read_text()) for t in TARGETS}
        for meta in metas.values():
            if meta["features"] != FEATURES:
                raise ValueError("model was trained on different features")
        models = {t: joblib.load(directory / f"{t}.joblib") for t in TARGETS}
        for model in models.values():
            # Trained with all cores; one row per prediction is faster on one thread.
            if "n_jobs" in model.get_params():
                model.set_params(n_jobs=1)
        return cls(models, metas[TARGETS[0]])

    def predict(self, state: SimulationState, industry: Industry, target_turn: int) -> Forecast:
        x = np.asarray([feature_vector(state, industry)])
        revenue, customers, churn = (float(self.models[t].predict(x)[0]) for t in TARGETS)
        return Forecast(
            available=True,
            target_turn=target_turn,
            model_version=self.version,
            training_dataset_version=self.meta["trainingDatasetVersion"],
            revenue=max(0, round(revenue)),
            customers=max(0, round(customers)),
            churn_rate=round(min(1.0, max(0.0, churn)), 6),
        )


@lru_cache(maxsize=4)
def _load_cached(artifacts: str) -> ForecastModel:
    return ForecastModel.load(Path(artifacts))


def forecast(
    state: SimulationState, industry: Industry, artifacts: Path = DEFAULT_ARTIFACTS
) -> Forecast:
    """Next-turn forecast for a state, or an unavailable forecast explaining why."""
    target_turn = state.turn + 1
    started = time.perf_counter()
    try:
        model = _load_cached(str(artifacts))
    except FileNotFoundError:
        return _unavailable(target_turn, "No trained forecasting model; run python -m ml.train")
    except Exception:
        logger.exception("forecast model failed to load")
        return _unavailable(target_turn, "The forecasting model could not be loaded")
    try:
        result = model.predict(state, industry, target_turn)
    except Exception:
        logger.exception("forecast prediction failed")
        return _unavailable(target_turn, "The forecasting model failed")
    logger.info(
        "forecast made",
        extra={
            "fields": {
                "modelVersion": model.version,
                "latencyMs": round((time.perf_counter() - started) * 1000, 2),
            }
        },
    )
    return result


def _unavailable(target_turn: int, reason: str) -> Forecast:
    return Forecast(available=False, target_turn=target_turn, unavailable_reason=reason)
