from lib import *
import pickle
OUT, y = pickle.load(open('exp2.pkl', 'rb')); KS = np.arange(1, 11)
def dmed(Pd, wk, grid=np.arange(1, 10.01, 0.5)):
    cost = (Pd * wk)[:, :, None] * np.abs(grid[None, None, :] - KS[None, :, None]); return grid[cost.sum(1).argmin(1)]
def emean(Pd, wk):
    W = Pd * wk; return (W @ KS) / W.sum(1)
for key in ('hgc', 'hgc_mono', 'hgc_bag5', 'logit', 'hgc_small'):
    print('==', key)
    for a in (0, .25, .5, .75, 1.0):
        show('int median a=%.2f' % a, [dmed(A, Wk[a], KS.astype(float)) for A, Wk in OUT[key]], y)
    for a in (.5, 1.0):
        show('half-step median a=%.2f' % a, [dmed(A, Wk[a]) for A, Wk in OUT[key]], y)
        for lam in (0.15, 0.3, 0.5):
            show('int med + %.2f wmean a=%.2f' % (lam, a), [(1-lam)*dmed(A, Wk[a], KS.astype(float)) + lam*emean(A, Wk[a]) for A, Wk in OUT[key]], y)
        show('weighted mean a=%.2f' % a, [emean(A, Wk[a]) for A, Wk in OUT[key]], y)
print('== avg hgc_mono + logit dists')
for a in (0, .25, .5, .75, 1.0):
    Ps = [((A1 + A2) / 2, W1) for (A1, W1), (A2, W2) in zip(OUT['hgc_mono'], OUT['logit'])]
    show('int median a=%.2f' % a, [dmed(A, Wk[a], KS.astype(float)) for A, Wk in Ps], y)
    show('int med+.3 wmean a=%.2f' % a, [.7*dmed(A, Wk[a], KS.astype(float)) + .3*emean(A, Wk[a]) for A, Wk in Ps], y)
