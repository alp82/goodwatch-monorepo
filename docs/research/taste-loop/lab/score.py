"""From a predictor's answers to the numbers in the ledger: the contract check, the one output convention, and the
T1 measures (PLAN.md 2.2 and 2.4).

Contract. `predict(view)` returns a dict with nothing but `rank`, `score` and `p_low`. `rank` is required: one
finite number per target, higher is shown earlier. `score` is None or one finite number per target; the harness
clips it to 1..10 and rounds it (halves up). `p_low` is None or one number in 0..1 per target. A predictor gives
`score` (or `p_low`) for every view or for none. Anything else fails the run.

A scorer without `score` gets one from the calibrator: an isotonic (monotone, least squares) fit of rating on rank
over the member's history only. The ranks of history titles come from calibration views, in which a fifth of the
history is hidden and predicted from the rest, so no title is ranked by a taste built with its own rating. With
fewer than 10 such pairs, or when the scorer gives every history title the same rank, the calibrated score is the
median of the member's history, which is rung B0.
"""
import numpy as np

import stats

MIN_TARGETS = 10                     # members in the primary measure
MIN_CALIBRATION_PAIRS = 10
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
    return out


def to_rating(score):
    """The number compared: clipped to 1..10, rounded to a whole rating, halves up."""
    return np.floor(np.clip(np.asarray(score, float), 1, 10) + 0.5).astype(np.int64)


def isotonic(x, y):
    """Least-squares non-decreasing fit of y on x. Returns the distinct x and the fitted value at each."""
    ux, inv = np.unique(np.asarray(x, float), return_inverse=True)
    w = np.bincount(inv).astype(float)
    v = np.bincount(inv, np.asarray(y, float)) / w
    vals, wts, size = [], [], []
    for a, b in zip(v.tolist(), w.tolist()):
        vals.append(a), wts.append(b), size.append(1)
        while len(vals) > 1 and vals[-2] > vals[-1]:
            tw = wts[-2] + wts[-1]
            vals[-2:] = [(vals[-2] * wts[-2] + vals[-1] * wts[-1]) / tw]
            wts[-2:] = [tw]
            size[-2:] = [size[-2] + size[-1]]
    return ux, np.repeat(vals, size)


def calibrated(rank, cal_rank, cal_score, history_score):
    """A score for each target rank from the member's history: see the module text."""
    cal_rank, cal_score = np.asarray(cal_rank, float), np.asarray(cal_score, float)
    if len(cal_rank) < MIN_CALIBRATION_PAIRS or len(np.unique(cal_rank)) < 2:
        return np.full(len(rank), np.median(history_score))
    ux, fit = isotonic(cal_rank, cal_score)
    return np.interp(rank, ux, fit)


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
           'mae_mid': mean_where((y >= 6) & (y <= 7)), 'mae_high': mean_where(y >= 8)}
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


LOWER_IS_BETTER = {'mae': True, 'mae_low': True, 'mae_mid': True, 'mae_high': True, 'brier': True,
                   'pair_acc': False, 'low_auc': False}


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
    return s


def t1_measures(table, candidate, refs, owner, draws, seed):
    """table: one row per target (member, view, y, sitting, same_sitting, block, media, provenance,
    has_fingerprint, old_title, low_share) plus provenance_names. candidate and each of refs (name -> ...) are
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
        sit = table['sitting'][at]
        err = np.abs(candidate['pred'][at] - y[at]).astype(float)
        w = {'n_targets': int(at.sum()), 'sittings': int(len(np.unique(sit))),
             'mae': stats.cluster_mean(err, sit, draws, seed)}
        for name, mask in (('mae_low', y[at] <= LOW), ('mae_mid', (y[at] >= 6) & (y[at] <= 7)),
                           ('mae_high', y[at] >= 8)):
            w[name] = stats.cluster_mean(err[mask], sit[mask], draws, seed)
        for name in ('pair_acc', 'low_auc', 'brier', 'brier_ref'):
            if name in cv:
                w[name] = {'value': stats._r(cv[name][owner])}
        w['vs'] = {}
        for ref, r in refs.items():
            rerr = np.abs(r['pred'][at] - y[at]).astype(float)
            d = {'mae': stats.cluster_paired(err, rerr, sit, draws, seed)}
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
