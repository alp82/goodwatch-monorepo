"""From a predictor's answers to the numbers in the ledger: the contract check, the one output convention, and the
T1 measures (PLAN.md 2.2 and 2.4).

Contract. `predict(view)` returns a dict with nothing but `rank`, `score` and `p_low`. `rank` is required: one
finite number per target, higher is shown earlier. `score` is None or one finite number per target; the harness
clips it to 1..10 and rounds it (halves up). `p_low` is None or one number in 0..1 per target. A predictor gives
`score` (or `p_low`) for every view or for none. A predictor that gives no `score` must give `rank` on a scale that
means the same in every view of one member, as a number in 0..1 (the ladder's rank-only rungs give a percentile
over the reference pool); a rank outside 0..1 without a score fails the run. Anything else fails the run too.

A scorer without `score` gets one from the calibrator: a monotone fit of rating on rank under absolute loss, over
the member's history only, in steps that each hold 20 or more history ratings. The ranks of history titles come
from calibration views, in which a fifth of the history is hidden and predicted from the rest, so no title is
ranked by a taste built with its own rating. The calibrated score is the median of the member's history, which is
rung B0, when the block has fewer than 10 history ratings (no calibration views), when the scorer gives every title
of a calibration view or of the block itself one rank (no taste there), and whenever the fit has one step only,
which is always the case below 40 history ratings.

The calibrator floor is what the calibrator alone does: the same answers with the ranks permuted within every
view, calibrated the same way. A scorer that knows nothing must land on B0.
"""
import numpy as np

import stats

MIN_TARGETS = 10                     # members in the primary measure
MIN_CALIBRATION_PAIRS = 10
MIN_STEP = 20                        # history ratings per step of the calibrator
FLOOR_PERMUTATIONS = 20              # the calibrator floor is the average over this many permutations
FLOOR_TOLERANCE = 0.01               # how far the floor may lie from B0 for members other than the owner
LOW = 5                              # a rating of 5 or less is low
AUC_MIN = 5                          # low-rating AUC: members with 5 or more low and 5 or more other targets
KEYS = ('rank', 'score', 'p_low')


class ContractError(Exception):
    pass


def check_answer(answer, n_targets):
    """One view's answer as sandbox.py reported it -> {'rank', 'score', 'p_low'} arrays, or ContractError."""
    returned = answer.get('returned')
    if returned == 'error':
        raise ContractError(f'predict failed: {answer.get("error")}')
    if returned != 'dict':
        raise ContractError(f'predict returned {returned}, not a dict with rank, score and p_low')
    extra = sorted(set(answer.get('keys', ())) - set(KEYS))
    if extra:
        raise ContractError(f'predict returned keys the contract does not have: {extra}')
    out = {}
    for name in KEYS:
        got = answer.get(name)
        if got is None:
            if name == 'rank':
                raise ContractError('predict returned no rank')
            out[name] = None
            continue
        if 'error' in got:
            raise ContractError(got['error'])
        if got['shape'] != [n_targets]:
            raise ContractError(f'{name} has shape {got["shape"]}, expected one value per target: [{n_targets}]')
        a = np.array(got['values'], float)
        if not np.isfinite(a).all():
            raise ContractError(f'{name} holds values that are not finite')
        if name == 'p_low' and ((a < 0) | (a > 1)).any():
            raise ContractError('p_low holds values outside 0..1')
        out[name] = a
    if out['score'] is None and ((out['rank'] < 0) | (out['rank'] > 1)).any():
        raise ContractError('a predictor without score must give rank in 0..1, on one scale for all views of a '
                            'member; rank holds values outside 0..1')
    return out


def to_rating(score):
    """The number compared: clipped to 1..10, rounded to a whole rating, halves up."""
    return np.floor(np.clip(np.asarray(score, float), 1, 10) + 0.5).astype(np.int64)


def monotone_fit(x, y, min_step=MIN_STEP):
    """A non-decreasing step function of x fitted to y under absolute loss, every step holding `min_step` or more
    points. The points are sorted by x and dealt into bins of `min_step` (titles with one x stay together, the
    last bin takes the rest); bins are then pooled wherever the median does not rise from one to the next, and a pooled
    bin takes the median of all its points. Returns (bounds, values): step j covers x from bounds[j - 1] up to
    bounds[j], the midpoints between neighbouring steps."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    order = np.argsort(x, kind='stable')
    x, y = x[order], y[order]
    n = len(x)
    starts, a = [0], 0
    for i in range(1, n):
        if i - a >= min_step and n - i >= min_step and x[i] > x[i - 1]:
            starts.append(i)
            a = i
    blocks = []                                        # [first, last + 1, median]
    for a, b in zip(starts, starts[1:] + [n]):
        blocks.append([a, b, float(np.median(y[a:b]))])
        while len(blocks) > 1 and blocks[-2][2] >= blocks[-1][2]:
            a0, b0 = blocks[-2][0], blocks[-1][1]
            blocks[-2:] = [[a0, b0, float(np.median(y[a0:b0]))]]
    bounds = np.array([(x[b[0] - 1] + x[b[0]]) / 2 for b in blocks[1:]])
    return bounds, np.array([b[2] for b in blocks])


def calibrated(rank, cal_ranks, cal_scores, history_score, min_step=MIN_STEP):
    """A score for each target rank from the member's history: see the module text. cal_ranks and cal_scores are
    lists with one array per calibration view."""
    rank = np.asarray(rank, float)
    flat = np.full(len(rank), np.median(history_score))
    no_order = (lambda r: len(r) >= 2 and np.ptp(r) == 0)
    if sum(len(r) for r in cal_ranks) < MIN_CALIBRATION_PAIRS or no_order(rank) or any(no_order(np.asarray(r, float))
                                                                                         for r in cal_ranks):
        return flat
    bounds, values = monotone_fit(np.concatenate(cal_ranks), np.concatenate(cal_scores), min_step)
    if len(values) < 2:
        return flat
    return values[np.searchsorted(bounds, rank, side='right')]


# ------------------------------------------------------------------ T1 measures

def _pairs(rank, y):
    """(correctly ordered, pairs) among targets with different ratings; a tie in rank counts a half."""
    dy = y[:, None] - y[None, :]
    dr = rank[:, None] - rank[None, :]
    m = dy > 0
    return float((dr[m] > 0).sum() + 0.5 * (dr[m] == 0).sum()), int(m.sum())


def _low_pairs(rank, y):
    """(low title ranked below a not-low title, pairs)."""
    low, rest = rank[y <= LOW], rank[y > LOW]
    if len(low) == 0 or len(rest) == 0:
        return 0.0, 0
    d = rest[:, None] - low[None, :]
    return float((d > 0).sum() + 0.5 * (d == 0).sum()), int(d.size)


def member_values(table, p):
    """One row of values per member (indexed by member row number; NaN where not defined)."""
    n = int(table['member'].max()) + 1 if len(table['member']) else 0
    member, y = table['member'], table['y']
    err = np.abs(p['pred'] - y).astype(float)
    count = np.bincount(member, minlength=n).astype(float)

    def mean_where(mask, values=err):
        k = np.bincount(member[mask], minlength=n).astype(float)
        with np.errstate(invalid='ignore', divide='ignore'):
            return np.where(k > 0, np.bincount(member[mask], values[mask], minlength=n) / k, np.nan)

    everything = np.ones(len(y), bool)
    out = {'targets': count, 'mae': mean_where(everything), 'mae_low': mean_where(y <= LOW),
           'mae_mid': mean_where((y >= 6) & (y <= 7)), 'mae_high': mean_where(y >= 8),
           'mae_unedited': mean_where(~table['label_edited'].astype(bool))}       # targets whose rating was never edited
    good, pairs, lgood, lpairs = (np.zeros(n) for _ in range(4))
    for v in np.unique(table['view']):
        at = np.flatnonzero(table['view'] == v)
        u = member[at[0]]
        a, b = _pairs(p['rank'][at], y[at])
        good[u] += a
        pairs[u] += b
        a, b = _low_pairs(p['rank'][at], y[at])
        lgood[u] += a
        lpairs[u] += b
    lows = np.bincount(member[y <= LOW], minlength=n)
    with np.errstate(invalid='ignore', divide='ignore'):
        out['pair_acc'] = np.where(pairs > 0, good / pairs, np.nan)
        out['low_auc'] = np.where((lows >= AUC_MIN) & (count - lows >= AUC_MIN) & (lpairs > 0), lgood / lpairs,
                                  np.nan)
    is_low = (y <= LOW).astype(float)
    out['brier_ref'] = mean_where(everything, (table['low_share'] - is_low) ** 2)
    if p['p_low'] is not None:
        out['brier'] = mean_where(everything, (p['p_low'] - is_low) ** 2)
    return out


LOWER_IS_BETTER = {'mae': True, 'mae_low': True, 'mae_mid': True, 'mae_high': True, 'mae_unedited': True,
                   'brier': True, 'pair_acc': False, 'low_auc': False}


def _reliability(p_low, is_low):
    rows = []
    b = np.minimum((p_low * 10).astype(int), 9)
    for k in range(10):
        m = b == k
        if m.any():
            rows.append({'bin': f'{k / 10:.1f} to {(k + 1) / 10:.1f}', 'n': int(m.sum()),
                         'predicted': round(float(p_low[m].mean()), 4), 'observed': round(float(is_low[m].mean()), 4)})
    return rows


def strata_of(table):
    """name -> mask over targets."""
    s = {'sitting:same': table['same_sitting'], 'sitting:later': ~table['same_sitting']}
    for b in np.unique(table['block']).tolist():
        s[f'block:{b}'] = table['block'] == b
    s['media:movie'], s['media:show'] = table['media'] == 0, table['media'] == 1
    for k, name in enumerate(table['provenance_names']):
        if (table['provenance'] == k).any():
            s[f'provenance:{name}'] = table['provenance'] == k
    s['fingerprint:with'], s['fingerprint:without'] = table['has_fingerprint'], ~table['has_fingerprint']
    s['released:2y_before_rating'] = table['old_title']
    s['released:later_or_unknown'] = ~table['old_title']
    s['label:never_edited'], s['label:edited_later'] = ~table['label_edited'], table['label_edited']
    return s


def t1_measures(table, candidate, refs, owner, draws, seed):
    """table: one row per target (member, view, y, sitting, same_sitting, block, media, provenance,
    has_fingerprint, old_title, label_edited, franchise, low_share) plus provenance_names. candidate and each of refs (name -> ...) are
    {'pred', 'rank', 'p_low'} aligned with the table. owner: the owner's member row or None."""
    member, y = table['member'], table['y']
    cv = member_values(table, candidate)
    rv = {name: member_values(table, p) for name, p in refs.items()}
    n = len(cv['targets'])
    is_owner = np.zeros(n, bool)
    if owner is not None and owner < n:
        is_owner[owner] = True
    primary = (cv['targets'] >= MIN_TARGETS) & ~is_owner
    out = {'primary': 'mae', 'min_targets': MIN_TARGETS}

    # members other than the owner
    o = {'n_members': int(primary.sum()), 'n_targets': int(cv['targets'][primary].sum()),
         'n_targets_edited': int((table['label_edited'] & primary[member]).sum()),
         'n_members_any': int(((cv['targets'] > 0) & ~is_owner).sum()),
         'n_targets_any': int(cv['targets'][~is_owner].sum())}
    for name, values in cv.items():
        if name == 'targets':
            continue
        m = primary & np.isfinite(values)
        o[name] = stats.mean_interval(values[m], draws, seed)
    o['vs'] = {}
    for ref, r in rv.items():
        d = {}
        for name, better in LOWER_IS_BETTER.items():
            if name in cv and name in r:
                d[name] = stats.paired(cv[name][primary], r[name][primary], draws, seed, better)
        both = primary & np.isfinite(cv['mae']) & np.isfinite(r['mae'])
        d['skill'] = stats._r(1 - cv['mae'][both].mean() / r['mae'][both].mean()) if both.any() else None
        o['vs'][ref] = d
    out['others'] = o

    # the owner, alone
    if is_owner.any() and cv['targets'][owner] > 0:
        at = member == owner
        sit, fr, clean = table['sitting'][at], table['franchise'][at], ~table['label_edited'][at]
        err = np.abs(candidate['pred'][at] - y[at]).astype(float)
        # `mae` resamples sittings and often has no interval (stats.cluster_mean); `mae_franchise` is the second,
        # labelled figure: the same mean with whole franchises drawn again, sittings ignored
        w = {'n_targets': int(at.sum()), 'sittings': int(len(np.unique(sit))),
             'franchises': int(len(np.unique(fr))), 'n_targets_edited': int((~clean).sum()),
             'mae': stats.cluster_mean(err, sit, draws, seed),
             'mae_franchise': stats.cluster_mean(err, fr, draws, seed),
             'mae_unedited': {'value': stats._r(err[clean].mean()) if clean.any() else None}}
        for name, mask in (('mae_low', y[at] <= LOW), ('mae_mid', (y[at] >= 6) & (y[at] <= 7)),
                           ('mae_high', y[at] >= 8)):
            w[name] = stats.cluster_mean(err[mask], sit[mask], draws, seed)
        for name in ('pair_acc', 'low_auc', 'brier', 'brier_ref'):
            if name in cv:
                w[name] = {'value': stats._r(cv[name][owner])}
        w['vs'] = {}
        for ref, r in refs.items():
            rerr = np.abs(r['pred'][at] - y[at]).astype(float)
            d = {'mae': stats.cluster_paired(err, rerr, sit, draws, seed),
                 'mae_franchise': stats.cluster_paired(err, rerr, fr, draws, seed),
                 'mae_unedited': {'diff': stats._r((err[clean] - rerr[clean]).mean()) if clean.any() else None}}
            for name, mask in (('mae_low', y[at] <= LOW), ('mae_mid', (y[at] >= 6) & (y[at] <= 7)),
                               ('mae_high', y[at] >= 8)):
                d[name] = stats.cluster_paired(err[mask], rerr[mask], sit[mask], draws, seed)
            for name in ('pair_acc', 'low_auc'):
                d[name] = {'diff': stats._r(cv[name][owner] - rv[ref][name][owner])}
            d['skill'] = stats._r(1 - err.mean() / rerr.mean()) if rerr.mean() > 0 else None
            w['vs'][ref] = d
        out['owner'] = w

    # strata: members with one or more targets in the stratum, each counting once
    out['strata'] = {}
    cerr = np.abs(candidate['pred'] - y).astype(float)
    rerr = {ref: np.abs(r['pred'] - y).astype(float) for ref, r in refs.items()}
    for name, mask in strata_of(table).items():
        s = {}
        mo = mask & ~is_owner[member]
        k = np.bincount(member[mo], minlength=n)
        have = k > 0
        if have.any():
            cm = np.bincount(member[mo], cerr[mo], minlength=n)[have] / k[have]
            so = {'n_members': int(have.sum()), 'n_targets': int(mo.sum()),
                  'mae': stats.mean_interval(cm, draws, seed), 'vs': {}}
            for ref, e in rerr.items():
                rm = np.bincount(member[mo], e[mo], minlength=n)[have] / k[have]
                so['vs'][ref] = {'mae': stats.paired(cm, rm, draws, seed)}
            s['others'] = so
        mw = mask & is_owner[member]
        if mw.any():
            sit = table['sitting'][mw]
            sw = {'n_targets': int(mw.sum()), 'mae': stats.cluster_mean(cerr[mw], sit, draws, seed), 'vs': {}}
            for ref, e in rerr.items():
                sw['vs'][ref] = {'mae': stats.cluster_paired(cerr[mw], e[mw], sit, draws, seed)}
            s['owner'] = sw
        out['strata'][name] = s

    if candidate['p_low'] is not None:
        is_low = (y <= LOW).astype(float)
        out['reliability'] = {}
        for who, m in (('others', ~is_owner[member]), ('owner', is_owner[member])):
            if m.any():
                out['reliability'][who] = {'p_low': _reliability(candidate['p_low'][m], is_low[m]),
                                           'own_share_so_far': _reliability(table['low_share'][m], is_low[m])}
    return out


def floor_measures(table, candidate, floor_err, b0_pred, owner, draws, seed):
    """The calibrator floor of a rank-only candidate. floor_err: per target, the error of the candidate's answers
    with ranks permuted within each view and calibrated, averaged over the permutations. b0_pred: the rounded
    median of the member's history per target, which is rung B0's prediction."""
    member, y = table['member'], table['y']
    n = int(member.max()) + 1 if len(member) else 0
    count = np.bincount(member, minlength=n).astype(float)
    with np.errstate(invalid='ignore', divide='ignore'):
        mean = (lambda e: np.where(count > 0, np.bincount(member, e, minlength=n) / count, np.nan))
        floor, b0 = mean(floor_err), mean(np.abs(b0_pred - y).astype(float))
        rung = mean(np.abs(candidate['pred'] - y).astype(float))
    is_owner = np.zeros(n, bool)
    if owner is not None and owner < n:
        is_owner[owner] = True
    primary = (count >= MIN_TARGETS) & ~is_owner
    vs_b0 = stats.paired(floor[primary], b0[primary], draws, seed)
    out = {'permutations': FLOOR_PERMUTATIONS, 'tolerance': FLOOR_TOLERANCE,
           'others': {'mae': stats.mean_interval(floor[primary], draws, seed), 'vs_b0': vs_b0,
                      'rung_vs_floor': stats.paired(rung[primary], floor[primary], draws, seed),
                      'within_tolerance': bool(vs_b0['diff'] is not None and abs(vs_b0['diff']) <= FLOOR_TOLERANCE)}}
    if is_owner.any() and count[owner] > 0:
        out['owner'] = {'mae': {'value': stats._r(floor[owner])},
                        'vs_b0': {'diff': stats._r(floor[owner] - b0[owner])},
                        'rung_vs_floor': {'diff': stats._r(rung[owner] - floor[owner])}}
    return out
