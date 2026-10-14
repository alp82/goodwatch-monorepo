import numpy as np
import pytest

import score
import stats


def test_paired_difference_and_smallest_detectable_effect():
    rng = np.random.default_rng(0)
    ref = rng.normal(1.4, 0.3, 80)
    cand = ref - 0.2 + rng.normal(0, 0.4, 80)
    p = stats.paired(cand, ref, 10000, 1)
    d = cand - ref
    assert p['diff'] == pytest.approx(d.mean(), abs=1e-6)
    assert p['median'] == pytest.approx(np.median(d), abs=1e-6)
    assert p['improved'] == int((d < 0).sum()) and p['n'] == 80
    assert p['sde'] == pytest.approx(2.801585 * d.std(ddof=1) / np.sqrt(80), abs=1e-5)
    se = d.std(ddof=1) / np.sqrt(80)
    assert p['lo'] == pytest.approx(d.mean() - 1.96 * se, abs=0.02)
    assert p['hi'] == pytest.approx(d.mean() + 1.96 * se, abs=0.02)
    assert stats.paired(cand, ref, 10000, 1) == p                     # the same seed, the same interval
    assert stats.paired(cand, ref, 10000, 2)['lo'] != p['lo']


def test_missing_members_are_left_out_of_a_pair():
    p = stats.paired([1.0, np.nan, 2.0], [1.5, 1.0, np.nan], 100, 1)
    assert p['n'] == 1 and p['diff'] == -0.5


def test_owner_interval_resamples_whole_sittings():
    # twenty sittings of 50 targets, ten with error 0 and ten with error 1: the interval comes from whole sittings
    values = np.repeat(np.r_[np.zeros(10), np.ones(10)], 50)
    sitting = np.repeat(np.arange(20), 50)
    m = stats.cluster_mean(values, sitting, 2000, 1)
    assert m['value'] == 0.5 and m['clusters'] == 20 and m['largest_share'] == 0.05
    assert 0.2 < m['lo'] < 0.35 and 0.65 < m['hi'] < 0.8 and 'why' not in m
    flat = stats.cluster_mean(values, np.arange(1000), 2000, 1)      # every target its own cluster: far narrower
    assert flat['hi'] - flat['lo'] < 0.1


def test_no_interval_from_few_or_lopsided_clusters():
    values = np.r_[np.zeros(500), np.ones(500)]
    few = stats.cluster_mean(values, np.repeat(np.arange(9), 112)[:1000], 2000, 1)
    assert few['value'] == 0.5 and few['lo'] is None and few['hi'] is None and few['se'] is None
    assert few['why'] == '9 clusters, fewer than 10'
    # the owner's shape: 97 sittings, of which one holds 39% of the targets
    sitting = np.r_[np.zeros(391), 1 + np.arange(609) % 96]
    lopsided = stats.cluster_mean(values, sitting, 2000, 1)
    assert lopsided['clusters'] == 97 and lopsided['lo'] is None and lopsided['why'] == \
        'the largest of 97 clusters holds 39% of the rows'
    quarter = stats.cluster_mean(values, np.r_[np.zeros(250), 1 + np.arange(750) % 30], 2000, 1)
    assert quarter['lo'] is not None                                   # exactly a quarter is allowed
    d = stats.cluster_paired(values, 1 - values, sitting, 2000, 1)
    assert d['diff'] == 0 and d['lo'] is None and d['sde'] is None and 'why' in d
    d = stats.cluster_paired(values, np.zeros(1000), np.arange(1000) % 40, 2000, 1)
    assert d['lo'] < d['diff'] < d['hi'] and d['sde'] > 0 and 'why' not in d


def test_rounding_is_half_up_and_clipped():
    assert score.to_rating([6.5, 7.5, 7.49, 0.2, 11.0, 9.5, 1.4]).tolist() == [7, 8, 7, 1, 10, 10, 1]


def test_monotone_fit_is_the_best_non_decreasing_fit_under_absolute_loss():
    import itertools
    rng = np.random.default_rng(3)
    for _ in range(100):                                               # against every non-decreasing fit, by force
        n = 6
        x = rng.permutation(n).astype(float)
        y = rng.integers(1, 5, n).astype(float)
        bounds, values = score.monotone_fit(x, y, min_step=1)
        assert (np.diff(values) > 0).all()
        loss = np.abs(values[np.searchsorted(bounds, x, side='right')] - y).sum()
        in_order = y[np.argsort(x)]
        best = min(np.abs(np.array(c) - in_order).sum() for c in itertools.combinations_with_replacement([1, 2, 3, 4], n))
        assert loss == best


def test_every_step_of_the_calibrator_holds_twenty_history_ratings():
    rng = np.random.default_rng(4)
    for n in (40, 59, 60, 137, 640):
        x = np.round(rng.random(n), 2)                                 # with ties
        y = np.clip(np.round(3 + 6 * x + rng.normal(0, 1.5, n)), 1, 10)
        bounds, values = score.monotone_fit(x, y)
        step = np.searchsorted(bounds, x, side='right')
        assert (np.bincount(step, minlength=len(values)) >= 20).all() and len(values) <= n // 20
        assert (np.diff(values) > 0).all() and len(values) >= 2
        for j in range(len(values)):
            assert values[j] == np.median(y[step == j])                # the median: the best constant under absolute loss
    bounds, values = score.monotone_fit(np.arange(39.0), np.arange(39.0) % 10 + 1)
    assert len(values) == 1 and values[0] == 5.0                       # below 40 points: one step


def test_calibrator_falls_back_to_the_median():
    history = np.array([3, 7, 8, 8, 9])
    two = (lambda a: [a[::2], a[1::2]])
    rank = np.arange(20.0) / 20
    few = score.calibrated(np.array([0.1, 0.9]), two(rank[:8]), two(rank[:8] * 10), history)
    assert few.tolist() == [8.0, 8.0]                                  # fewer than 10 pairs
    one_step = score.calibrated(np.array([0.1, 0.9]), two(rank), two(rank * 10), history)
    assert one_step.tolist() == [8.0, 8.0]                             # fewer than 40 pairs: one step, the median
    rank = np.arange(80.0) / 80
    rating = np.floor(rank * 10) + 1
    history = rating.astype(int)
    good = score.calibrated(np.array([-5.0, 0.3, 0.6, 99.0]), two(rank), two(rating), history)
    assert good.tolist() == [2.0, 4.0, 7.0, 9.0]                       # four steps of 20: medians of 1..3, 3..5, ...
    flat = score.calibrated(np.array([0.1, 0.9]), [rank[:40], np.full(40, 0.5)], [rating[:40], rating[40:]], history)
    assert flat.tolist() == [np.median(history)] * 2                   # a calibration view without a taste
    same = score.calibrated(np.array([0.5, 0.5, 0.5]), two(rank), two(rating), history)
    assert same.tolist() == [np.median(history)] * 3                   # a block without a taste
    alone = score.calibrated(np.array([0.9]), two(rank), two(rating), history)
    assert alone.tolist() == [9.0]                                     # one target is not "no order"


def test_a_scorer_that_knows_nothing_lands_on_b0_within_the_tolerance():
    """The calibrator floor on made-up members: random ranks through folds, the fit and the rounding."""
    rng = np.random.default_rng(8)
    worse = []
    for size in rng.choice([40, 60, 80, 160, 320], 300):
        level = rng.uniform(5, 8.5)
        history = np.clip(np.round(rng.normal(level, 1.6, size)), 1, 10)
        targets = np.clip(np.round(rng.normal(level, 1.6, 30)), 1, 10)
        folds = np.arange(size) % 5
        ranks = rng.random(size)
        got = score.calibrated(rng.random(30), [ranks[folds == f] for f in range(5)],
                               [history[folds == f] for f in range(5)], history)
        b0 = score.to_rating(np.full(30, np.median(history)))
        worse.append(np.abs(score.to_rating(got) - targets).mean() - np.abs(b0 - targets).mean())
    assert abs(np.mean(worse)) < score.FLOOR_TOLERANCE


def answer(**kw):
    base = {'returned': 'dict', 'keys': ['p_low', 'rank', 'score'], 'rank': {'shape': [3], 'values': [0.1, 0.2, 0.3]},
            'score': None, 'p_low': None}
    return {**base, **kw}


def test_contract():
    ok = score.check_answer(answer(), 3)
    assert ok['rank'].tolist() == [0.1, 0.2, 0.3] and ok['score'] is None
    bad = [answer(returned='ndarray'), answer(returned='error', error='boom'), answer(rank=None),
           answer(keys=['rank', 'extra']), answer(rank={'shape': [2], 'values': [1, 2]}),
           answer(rank={'shape': [3, 1], 'values': [1, 2, 3]}),
           answer(rank={'shape': [3], 'values': [1, float('nan'), 3]}),
           answer(score={'shape': [3], 'values': [1, float('inf'), 3]}),
           answer(p_low={'shape': [3], 'values': [0.1, 1.2, 0.3]}), answer(score={'error': 'not numeric'})]
    for a in bad:
        with pytest.raises(score.ContractError):
            score.check_answer(a, 3)
    wide = score.check_answer(answer(score={'shape': [3], 'values': [0.0, 5.4, 12.0]}), 3)
    assert score.to_rating(wide['score']).tolist() == [1, 5, 10]       # out of range is clipped, not refused
    # without a score the rank is the scale the calibrator reads: 0..1, the same in every view
    for values in ([0.1, 0.2, 1.3], [-0.1, 0.2, 0.3], [5.1, 5.2, 5.3]):
        with pytest.raises(score.ContractError, match='rank in 0..1'):
            score.check_answer(answer(rank={'shape': [3], 'values': values}), 3)
    free = score.check_answer(answer(rank={'shape': [3], 'values': [5.1, -5.2, 5.3]},
                                     score={'shape': [3], 'values': [6, 7, 8]}), 3)
    assert free['rank'].tolist() == [5.1, -5.2, 5.3]                   # with a score any rank will do


def table(member, view, y, **kw):
    n = len(y)
    base = {'member': np.array(member), 'view': np.array(view), 'y': np.array(y), 'sitting': np.zeros(n, int),
            'same_sitting': np.ones(n, bool), 'block': np.full(n, 5), 'media': np.zeros(n, int),
            'provenance': np.zeros(n, int), 'has_fingerprint': np.ones(n, bool), 'old_title': np.ones(n, bool),
            'label_edited': np.zeros(n, bool), 'franchise': np.arange(n),
            'low_share': np.full(n, 0.25), 'provenance_names': ['typed', 'bulk', 'import']}
    return {**base, **{k: np.array(v) for k, v in kw.items()}}


def test_member_values_by_hand():
    #            member 0, view 0          member 0, view 1     member 1, view 2
    y = [9, 4, 7,                        8, 2,              6, 6]
    pred = [8, 6, 7,                     8, 5,              7, 3]
    rank = [0.9, 0.1, 0.1,               0.2, 0.3,          0.5, 0.4]
    t = table([0, 0, 0, 0, 0, 1, 1], [0, 0, 0, 1, 1, 2, 2], y, label_edited=np.array([0, 1, 0, 0, 0, 1, 1], bool))
    v = score.member_values(t, {'pred': np.array(pred), 'rank': np.array(rank), 'p_low': np.full(7, 0.5)})
    assert v['mae'].tolist() == [pytest.approx((1 + 2 + 0 + 0 + 3) / 5), 2.0]
    assert v['mae_unedited'][0] == pytest.approx((1 + 0 + 0 + 3) / 4) and np.isnan(v['mae_unedited'][1])
    assert v['mae_low'][0] == pytest.approx(2.5) and np.isnan(v['mae_low'][1])
    # pairs within a view only: view 0 has (9,4) right, (9,7) right, (7,4) tied in rank = 2.5 of 3; view 1 has
    # (8,2) wrong = 0 of 1; view 2 has no pair with different ratings
    assert v['pair_acc'][0] == pytest.approx(2.5 / 4) and np.isnan(v['pair_acc'][1])
    assert np.isnan(v['low_auc']).all()                               # fewer than 5 low and 5 other targets
    assert v['brier'][0] == pytest.approx(0.25) and v['brier_ref'][0] == pytest.approx((3 * 0.0625 + 2 * 0.5625) / 5)


def test_measures_report_owner_and_others_apart():
    rng = np.random.default_rng(5)
    member = np.repeat(np.arange(6), 20)
    view = np.repeat(np.arange(12), 10)
    y = rng.integers(1, 11, 120)
    edited = np.arange(120) % 10 == 0
    t = table(member, view, y, sitting=np.tile(np.repeat(np.arange(4), 5), 6), label_edited=edited,
              franchise=np.arange(120) // 2)
    perfect = {'pred': y.copy(), 'rank': y.astype(float), 'p_low': None}
    const = {'pred': np.full(120, 7), 'rank': np.zeros(120), 'p_low': None}
    m = score.t1_measures(t, perfect, {'ref': const}, owner=0, draws=500, seed=1)
    assert m['others']['n_members'] == 5 and m['others']['mae']['value'] == 0
    assert m['others']['pair_acc']['value'] == 1 and m['others']['vs']['ref']['skill'] == 1
    assert m['others']['vs']['ref']['mae']['improved'] == 5
    assert m['owner']['n_targets'] == 20 and m['owner']['sittings'] == 4 and m['owner']['franchises'] == 10
    d = m['owner']['vs']['ref']
    assert d['mae']['diff'] == pytest.approx(-np.abs(y[:20] - 7).mean(), abs=1e-6)
    assert d['mae']['lo'] is None and d['mae']['sde'] is None and d['mae']['why'] == '4 clusters, fewer than 10'
    assert d['mae_franchise']['diff'] == d['mae']['diff'] and d['mae_franchise']['lo'] < d['mae_franchise']['hi'] < 0
    assert d['mae_unedited']['diff'] == pytest.approx(-np.abs(y[:20][~edited[:20]] - 7).mean(), abs=1e-6)
    assert m['others']['n_targets_edited'] == 10 and m['others']['mae_unedited']['value'] == 0
    assert m['strata']['label:edited_later']['others']['n_targets'] == 10
    assert m['strata']['sitting:same']['others']['n_members'] == 5
    assert 'others' not in m['strata']['sitting:later']


def test_floor_measures_compare_the_floor_with_b0_and_the_rung_with_its_floor():
    member = np.repeat(np.arange(4), 12)
    y = np.tile([9, 8, 7, 6, 9, 8, 7, 6, 9, 8, 7, 6], 4)
    t = table(member, np.repeat(np.arange(4), 12), y)
    rung = {'pred': y - 1, 'rank': np.zeros(48), 'p_low': None}        # error 1 everywhere
    b0 = np.full(48, 8)                                                # error 1, 0, 1, 2: mean 1
    floor_err = np.abs(b0 - y) + 0.005                                 # the floor: B0 plus 0.005
    m = score.floor_measures(t, rung, floor_err, b0, owner=0, draws=200, seed=1)
    assert m['others']['vs_b0']['diff'] == pytest.approx(0.005) and m['others']['within_tolerance'] is True
    assert m['others']['rung_vs_floor']['diff'] == pytest.approx(-0.005) and m['others']['mae']['n'] == 3
    assert m['owner']['vs_b0']['diff'] == pytest.approx(0.005)
    far = score.floor_measures(t, rung, floor_err + 0.02, b0, owner=0, draws=200, seed=1)
    assert far['others']['within_tolerance'] is False


# ------------------------------------------------------------------ T2a

def facts(n):
    return {'g': np.array([50., 52., 60., 51., 80., 49.])[:n], 'show': np.array([1, 0, 0, 1, 0, 0], bool)[:n],
            'animation': np.array([0, 0, 1, 0, 0, 0], bool)[:n], 'franchise': np.array([7, 7, -3, 7, -5, -6])[:n],
            'votes': np.array([100., 9e9, 300., 500., 9e9, 700.])[:n]}


def test_t2a_view_places_each_hidden_title_among_the_candidates_by_hand():
    # six targets; the titles at positions 1 and 4 are hidden, the candidates are 0, 2, 3 and 5
    answer = {'rank': np.array([.1, .5, .5, .9, .2, .3]), 'score': np.array([5., 7.4, 5., 5., 11., 5.]), 'p_low': None}
    r = score.t2a_view(answer, {'pos': np.array([1, 4])}, np.arange(6), facts(6))
    # position 1 (rank .5): two candidates below, one tied, one above
    assert r['pct'] == [pytest.approx(2.5 / 4), pytest.approx(1 / 4)] and r['above'] == [1.5, 3.0]
    # equally well-rated, within 3 points: for 52 the candidates at 50, 51 and 49 (ranks .1, .9, .3); for 80 none
    assert r['pct_matched'] == [pytest.approx(2 / 3), None] and r['n_matched'] == [3, 0]
    # the first 50 candidates are all four: two shows, one animation, two of franchise 7 (the third is hidden),
    # votes 100, 300, 500 and 700
    assert r['top'] == {'top_shows': 0.5, 'top_animation': 0.25, 'top_franchise_max': 2, 'top_votes_median': 400.0}
    assert r['score'] == [7, 10] and r['p_low'] is None and r['candidates'] == 4   # hidden titles only, rounded
    flat = score.t2a_view({'rank': np.zeros(6), 'score': None, 'p_low': None}, {'pos': np.array([1, 4])},
                          np.arange(6), facts(6))
    assert flat['pct'] == [0.5, 0.5] and flat['above'] == [2.0, 2.0] and flat['score'] is None   # no order: 0.5


def t2a_table(member, y, view=None, **kw):
    n = len(y)
    members = int(max(member)) + 1
    view = np.array(member if view is None else view)
    base = {'member': np.array(member), 'view': view, 'y': np.array(y), 'sitting': np.arange(n) % 12,
            'franchise': np.arange(n), 'low_share': np.full(n, 0.25), 'title': np.arange(n),
            'view_member': np.array([member[list(view).index(v)] for v in sorted(set(view.tolist()))]),
            'n_outside': np.zeros(members, int), 'own_shows': np.full(members, 0.25),
            'own_animation': np.full(members, 0.1)}
    return {**base, **{k: np.array(v) for k, v in kw.items()}}


def t2a_answers(pct, views=1, **kw):
    n = len(pct)
    base = {'pct': np.array(pct, float), 'above': np.zeros(n), 'pct_matched': np.array(pct, float), 'pred': None,
            'pct_popular': np.array(pct, float), 'pct_both': np.array(pct, float), 'n_both': np.full(n, 100.),
            'pct_lists': np.array(pct, float),
            'p_low': None, 'candidates': np.full(views, 1000.), 'top_shows': np.full(views, 0.5),
            'top_animation': np.full(views, 0.1), 'top_franchise_max': np.full(views, 2.),
            'top_votes_median': np.full(views, 5000.)}
    return {**base, **kw}


def test_t2a_member_values_by_hand():
    # member 0: five titles rated 9, five rated 3, one rated 7. member 1: five rated 9 and four rated 3
    y = [9] * 5 + [3] * 5 + [7] + [9] * 5 + [3] * 4
    member = [0] * 11 + [1] * 9
    pct = [.9, .8, .7, .6, 1.0] + [.1, .2, .3, .4, .5] + [.5] + [.9] * 5 + [.1] * 4
    above = [10, 60, 49, 50, 0] + [300] * 5 + [100] + [0] * 5 + [1000] * 4
    v = score.t2a_member_values(t2a_table(member, y), t2a_answers(pct, 2, above=np.array(above, float),
                                                                   pred=np.array(y) - 1))
    assert v['pct_high'].tolist() == [pytest.approx(0.8), pytest.approx(0.9)]
    assert v['pct_low'][0] == pytest.approx(0.3) and np.isnan(v['pct_low'][1])     # four titles are not a band
    assert np.isnan(v['pct_mid']).all()
    assert v['separation'][0] == pytest.approx(0.5) and np.isnan(v['separation'][1])
    assert v['first50_high'][0] == pytest.approx(3 / 5) and v['first200_high'][0] == 1  # 50 above is not the first 50
    assert v['first50_low'][0] == 0 and v['first200_low'][0] == 0
    assert v['n_low'].tolist() == [5, 4] and v['hidden'].tolist() == [11, 9]
    assert v['pct_min'].tolist() == [0.1, 0.1] and v['pct_max'].tolist() == [1.0, 0.9]
    assert v['top_shows_vs_own'].tolist() == [0.25, 0.25] and v['mae'].tolist() == [1.0, 1.0]


def test_t2a_measures_report_owner_and_others_apart():
    rng = np.random.default_rng(3)
    member = np.repeat(np.arange(6), 30)
    y = np.tile(np.r_[np.full(10, 9), np.full(10, 6), np.full(10, 3)], 6)
    good = np.where(y >= 8, 0.9, np.where(y <= 5, 0.2, 0.5)) + rng.uniform(-0.05, 0.05, 180)
    none = np.full(180, 0.5)
    t = t2a_table(member, y, franchise=np.arange(180) // 2)
    m = score.t2a_measures(t, t2a_answers(good, 6), {'ref': t2a_answers(none, 6)}, owner=0, draws=500, seed=1)
    o = m['others']
    assert o['n_members'] == 5 and o['n_primary'] == 5 and o['n_hidden'] == 150 and o['members_low'] == 5
    assert o['separation']['value'] == pytest.approx(0.7, abs=0.03) and o['separation']['se'] < 0.02
    d = o['vs']['ref']['separation']
    assert d['diff'] == o['separation']['value'] and d['improved'] == 5 and d['lo'] > 0.6   # higher is better
    assert o['vs']['ref']['pct_low']['improved'] == 5 and o['vs']['ref']['pct_low']['diff'] < 0   # lower is better
    assert 'improved' not in o['vs']['ref']['top_shows'] and 'mae' not in o
    w = m['owner']
    assert w['n_hidden'] == 30 and w['n_high'] == 10 and w['sittings'] == 12 and w['franchises'] == 15
    assert w['separation']['value'] == pytest.approx(0.7, abs=0.05) and w['separation']['lo'] is not None
    assert w['separation_franchise']['lo'] < w['separation_franchise']['value'] < w['separation_franchise']['hi']
    assert w['vs']['ref']['separation']['value'] == w['separation']['value']
    assert w['pct_high']['value'] == pytest.approx(0.9, abs=0.03)
    # the owner's shape: one sitting holds most of the titles, so there is no interval over sittings
    t['sitting'] = np.where(np.arange(180) % 30 < 20, 0, np.arange(180) % 30)
    w = score.t2a_measures(t, t2a_answers(good, 6), {}, owner=0, draws=500, seed=1)['owner']
    assert w['separation']['lo'] is None and 'holds' in w['separation']['why'] and w['separation']['value'] > 0.6
    assert w['separation_franchise']['lo'] is not None


def test_cluster_separation_resamples_whole_clusters():
    values = np.r_[np.full(100, 0.8), np.full(100, 0.3)]
    high = np.arange(200) < 100
    s = stats.cluster_separation(values, high, ~high, np.arange(200) % 20, 1000, 1)
    assert s['value'] == pytest.approx(0.5) and s['n_high'] == 100 and s['n_low'] == 100 and s['clusters'] == 20
    assert s['lo'] == pytest.approx(0.5) and s['hi'] == pytest.approx(0.5)        # no spread inside a group
    few = stats.cluster_separation(values, high, ~high, np.arange(200) % 5, 1000, 1)
    assert few['value'] == pytest.approx(0.5) and few['lo'] is None and few['why'] == '5 clusters, fewer than 10'
    assert stats.cluster_separation(values, high, np.zeros(200, bool), np.arange(200), 100, 1)['value'] is None


def test_equally_popular_and_both_by_hand_and_the_t2b_view():
    f = {'g': np.full(6, 50.), 'show': np.zeros(6, bool), 'animation': np.zeros(6, bool),
         'franchise': -1 - np.arange(6), 'votes': np.array([1000., 1400., 1500., 2100., 3000., 1000.])}
    answer = {'rank': np.array([.1, .5, .9, .5, .2, .6]), 'score': None, 'p_low': None}
    r = score.t2a_view(answer, {'pos': np.array([1])}, np.arange(6), f)
    # 1400 votes: 1000, 1500 and 2100 lie within a factor of 1.5 (2100 exactly, the edge counts); 3000 does not
    assert r['n_popular'] == [4] and r['pct_popular'] == [pytest.approx(1.5 / 4)]
    assert r['n_both'] == [4] and r['pct_both'] == [None]               # fewer than 50 such candidates
    assert r['n_matched'] == [5] and r['pct_matched'] == r['pct']       # every candidate has the same score
    key = {'pos': np.array([1]), 'later_pos': np.array([5]), 'touched': np.array([7])}
    b = score.t2b_view(answer, key, np.arange(6), f)
    # the later skip (rank .6) among the other non-targets (.1, .9, .5, .2): three below it
    assert b['later_pct'] == [pytest.approx(0.75)] and (b['auc_good'], b['auc_pairs']) == (0.0, 1)
    assert b['touched_first50'] == 0 and b['touched_listed'] == 0 and b['pct'] == r['pct']
    assert score.t2b_view(answer, {**key, 'touched': np.array([3])}, np.arange(6), f)['touched_listed'] == 1


def test_titles_on_the_member_s_lists_are_left_out_of_the_comparison():
    # six targets: position 1 hidden; position 3 (rank .9) is on the member's Want to See list, so it is not hidden
    answer = {'rank': np.array([.1, .5, .2, .9, .3, .6]), 'score': None, 'p_low': None}
    f = {'g': np.full(6, 50.), 'show': np.zeros(6, bool), 'animation': np.zeros(6, bool),
         'franchise': -1 - np.arange(6), 'votes': np.full(6, 1000.)}
    r = score.t2a_view(answer, {'pos': np.array([1]), 'listed_pos': np.array([3])}, np.arange(6), f)
    assert r['pct'] == [pytest.approx(3 / 4)] and r['candidates'] == 4     # .1, .2, .3 below; .6 above
    assert r['pct_lists'] == [pytest.approx(3 / 5)]                     # the rule before item 004
    assert r['above'] == [1.0] and r['top']['top_votes_median'] == 1000.0
    # the canary's shortcut: listed titles at the bottom, everything else in the middle
    shortcut = {'rank': np.array([.5, .5, .5, 0., .5, .5]), 'score': None, 'p_low': None}
    r = score.t2a_view(shortcut, {'pos': np.array([1]), 'listed_pos': np.array([3])}, np.arange(6), f)
    assert r['pct'] == [0.5] and r['pct_lists'] == [pytest.approx((1 + 0.5 * 4) / 5)]


def test_the_owner_keeps_the_band_minimum():
    # the owner (member 0) has ten titles rated 9 and four rated 3: no low band, so no separation
    y = np.r_[np.full(10, 9), np.full(4, 3), np.tile(np.r_[np.full(6, 9), np.full(6, 3)], 2)]
    member = np.r_[np.zeros(14, int), np.ones(12, int), np.full(12, 2)]
    pct = np.where(y >= 8, 0.8, 0.3)
    t = t2a_table(member, y, franchise=np.arange(len(y)))
    m = score.t2a_measures(t, t2a_answers(pct, 3), {'ref': t2a_answers(np.full(len(y), 0.5), 3)}, owner=0,
                           draws=200, seed=1)
    w = m['owner']
    assert w['n_low'] == 4 and w['pct_low']['value'] is None and 'fewer than 5' in w['pct_low']['why']
    assert w['separation']['value'] is None and 'fewer than 5' in w['separation']['why']
    assert w['separation_matched_franchise']['value'] is None and w['vs']['ref']['separation']['value'] is None
    assert w['pct_high']['value'] == pytest.approx(0.8) and m['others']['separation']['value'] == pytest.approx(0.5)
