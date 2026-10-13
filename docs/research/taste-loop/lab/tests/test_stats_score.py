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
    # two sittings with very different errors: the interval must span both, however many targets each has
    values = np.r_[np.zeros(500), np.ones(500)]
    sitting = np.r_[np.zeros(500), np.ones(500)]
    m = stats.cluster_mean(values, sitting, 2000, 1)
    assert m['value'] == 0.5 and m['lo'] == 0.0 and m['hi'] == 1.0 and m['clusters'] == 2
    flat = stats.cluster_mean(values, np.arange(1000), 2000, 1)      # every target its own cluster: far narrower
    assert flat['hi'] - flat['lo'] < 0.1


def test_rounding_is_half_up_and_clipped():
    assert score.to_rating([6.5, 7.5, 7.49, 0.2, 11.0, 9.5, 1.4]).tolist() == [7, 8, 7, 1, 10, 10, 1]


def test_isotonic_matches_sklearn():
    from sklearn.isotonic import IsotonicRegression
    rng = np.random.default_rng(3)
    for n in (10, 37, 200):
        x = np.round(rng.normal(size=n), 1)                            # with ties
        y = rng.integers(1, 11, n).astype(float)
        ux, fit = score.isotonic(x, y)
        ref = IsotonicRegression(out_of_bounds='clip').fit(x, y)
        assert np.allclose(fit, ref.predict(ux))
        grid = np.linspace(-3, 3, 50)
        assert np.allclose(np.interp(grid, ux, fit), ref.predict(grid))


def test_calibrator_falls_back_to_the_median():
    history = np.array([3, 7, 8, 8, 9])
    few = score.calibrated(np.array([0.1, 0.9]), np.arange(5.0), np.arange(5.0) + 3, history)
    assert few.tolist() == [8.0, 8.0]                                  # fewer than 10 pairs
    flat = score.calibrated(np.array([0.1, 0.9]), np.zeros(20), np.arange(20.0) % 10 + 1, history)
    assert flat.tolist() == [8.0, 8.0]                                 # no order in the history
    rank = np.arange(20.0)
    good = score.calibrated(np.array([-5.0, 9.5, 99.0]), rank, rank / 2 + 1, history)
    assert good.tolist() == [1.0, 5.75, 10.5]


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


def table(member, view, y, **kw):
    n = len(y)
    base = {'member': np.array(member), 'view': np.array(view), 'y': np.array(y), 'sitting': np.zeros(n, int),
            'same_sitting': np.ones(n, bool), 'block': np.full(n, 5), 'media': np.zeros(n, int),
            'provenance': np.zeros(n, int), 'has_fingerprint': np.ones(n, bool), 'old_title': np.ones(n, bool),
            'low_share': np.full(n, 0.25), 'provenance_names': ['typed', 'bulk', 'import']}
    return {**base, **{k: np.array(v) for k, v in kw.items()}}


def test_member_values_by_hand():
    #            member 0, view 0          member 0, view 1     member 1, view 2
    y = [9, 4, 7,                        8, 2,              6, 6]
    pred = [8, 6, 7,                     8, 5,              7, 3]
    rank = [0.9, 0.1, 0.1,               0.2, 0.3,          0.5, 0.4]
    t = table([0, 0, 0, 0, 0, 1, 1], [0, 0, 0, 1, 1, 2, 2], y)
    v = score.member_values(t, {'pred': np.array(pred), 'rank': np.array(rank), 'p_low': np.full(7, 0.5)})
    assert v['mae'].tolist() == [pytest.approx((1 + 2 + 0 + 0 + 3) / 5), 2.0]
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
    t = table(member, view, y, sitting=np.tile(np.repeat(np.arange(4), 5), 6))
    perfect = {'pred': y.copy(), 'rank': y.astype(float), 'p_low': None}
    const = {'pred': np.full(120, 7), 'rank': np.zeros(120), 'p_low': None}
    m = score.t1_measures(t, perfect, {'ref': const}, owner=0, draws=500, seed=1)
    assert m['others']['n_members'] == 5 and m['others']['mae']['value'] == 0
    assert m['others']['pair_acc']['value'] == 1 and m['others']['vs']['ref']['skill'] == 1
    assert m['others']['vs']['ref']['mae']['improved'] == 5
    assert m['owner']['n_targets'] == 20 and m['owner']['sittings'] == 4
    assert m['owner']['vs']['ref']['mae']['diff'] == pytest.approx(-np.abs(y[:20] - 7).mean(), abs=1e-6)
    assert m['strata']['sitting:same']['others']['n_members'] == 5
    assert 'others' not in m['strata']['sitting:later']
