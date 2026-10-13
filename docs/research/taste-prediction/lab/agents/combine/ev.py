"""Score ingredient combinations from the component cache: repeated CV, paired differences with bootstrap intervals."""
import os, sys, pickle, glob, numpy as np
import lib
from lib import *
from harness import Data, metrics
import shape
from scipy.optimize import nnls
from sklearn.linear_model import Ridge, LogisticRegression
D = Data(); F = feats(D); OWN = D.owner; USERS = D.users()
_cache = {}
def load(u, s):
    if (u, s) not in _cache: _cache[(u, s)] = pickle.load(open(os.path.join(HERE, 'cache', f'{u[:8]}_{s}.pkl'), 'rb'))
    return _cache[(u, s)]
def point_dist(o, p, y, strict=False):
    cum = {}
    for k in range(1, 10):
        t = y <= k
        if 5 <= t.sum() <= len(t) - 5:
            m = LogisticRegression(C=10).fit(o[:, None], t)
            if strict and m.coef_[0, 0] >= 0: continue          # a higher score must not raise P(rating <= k): fall back to the base rate
            cum[k] = m.predict_proba(p[:, None])[:, 1]
    return shape._to_dist(cum, y, len(p))
KS = np.arange(1, 11)
def decide(Pd, tr_y, alpha, tie=None, lam=0.15):
    wk = shape.band_weights(tr_y, alpha); W = Pd * wk
    med = KS[(W[:, :, None] * np.abs(KS[None, None, :] - KS[None, :, None])).sum(1).argmin(1)]
    return (1 - lam) * med + lam * ((W @ KS) / W.sum(1) if tie is None else tie)
def point(c, tr_idx, y, te_idx, v='A', lin=None, c0=300.0, fr=False, fr_alpha=30.0):
    o, p = c[v]; n = len(y); m = y.mean()
    if lin == 'half':       # structure: plain average with the metric-kernel model
        o, p = 0.5 * o + 0.5 * c['MK'][0], 0.5 * p + 0.5 * c['MK'][1]
    elif lin in ('L2', 'MK'):
        l = n / (n + c0); o, p = l * o + (1 - l) * c[lin][0], l * p + (1 - l) * c[lin][1]
    elif lin is not None:   # 'stack' (text agent) or a '+'-joined list of linear parts, non-negative weights
        parts = ['Rlin_facts', 'Ren', 'Rtags'] if lin == 'stack' else lin.split('+')
        O = np.array([o - m] + [c[k][0] - m for k in parts]).T; P = np.array([p - m] + [c[k][1] - m for k in parts]).T
        w = nnls(O, y - m)[0]; l = n / (n + c0); o, p = l * o + (1 - l) * (m + O @ w), l * p + (1 - l) * (m + P @ w)
    if fr:
        r = y - o; w = np.sqrt(fr_alpha)
        A = np.c_[F['seq'][tr_idx], w * series_effect(F['series'], tr_idx, r, tr_idx, r)]
        B = np.c_[F['seq'][te_idx], w * series_effect(F['series'], tr_idx, r, te_idx, None)]
        mdl = Ridge(alpha=fr_alpha).fit(A, r); o, p = o + mdl.predict(A), p + mdl.predict(B)
    return o, p
def run(u, s, out='cont', alpha=0.5, dv='A', parts='tlp', strict=False, tie=False, eps=0.0, **kw):
    """out: 'cont' continuous, 'round' 0.85 round + 0.15 raw, 'shape' distribution + band-weighted median, 'dist' the distribution"""
    idx, y = D.of(u); C = load(u, s); pred = np.zeros(len(y)); PD = np.zeros((len(y), 10))
    for c in C:
        tr, te = c['tr'], c['te']; o, p = point(c, idx[tr], y[tr], idx[te], **kw); p = np.clip(p, 1, 10)
        if out == 'cont': pred[te] = p
        elif out == 'round': pred[te] = 0.85 * np.round(p) + 0.15 * p
        else:
            ps = []
            if 't' in parts: ps.append(c['dt_' + dv])
            if 'l' in parts: ps.append(c['dl_' + dv])
            if 'p' in parts: ps.append(point_dist(o, p, y[tr], strict))
            P = sum(ps) / len(ps)
            if eps: e = eps if eps > 0 else -eps / (len(tr) - eps); pr = np.bincount(y[tr].astype(int), minlength=11)[1:] + 0.5; P = (1 - e) * P + e * pr / pr.sum()
            PD[te] = P; pred[te] = decide(P, y[tr], alpha, p if tie else None)
    return PD if out == 'dist' else pred
_memo = {}
def preds(seeds_own=(0, 1, 2, 3), seeds_oth=(0, 1), users=None, **kw):
    """{user: [prediction vector per seed]}"""
    key = (seeds_own, seeds_oth, tuple(sorted(kw.items())))
    if key not in _memo: _memo[key] = {u: [run(u, s, **kw) for s in (seeds_own if u == OWN else seeds_oth)] for u in [OWN] + USERS}
    return _memo[key]
def _m(p, y, sel=None):
    if sel is not None: p, y = p[sel], y[sel]
    m = metrics(p, y); return np.array([m['mae'], m['macro_mae'], m['rho'], m['auc_bad'], m['mae_bad']])
NAMES = ['mae', 'macro', 'rho', 'auc_bad', 'mae_bad']
def owner(P): y = D.of(OWN)[1]; return np.mean([_m(p, y) for p in P[OWN]], 0)
def skills(P):
    out = []
    for u in USERS:
        y = D.of(u)[1]; const = np.abs(y - y.mean()).mean(); out.append(np.mean([1 - np.abs(np.clip(p, 1, 10) - y).mean() / const for p in P[u]]))
    return np.array(out)
def rhos(P):
    from scipy.stats import spearmanr
    return np.array([np.mean([spearmanr(p, D.of(u)[1])[0] for p in P[u]]) for u in USERS])
def compare(Pa, Pb, B=400, seed=0):
    """b minus a. Owner: bootstrap over ratings, metrics averaged over split seeds. Others: bootstrap over members of per-member skill."""
    y = D.of(OWN)[1]; rng = np.random.default_rng(seed); n = len(y); d = []
    for _ in range(B):
        s = rng.integers(0, n, n)
        d.append(np.mean([_m(p, y, s) for p in Pb[OWN]], 0) - np.mean([_m(p, y, s) for p in Pa[OWN]], 0))
    d = np.array(d); pt = owner(Pb) - owner(Pa); lo, hi = np.percentile(d, [2.5, 97.5], 0)
    ds = skills(Pb) - skills(Pa); bs = [ds[rng.integers(0, len(ds), len(ds))].mean() for _ in range(2000)]
    return {'owner': {k: (pt[i], lo[i], hi[i]) for i, k in enumerate(NAMES)}, 'skill': (ds.mean(), *np.percentile(bs, [2.5, 97.5])), 'n_better': int((ds > 0).sum())}
def line(name, P):
    o = owner(P); return f"{name:46s} {o[0]:.3f} {o[1]:.3f} {o[2]:.3f} {o[4]:.2f} {o[3]:.3f} | {skills(P).mean():.3f} {rhos(P).mean():.3f}"
def cline(name, r):
    f = lambda t: f"{t[0]:+.3f} [{t[1]:+.3f},{t[2]:+.3f}]"
    return f"{name:40s} mae {f(r['owner']['mae'])} macro {f(r['owner']['macro'])} rho {f(r['owner']['rho'])} auc {f(r['owner']['auc_bad'])} | skill {f(r['skill'])} {r['n_better']}/22"
