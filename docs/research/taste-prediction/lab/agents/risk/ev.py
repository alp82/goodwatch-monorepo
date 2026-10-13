"""risk agent: repeated cross-validation of rating-distribution models on cached point scores (owner + 22 members).

    python3 ev.py name1 name2 ...     runs the named configs (CONFIGS in configs.py), 3 processes, results in cache/res_<name>.pkl
"""
import os, sys, pickle, numpy as np
import common, om, feats as FE
from sklearn.linear_model import LogisticRegression
HERE = common.HERE; EPS = 0.03; KS = np.arange(1, 11); LAM, CAP = 0.15, 8.0
_g = {}

def G():
    if not _g:
        import harness
        D = harness.Data(); _g['D'] = D; X = FE.get(D); _g['X'] = (X - X.mean(0)) / X.std(0); _g['names'] = list(FE.NAMES)
        _g['cheap'] = pickle.load(open(os.path.join(HERE, 'cache', 'cheap.pkl'), 'rb'))
        _g['users'] = [D.owner] + D.users()
    return _g

def fm(names, idx, dis, sc=None):
    """columns for title rows idx; 'dis' = linear minus trees (member-specific), 'abs_dis' its size"""
    g = G(); cols = []
    for nm in names:
        if nm == 'dis': cols.append(dis / 0.5)
        elif nm == 'score': cols.append(sc - 7.0)
        elif nm == 'abs_dis': cols.append((np.abs(dis) - 0.4) / 0.3)
        else: cols.append(g['X'][idx, g['names'].index(nm)])
    return np.array(cols).T.reshape(len(idx), len(names))

def prior_mix(P, y):
    pr = np.bincount(np.asarray(y).astype(int), minlength=11)[1:] + 0.5; return (1 - EPS) * P + EPS * pr / pr.sum()

def thr_dist(o, y, p):
    """the round-2 form: one logistic model per threshold on the score alone (combine agent)"""
    n = len(p); C = np.zeros((n, 11)); C[:, 10] = 1; prev = np.zeros(n)
    for k in range(1, 10):
        t = y <= k; c = np.full(n, t.mean())
        if 5 <= t.sum() <= len(t) - 5:
            m = LogisticRegression(C=10).fit(o[:, None], t)
            if m.coef_[0, 0] < 0: c = m.predict_proba(p[:, None])[:, 1]
        prev = np.maximum(prev, c); C[:, k] = prev
    return np.diff(C, axis=1)

def decide(Pd, tr_y, alpha, tie):
    band = lambda v: np.where(v <= 5, 0, np.where(v <= 7, 1, 2))
    c = np.bincount(band(np.asarray(tr_y)), minlength=3).astype(float); wk = (np.minimum(len(tr_y) / (3 * np.maximum(c, 1)), CAP) ** alpha)[band(KS)]
    W = Pd * wk; med = KS[(W[:, :, None] * np.abs(KS[None, None, :] - KS[None, :, None])).sum(1).argmin(1)]
    return (1 - LAM) * med + LAM * tie

_base = {}
def cheap_base(v, use_c):
    """member v's base ordinal fit on their cheap out-of-fold score (no inputs)"""
    if (v, use_c) not in _base:
        c = G()['cheap'][v]; s = common.blend(c['ol'], c['ot'], len(c['y'])); _base[(v, use_c)] = (om.fit(s, c['y'], use_c=use_c), s)
    return _base[(v, use_c)]

def pool_prior(u, cfg):
    """population values of the input effects, from every member but u"""
    g = G(); groups = []
    for v, c in g['cheap'].items():
        if v == u: continue
        par, s = cheap_base(v, cfg.get('use_c', True)); d = c['ol'] - c['ot']
        groups.append((par, s, c['y'], fm(cfg['L'], c['idx'], d, s), fm(cfg['S'], c['idx'], d, s), fm(cfg['T'], c['idx'], d, s)))
    return om.fit_shared(groups, len(cfg['L']), len(cfg['S']), len(cfg['T']), lam=cfg.get('lam_pool', (1., 1., 1.)))

def model_dist(cfg, u, tr_idx, y, o, do, te_idx, p, dp, prior=None):
    """P(rating = 1..10) for te_idx. o/do: out-of-fold score and linear-minus-trees on the visible ratings; p/dp: same for the titles to predict."""
    if cfg['form'] == 'hist': P = np.zeros((len(p), 10))
    elif cfg['form'] == 'thr': P = thr_dist(o, y, p)
    else:
        L, S, T = cfg.get('L', []), cfg.get('S', []), cfg.get('T', [])
        lam = cfg.get('lam', (5., 5., 5.))
        if cfg.get('prior') == 'fixed': lam = (1e6, 1e6, 1e6)
        m = om.fit(o, y, fm(L, tr_idx, do, o), fm(S, tr_idx, do, o), fm(T, tr_idx, do, o), lam=lam, prior=prior, use_c=cfg.get('use_c', True))
        P = om.dist(m, p, fm(L, te_idx, dp, p), fm(S, te_idx, dp, p), fm(T, te_idx, dp, p))
    return prior_mix(P, y) if cfg['form'] != 'hist' else prior_mix(P, y) / EPS

def run_user(args):
    cfg, u = args; g = G(); B = pickle.load(open(os.path.join(HERE, 'cache', f'base_{u[:8]}.pkl'), 'rb'))
    idx, y = B['idx'], B['y']; n = len(y); seeds = sorted({k[0] for k in B['folds']})[:cfg.get('seeds', 3)]
    prior = pool_prior(u, cfg) if cfg.get('prior') in ('pool', 'fixed') else None
    P = np.zeros((len(seeds), n, 10)); pred = np.zeros((len(seeds), n)); sc = np.zeros((len(seeds), n))
    for si, seed in enumerate(seeds):
        for f in range(5):
            c = B['folds'][(seed, f)]; tr, te = c['tr'], c['te']; ni = int(len(tr) * 0.8)
            o = common.blend(c['ol'], c['ot'], ni); p = common.blend(c['pl'], c['pt'], len(tr))
            if cfg.get('src') == 'lin': o, p = c['ol'], c['pl']      # positive control: hide the tree part from the score
            P[si, te] = model_dist(cfg, u, idx[tr], y[tr], o, c['ol'] - c['ot'], idx[te], p, c['pl'] - c['pt'], prior)
            pred[si, te] = decide(P[si, te], y[tr], cfg.get('alpha', 0.5), p); sc[si, te] = p
    return u, dict(P=P, pred=pred, score=sc, y=y, idx=idx, prior=prior)

def run(name, cfg, procs=3):
    p = os.path.join(HERE, 'cache', f'res_{name}.pkl')
    if os.path.exists(p): return pickle.load(open(p, 'rb'))
    g = G(); import multiprocessing as mp
    with mp.Pool(procs) as pl: out = dict(pl.map(run_user, [(cfg, u) for u in g['users']], chunksize=1))
    pickle.dump(out, open(p, 'wb')); return out

# ---------- measures
def per_rating(r):
    """per rating, averaged over split seeds: log loss of the ten-way distribution, Brier of P(<=5) and of P(>=8)"""
    y = r['y'].astype(int); P = r['P']; n = len(y)
    ll = -np.log(P[:, np.arange(n), y - 1]).mean(0); b5 = ((P[:, :, :5].sum(2) - (y <= 5)) ** 2).mean(0); b8 = ((P[:, :, 7:].sum(2) - (y >= 8)) ** 2).mean(0)
    return ll, b5, b8
def auc(score, pos):
    if pos.sum() == 0 or (~pos).sum() == 0: return np.nan
    a, b = score[pos], score[~pos]; return float((a[:, None] > b[None, :]).mean() + 0.5 * (a[:, None] == b[None, :]).mean())
def summary(r):
    import harness
    y = r['y']; ll, b5, b8 = per_rating(r); risk = r['P'][:, :, :5].sum(2)
    ms = [harness.metrics(p, y) for p in r['pred']]
    return dict(ll=ll.mean(), b5=b5.mean(), b8=b8.mean(), auc=np.nanmean([auc(x, y <= 5) for x in risk]), mae=np.mean([m['mae'] for m in ms]),
                macro=np.mean([m['macro_mae'] for m in ms]), mae_bad=np.mean([m['mae_bad'] or np.nan for m in ms]), pred_bad=np.mean([m['pred_bad'] or np.nan for m in ms]),
                rho=np.mean([m['rho'] for m in ms]), skill=1 - np.mean([m['mae'] for m in ms]) / np.abs(y - y.mean()).mean())
def compare(res, base, owner):
    """paired differences res - base (negative = better): owner mean, se over ratings; others mean, se over the 22 members"""
    out = {}
    for j, nm in enumerate(('ll', 'b5', 'b8')):
        d = per_rating(res[owner])[j] - per_rating(base[owner])[j]
        do = np.array([(per_rating(res[u])[j] - per_rating(base[u])[j]).mean() for u in res if u != owner])
        out[nm] = (d.mean(), d.std(ddof=1) / np.sqrt(len(d)), do.mean(), do.std(ddof=1) / np.sqrt(len(do)), int((do < 0).sum()))
    return out
def line(name, res, base, owner):
    s = summary(res[owner]); so = [summary(res[u]) for u in res if u != owner]; c = compare(res, base, owner) if base is not None else None
    t = f"{name:26s} OWNER ll {s['ll']:.4f} b5 {s['b5']:.4f} b8 {s['b8']:.4f} auc {s['auc']:.3f} mae {s['mae']:.3f} macro {s['macro']:.3f} bad {s['mae_bad']:.2f}/{s['pred_bad']:.2f} | OTH ll {np.mean([x['ll'] for x in so]):.4f} b5 {np.mean([x['b5'] for x in so]):.4f} b8 {np.mean([x['b8'] for x in so]):.4f} auc {np.nanmean([x['auc'] for x in so]):.3f} skill {np.mean([x['skill'] for x in so]):.3f}"
    if c:
        t += '\n' + ' ' * 27 + 'vs base: ' + ' ; '.join(f"{k} own {1000 * v[0]:+.1f}±{1000 * v[1]:.1f} oth {1000 * v[2]:+.1f}±{1000 * v[3]:.1f} ({v[4]}/22)" for k, v in c.items()) + '  [x1000]'
    return t

if __name__ == '__main__':
    import configs
    g = G(); base = None
    for nm in sys.argv[1:]:
        r = run(nm, configs.CONFIGS[nm]); 
        if base is None: base = r
        print(line(nm, r, base if r is not base else None, g['D'].owner), flush=True)
