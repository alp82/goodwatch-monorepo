"""Signal check: correlation of each collab feature with the member's rating and with the baseline's out-of-fold residual."""
import sys, numpy as np, warnings; warnings.filterwarnings('ignore')
from scipy.stats import spearmanr
from sklearn.model_selection import StratifiedKFold
from ev import data; import lib
D = data()
def oof(user, folds=10, seed=0):
    idx, y = D.of(user); band = np.where(y <= 5, 0, np.where(y <= 7, 1, 2))
    if np.bincount(band, minlength=3)[np.unique(band)].min() < folds: band = np.zeros(len(y), int)
    P = np.zeros(len(y)); F = None
    for tr, te in StratifiedKFold(folds, shuffle=True, random_state=seed).split(idx, band):
        P[te] = lib.make([])(D, user, idx[tr], y[tr], idx[te])
        X = np.hstack([lib.disagree(D)[idx[te]], lib.sig_counts(D, user)[idx[te]], lib.others_stats(D, user)['F'][idx[te]],
                       lib.knn_graph_feats(D, idx[tr], y[tr], idx[te]), lib.cf_feats(D, user, idx[tr], y[tr], idx[te])])
        if F is None: F = np.zeros((len(y), X.shape[1]))
        F[te] = X
    return idx, y, P, F
names = lib.DIS_NAMES + ['sig_wish', 'sig_skip', 'sig_fav', 'sig_wishshare', 'sig_n'] + ['ost_logn', 'ost_mean', 'ost_meanz', 'ost_low'] + lib.KG_NAMES + lib.CF_NAMES
users = [D.owner] + (D.users() if len(sys.argv) > 1 else [])
acc = []
for u in users:
    idx, y, P, F = oof(u, 10 if u == D.owner else 5); r = y - P; row = []
    for j, n in enumerate(names):
        ok = np.isfinite(F[:, j]) & (F[:, j] != 0 if n.split('_')[0] in ('rec', 'sim', 'in', 'any', 'hop2', 'uu', 'ii') else True)
        if ok.sum() < 15 or F[ok, j].std() == 0: row.append((np.nan, np.nan, ok.mean())); continue
        row.append((spearmanr(F[ok, j], y[ok])[0], spearmanr(F[ok, j], r[ok])[0], ok.mean()))
    acc.append(row)
    if u == D.owner:
        print('OWNER  feature: coverage, rho with rating, rho with baseline residual')
        for n, (a, b, c) in zip(names, row): print(f'  {n:22s} cov {c:.2f}  y {a:+.3f}  resid {b:+.3f}')
if len(users) > 1:
    A = np.array(acc[1:]); print('OTHERS mean over members')
    for j, n in enumerate(names): print(f'  {n:22s} cov {np.nanmean(A[:, j, 2]):.2f}  y {np.nanmean(A[:, j, 0]):+.3f}  resid {np.nanmean(A[:, j, 1]):+.3f}  share resid>0 {np.nanmean(A[:, j, 1] > 0):.2f}')
