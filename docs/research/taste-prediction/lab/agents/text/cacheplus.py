import sys, os, pickle, numpy as np, re
import rig
from rig import D, F
from sklearn.ensemble import HistGradientBoostingRegressor as HGB
kwv = {k: i for i, k in enumerate(F['keywords'][1])}
seq = np.asarray(F['keywords'][0][:, kwv['sequel']].todense()).ravel()
numt = np.array([bool(re.search(r'(\b[2-9]\b|\bII+\b|\bIV\b|Part |: )', x['title'] or '')) for x in D.info], float)
ser = np.array([x.get('movie_series_id') is not None for x in D.info], float)
XP = np.c_[rig.XG, seq, numt, ser, F['pca_text_en_v1'][:, :16], F['tags_svd'][:, :16], F['tfidf_svd'][:, :16]]
def gp(tr, y, te): return HGB(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3).fit(XP[tr], y).predict(XP[te])
def build(seed):
    p = os.path.join(rig.HERE, f'plus3_cache_{seed}.pkl')
    if os.path.exists(p): return pickle.load(open(p, 'rb'))
    C = {}
    for u in [D.owner] + D.users():
        idx, y, sp = rig.splits(u, seed=seed); C[u] = []
        for tr, te in sp: C[u].append({'tr': tr, 'te': te, 'oof': rig.inner_oof(gp, idx[tr], y[tr]), 'pte': gp(idx[tr], y[tr], idx[te])})
    pickle.dump(C, open(p, 'wb')); return C
if __name__ == '__main__': build(int(sys.argv[1]))
