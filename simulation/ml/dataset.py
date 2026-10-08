"""Synthetic training data: thousands of seeded simulations across industries, difficulties
and decision policies. Each row is (state after turn t) -> (outcome of turn t+1).

    python -m ml.dataset --sims 3000 --turns 24
"""

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from stackforge_shared.models.enums_schema import Difficulty, Industry
from stackforge_shared.templates import build_configuration

from engine import ENGINE_VERSION, create_initial_state, run_turn
from ml.features import FEATURES, TARGETS, feature_vector, target_vector
from runner.policies import POLICIES, accepted_only

DATA_DIR = Path(__file__).resolve().parent / "data"
# Weighted towards the random policy for variety; scripted policies add realistic runs.
POLICY_MIX = ["random", "random", "random", "growth", "steady"]


@dataclass
class Dataset:
    version: str
    X: np.ndarray
    y: np.ndarray
    groups: np.ndarray  # simulation index of each row, for splitting by run
    params: dict

    def save(self, directory: Path = DATA_DIR) -> Path:
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{self.version}.npz"
        np.savez_compressed(path, X=self.X, y=self.y, groups=self.groups)
        (directory / f"{self.version}.json").write_text(json.dumps(self.params, indent=2))
        return path


def dataset_version(sims: int, turns: int, seed: int) -> str:
    key = json.dumps(
        {"engine": ENGINE_VERSION, "sims": sims, "turns": turns, "seed": seed,
         "features": FEATURES, "targets": TARGETS, "policies": POLICY_MIX},
        sort_keys=True,
    )  # fmt: skip
    return f"ds-{hashlib.sha256(key.encode()).hexdigest()[:12]}"


def generate(sims: int = 3000, turns: int = 24, seed: int = 0) -> Dataset:
    industries, difficulties = list(Industry), list(Difficulty)
    X, y, groups = [], [], []
    for sim in range(sims):
        industry = industries[sim % len(industries)]
        difficulty = difficulties[(sim // len(industries)) % len(difficulties)]
        policy_name = POLICY_MIX[(sim // (len(industries) * len(difficulties))) % len(POLICY_MIX)]
        run_seed = seed * 1_000_003 + sim
        config = build_configuration(industry, difficulty)
        policy = POLICIES[policy_name]
        state = create_initial_state(config, run_seed)
        previous = None
        for turn in range(1, turns + 1):
            if state.cash < 0:
                break
            decisions = accepted_only(state, config, policy(state, config, turn, run_seed))
            state = run_turn(state, decisions, config, run_seed, turn).state_after
            if previous is not None:
                X.append(feature_vector(previous, industry))
                y.append(target_vector(state))
                groups.append(sim)
            previous = state
    params = {
        "version": dataset_version(sims, turns, seed),
        "engineVersion": ENGINE_VERSION,
        "simulations": sims,
        "turnsPerSimulation": turns,
        "seed": seed,
        "policies": POLICY_MIX,
        "features": FEATURES,
        "targets": TARGETS,
        "rows": len(X),
    }
    return Dataset(
        params["version"],
        np.asarray(X, dtype=np.float64),
        np.asarray(y, dtype=np.float64),
        np.asarray(groups, dtype=np.int64),
        params,
    )


def load_or_generate(sims: int, turns: int, seed: int, *, regenerate: bool = False) -> Dataset:
    version = dataset_version(sims, turns, seed)
    path = DATA_DIR / f"{version}.npz"
    if path.exists() and not regenerate:
        data = np.load(path)
        params = json.loads((DATA_DIR / f"{version}.json").read_text())
        return Dataset(version, data["X"], data["y"], data["groups"], params)
    dataset = generate(sims, turns, seed)
    dataset.save()
    return dataset


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sims", type=int, default=3000)
    parser.add_argument("--turns", type=int, default=24)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)
    dataset = load_or_generate(args.sims, args.turns, args.seed, regenerate=True)
    print(f"{dataset.version}: {dataset.X.shape[0]} rows from {args.sims} simulations")
    return 0


if __name__ == "__main__":
    sys.exit(main())
