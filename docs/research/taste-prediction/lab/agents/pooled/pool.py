"""pooled: one model learned across members, the member enters through a few numbers.

Model (fitted on D.others(user) only, cached in process memory per predicted member):

    rating[v, i] = b_v + beta_v * g_i + a_v . (U' x_i) + noise
    g_i = x_i . w0            the members' consensus score of title i (population weights w0 on the title features)
    U                         k shared "taste axes" (directions in title-feature space along which members differ)
    c_v = (b_v, beta_v, a_v)  ~ Normal(mu, Sigma)   the member's taste, shrunk to the population

mu, Sigma and the noise variance are estimated by EM over the other members. For the predicted member c is the
posterior mean given tr_idx/tr_y only: a closed form that works from 1 rating on (it starts at the population taste mu).
"""
import os, sys, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(LAB, 'baselines'))
import gbm_facts
_C = {}

def base_names(D):
    genres = sorted({g for x in D.info for g in (x['genres'] or [])})
    return (list(D.fp_keys) + ['gw_score', 'imdb', 'metacritic', 'rt_critics', 'rt_audience', 'tmdb', 'year', 'is_show', 'lang_en', 'lang_ja', 'log_votes']
            + ['genre:' + g for g in genres])

def feats(D, kind='all'):
    """Standardized title features, no ratings involved. kind: 'fp' (74 attributes), 'base' (gbm_facts columns), 'all' (+ 51 text columns)."""
    if kind not in _C:
        B = gbm_facts.features(D)
        if kind == 'fp': X = D.Z.copy(); names = list(D.fp_keys)
        else:
            X = B; names = base_names(D)
            if kind == 'all':
                t = np.load(os.path.join(LAB, 'agents', 'text', 'text_feats.npz'))
                X = np.c_[X, t['flags'], t['pca_en'], t['tags_svd'][:, :16], t['tfidf_svd']]
                names = names + ['sequel_kw', 'sequel_title', 'in_series'] + ['emb%d' % i for i in range(16)] + ['tag%d' % i for i in range(16)] + ['txt%d' % i for i in range(16)]
        X = np.where(np.isnan(X), np.nanmean(X, 0), X); X = (X - X.mean(0)) / (X.std(0) + 1e-9)
        _C[kind] = (X.astype(np.float64), names)
    return _C[kind]

def _ridge(A, y, lam):
    if A.shape[0] < A.shape[1]: return A.T @ np.linalg.solve(A @ A.T + lam * np.eye(A.shape[0]), y)
    return np.linalg.solve(A.T @ A + lam * np.eye(A.shape[1]), A.T @ y)

def em(groups, q, iters=30, diag=False):
    """Random-coefficient model y_v = T_v c_v + e, c_v ~ N(mu, Sigma), e ~ N(0, s2). groups: list of (T_v, y_v)."""
    mu = np.zeros(q); mu[0] = np.mean(np.concatenate([y for _, y in groups])); Sig = np.eye(q); s2 = 2.0
    N = sum(len(y) for _, y in groups)
    TT = np.array([T.T @ T for T, _ in groups]); Ty = np.array([T.T @ y for T, y in groups]); yy = sum(y @ y for _, y in groups)
    for _ in range(iters):
        Si = np.linalg.inv(Sig); S = np.linalg.inv(Si[None] + TT / s2)
        M = np.einsum('vij,vj->vi', S, (Si @ mu)[None] + Ty / s2)
        rss = yy - 2 * (M * Ty).sum() + np.einsum('vi,vij,vj->', M, TT, M) + np.einsum('vij,vji->', TT, S)
        mu = M.mean(0); d = M - mu
        Sig = (d.T @ d + S.sum(0)) / len(groups)
        if diag: Sig = np.diag(np.diag(Sig))
        Sig += 1e-6 * np.eye(q); s2 = rss / N
    return mu, Sig, s2, M

def _grams(D, kind):
    """X_v' X_v over each member's rated titles: depends on which titles a member rated, never on a rating value.
    Only other members' grams are used when predicting a member."""
    if ('gram', kind) not in _C:
        X = feats(D, kind)[0]; _C[('gram', kind)] = {u: X[[r[1] for r in rs]].T @ X[[r[1] for r in rs]] for u, rs in D._by.items()}
    return _C[('gram', kind)]

def posterior(T, y, mu, Sig, s2):
    Si = np.linalg.inv(Sig); S = np.linalg.inv(Si + T.T @ T / s2)
    return S @ (Si @ mu + T.T @ y / s2), S

def fit_pool(D, user, k=5, kind='all', lam0=300.0, lam_m=200.0, lam_u=30.0, lam_a=3.0, als=4, min_n=1, basis='learn', scale=True, diag=False, tree=0, cf=False, std=False):
    """Everything learned from the other members. Returns dict with T (titles x (2+k) design: 1, consensus, axes), mu, Sig, s2, w0, U."""
    key = ('pool', user, k, kind, lam0, lam_m, lam_u, lam_a, als, min_n, basis, scale, diag, tree, cf, std)
    if key in _C: return _C[key]
    X, names = feats(D, kind); p = X.shape[1]
    ou, oi, oy = D.others(user)
    uid, uinv = np.unique(ou, return_inverse=True); nu = len(uid); cnt = np.bincount(uinv).astype(float)
    gm = oy.mean()
    # member offset and scale, shrunk to the population (pseudo-counts)
    b = (np.bincount(uinv, oy) + 3 * gm) / (cnt + 3)
    gs = np.sqrt(np.mean((oy - b[uinv]) ** 2))
    s = np.sqrt((np.bincount(uinv, (oy - b[uinv]) ** 2) + 5 * gs ** 2) / (cnt + 5)) if scale else np.ones(nu)
    snorm = np.average(s, weights=cnt); s = s / snorm
    w0 = np.zeros(p); GR = _grams(D, kind); Xo = X[oi]
    G0 = np.linalg.inv(sum(GR[v] for v in uid) + lam0 * np.eye(p))
    for _ in range(3):                                   # consensus weights and member offsets, alternating
        z = (oy - b[uinv]) / s[uinv]; w0 = G0 @ (Xo.T @ z)
        r = oy - s[uinv] * (X[oi] @ w0); b = (np.bincount(uinv, r) + 3 * gm) / (cnt + 3)
    g = X @ w0; g = g / g[oi].std()                       # consensus score, unit spread over rated rows
    # what the consensus leaves unexplained, in member-scale units
    slope = np.ones(nu)
    r = (oy - b[uinv]) / s[uinv] - (X[oi] @ w0)
    U = np.zeros((p, 0)); Wc = None
    if k == 0 or basis == 'pca':                         # second moment of the members' own (shrunk) weights on what the consensus leaves
        W = []; wt = []
        for v in range(nu):
            if cnt[v] < 15: continue
            m = uinv == v; W.append(np.linalg.solve(GR[uid[v]] + lam_m * np.eye(p), Xo[m].T @ (r[m] - r[m].mean()))); wt.append(np.sqrt(cnt[v]))
        W = np.array(W) * np.array(wt)[:, None]; Wc = W.T @ W / np.sum(np.array(wt) ** 2)
    if k > 0:
        if basis == 'pca':                               # rating-free basis: principal directions of the rated titles
            Xc = X[np.unique(oi)]; _, _, Vt = np.linalg.svd(Xc - Xc.mean(0), full_matrices=False); U = Vt[:k].T
        else:
            W = []; wt = []
            for v in range(nu):
                if cnt[v] < 15: continue
                m = uinv == v; W.append(np.linalg.solve(GR[uid[v]] + lam_m * np.eye(p), Xo[m].T @ (r[m] - r[m].mean()))); wt.append(np.sqrt(cnt[v]))
            W = np.array(W) * np.array(wt)[:, None]
            _, _, Vt = np.linalg.svd(W, full_matrices=False); U = Vt[:k].T
            Wc = W.T @ W / np.sum(np.array(wt) ** 2)
            for _ in range(als):                         # reduced-rank regression by alternating ridge
                P = X @ U; P = P / P[oi].std(0); A = np.zeros((nu, k)); c0 = np.zeros(nu)
                for v in range(nu):
                    m = uinv == v; Tv = P[oi[m]]; rv = r[m]; c0[v] = rv.sum() / (cnt[v] + 3)
                    A[v] = _ridge(Tv, rv - c0[v], lam_a)
                G = np.zeros((k * p, k * p)); h = np.zeros(k * p)   # normal equations of the (a_v kron x_i) design, member by member
                for v in range(nu):
                    m = uinv == v; Xv = X[oi[m]]
                    G += np.kron(np.outer(A[v], A[v]), Xv.T @ Xv); h += np.kron(A[v], Xv.T @ (r[m] - c0[v]))
                U = np.linalg.solve(G + lam_u * np.eye(k * p), h).reshape(k, p).T
                U, _ = np.linalg.qr(U)
            # order and orient the axes: by spread of member coefficients
        P = X @ U; P = (P - P[oi].mean(0)) / P[oi].std(0)
    else: P = np.zeros((D.n, 0))
    T = np.c_[np.ones(D.n), g, P]; Trow = T[oi]
    if tree or cf:
        # consensus scores of a rated title must not have seen that title's ratings when the population spread is estimated:
        # cross-fit over titles (5 folds) for the rows the EM sees; the all-data fit is used for prediction.
        z = (oy - b[uinv]) / s[uinv]; fold = (oi * 2654435761 % 1000003) % 5; gsd = (X[oi] @ w0).std()
        gcf = np.zeros(len(oi)); tcf = np.zeros(len(oi))
        if tree:
            from sklearn.ensemble import HistGradientBoostingRegressor as H
            mk = lambda: H(max_depth=3, max_iter=tree, learning_rate=0.08, min_samples_leaf=20, l2_regularization=1.0, random_state=0)
            gt = mk().fit(Xo, z).predict(X)
        for f in range(5):
            m = fold == f
            gcf[m] = Xo[m] @ np.linalg.solve(Xo[~m].T @ Xo[~m] + lam0 * np.eye(p), Xo[~m].T @ z[~m]) / gsd
            if tree: tcf[m] = mk().fit(Xo[~m], z[~m]).predict(Xo[m])
        Trow = Trow.copy(); Trow[:, 1] = gcf
        if tree:
            tsd = tcf.std(); T = np.c_[T, gt / tsd]; Trow = np.c_[Trow, tcf / tsd]
    q = T.shape[1]
    ys = oy / s[uinv] if std else oy                      # std: the whole model lives in units of the member's own spread
    groups = [(Trow[uinv == v], ys[uinv == v]) for v in range(nu) if cnt[v] >= min_n]
    mu, Sig, s2, M = em(groups, q, diag=diag)
    out = {'T': T, 'mu': mu, 'Sig': Sig, 's2': s2, 'w0': w0, 'U': U, 'M': M, 'cnt': cnt[cnt >= min_n], 'names': names, 'X': X, 'Wc': Wc, 'std': std, 'gm': gm, 'gs': gs, 'snorm': snorm, 'uid': uid[cnt >= min_n]}
    _C[key] = out; return out

def _prior(F, prior, rho):
    """Prior covariance of a member's personal weights (up to scale): identity, or identity plus how members were seen to differ."""
    key = ('prior', prior, rho)
    if key not in F:
        p = F['X'].shape[1]; C = F['Wc'] * p / np.trace(F['Wc'])
        if prior == 'diag': S = (1 - rho) * np.eye(p) + rho * np.diag(np.diag(C))
        else: S = (1 - rho) * np.eye(p) + rho * C
        F[key] = F['X'] @ np.linalg.cholesky(S)            # X S X' = (X L)(X L)'
    return F[key]

def pooled_predict(D, user, tr_idx, tr_y, te_idx, own=0.0, prior='iso', rho=0.5, **kw):
    """own > 0: after the low-dimensional taste, a ridge on all title features explains what is left (penalty `own`):
    the member's weights are free in every direction but shrunk to the pooled ones (hierarchical ridge).
    prior 'cov'/'diag': directions in which other members differ from the consensus are penalised less."""
    F = fit_pool(D, user, **kw); y = np.asarray(tr_y, float); sc = 1.0
    if F['std']:                                         # the member's spread, shrunk to the population spread exactly as for the other members
        n = len(y); b = (y.sum() + 3 * F['gm']) / (n + 3); sc = np.sqrt((np.sum((y - b) ** 2) + 5 * F['gs'] ** 2) / (n + 5)) / F['snorm']; y = y / sc
    c, _ = posterior(F['T'][tr_idx], y, F['mu'], F['Sig'], F['s2'])
    p = F['T'][te_idx] @ c
    if own > 0 and len(y) >= 3:
        X = F['X'] if prior == 'iso' else _prior(F, prior, rho); r = y - F['T'][tr_idx] @ c; A = X[tr_idx]
        if len(y) < X.shape[1]: p = p + X[te_idx] @ (A.T @ np.linalg.solve(A @ A.T + own * np.eye(len(y)), r))
        else: p = p + X[te_idx] @ np.linalg.solve(A.T @ A + own * np.eye(X.shape[1]), A.T @ r)
    return np.clip(p * sc, 1, 10)

def make(**kw):
    return lambda D, user, tr_idx, tr_y, te_idx: pooled_predict(D, user, tr_idx, tr_y, te_idx, **kw)
