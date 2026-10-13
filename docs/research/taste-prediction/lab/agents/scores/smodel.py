"""scores agent: the pooled leader (agents/pooled: hierarchical ridge + tree consensus, blended with per-member trees)
with score feature blocks added as plain columns, and optionally personal "which sources do I follow" coefficients.

make(blocks=(...), tree=150, extra=None, pscale=None, trees=True, tree_blocks=())
  blocks       sfeats block names appended to the 160 pooled columns (consensus weights from the other members, the
               member's own weights shrunk to them)
  extra        'lean'  : the member gets personal slopes on the audience composite and the critic composite,
               'src6'  : personal slopes on each of the six sources,
               drawn from the population distribution of such slopes (EM over the other members), exactly as the
               pooled model treats the member's offset and consensus slope.
  pscale       factor on the six score columns in the personal-weights ridge only (2 = four times less penalty)
  tree_blocks  blocks also given to the per-member trees
"""
import os, sys, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import sfeats
pool = sfeats.pool
_tb = sfeats.load(os.path.join(LAB, 'agents', 'text', 'best.py'), 'text_best')
_C = {}; _TC = {}
SCORE_COLS = ['gw_score', 'imdb', 'metacritic', 'rt_critics', 'rt_audience', 'tmdb']

def extra_cols(D, extra):
    r = sfeats.raw(D)
    if extra == 'lean': return np.c_[r['aud'], np.nan_to_num(r['crit'])]
    if extra == 'gap': return np.c_[np.where(r['has_crit'], r['aud'] - np.nan_to_num(r['crit']), 0.)]
    if extra == 'src6': return np.c_[[np.nan_to_num(r['Z'][s]) for s in sfeats.SRC]].T
    if extra == 'leanq': return np.c_[r['aud'], np.nan_to_num(r['crit']), (r['aud'] ** 2 - 1) / 2]          # + curved response to the audience score
    if extra == 'leans': return np.c_[r['aud'], np.nan_to_num(r['crit']), r['aud'] * (r['show'] - r['show'].mean())]   # + audience weight differs for shows
    if extra == 'src4': return np.c_[np.nan_to_num(r['Z']['imdb']), np.nan_to_num(r['Z']['tmdb']), np.nan_to_num(r['Z']['rta']), np.nan_to_num(r['crit'])]   # three audience sources + critics
    raise ValueError(extra)

def fit(D, user, kind, tree, extra, lam0=300.0):
    """pool.fit_pool (k=0 path) plus extra personal-coefficient columns in the design the EM sees."""
    if extra is None: return pool.fit_pool(D, user, k=0, kind=kind, tree=tree)
    key = (user, kind, tree, extra)
    if key in _C: return _C[key]
    F0 = pool.fit_pool(D, user, k=0, kind=kind, tree=tree); X = F0['X']; p = X.shape[1]
    ou, oi, oy = D.others(user); uid, uinv = np.unique(ou, return_inverse=True); nu = len(uid); cnt = np.bincount(uinv).astype(float); gm = oy.mean()
    # rebuild the rows the EM saw (cross-fitted consensus) exactly as pool.fit_pool does
    b = (np.bincount(uinv, oy) + 3 * gm) / (cnt + 3); gs = np.sqrt(np.mean((oy - b[uinv]) ** 2))
    s = np.sqrt((np.bincount(uinv, (oy - b[uinv]) ** 2) + 5 * gs ** 2) / (cnt + 5)); s = s / np.average(s, weights=cnt)
    Xo = X[oi]; G0 = np.linalg.inv(Xo.T @ Xo + lam0 * np.eye(p)); w0 = np.zeros(p)
    for _ in range(3):
        z = (oy - b[uinv]) / s[uinv]; w0 = G0 @ (Xo.T @ z); r = oy - s[uinv] * (Xo @ w0); b = (np.bincount(uinv, r) + 3 * gm) / (cnt + 3)
    T = F0['T']; Trow = T[oi].copy()
    if tree:
        from sklearn.ensemble import HistGradientBoostingRegressor as H
        z = (oy - b[uinv]) / s[uinv]; fold = (oi * 2654435761 % 1000003) % 5; gsd = (Xo @ w0).std(); gcf = np.zeros(len(oi)); tcf = np.zeros(len(oi))
        mk = lambda: H(max_depth=3, max_iter=tree, learning_rate=0.08, min_samples_leaf=20, l2_regularization=1.0, random_state=0)
        for f in range(5):
            m = fold == f
            gcf[m] = Xo[m] @ np.linalg.solve(Xo[~m].T @ Xo[~m] + lam0 * np.eye(p), Xo[~m].T @ z[~m]) / gsd
            tcf[m] = mk().fit(Xo[~m], z[~m]).predict(Xo[m])
        Trow[:, 1] = gcf; Trow[:, 2] = tcf / tcf.std()
    E = extra_cols(D, extra); T = np.c_[T, E]; Trow = np.c_[Trow, E[oi]]
    mu, Sig, s2, M = pool.em([(Trow[uinv == v], oy[uinv == v]) for v in range(nu)], T.shape[1])
    out = dict(F0); out.update(T=T, mu=mu, Sig=Sig, s2=s2, M=M); _C[key] = out; return out

def pooled_part(D, user, tr_idx, tr_y, te_idx, kind, tree=150, extra=None, pscale=None, own=300.0, ret_coef=False):
    F = fit(D, user, kind, tree, extra); y = np.asarray(tr_y, float)
    c, _ = pool.posterior(F['T'][tr_idx], y, F['mu'], F['Sig'], F['s2']); p = F['T'][te_idx] @ c; w = None
    if len(y) >= 3:
        X = F['X']
        if pscale:
            k = ('ps', pscale)
            if k not in F:
                sc = np.ones(X.shape[1]); sc[[F['names'].index(n) for n in SCORE_COLS]] = pscale; F[k] = X * sc
            X = F[k]
        r = y - F['T'][tr_idx] @ c; A = X[tr_idx]
        if len(y) < X.shape[1]: w = A.T @ np.linalg.solve(A @ A.T + own * np.eye(len(y)), r)
        else: w = np.linalg.solve(A.T @ A + own * np.eye(X.shape[1]), A.T @ r)
        p = p + X[te_idx] @ w
    if ret_coef: return np.clip(p, 1, 10), c, w, F
    return np.clip(p, 1, 10)

def member_trees(D, user, tr_idx, tr_y, te_idx, tree_blocks=()):
    """The text agent's per-member boosted trees (baseline + 51 text columns), cached per split."""
    key = (tree_blocks, hash(np.asarray(tr_idx).tobytes()), hash(np.asarray(te_idx).tobytes()), hash(np.asarray(tr_y).tobytes()))
    if key not in _TC:
        k = ('XP', tree_blocks)
        if k not in _C:
            XP = _tb._setup(D)['XP']
            if tree_blocks: XP = np.c_[XP, np.hstack([sfeats.blocks(D)[b][0] for b in tree_blocks])]
            _C[k] = XP
        XP = _C[k]
        try: _TC[key] = _tb._gbm(XP[tr_idx], np.asarray(tr_y, float), XP[te_idx])
        except ValueError: _TC[key] = np.full(len(te_idx), np.mean(tr_y))
    return _TC[key]

def make(blocks=(), tree=150, extra=None, pscale=None, trees=True, tree_blocks=(), scale=None):
    blocks = tuple(blocks); tree_blocks = tuple(tree_blocks)
    def predict(D, user, tr_idx, tr_y, te_idx):
        kind = sfeats.register(D, blocks, scale=scale) if (blocks or scale) else 'all'
        tr_idx = np.asarray(tr_idx); te_idx = np.asarray(te_idx); n = len(tr_y)
        a = pooled_part(D, user, tr_idx, tr_y, te_idx, kind, tree, extra, pscale)
        if not trees or n < 20: return a
        l = 0.5 * n / (n + 100.0)                              # same blend rule as pooled/preds.py
        return (1 - l) * a + l * member_trees(D, user, tr_idx, tr_y, te_idx, tree_blocks)
    return predict
