"""The taste profile: a short ordered list of typed statements, each with an effect in rating points, an interval, the number
of titles behind it, and the member's own titles as examples. The profile IS a predictor: usual rating + sum of statement effects.

Order (each statement is measured on what the statements before it leave unexplained):
  1 quality   'well made' slope and audience-vs-critics lean        (least squares; the lean is shrunk toward zero)
  2 kinds     offset per shared kind of title (six catalog regions) (all at once, shrunk)
  3 facts     sequel and simple title facts                         (greedy, shrunk)
  4 dials     single attributes                                     (greedy, shrunk)
  5 themes    text themes                                           (greedy, shrunk)
  6 trust     how far to trust a high / middling prediction         (descriptive; does not change the prediction)
Shrinkage: every family has a spread tau of true effects estimated from the member's own data (variance of the measured effects
minus their noise); the reported effect is measured * tau^2 / (tau^2 + se^2). A family whose measured effects are no wider than
noise shows nothing. Show rule: 90% interval excludes zero, at least `nmin` titles behind it, effect at least `emin` points."""
import numpy as np
import feats

CFG = dict(z=1.64, nmin=8, emin=0.15, kinds=6, order=('kinds', 'facts', 'themes'), maxn={'facts': 4, 'dials': 4, 'themes': 2, 'genres': 3},
           gap_tau=0.15, strict=True, zq=1.64, min_ratings={}, themes_sel=list(range(16, 32)))   # dials and genres are available but off: they did not replicate on top of kinds

class St:  # one statement
    def __init__(s, **k): s.__dict__.update(k)
    def contrib(s, rows): return s.b * (s.x[rows] - s.c)

def _fam(D, name):
    F = feats.get(D)
    if name == 'facts': return np.c_[F['sequel'], F['facts']], ['a sequel'] + F['fact_names'], True
    if name == 'genres': return F['genres'], F['genre_names'], True
    if name == 'dials': return F['dials'], F['dial_names'], False
    if name == 'themes': return F['themes'], F['theme_names'], False
_hl = {}
def _scale(D, name):
    if name not in _hl:
        X, _, flag = _fam(D, name); _hl[name] = np.ones(X.shape[1]) if flag else feats.hilo(X)
    return _hl[name]
_th = {}
def _thirds(D, name):
    if name not in _th:
        X = _fam(D, name)[0]; _th[name] = np.quantile(X, [1 / 3, 2 / 3], axis=0)
    return _th[name]

def fit(D, idx, y, cfg=None):
    c = dict(CFG); c.update(cfg or {}); F = feats.get(D); n = len(y); S = []; usual = float(y.mean()); sd = float(y.std()) or 1.0
    # ---- 1 quality
    cols = {'well made': F['qm'], 'audiences over critics': F['gap']}; use = list(cols); co = {}
    mr = c['min_ratings']
    if n < mr.get('gap', 0): use.remove('audiences over critics')
    if n < mr.get('quality', 0): use = []
    while use and n >= 8:
        X = np.c_[np.ones(n), *[cols[k][idx] for k in use]]; b = np.linalg.lstsq(X, y, rcond=None)[0]
        s2 = np.sum((y - X @ b) ** 2) / max(n - len(b), 1); se = np.sqrt(s2 * np.diag(np.linalg.pinv(X.T @ X)))
        co = {k: (b[i + 1], se[i + 1]) for i, k in enumerate(use)}
        if 'audiences over critics' in co:                      # the lean is shrunk toward 'no lean'
            bg, sg = co['audiences over critics']; sh = (c['gap_tau'] * sd) ** 2 / ((c['gap_tau'] * sd) ** 2 + sg ** 2); co['audiences over critics'] = (bg * sh, sg * np.sqrt(sh))
        drop = [k for k in use if abs(co[k][0]) / max(co[k][1], 1e-9) < c['zq']] if c['strict'] else []
        if not drop: break
        worst = min(drop, key=lambda k: abs(co[k][0]) / max(co[k][1], 1e-9)); use.remove(worst); co = {}
    for k in ('well made', 'audiences over critics'):
        if k in co: S.append(St(type='quality', key=k, x=cols[k], c=float(cols[k][idx].mean()), b=co[k][0], sd=co[k][1], scale=1.0, n=n, grp=None))
    pred = lambda rows: usual + sum(s.contrib(rows) for s in S)
    r = y - pred(idx)
    for stage in c['order']:
        if n < mr.get(stage, 0): continue
        if stage == 'kinds':
            lab = feats.kinds(D, c['kinds'])[0]; k = c['kinds']; nj = np.bincount(lab[idx], minlength=k).astype(float); m = np.bincount(lab[idx], weights=r, minlength=k) / np.maximum(nj, 1)
            se2 = r.var() / np.maximum(nj, 1); ok = nj >= 3; tau2 = max(np.sum((m[ok] ** 2 - se2[ok]) * nj[ok]) / max(nj[ok].sum(), 1), 0.0)
            sh = tau2 / (tau2 + se2); d = m * sh; psd = np.sqrt(se2 * sh); new = []
            for j in range(k):
                show = nj[j] >= c['nmin'] and psd[j] > 0 and abs(d[j]) / psd[j] >= c['z'] and abs(d[j]) >= c['emin']
                if show or (not c['strict'] and nj[j] > 0):
                    new.append(St(type='kinds', key=j, x=(lab == j).astype(float), c=0.0, b=d[j], sd=psd[j], scale=1.0, n=int(nj[j]), grp=lab == j, shown=show))
            S += new; r = r - sum(s.contrib(idx) for s in new)
            continue
        X, names, flag = _fam(D, stage); sc = _scale(D, stage); th = None if flag else _thirds(D, stage)
        if stage == 'themes' and c.get('themes_sel') is not None:
            sel = np.array(c['themes_sel']); X = X[:, sel]; names = [names[i] for i in sel]; sc = sc[sel]; th = th[:, sel]
        Xa = X[idx]; mu = Xa.mean(0); Xc = Xa - mu; v = np.maximum((Xc ** 2).sum(0), 1e-9)
        if flag: cnt = np.minimum((Xa > 0).sum(0), (Xa <= 0).sum(0))
        else: cnt = np.minimum((Xa <= th[0]).sum(0), (Xa >= th[1]).sum(0))
        okc = cnt >= c['nmin']; tau2 = None; taken = set()
        for step in range(c['maxn'].get(stage, 3)):
            b = Xc.T @ (r - r.mean()) / v; se2 = r.var() / v
            if tau2 is None:                                    # spread of true effects in this family, fixed at the first step
                tau2 = max(np.mean((b[okc] ** 2 - se2[okc]) * sc[okc] ** 2), 0.0) if okc.any() else 0.0
            sh = (tau2 / sc ** 2) / (tau2 / sc ** 2 + se2); d = b * sh; psd = np.sqrt(se2 * sh); z = np.where(psd > 0, np.abs(d) / np.maximum(psd, 1e-12), 0)
            z[~okc] = 0; z[list(taken)] = 0; z[np.abs(d * sc) < c['emin']] = 0
            j = int(np.argmax(z))
            if z[j] < c['z']: break
            taken.add(j); grp = (X[:, j] > 0) if flag else (X[:, j] >= th[1][j]); low = None if flag else (X[:, j] <= th[0][j])
            s = St(type=stage, key=names[j], x=X[:, j], c=float(mu[j]), b=d[j], sd=psd[j], scale=float(sc[j]), n=int(cnt[j]), grp=grp, low=low, shown=True)
            S.append(s); r = r - s.contrib(idx)
    P = Profile(D, S, usual, sd, idx, y, c); return P

class Profile:
    def __init__(s, D, S, usual, sd, idx, y, cfg):
        s.D, s.S, s.usual, s.sd, s.idx, s.y, s.cfg = D, S, usual, sd, idx, y, cfg
        # ---- 6 trust: how the member actually rated titles by third of the profile's own prediction
        p = s.predict(idx); s.cut = np.quantile(p, [1 / 3, 2 / 3]) if len(y) >= 12 else None; s.low_at = np.floor(usual - 1.5 * sd)
        if np.mean(y <= s.low_at) < 0.05: s.low_at = np.floor(np.quantile(y, 0.15))   # 'low' = clearly below this member's usual
        s.trust = s.bands(idx, y) if s.cut is not None and p.std() > 1e-9 else None
    def predict(s, rows): return np.clip(s.usual + sum((st.contrib(rows) for st in s.S), np.zeros(len(rows))), 1, 10)
    def bands(s, rows, y):
        p = s.predict(rows); out = []
        for m in (p >= s.cut[1], (p < s.cut[1]) & (p > s.cut[0]), p <= s.cut[0]):
            out.append(dict(n=int(m.sum()), mean=float(y[m].mean()) if m.any() else np.nan, low=float((y[m] <= s.low_at).mean()) if m.any() else np.nan,
                            err=float(np.abs(y[m] - p[m]).mean()) if m.any() else np.nan, pred=float(p[m].mean()) if m.any() else np.nan))
        return out
    def effect(s, st): return st.b * st.scale, (st.b - 1.645 * st.sd) * st.scale, (st.b + 1.645 * st.sd) * st.scale

def holdout(P, idx_h, y_h):
    """Re-measure every statement of profile P on ratings it has not seen. Returns rows (type, key, claim, claim sd, held-out effect, its se, n train, n held out), in points."""
    F = feats.get(P.D); out = []; q = [s for s in P.S if s.type == 'quality']
    if q and len(y_h) >= 8:
        X = np.c_[np.ones(len(y_h)), *[s.x[idx_h] for s in q]]; b = np.linalg.lstsq(X, y_h, rcond=None)[0]
        s2 = np.sum((y_h - X @ b) ** 2) / max(len(y_h) - len(b), 1); se = np.sqrt(s2 * np.diag(np.linalg.pinv(X.T @ X)))
        for i, s in enumerate(q): out.append((s.key if s.key == 'audiences over critics' else 'quality', s.key, s.b, s.sd, b[i + 1], se[i + 1], s.n, len(y_h)))
    r = y_h - (P.usual + sum((s.contrib(idx_h) for s in q), np.zeros(len(y_h))))
    kin = [s for s in P.S if s.type == 'kinds']
    for s in kin:
        m = s.grp[idx_h]
        if getattr(s, 'shown', True) and m.sum() >= 3: out.append(('kinds', s.key, s.b, s.sd, r[m].mean(), r.std() / np.sqrt(m.sum()), s.n, int(m.sum())))
    r = r - sum((s.contrib(idx_h) for s in kin), np.zeros(len(y_h)))
    for s in P.S:
        if s.type in ('quality', 'kinds'): continue
        x = s.x[idx_h]; xc = x - x.mean(); v = (xc ** 2).sum()
        if v > 1e-9:
            nh = int(min((x > 0).sum(), (x <= 0).sum())) if s.low is None else int(min(s.grp[idx_h].sum(), s.low[idx_h].sum()))
            out.append((s.type if s.key != 'a sequel' else 'sequel', s.key, s.b * s.scale, s.sd * s.scale, (xc @ (r - r.mean()) / v) * s.scale, r.std() / np.sqrt(v) * s.scale, s.n, nh))
        r = r - s.contrib(idx_h)
    return out
