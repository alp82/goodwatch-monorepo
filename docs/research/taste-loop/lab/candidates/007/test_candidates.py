"""Synthetic rule checks; never open the pack or gate."""
import importlib.util
from pathlib import Path

import numpy as np


HERE = Path(__file__).parent
LADDER = HERE.parent.parent / 'ladder'


def load(name):
    path = HERE / f'{name}.py'
    source = path.read_text()
    # The only permitted edits to the copied rungs are entry point names.
    for rung, filename in [('B3', 'b3_taste_standardized'), ('B5', 'b5_pooled')]:
        copied = source.split(f'# BEGIN COPIED {rung}\n')[1].split(f'\n# END COPIED {rung}')[0]
        expected = (LADDER / f'{filename}.py').read_text().replace(
            'def predict(view):', f'def {rung.lower()}_predict(view):')
        assert copied == expected
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check(module, b3, b5, threshold, series=None, diversify=False):
    n = len(b3)
    # Nontrivial target order verifies that series IDs are looked up by title row.
    rows = np.arange(n)[::-1]
    view = {'targets': {'title': rows}, 'titles': {'num': {}}}
    if series is not None:
        view['titles']['num']['movie_series_id'] = np.asarray(series)[::-1]
    score = np.clip(b5, 1, 10)
    module.b3_predict = lambda v: {'rank': b3, 'score': None, 'p_low': None}
    module.b5_predict = lambda v: {'rank': b5, 'score': score, 'p_low': None}
    # Independent definition: pairwise comparisons, no sort/search percentile code.
    pct = np.array([(np.count_nonzero(b5 < x) + 0.5 * np.count_nonzero(b5 == x)) / n for x in b5])
    np.testing.assert_array_equal(module.view_percentile(b5), pct)
    front = sorted([i for i in range(n) if pct[i] >= threshold], key=lambda i: (-b3[i], i))
    back = sorted([i for i in range(n) if pct[i] < threshold], key=lambda i: (-b3[i], i))
    keys = [('series', series[i]) if series is not None and series[i] > 0 else ('title', rows[i])
            for i in range(n)]
    if diversify:
        seen, first, repeat = set(), [], []
        for i in front:
            (repeat if keys[i] in seen else first).append(i)
            seen.add(keys[i])
        front = first + repeat
    result = module.predict(view)
    actual = np.argsort(-result['rank'], kind='stable').tolist()
    assert actual == front + back
    assert result['score'] is score
    assert result['p_low'] is None
    if diversify:
        # Every represented series appears before any series repeats.
        remaining = {keys[i] for i in front}
        seen = set()
        for i in actual[:len(front)]:
            if keys[i] in seen:
                assert not remaining
            seen.add(keys[i])
            remaining.discard(keys[i])
    return result


def exercise(name, threshold, diversify=False):
    module = load(name)
    b3 = np.array([1., .9, .9, .8, .7, .6, .5, .4, .3, 0.])
    b5 = np.array([0., 9., 8., 8., 6., 5., 4., 3., 2., 1.])
    check(module, b3, b5, threshold, [5, 5, 5, 5, 6, 6, -1, 0, -1, 7], diversify)
    # All-tied B5 has percentile exactly .5: admitted by F1/F3, rejected by F2.
    result = check(module, b3, np.ones(10), threshold, diversify=diversify)
    np.testing.assert_allclose(result['rank'] - b3, np.full(10, (4 if diversify else 2) if threshold == .5 else 0), rtol=0, atol=1e-15)
    # A tie with midpoint exactly .8 checks inclusive F2 threshold.
    check(module, b3[:5], np.array([0., 1., 2., 3., 3.]), threshold, [1, 1, 2, 2, 3], diversify)
    rng = np.random.default_rng(7)
    for _ in range(100):
        n = int(rng.integers(1, 40))
        check(module, rng.integers(0, 6, n) / 5, rng.integers(-3, 15, n).astype(float),
              threshold, rng.integers(-1, 8, n), diversify)


def test_f1_median():
    exercise('f1_median', .5)


def test_f2_eighty():
    exercise('f2_eighty', .8)


def test_f3_franchise():
    exercise('f3_franchise', .5, diversify=True)
