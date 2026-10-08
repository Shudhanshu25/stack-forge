"""Deterministic randomness.

Every random draw comes from a generator derived from (seed, turn number, stream name), so any
single turn can be replayed on its own, and adding draws to one stream never shifts another.
Only ``Random.random()`` is used: CPython guarantees its sequence for a given integer seed across
versions, whereas helpers such as ``gauss`` may change. Distributions are built on top of it here.
"""

import hashlib
import math
import random

MAX_SEED = 2**53 - 1  # seeds round-trip through JSON and JavaScript numbers exactly


def rng_for(seed: int, turn: int, stream: str) -> random.Random:
    digest = hashlib.sha256(f"stackforge|{seed}|{turn}|{stream}".encode()).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


def standard_normal(rng: random.Random) -> float:
    """Box-Muller transform; always consumes exactly two uniforms."""
    u1 = 1.0 - rng.random()  # in (0, 1], so log is defined
    u2 = rng.random()
    return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)


def noise_factor(rng: random.Random, sigma: float) -> float:
    """Mean-one lognormal multiplier."""
    return math.exp(sigma * standard_normal(rng) - sigma * sigma / 2.0)
