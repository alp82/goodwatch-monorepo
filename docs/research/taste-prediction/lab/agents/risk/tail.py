"""How low a justified prediction goes and how many bad titles can be flagged (owner, cross-validated, seed-averaged)."""
import sys, pickle, numpy as np, ev, harness
g = ev.G(); D = g['D']; name = sys.argv[1] if len(sys.argv) > 1 else 'po'
r = pickle.load(open(ev.HERE + f'/cache/res_{name}.pkl', 'rb'))[D.owner]; y = r['y']; bad = y <= 5; P = r['P']; S = P.shape[0]
risk = P[:, :, :5].sum(2); hi = P[:, :, 7:].sum(2)
print(f'== {name}: owner n {len(y)}, bad {bad.sum()}')
print('risk quantiles (seed 0):', np.round(np.quantile(risk[0], [0, .1, .25, .5, .75, .9, .95, .99, 1]), 3))
print('-- calibration of P(rating <= 5), by risk bin (all seeds pooled)')
rr = risk.ravel(); bb = np.tile(bad, S); edges = [0, .02, .05, .1, .2, .3, .4, .5, .7, 1.01]
for a, b in zip(edges[:-1], edges[1:]):
    m = (rr >= a) & (rr < b)
    if m.sum(): print(f'   risk {a:.2f}-{b:.2f}: titles {m.sum() / S:6.1f}  predicted {rr[m].mean():.3f}  observed {bb[m].mean():.3f}  (bad titles {bb[m].sum() / S:.1f})')
print('-- calibration of P(rating >= 8)')
hh = hi.ravel(); tt = np.tile(y >= 8, S)
for a, b in zip([0, .1, .2, .3, .4, .5, .6, .7, .8], [.1, .2, .3, .4, .5, .6, .7, .8, 1.01]):
    m = (hh >= a) & (hh < b)
    if m.sum(): print(f'   {a:.1f}-{b:.2f}: titles {m.sum() / S:6.1f}  predicted {hh[m].mean():.3f}  observed {tt[m].mean():.3f}')
print('-- flagging "risk >= t": titles flagged, precision, recall (mean over seeds)')
for t in [.1, .15, .2, .25, .3, .35, .4, .5, .6]:
    f = risk >= t; n = f.sum(1); tp = (f & bad).sum(1)
    print(f'   t {t:.2f}: flagged {n.mean():6.1f}  precision {np.mean(tp / np.maximum(n, 1)):.2f}  recall {np.mean(tp / bad.sum()):.2f}  (bad caught {tp.mean():.1f} of {bad.sum()})')
print('-- flagging the top-k riskiest: precision')
for k in [10, 20, 35, 70, 140]:
    print(f'   top {k}: precision {np.mean([bad[np.argsort(-x)[:k]].mean() for x in risk]):.2f} recall {np.mean([bad[np.argsort(-x)[:k]].sum() / bad.sum() for x in risk]):.2f}')
print('-- decision rules: predicted rating')
B = pickle.load(open(ev.HERE + f'/cache/base_{D.owner[:8]}.pkl', 'rb'))
for alpha in [0.0, 0.5, 0.75, 1.0]:
    out = []
    for si in range(S):
        pred = np.zeros(len(y))
        for f in range(5):
            c = B['folds'][(si, f)]; pred[c['te']] = ev.decide(P[si, c['te']], y[c['tr']], alpha, r['score'][si, c['te']])
        m = harness.metrics(pred, y); lo = np.round(pred) <= 5
        out.append([m['mae'], m['macro_mae'], m['mae_bad'], m['pred_bad'], m['rho'], m['auc_bad'], lo.sum(), (lo & bad).sum() / max(lo.sum(), 1), (lo & bad).sum() / bad.sum(), pred.min(), (np.round(pred) <= 4).sum()])
    o = np.mean(out, 0)
    print(f'   alpha {alpha:.2f}: mae {o[0]:.3f} macro {o[1]:.3f} mae_bad {o[2]:.2f} mean pred on bad {o[3]:.2f} rho {o[4]:.3f} auc_bad {o[5]:.3f} | predicted<=5: {o[6]:.1f} titles, precision {o[7]:.2f}, recall {o[8]:.2f} | lowest {o[9]:.2f}, predicted<=4: {o[10]:.1f}')
sc = r['score']; print(f'   continuous score: mean on bad {sc[:, bad].mean():.2f}, lowest {sc.min(1).mean():.2f}, titles under 5.5: {(sc < 5.5).sum(1).mean():.1f}')
ex = (P * np.arange(1, 11)).sum(2); print(f'   distribution mean: on bad {ex[:, bad].mean():.2f}; distribution median on bad {np.mean([(np.cumsum(P[s][bad], 1) < 0.5).sum(1).mean() + 1 for s in range(S)]):.2f}')
print('-- what the bad titles were rated vs lowest justified:', np.bincount(y[bad].astype(int), minlength=6)[1:])
