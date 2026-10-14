"""Item 005's three frozen candidates, checked on synthetic views; no pack or gate access."""
import importlib.util
from pathlib import Path

import numpy as np
from scipy.stats import rankdata, spearmanr


HERE = Path(__file__).resolve().parent
LAB = HERE.parents[1]


def load(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def t1_view():
    """240 rated titles and 10 targets: the view is dominated by rated rows, as in T1."""
    rng = np.random.default_rng(5)
    n = 250
    quality = rng.normal(0, 1, n)
    b5 = load(LAB / 'ladder/b5_pooled.py')
    num = {name: 65 + 10 * quality + rng.normal(0, 5, n) for name in b5.FACTS}
    num['release_year'] = rng.integers(1970, 2026, n)
    num['goodwatch_overall_score_voting_count'] = rng.integers(1000, 500000, n)
    num[b5.FACTS[2]][17] = np.nan
    titles = {'num': num, 'fingerprint': rng.integers(0, 11, (n, 74), dtype=np.uint8),
              'in_pool': np.ones(n, bool), 'has_fingerprint': np.ones(n, bool),
              'media_type': rng.integers(0, 2, n), 'language': rng.integers(0, 3, n),
              'language_names': ['en', 'ja', 'fr'], 'genres': rng.random((n, 5)) < .4}
    titles['fingerprint'][12, 3] = 255
    mine = np.arange(40, dtype=np.int32)
    other = np.arange(40, 240, dtype=np.int32)
    empty = {'title': np.array([], dtype=np.int32)}
    ratings = lambda rows: {'title': rows, 'score': np.clip(np.floor(7 + quality[rows] + .5), 1, 10)}
    return {'task': 'T1', 'titles': titles,
            'me': {'ratings': ratings(mine), 'want_to_see': empty, 'skip': empty, 'not_interested': empty},
            'others': {'ratings': {**ratings(other), 'member': np.repeat(np.arange(10), 20)},
                       'want_to_see': empty, 'skip': empty, 'not_interested': empty},
            'targets': {'title': np.arange(240, n, dtype=np.int32)}}


def test_c1_agrees_with_b5_in_t1_and_ignores_unrated_rows():
    c1 = load(HERE / 'c1_rated.py')
    b5 = load(LAB / 'ladder/b5_pooled.py')
    view = t1_view()
    correlation = spearmanr(c1.predict(view)['rank'], b5.predict(view)['rank']).statistic
    print(f'C1 versus B5 synthetic T1 Spearman rho: {correlation:.9f}')
    assert correlation >= .98
    rows = c1.universe(view)
    original = c1.features(view, rows)
    # Adding unrated rows must not change rated-row imputation or standardization.
    reduced = c1.features(view, rows[:240])
    np.testing.assert_allclose(original[:240], reduced, rtol=1e-12, atol=1e-12)
    np.testing.assert_allclose(original[:240].mean(0), 0, atol=1e-12)
    assert original[17, 76] == 0  # missing public-score column filled from rated rows
    # Repeated ratings of one title do not weight that title's normalization more.
    view['others']['ratings']['title'] = np.r_[view['others']['ratings']['title'], [40] * 20]
    np.testing.assert_array_equal(original, c1.features(view, rows))


def test_c2_every_column_stays_inside_rated_percentiles():
    c1 = load(HERE / 'c1_rated.py')
    c2 = load(HERE / 'c2_clipped.py')
    view = t1_view()
    view['titles']['num'][c1.FACTS[0]][240:] = 1e6
    view['titles']['num']['release_year'][240:] = 3000
    rows = c1.universe(view)
    unclipped = c1.features(view, rows)
    low, high = np.percentile(unclipped[:240], [1, 99], axis=0)
    assert np.any(unclipped[240:] > high)
    clipped = c2.features(view, rows)
    assert np.isfinite(clipped).all()
    assert np.all(clipped >= low) and np.all(clipped <= high)
    np.testing.assert_array_equal(clipped, np.clip(unclipped, low, high))


def test_c3_is_equal_average_of_within_view_percentiles_and_c1_score():
    c1 = load(HERE / 'c1_rated.py')
    b3 = load(LAB / 'ladder/b3_taste_standardized.py')
    c3 = load(HERE / 'c3_average.py')
    view = t1_view()
    pooled, taste = c1.predict(view), b3.predict(view)
    n = len(view['targets']['title'])
    expected = ((rankdata(pooled['rank'], method='average') - .5) / n
                + (rankdata(taste['rank'], method='average') - .5) / n) / 2
    actual = c3.predict(view)
    np.testing.assert_allclose(actual['rank'], expected, rtol=0, atol=1e-15)
    np.testing.assert_array_equal(actual['score'], pooled['score'])
    assert actual['p_low'] == pooled['p_low']
    # Exercise tie handling and B3's fallback when fewer than five titles are liked.
    view['me']['ratings']['score'][:] = 2
    pooled = c1.predict(view)
    expected = ((rankdata(pooled['rank']) - .5) / n + .5) / 2
    np.testing.assert_allclose(c3.predict(view)['rank'], expected, rtol=0, atol=1e-15)
    np.testing.assert_array_equal(c3.view_percentile(np.array([2., 1., 2., 4.])), [.5, .125, .5, .875])
