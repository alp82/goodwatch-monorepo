"""The ladder against its sources: B2 by hand and against formula.server.ts itself, B3's standardization, B4 and B5
against the first loop's pool.py, and the rule that the paired files share their code."""
import importlib.util
import json
import os
import shutil
import subprocess
import sys

import numpy as np
import pytest

LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.abspath(os.path.join(LAB, '..', '..', '..', '..'))
K = 74


def load(name):
    spec = importlib.util.spec_from_file_location(f'rung_{name}', os.path.join(LAB, 'ladder', f'{name}.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def fingerprint(*head):
    fp = np.zeros(K, np.uint8)
    fp[:len(head)] = head
    return fp


def make_view(fps, has, ratings, want, targets, in_pool=None):
    n = len(fps)
    return {'titles': {'fingerprint': np.array(fps, np.uint8), 'has_fingerprint': np.array(has, bool),
                       'in_pool': np.ones(n, bool) if in_pool is None else np.array(in_pool, bool)},
            'me': {'ratings': {'title': np.array([r[0] for r in ratings], np.int32),
                               'score': np.array([r[1] for r in ratings], np.int8)},
                   'want_to_see': {'title': np.array(want, np.int32)}},
            'targets': {'title': np.array(targets, np.int32)}}


def test_b2_hand_checked():
    """Worked by hand from formula.server.ts. Unit fingerprints: A, E (3,4) -> (0.6, 0.8); B, W (4,3) -> (0.8, 0.6);
    C, G (0,5) -> (0, 1); D, F (5,0) -> (1, 0).
    Liked (weight score - 5): A 10 -> 5, B 8 -> 3, C 6 -> 1, D 7 -> 2, E 9 -> 4. Want to See W -> 0.5.
      P = (5(0.6,0.8) + 3(0.8,0.6) + 1(0,1) + 2(1,0) + 4(0.6,0.8) + 0.5(0.8,0.6)) / 15.5 = (10.2, 10.3) / 15.5
    Disliked (weight 6 - score): F 2 -> 4, G 5 -> 1.
      N = (4(1,0) + 1(0,1)) / 5 = (0.8, 0.2)
    Taste = 2P - N = (20.4/15.5 - 0.8, 20.6/15.5 - 0.2) = (8, 17.5) / 15.5, direction (16, 35), length sqrt(1481).
    Cosine with X (3,4): (0.6 * 16 + 0.8 * 35) / sqrt(1481) = 37.6 / sqrt(1481). With Y (5,0): 16 / sqrt(1481).
    Not counted: H is rated 10 but has no fingerprint; A is also in Want to See but is rated; V is in Want to See
    without a fingerprint. A missing score (255) counts as 0: X2 is (3, 4, 255, 0, ...)."""
    b2 = load('b2_taste_today')
    A, B, C, D, E, F, G, W, H, V, X, Y, Z, X2 = range(14)
    fps = [fingerprint(3, 4), fingerprint(4, 3), fingerprint(0, 5), fingerprint(5, 0), fingerprint(3, 4),
           fingerprint(5, 0), fingerprint(0, 5), fingerprint(4, 3), np.full(K, 255), np.full(K, 255),
           fingerprint(3, 4), fingerprint(5, 0), np.full(K, 255), fingerprint(3, 4, 255)]
    has = [True] * 8 + [False, False, True, True, False, True]
    ratings = [(A, 10), (B, 8), (C, 6), (D, 7), (E, 9), (F, 2), (G, 5), (H, 10)]
    view = make_view(fps, has, ratings, [W, A, V], [X, Y, Z, X2])
    root = np.sqrt(1481.0)
    taste = b2.taste_vector(view)
    assert taste.dtype == np.float32
    assert np.allclose(taste[:2], [16 / root, 35 / root], atol=1e-7) and not taste[2:].any()
    out = b2.predict(view)
    assert out['score'] is None and out['p_low'] is None
    x, y = 37.6 / root, 16 / root
    assert np.allclose(out['rank'], [x, y, x, x], atol=1e-6)   # Z, no fingerprint: the median of x, y, x

    # four liked titles with a fingerprint are not enough, whatever else there is
    few = make_view(fps, has, [(A, 10), (B, 8), (C, 6), (D, 7), (F, 2), (H, 10)], [W], [X, Y])
    assert b2.taste_vector(few) is None
    assert b2.predict(few)['rank'].tolist() == [0.0, 0.0]

    # without dislikes the taste is P
    only = make_view(fps, has, ratings[:5], [], [X])
    p = np.array([5 * .6 + 3 * .8 + 0 + 2 + 4 * .6, 5 * .8 + 3 * .6 + 1 + 0 + 4 * .8])
    assert np.allclose(b2.taste_vector(only)[:2], p / np.sqrt((p * p).sum()), atol=1e-7)


@pytest.mark.skipif(not shutil.which('bun'), reason='bun is not installed')
def test_b2_matches_formula_server_ts(tmp_path):
    """Random members through the product's own TypeScript and through the port: the same vectors and cosines."""
    webapp = os.path.join(REPO, 'goodwatch-webapp')
    if not os.path.exists(os.path.join(webapp, 'app/server/taste/formula.server.ts')):
        pytest.skip('the webapp is not beside the lab')
    b2 = load('b2_taste_today')
    rng = np.random.default_rng(11)
    n = 120
    fps = rng.integers(0, 11, size=(n, K)).astype(np.uint8)
    fps[rng.random((n, K)) < 0.03] = 255
    has = rng.random(n) > 0.1
    members = []
    for i in range(12):
        k = int(rng.integers(3, 60))
        rated = rng.choice(n, k, replace=False)
        scores = rng.integers(1, 11, k)
        if i == 0:
            scores[:] = rng.integers(1, 6, k)                           # nothing liked
        if i == 1:
            scores[:] = rng.integers(6, 11, k)                          # nothing disliked
        want = rng.choice(n, int(rng.integers(0, 15)), replace=False)
        members.append((rated, scores, want))
    case = {'fingerprints': fps.tolist(), 'hasFingerprint': has.tolist(),
            'members': [{'ratings': [{'key': int(t), 'score': int(s), 'at': 1} for t, s in zip(r, sc)],
                         'wantToSee': [{'key': int(t), 'at': 1} for t in w]} for r, sc, w in members]}
    path = tmp_path / 'case.json'
    path.write_text(json.dumps(case))
    done = subprocess.run(['bun', os.path.join(os.path.dirname(__file__), 'formula_check.ts'), webapp, str(path)],
                          capture_output=True, text=True)
    assert done.returncode == 0, done.stderr
    theirs = json.loads(done.stdout.strip().splitlines()[-1])
    with_taste = 0
    for (rated, scores, want), t in zip(members, theirs):
        view = make_view(fps, has, list(zip(rated, scores)), want, np.arange(n))
        taste = b2.taste_vector(view)
        if t['vector'] is None:
            assert taste is None
            continue
        with_taste += 1
        assert np.array_equal(taste, np.array(t['vector'], np.float32))        # bit for bit, in single precision
        cosine, usable = b2.cosines(view, np.arange(n), taste)
        # the product's pool keeps every title with a non-zero fingerprint, in order (missing scores count as 0)
        raw = np.where(fps == 255, 0, fps)
        in_pool = (raw.astype(float) ** 2).sum(1) > 0
        theirs_cosine = np.zeros(n, np.float32)
        theirs_cosine[in_pool] = np.array(t['cosines'], np.float32)
        assert np.array_equal(usable, in_pool & has)
        assert np.array_equal(cosine[usable], theirs_cosine[usable])           # bit for bit as well
    assert with_taste >= 8


def test_b3_standardizes_against_the_reference_pool():
    b3 = load('b3_taste_standardized')
    rng = np.random.default_rng(2)
    n = 200
    fps = rng.integers(0, 11, size=(n, K)).astype(np.uint8)
    in_pool = rng.random(n) < 0.7
    has = np.ones(n, bool)
    has[:5] = False
    fps[5, 3] = 255
    view = make_view(fps, has, [(i, 8) for i in range(10, 20)] + [(20, 2)], [], np.arange(30, 60), in_pool)
    v, squares, usable = b3.vectors(view, np.arange(n))
    pool = fps[in_pool & has].astype(float)
    pool[pool == 255] = np.nan
    z = (fps.astype(float) - np.nanmean(pool, 0)) / np.nanstd(pool, 0)
    z[fps == 255] = 0                                                   # a missing score is the pool mean
    assert np.allclose(v, z) and not usable[:5].any() and usable[5:].all()
    # then the same formula as B2: check the taste by the definition
    unit = z / np.sqrt((z * z).sum(1))[:, None]
    p = unit[10:20].sum(0) * 3 / 30
    taste = 2 * p - unit[20]
    taste /= np.sqrt((taste * taste).sum())
    assert np.allclose(b3.taste_vector(view), taste, atol=1e-6)
    assert np.allclose(b3.predict(view)['rank'], unit[30:60] @ taste, atol=1e-5)


def test_paired_rungs_share_their_code():
    marker = '# ---- the lines below are the same'
    for a, b in (('b2_taste_today', 'b3_taste_standardized'), ('b4_consensus', 'b5_pooled')):
        ta, tb = (open(os.path.join(LAB, 'ladder', f'{x}.py')).read() for x in (a, b))
        assert marker in ta and ta[ta.index(marker):].split('\n', 1)[1] == tb[tb.index(marker):].split('\n', 1)[1]
    assert load('b2_taste_today').STANDARDIZE is False and load('b3_taste_standardized').STANDARDIZE is True
    assert load('b4_consensus').OWN == 0.0 and load('b5_pooled').OWN == 300.0


class OldData:
    """The first loop's data object, built from a view: just what pool.py and gbm_facts.py read."""

    def __init__(self, view, rows, b4):
        titles = view['titles']
        self.n = len(rows)
        pool = titles['fingerprint'][titles['in_pool'] & titles['has_fingerprint']].astype(float)
        fp = titles['fingerprint'][rows].astype(float)
        fp[~titles['has_fingerprint'][rows]] = np.nan
        self.Z = (fp - pool.mean(0)) / pool.std(0)
        self.fp_keys = titles['fingerprint_keys']
        num = titles['num']
        self.info = []
        for i in rows.tolist():
            x = {c: (None if np.isnan(num[c][i]) else float(num[c][i])) for c in b4.FACTS[:6]}
            x['release_year'] = None if num['release_year'][i] < 0 else int(num['release_year'][i])
            votes = int(num['goodwatch_overall_score_voting_count'][i])
            x['goodwatch_overall_score_voting_count'] = None if votes < 0 else votes
            x['media_type'] = 'show' if titles['media_type'][i] == 1 else 'movie'
            code = titles['language'][i]
            x['original_language_code'] = None if code < 0 else titles['language_names'][code]
            x['genres'] = [g for g, on in zip(titles['genre_names'], titles['genres'][i]) if on] or None
            self.info.append(x)
        at = (lambda t: np.searchsorted(rows, t))
        o = view['others']['ratings']
        self._others = (o['member'], at(o['title']), o['score'].astype(float))
        self._by = {}
        for u, t in zip(o['member'].tolist(), at(o['title']).tolist()):
            self._by.setdefault(u, []).append((u, t))

    def others(self, user):
        return self._others


@pytest.mark.parametrize('rung, own', [('b4_consensus', 0.0), ('b5_pooled', 300.0)])
def test_b4_b5_match_the_first_loop_s_pool_py(pack, tmp_path, rung, own):
    """The original pool.pooled_predict (k=0, the base columns, personal weights off or on) and the port, on the
    same views of the made-up pack: the same predictions."""
    import views
    old_lab = os.path.join(REPO, 'docs', 'research', 'taste-prediction', 'lab')
    if not os.path.exists(os.path.join(old_lab, 'agents', 'pooled', 'pool.py')):
        pytest.skip('the first loop\'s lab is not in this checkout')
    added = [os.path.join(old_lab, 'agents', 'pooled'), os.path.join(old_lab, 'baselines')]
    sys.path[:0] = added
    try:
        import gbm_facts
        import pool
    finally:
        for p in added:
            sys.path.remove(p)
    port = load(rung)
    out = str(tmp_path / 'run')
    counts = np.bincount(pack.ratings['member'], minlength=len(pack.members['tier']))
    some = [int(u) for u in np.flatnonzero((counts >= 7) & (pack.members['tier'] == 0))[:4]] + [pack.owner]
    index, keys, _ = views.build_t1(pack, out, members=some)
    views.export_titles(pack, os.path.join(out, 'titles.npz'))
    titles = views.load_titles(os.path.join(out, 'titles.npz'))
    checked = 0
    for v in [v for v in index if v['kind'] == 'main']:
        view = views.load_view(os.path.join(out, 'views', v['vid']), titles)
        rows = port.universe(view)
        pool._C.clear()
        gbm_facts._X = None
        D = OldData(view, rows, port)
        at = (lambda t: np.searchsorted(rows, t))
        mine = view['me']['ratings']
        theirs = pool.pooled_predict(D, 'me', at(mine['title']), mine['score'].astype(float),
                                     at(view['targets']['title']), own=own, k=0, kind='base')
        ours = port.predict(view)
        assert np.allclose(ours['score'], theirs, atol=1e-8, rtol=0), v
        assert np.allclose(np.clip(ours['rank'], 1, 10), ours['score'])
        checked += len(theirs)
    assert checked > 150


def test_b0_b1_bp_by_hand():
    b0, b1, bp = load('b0_median'), load('b1_public'), load('bp_votes')
    gw = np.array([80.0, 60.0, 70.0, np.nan, 90.0, 50.0])
    votes = np.array([1000, 10, -1, 500, 100000, 1])
    view = {'titles': {'num': {'goodwatch_overall_score_normalized_percent': gw,
                               'goodwatch_overall_score_voting_count': votes}},
            'me': {'ratings': {'title': np.array([0, 1]), 'score': np.array([9, 4])}},
            'others': {'ratings': {'title': np.array([0, 1, 2, 3]), 'score': np.array([6, 6, 9, 1])}},
            'targets': {'title': np.array([2, 3, 4, 5])}}
    out = b0.predict(view)
    assert out['score'].tolist() == [6.5] * 4 and out['p_low'].tolist() == [0.5] * 4 and not out['rank'].any()
    # population offset: mean of (6-8, 6-6, 9-7) = 0 (the title without a score is left out)
    # member offset: ((9-8) + (4-6) + 3 * 0) / (2 + 3) = -0.2
    out = b1.predict(view)
    assert np.allclose(out['score'], [6.8, 6.5, 8.8, 4.8]) and out['p_low'] is None      # no score: the median
    out = bp.predict(view)
    assert out['score'] is None and np.allclose(out['rank'], [-1, np.log10(500), 5, 0])
