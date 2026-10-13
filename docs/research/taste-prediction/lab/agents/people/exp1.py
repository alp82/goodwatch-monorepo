import lab, pf, numpy as np
from sklearn.linear_model import RidgeCV
D = lab.data(); S = pf.static(D)
def resid_base(tr_idx, tr_y, mode):
    if mode == 'mean': return tr_y - tr_y.mean()
    g = S['base'][tr_idx, 74]  # goodwatch overall
    A = np.c_[np.ones(len(g)), g]; w = np.linalg.lstsq(A, tr_y, rcond=None)[0]; return tr_y - A @ w
def mk(groups=(), extra=False, k=2.0, mode='lin', inner=5, reps=1, cols=(0,1,2,3), gkw={}):
    def predict(D, user, tr_idx, tr_y, te_idx):
        Xa = S['base'] if not extra else np.hstack([S['base'], S['extra']])
        Xtr, Xte = Xa[tr_idx], Xa[te_idx]
        if groups:
            r = resid_base(tr_idx, tr_y, mode)
            Ftr, Fte = pf.te_features(S, groups, tr_idx, r, te_idx, k=k, inner=inner, reps=reps)
            sel = [4*g+c for g in range(len(groups)) for c in cols]
            Xtr = np.hstack([Xtr, Ftr[:, sel]]); Xte = np.hstack([Xte, Fte[:, sel]])
        return pf.gbm(**gkw).fit(Xtr, tr_y).predict(Xte)
    return predict
if __name__ == '__main__':
    lab.score(mk(), 'baseline gbm_facts')
    lab.score(mk(extra=True), 'base+extra facts')
    for g in ['cast','lead','director','writer','producer','composer','dop','anyperson','series','family','company','recs','similar','lang','era','highlight','genre','genre2','genre_era','method_genre','type_genre','cert_genre','flag_genre','hl_genre','hl2']:
        lab.score(mk(groups=(g,)), 'base + TE ' + g)
