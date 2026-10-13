"""collab: features that come from other people. Static (rating-free) blocks are cached per process;
label-dependent blocks are computed inside predict from tr_idx/tr_y and D.others(user) only."""
import os, sys, collections
import numpy as np
import scipy.sparse as sp
from sklearn.ensemble import HistGradientBoostingRegressor
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'baselines'))
import gbm_facts

_C = {}
def f(v): return np.nan if v is None else float(v)

def graph(D):
    """Title graph from TMDB recommendations / similar lists. Returns dict of csr adjacency (row -> listed titles)."""
    if 'graph' not in _C:
        k2r = {k: i for i, k in enumerate(D.keys)}
        out = {}
        for name in ('tmdb_recommendation_ids', 'tmdb_similar_ids'):
            r, c, w = [], [], []
            for i, x in enumerate(D.info):
                ids = x[name] or []
                for rank, j in enumerate(ids):
                    jj = k2r.get((x['media_type'], j))
                    if jj is not None and jj != i: r.append(i); c.append(jj); w.append(1.0)
            A = sp.csr_matrix((w, (r, c)), shape=(D.n, D.n)); A.data[:] = 1.0
            out[name[5:8]] = A
        _C['graph'] = out
    return _C['graph']

def disagree(D):
    """Source disagreement and crowd-size facts (rating-free)."""
    if 'dis' not in _C:
        g = lambda c: np.array([f(x.get(c)) for x in D.info])
        imdb, meta, metau = g('imdb_user_score_normalized_percent'), g('metacritic_meta_score_normalized_percent'), g('metacritic_user_score_normalized_percent')
        rtc, rta, tmdb = g('rotten_tomatoes_tomato_score_normalized_percent'), g('rotten_tomatoes_audience_score_normalized_percent'), g('tmdb_user_score_normalized_percent')
        gu, go = g('goodwatch_user_score_normalized_percent'), g('goodwatch_official_score_normalized_percent')
        S = np.vstack([imdb, meta, metau, rtc, rta, tmdb])
        with np.errstate(all='ignore'):
            cols = [rtc - rta, meta - imdb, meta - metau, go - gu, tmdb - imdb, rta - imdb, rtc - meta,
                    np.nanstd(S, axis=0), np.isnan(S).sum(0).astype(float), np.nanmin(S, axis=0), np.nanmax(S, axis=0), gu, go, metau,
                    np.log10(np.maximum(g('imdb_user_score_rating_count'), 1)), np.log10(np.maximum(g('popularity'), 0.01))]
        gr = graph(D)
        cols += [np.log1p(np.asarray(gr['rec'].sum(0)).ravel()), np.log1p(np.asarray(gr['sim'].sum(0)).ravel())]  # in-degree: how often other titles point here
        _C['dis'] = np.vstack(cols).T
    return _C['dis']
DIS_NAMES = ['rt_critic-rt_aud', 'meta-imdb', 'meta-metauser', 'gw_official-gw_user', 'tmdb-imdb', 'rt_aud-imdb', 'rt_critic-meta', 'source_std', 'sources_missing',
             'source_min', 'source_max', 'gw_user', 'gw_official', 'meta_user', 'log_imdb_votes', 'log_popularity', 'rec_indegree', 'sim_indegree']

def graph_emb(D, k=12):
    if ('gemb', k) not in _C:
        gr = graph(D); A = gr['rec'] + gr['sim']; A = A + A.T; A.data[:] = 1.0
        d = np.asarray(A.sum(1)).ravel() + 1.0
        N = sp.diags(d ** -0.5) @ A @ sp.diags(d ** -0.5)
        from scipy.sparse.linalg import svds
        U, s, _ = svds(N.asfptype() if hasattr(N, 'asfptype') else N.astype(float), k=k, random_state=0) if False else svds(N.astype(float), k=k)
        o = np.argsort(-s); U = U[:, o] * s[o]
        U *= np.sign(U[np.abs(U).argmax(0), np.arange(k)])
        _C[('gemb', k)] = U
    return _C[('gemb', k)]

def sig_counts(D, user):
    """How many OTHER members wishlisted / skipped / favorited each title (target member's own signals excluded)."""
    key = ('sig', user)
    if key not in _C:
        cols = []
        for name in ('wishlist', 'skipped', 'favorite'):
            c = np.zeros(D.n)
            for u, t in D.signals[name]:
                if u != user: c[t] += 1
            cols.append(c)
        w, s, fa = cols
        _C[key] = np.vstack([np.log1p(w), np.log1p(s), fa, (w + 1) / (w + s + 2), w + s]).T
    return _C[key]

def others_stats(D, user):
    """Per-title stats of other members' ratings: count, mean, mean z (rater-centered, shrunk)."""
    key = ('ost', user)
    if key not in _C:
        u, t, s = D.others(user)
        uid = {x: i for i, x in enumerate(sorted(set(u)))}; ui = np.array([uid[x] for x in u])
        nu = len(uid)
        cnt = np.bincount(ui, minlength=nu); sm = np.bincount(ui, weights=s, minlength=nu)
        gm = s.mean(); mu = (sm + 5 * gm) / (cnt + 5)                      # shrunk rater mean
        sd = np.sqrt((np.bincount(ui, weights=(s - mu[ui]) ** 2, minlength=nu) + 5 * s.var()) / (cnt + 5))
        z = (s - mu[ui]) / sd[ui]
        R = sp.csr_matrix((s, (ui, t)), shape=(nu, D.n)); Zm = sp.csr_matrix((z, (ui, t)), shape=(nu, D.n)); M = sp.csr_matrix((np.ones(len(s)), (ui, t)), shape=(nu, D.n))
        n = np.asarray(M.sum(0)).ravel()
        with np.errstate(all='ignore'):
            mean = np.asarray(R.sum(0)).ravel() / n; mz = np.asarray(Zm.sum(0)).ravel() / (n + 1.0)
            lo = np.asarray(sp.csr_matrix((s <= 5, (ui, t)), shape=(nu, D.n)).sum(0)).ravel() / n
        mean[n == 0] = np.nan; mz[n == 0] = np.nan; lo[n == 0] = np.nan
        _C[key] = dict(F=np.vstack([np.log1p(n), mean, mz, lo]).T, Z=Zm.tocsc(), M=M.tocsc(), Zr=Zm, Mr=M, n=n)
    return _C[key]

def knn_graph_feats(D, tr_idx, tr_y, rows, base=None):
    """For each row: label statistics of its graph neighbours that the member has rated (training labels only).
    A title is never its own neighbour, so training rows get honest leave-one-out values."""
    gr = graph(D); mu = tr_y.mean()
    res = np.zeros(D.n); has = np.zeros(D.n); res[tr_idx] = tr_y - (mu if base is None else base); has[tr_idx] = 1
    lowv = np.zeros(D.n); lowv[tr_idx] = (tr_y <= 5)
    out = []
    mats = {'rec': gr['rec'], 'sim': gr['sim'], 'in': (gr['rec'] + gr['sim']).T.tocsr()}
    U = mats['rec'] + mats['sim'] + mats['in']; U.data[:] = 1.0; mats['any'] = U
    for name in ('rec', 'sim', 'in', 'any'):
        A = mats[name][rows]
        n = A @ has; s = A @ res
        out += [n, s / (n + 1.0)]                       # count, shrunk mean residual
        if name == 'any':
            out += [(A @ lowv) / (n + 1.0)]
            A2 = (A @ U).tolil(); A2[np.arange(len(rows)), rows] = 0; A2 = A2.tocsr()   # two hops, never back to the title itself
            n2 = A2 @ has; s2 = A2 @ res
            out += [s2 / (n2 + 3.0)]
    return np.vstack(out).T
KG_NAMES = ['rec_n', 'rec_res', 'sim_n', 'sim_res', 'in_n', 'in_res', 'any_n', 'any_res', 'any_low', 'hop2_res']

def cf_feats(D, user, tr_idx, tr_y, rows):
    """User-user ("members who agree with you") and item-item neighbours on other members' ratings.
    Agreement with each other member is measured on training titles only, leaving the predicted title out."""
    O = others_stats(D, user); Z, M = O['Z'], O['M']                       # members x titles (csc)
    mu, sd = tr_y.mean(), tr_y.std() + 1e-6
    zy = np.zeros(D.n); zy[tr_idx] = (tr_y - mu) / sd
    intr = np.zeros(D.n); intr[tr_idx] = 1
    Zt = Z.multiply(intr[None, :]).tocsc()                                # others' z on member's training titles
    agree = np.asarray(Zt @ zy).ravel()                                   # sum over co-rated of z_v * z_u
    absd = np.asarray((M.multiply(intr[None, :])) @ np.ones(D.n)).ravel()  # co-rated count
    Zr, Mr = Z[:, rows].toarray(), M[:, rows].toarray()                    # members x rows
    own = Zr * zy[rows][None, :]                                           # this title's own contribution (0 for test rows)
    a = agree[:, None] - own; c = absd[:, None] - Mr * intr[rows][None, :]
    w = a / (c + 5.0)                                                      # shrunk agreement, leave-one-out
    wp = np.maximum(w, 0)
    num = (wp * Zr).sum(0); den = (wp * Mr).sum(0)
    uu = num / (den + 0.3)
    uus = (w * Zr).sum(0) / (np.abs(w) * Mr).sum(0).clip(1e-9) * (np.abs(w) * Mr).sum(0) / ((np.abs(w) * Mr).sum(0) + 0.3)
    # item-item: similarity between row title and each training title via other members' co-ratings
    Zc = O['Z']; S = (Zc[:, rows].T @ Zt)                                  # rows x titles, sum of z*z over co-raters
    Cn = (M[:, rows].T @ M.multiply(intr[None, :]).tocsc())
    S = S.toarray(); Cn = Cn.toarray()
    S[np.arange(len(rows)), rows] = 0; Cn[np.arange(len(rows)), rows] = 0   # never use the title itself
    sim = S / (Cn + 3.0); simp = np.maximum(sim, 0)
    ii = (simp * zy[None, :]).sum(1) / (simp.sum(1) + 0.5)
    iin = (Cn > 0).sum(1)
    return np.vstack([uu, uus, den, ii, np.log1p(iin)]).T
CF_NAMES = ['uu_pos', 'uu_signed', 'uu_weight', 'ii', 'ii_n']

def build(D, user, tr_idx, tr_y, rows, blocks):
    X = [gbm_facts.features(D)[rows]]
    if 'dis' in blocks: X.append(disagree(D)[rows])
    if 'sig' in blocks: X.append(sig_counts(D, user)[rows])
    if 'ost' in blocks: X.append(others_stats(D, user)['F'][rows])
    if 'gemb' in blocks: X.append(graph_emb(D)[rows])
    if 'kg' in blocks: X.append(knn_graph_feats(D, tr_idx, tr_y, rows))
    if 'cf' in blocks: X.append(cf_feats(D, user, tr_idx, tr_y, rows))
    if 'pool' in blocks: X.append(pooled(D, user)[rows])
    if 'poolz' in blocks: X.append(pooled(D, user)[rows][:, :1])
    if 'kin' in blocks: X.append(kindred(D, user, tr_idx, tr_y, rows))
    for b in blocks:
        if b.startswith('axes'): X.append(taste_axes(D, user, k=int(b[4:] or 4))[rows])
    if 'aud' in blocks: X.append(disagree(D)[rows][:, [11, 13, 14]])       # gw_user, meta_user, log imdb votes
    return np.hstack(X)

def make(blocks, **kw):
    hp = dict(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3); hp.update(kw)
    def predict(D, user, tr_idx, tr_y, te_idx):
        Xtr = build(D, user, tr_idx, tr_y, tr_idx, blocks); Xte = build(D, user, tr_idx, tr_y, te_idx, blocks)
        return HistGradientBoostingRegressor(**hp).fit(Xtr, tr_y).predict(Xte)
    return predict

# ---------- pooled "what members here like" models, fitted on OTHER members only (cached per target member) ----------
def _zscore_others(D, user):
    u, t, s = D.others(user)
    uid = {x: i for i, x in enumerate(sorted(set(u)))}; ui = np.array([uid[x] for x in u]); nu = len(uid)
    cnt = np.bincount(ui, minlength=nu); gm = s.mean()
    mu = (np.bincount(ui, weights=s, minlength=nu) + 5 * gm) / (cnt + 5)
    sd = np.sqrt((np.bincount(ui, weights=(s - mu[ui]) ** 2, minlength=nu) + 5 * s.var()) / (cnt + 5))
    return ui, t, (s - mu[ui]) / sd[ui], cnt

def pooled(D, user, kind='z'):
    """One model over every other member's ratings: predicts how members here rate a title (rater-centred z, and raw)."""
    key = ('pool', user)
    if key not in _C:
        ui, t, z, cnt = _zscore_others(D, user); X = gbm_facts.features(D)
        _, _, s = D.others(user)
        hp = dict(max_depth=3, max_iter=200, learning_rate=0.05, min_samples_leaf=20, l2_regularization=1.0, random_state=3)
        w = 1.0 / np.sqrt(cnt[ui])                                    # heavy raters do not dominate
        gz = HistGradientBoostingRegressor(**hp).fit(X[t], z, sample_weight=w).predict(X)
        glow = HistGradientBoostingRegressor(**hp).fit(X[t], (s <= 5).astype(float), sample_weight=w).predict(X)
        _C[key] = np.vstack([gz, glow]).T
    return _C[key]

def member_models(D, user, least=40):
    """A small taste model per other member (ridge on attributes + public scores); returns titles x members predictions (z units)."""
    key = ('mm', user, least)
    if key not in _C:
        from sklearn.linear_model import Ridge
        ui, t, z, cnt = _zscore_others(D, user); X = gbm_facts.features(D)
        Xi = np.nan_to_num((X - np.nanmean(X, 0)) / (np.nanstd(X, 0) + 1e-9))
        P = []
        for v in np.where(cnt >= least)[0]:
            m = ui == v
            P.append(Ridge(alpha=200.0).fit(Xi[t[m]], z[m]).predict(Xi))
        _C[key] = np.vstack(P).T
    return _C[key]

def kindred(D, user, tr_idx, tr_y, rows):
    """Members whose taste model fits your ratings get more say: agreement-weighted mean of their models' predictions."""
    P = member_models(D, user); zy = (tr_y - tr_y.mean()) / (tr_y.std() + 1e-9)
    Pt = P[tr_idx]; Pc = (Pt - Pt.mean(0)) / (Pt.std(0) + 1e-9)
    c = (Pc * zy[:, None]).mean(0)                                    # correlation of each member's model with your ratings
    w = np.maximum(c, 0) ** 2
    top = np.argsort(-c)[:10]
    return np.vstack([P[rows] @ w / (w.sum() + 1e-9), P[rows][:, top].mean(1), P[rows].mean(1), P[rows].std(1)]).T

# ---------- shared taste axes: low-rank model of how members' tastes differ, learned from OTHER members ----------
def taste_axes(D, user, k=4, lam=300.0, mu=3.0, iters=8):
    """z[v,i] ~ x_i.w0 + a_v.(U'x_i). Returns titles x (1+k): the consensus score and k axes along which members disagree."""
    key = ('axes', user, k, lam, mu)
    if key not in _C:
        from sklearn.linear_model import Ridge
        ui, t, z, cnt = _zscore_others(D, user); X = gbm_facts.features(D)
        Xi = np.nan_to_num((X - np.nanmean(X, 0)) / (np.nanstd(X, 0) + 1e-9)); d = Xi.shape[1]; nu = cnt.shape[0]
        Xr = Xi[t]
        w0 = Ridge(alpha=lam).fit(Xr, z); r = z - w0.predict(Xr)
        rng = np.random.default_rng(0); U = rng.normal(size=(d, k)) / np.sqrt(d); a = np.zeros((nu, k))
        order = np.argsort(ui); bounds = np.searchsorted(ui[order], np.arange(nu + 1))
        for it in range(iters):
            F = Xr @ U
            for v in range(nu):
                m = order[bounds[v]:bounds[v + 1]]
                if len(m) < 3: a[v] = 0; continue
                Fm = F[m]; a[v] = np.linalg.solve(Fm.T @ Fm + mu * np.eye(k), Fm.T @ r[m])
            G = (Xr[:, :, None] * a[ui][:, None, :]).reshape(len(z), d * k)
            U = np.linalg.solve(G.T @ G + lam * np.eye(d * k), G.T @ r).reshape(d, k)
        Q, _ = np.linalg.qr(U)
        _C[key] = np.hstack([w0.predict(Xi)[:, None], Xi @ Q])
    return _C[key]

def make_axes_ridge(k=4, alpha=3.0):
    from sklearn.linear_model import Ridge
    def predict(D, user, tr_idx, tr_y, te_idx):
        T = taste_axes(D, user, k=k); T = T / T.std(0)
        return Ridge(alpha=alpha).fit(T[tr_idx], tr_y).predict(T[te_idx])
    return predict
def blend(pa, pb, w=0.5):
    return lambda D, user, tr_idx, tr_y, te_idx: w * pa(D, user, tr_idx, tr_y, te_idx) + (1 - w) * pb(D, user, tr_idx, tr_y, te_idx)
