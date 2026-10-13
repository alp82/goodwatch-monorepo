import sys, numpy as np, rig
from rig import D, F, metrics
from cacheplus import seq, numt, ser
from sklearn.ensemble import HistGradientBoostingRegressor as HGB
XG = rig.XG; S = np.c_[seq, numt, ser]
pe, pm, ts, tf = F['pca_text_en_v1'], F['pca_text_multi_v1'], F['tags_svd'], F['tfidf_svd']
def run(X, users, seeds=(0, 1, 2), **kw):
    p_ = dict(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3); p_.update(kw)
    out = []
    for seed in seeds:
        res = {}
        for u in users:
            idx, y, sp = rig.splits(u, seed=seed); p = np.zeros(len(y))
            for tr, te in sp: p[te] = HGB(**p_).fit(X[idx[tr]], y[tr]).predict(X[idx[te]])
            m = metrics(p, y); m['skill'] = 1 - m['mae'] / np.abs(y - y.mean()).mean(); res[u] = m
        out.append(res)
    return out
def show(name, out):
    o = [r[D.owner] for r in out if D.owner in r]; s = ''
    if o: s += 'OWNER mae ' + ' '.join(f"{x['mae']:.3f}" for x in o) + f" | avg mae {np.mean([x['mae'] for x in o]):.3f} macro {np.mean([x['macro_mae'] for x in o]):.3f} rho {np.mean([x['rho'] for x in o]):.3f} bad {np.mean([x['mae_bad'] for x in o]):.2f} auc {np.mean([x['auc_bad'] for x in o]):.3f}"
    oth = [np.mean([r[u]['skill'] for u in r if u != D.owner]) for r in out if len(r) > 1]
    if oth: s += ' | OTH skill ' + ' '.join(f'{x:.3f}' for x in oth)
    print(f'{name:36s} {s}', flush=True)
if __name__ == '__main__':
    V = {'base': XG, 'S': np.c_[XG, S], 'seq only': np.c_[XG, seq], 'en8': np.c_[XG, pe[:, :8]], 'en16': np.c_[XG, pe[:, :16]], 'en32': np.c_[XG, pe[:, :32]],
         'tag8': np.c_[XG, ts[:, :8]], 'tag16': np.c_[XG, ts[:, :16]], 'tag32': np.c_[XG, ts[:, :32]], 'tfidf16': np.c_[XG, tf[:, :16]], 'multi16': np.c_[XG, pm[:, :16]],
         'S+en16': np.c_[XG, S, pe[:, :16]], 'S+tag16': np.c_[XG, S, ts[:, :16]], 'S+en16+tag16': np.c_[XG, S, pe[:, :16], ts[:, :16]], 'S+en32+tag32': np.c_[XG, S, pe[:, :32], ts[:, :32]],
         'S+en8+tag8': np.c_[XG, S, pe[:, :8], ts[:, :8]], 'S+en16+tag16+tfidf16+multi16': np.c_[XG, S, pe[:, :16], ts[:, :16], tf[:, :16], pm[:, :16]]}
    for k, X in V.items(): show(k, run(X, [D.owner]))
