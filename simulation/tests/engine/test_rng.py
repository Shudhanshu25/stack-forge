import statistics

from engine.rng import noise_factor, rng_for, standard_normal


def test_same_seed_turn_and_stream_give_the_same_sequence() -> None:
    a, b = rng_for(7, 3, "demand"), rng_for(7, 3, "demand")
    assert [a.random() for _ in range(5)] == [b.random() for _ in range(5)]


def test_turn_seed_and_stream_each_change_the_sequence() -> None:
    base = rng_for(7, 3, "demand").random()
    assert rng_for(7, 4, "demand").random() != base
    assert rng_for(8, 3, "demand").random() != base
    assert rng_for(7, 3, "events").random() != base


def test_seed_derivation_is_pinned() -> None:
    # Changing the derivation would silently break replay of every stored simulation.
    assert rng_for(42, 1, "demand").random() == 0.5081413945873399


def test_normal_and_noise_have_the_expected_moments() -> None:
    rng = rng_for(1, 1, "test")
    normals = [standard_normal(rng) for _ in range(20_000)]
    assert abs(statistics.mean(normals)) < 0.03
    assert abs(statistics.stdev(normals) - 1) < 0.03
    factors = [noise_factor(rng, 0.12) for _ in range(20_000)]
    assert abs(statistics.mean(factors) - 1) < 0.01
    assert min(factors) > 0
