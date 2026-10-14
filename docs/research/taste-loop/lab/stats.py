"""Uncertainty for the harness (PLAN.md 2.4).

- Members: a value per member, bootstrap over members (10,000 draws, the seed is in the ledger) for the mean, 95%
  percentile interval, with the median member and, for a paired difference, the count of members improved.
- The owner: one member, so the bootstrap is over the owner's sittings (whole sittings are drawn again). It gives
  an interval only with 10 or more sittings of which none holds more than a quarter of the targets; otherwise the
  number stands as a plain figure and `why` says so. A second, labelled figure resamples whole franchises.
  T2a's separation (a mean over one group of the owner's titles minus the mean over another) follows the same rule.
- Smallest detectable effect: the paired difference this data finds four times out of five with a two-sided 5%
  test: 2.80 standard errors. For members the standard error is the spread of the per-member differences over the
  root of their number; for the owner it is the spread of the bootstrap draws.

Every function is deterministic for a given seed. The same members get the same draws within a run, so two
comparisons on the same members are resampled together.
"""
import numpy as np

Z_POWER = 1.959964 + 0.841621        # two-sided 5%, 80% power
MIN_CLUSTERS = 10
MAX_CLUSTER_SHARE = 0.25
_DRAWS = {}


def _index(n, draws, seed):
    """`draws` resamples of n things, the same for every caller with the same n, draws and seed."""
    key = (n, draws, seed)
    if key not in _DRAWS:
        _DRAWS[key] = np.random.default_rng([seed, n]).integers(0, n, size=(draws, n), dtype=np.int32)
    return _DRAWS[key]


def _r(x):
    return None if x is None or not np.isfinite(x) else round(float(x), 6)


def mean_interval(values, draws, seed):
    """Mean of one value per member with its bootstrap interval."""
    v = np.asarray(values, float)
    n = len(v)
    if n == 0:
        return {'value': None, 'lo': None, 'hi': None, 'n': 0}
    if n == 1:
        return {'value': _r(v[0]), 'lo': None, 'hi': None, 'n': 1}
    boot = v[_index(n, draws, seed)].mean(1)
    lo, hi = np.percentile(boot, [2.5, 97.5])
    return {'value': _r(v.mean()), 'lo': _r(lo), 'hi': _r(hi), 'n': n, 'median': _r(np.median(v))}


def paired(candidate, reference, draws, seed, lower_is_better=True):
    """Candidate minus reference per member: mean, interval, median member, members improved, smallest detectable
    effect. Members where either value is missing are left out."""
    c, r = np.asarray(candidate, float), np.asarray(reference, float)
    ok = np.isfinite(c) & np.isfinite(r)
    d = c[ok] - r[ok]
    n = len(d)
    if n == 0:
        return {'diff': None, 'lo': None, 'hi': None, 'n': 0}
    out = {'diff': _r(d.mean()), 'median': _r(np.median(d)), 'n': n,
           'improved': int((d < 0).sum() if lower_is_better else (d > 0).sum()),
           'worse': int((d > 0).sum() if lower_is_better else (d < 0).sum())}
    if n == 1:
        return {**out, 'lo': None, 'hi': None, 'sde': None}
    boot = d[_index(n, draws, seed)].mean(1)
    lo, hi = np.percentile(boot, [2.5, 97.5])
    return {**out, 'lo': _r(lo), 'hi': _r(hi), 'sde': _r(Z_POWER * d.std(ddof=1) / np.sqrt(n))}


def cluster_mean(values, cluster, draws, seed):
    """Mean over rows (one member's targets) with an interval from resampling whole clusters (sittings, or
    franchises). No interval and no standard error when the clusters cannot carry one: fewer than MIN_CLUSTERS of
    them, or one that holds more than MAX_CLUSTER_SHARE of the rows (drawing such clusters again gives draws with
    two or three humps, and their percentiles are not a 95% interval). `why` then says which."""
    v, cluster = np.asarray(values, float), np.asarray(cluster)
    if len(v) == 0:
        return {'value': None, 'lo': None, 'hi': None, 'n': 0, 'clusters': 0}
    _, inv = np.unique(cluster, return_inverse=True)
    s, k = np.bincount(inv, v), np.bincount(inv).astype(float)
    share = float(k.max() / k.sum())
    out = {'value': _r(v.mean()), 'n': int(len(v)), 'clusters': int(len(s)), 'largest_share': _r(share)}
    why = None
    if len(s) < MIN_CLUSTERS:
        why = f'{len(s)} clusters, fewer than {MIN_CLUSTERS}'
    elif share > MAX_CLUSTER_SHARE:
        why = f'the largest of {len(s)} clusters holds {share:.0%} of the rows'
    if why:
        return {**out, 'lo': None, 'hi': None, 'se': None, 'why': why}
    idx = _index(len(s), draws, seed)
    boot = s[idx].sum(1) / k[idx].sum(1)
    lo, hi = np.percentile(boot, [2.5, 97.5])
    return {**out, 'lo': _r(lo), 'hi': _r(hi), 'se': _r(boot.std(ddof=1))}


def cluster_paired(candidate, reference, cluster, draws, seed):
    """Mean of candidate minus reference over one member's targets, resampling whole clusters. Without an interval
    (see cluster_mean) there is no smallest detectable effect either."""
    d = np.asarray(candidate, float) - np.asarray(reference, float)
    m = cluster_mean(d, cluster, draws, seed)
    out = {'diff': m['value'], 'lo': m.get('lo'), 'hi': m.get('hi'), 'n': m['n'], 'clusters': m['clusters']}
    if m.get('why'):
        out['why'] = m['why']
    out['sde'] = _r(Z_POWER * m['se']) if m.get('se') is not None else None
    return out


def cluster_separation(values, high, low, cluster, draws, seed):
    """One member's rows (T2a: hidden titles): the mean of `values` over the rows in `high` minus the mean over the
    rows in `low`, with an interval from resampling whole clusters, under the rule of cluster_mean (the shares are
    counted over the rows of the two groups). A draw that leaves one group empty is left out."""
    v, high, low = np.asarray(values, float), np.asarray(high, bool), np.asarray(low, bool)
    high, low = high & np.isfinite(v), low & np.isfinite(v)
    out = {'value': None, 'lo': None, 'hi': None, 'se': None, 'n_high': int(high.sum()), 'n_low': int(low.sum()),
           'clusters': 0}
    if not high.any() or not low.any():
        return out
    use = high | low
    _, inv = np.unique(np.asarray(cluster)[use], return_inverse=True)
    x, h, l = v[use], high[use].astype(float), low[use].astype(float)
    sh, kh, sl, kl = np.bincount(inv, x * h), np.bincount(inv, h), np.bincount(inv, x * l), np.bincount(inv, l)
    k = kh + kl
    share = float(k.max() / k.sum())
    out.update(value=_r(sh.sum() / kh.sum() - sl.sum() / kl.sum()), clusters=int(len(k)), largest_share=_r(share))
    if len(k) < MIN_CLUSTERS:
        return {**out, 'why': f'{len(k)} clusters, fewer than {MIN_CLUSTERS}'}
    if share > MAX_CLUSTER_SHARE:
        return {**out, 'why': f'the largest of {len(k)} clusters holds {share:.0%} of the rows'}
    idx = _index(len(k), draws, seed)
    a, b = kh[idx].sum(1), kl[idx].sum(1)
    ok = (a > 0) & (b > 0)
    boot = sh[idx].sum(1)[ok] / a[ok] - sl[idx].sum(1)[ok] / b[ok]
    lo, hi = np.percentile(boot, [2.5, 97.5])
    return {**out, 'lo': _r(lo), 'hi': _r(hi), 'se': _r(boot.std(ddof=1))}
