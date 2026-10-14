"""G1's fixed rule on made-up views; no pack or gate access."""
import importlib.util
from fractions import Fraction
from pathlib import Path

import numpy as np
import pytest

HERE = Path(__file__).parent


def load():
    path = HERE / 'g1_mix.py'
    source = path.read_text()
    original = (HERE.parent / '007/f3_franchise.py').read_text()
    expected = original[original.index('# BEGIN COPIED B5'):].replace(
        'def predict(view):', 'def f3_predict(view):')
    assert source[source.index('# BEGIN COPIED B5'):source.rindex('\n\ndef predict(view):')] == expected
    spec = importlib.util.spec_from_file_location('g1_mix', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize('seed,own_show,own_animation,n', [
    (1, 4, 1, 240), (2, 0, 0, 240), (3, 10, 10, 240),
    (4, 5, 5, 240), (5, 2, 8, 240), (6, 8, 2, 240),
    (7, 4, 1, 99), (8, 4, 1, 100), (9, 4, 1, 101),
    (10, 4, 1, 0), (11, 4, 1, 7),
])
def test_greedy_prefix_and_f3_suffix(seed, own_show, own_animation, n):
    module = load()
    rng = np.random.default_rng(seed)
    rows = rng.permutation(np.arange(10, n + 10))
    show = np.r_[np.arange(10) < own_show, rng.integers(0, 2, n)].astype(bool)
    animation = np.r_[np.arange(10) < own_animation, rng.integers(0, 2, n)].astype(bool)
    # Missing production methods are not Animation, and Animation is not code zero.
    methods = np.where(animation, 1, np.where(np.arange(n + 10) % 2, 0, -1))
    view = {'me': {'ratings': {'title': np.arange(10)}},
            'targets': {'title': rows},
            'titles': {'media_type': show.astype(int), 'production_method': methods,
                       'production_method_names': np.array(['Live action', 'Animation'])}}
    f3_rank = rng.integers(0, 30, n).astype(float)  # ties must use view order
    score = np.full(n, 7.)
    module.f3_predict = lambda v: {'rank': f3_rank, 'score': score, 'p_low': None}
    result = module.predict(view)
    actual = np.argsort(-result['rank'], kind='stable').tolist()
    remaining = sorted(range(n), key=lambda i: (-f3_rank[i], i))
    counts = [0, 0]
    own = [Fraction(own_show, 10), Fraction(own_animation, 10)]
    fallback, closer_outside = 0, 0
    for position in range(min(100, n)):
        acceptable = []
        for i in remaining:
            bits = [int(show[rows[i]]), int(animation[rows[i]])]
            qualifies = []
            for axis in range(2):
                distance = abs(Fraction(counts[axis] + bits[axis], position + 1) - own[axis])
                opposite = abs(Fraction(counts[axis] + 1 - bits[axis], position + 1) - own[axis])
                qualifies.append(distance <= Fraction(1, 10) or (position >= 10 and distance < opposite))
            if all(qualifies):
                acceptable.append(i)
        expected = (acceptable or remaining)[0]
        assert actual[position] == expected
        if not acceptable:
            fallback += 1
        bits = [int(show[rows[expected]]), int(animation[rows[expected]])]
        for axis in range(2):
            counts[axis] += bits[axis]
            if position >= 10 and abs(Fraction(counts[axis], position + 1) - own[axis]) > Fraction(1, 10):
                closer_outside += 1
        remaining.remove(expected)
    assert actual[min(100, n):] == remaining
    assert sorted(actual) == list(range(n))
    assert result['score'] is score
    assert result['p_low'] is None
    if seed == 1:
        assert fallback > 0  # the small-prefix impossibility explicitly uses F3 fallback
    if seed == 3:
        # Ten unavoidable early mismatches must be recoverable via the closer option.
        assert closer_outside > 0


def test_no_ratings_keeps_f3():
    module = load()
    result = {'rank': np.array([2., 2., 1.]), 'score': np.ones(3), 'p_low': None}
    module.f3_predict = lambda v: result
    view = {'me': {'ratings': {'title': np.array([], dtype=int)}},
            'targets': {'title': np.arange(3)}}
    assert module.predict(view) is result
