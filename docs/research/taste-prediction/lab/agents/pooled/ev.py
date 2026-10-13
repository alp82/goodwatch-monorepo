"""Evaluation helpers: harness-identical CV for several predictors at once, and learning curves."""
import os, sys, time, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, LAB); sys.path.insert(0, HERE)
import harness
from harness import Data, metrics, cv
from scipy.stats import spearmanr

def full(D, preds, others=True, owner_folds=10, verbose=True):
    """preds: {name: predict}. Same folds as harness.py. Returns {name: row}."""
    out = {}
    for name, f in preds.items():
        t0 = time.time(); p, y = cv(D, f, D.owner, owner_folds); o = metrics(p, y); row = {'owner': o}
        if others:
            sk, rh, ma = [], [], []
            for u in D.users():
                pu, yu = cv(D, f, u, 5); mu = metrics(pu, yu); const = np.abs(yu - yu.mean()).mean()
                sk.append(1 - mu['mae'] / const); rh.append(mu['rho']); ma.append(mu['mae'])
            row.update(skill=float(np.mean(sk)), orho=float(np.mean(rh)), omae=float(np.mean(ma)), per=sk)
        out[name] = row
        if verbose:
            print(f"{name:38s} OWNER mae {o['mae']:.3f} macro {o['macro_mae']:.3f} rho {o['rho']:.3f} bad {o['mae_bad']:.2f} auc {o['auc_bad']:.3f}"
                  + (f" || OTHERS skill {row['skill']:.3f} rho {row['orho']:.3f} mae {row['omae']:.3f}" if others else '') + f" [{time.time() - t0:.0f}s]", flush=True)
    return out

def curve(D, preds, users, sizes=(5, 10, 20, 40, 80, 160), draws=6, max_test=400, seed=0, rnd=False):
    """For each member and size n: draw n of their ratings as the visible history, predict the rest.
    skill = 1 - mae / mae of the constant (the mean of the member's visible ratings... see 'const' predictor); here skill is
    relative to the harness convention: the member's mean over ALL ratings (an oracle constant, a strict reference).
    Returns rec[name][n] = list over members of (mean skill over draws, mean rho, mean mae)."""
    rec = {nm: {n: [] for n in sizes} for nm in preds}
    for u in users:
        idx, y = D.of(u); import zlib; rs = np.random.RandomState(seed + zlib.crc32(u.encode()) % 100000)
        const = None
        for n in sizes:
            if len(y) < n + 20: continue
            acc = {nm: [] for nm in preds}
            nd = draws if len(y) - n >= 60 else draws * 2
            for d in range(nd):
                perm = rs.permutation(len(y)); tr = perm[:n]; te = perm[n:n + max_test]
                c = np.abs(y[te] - y.mean()).mean()
                for nm, f in preds.items():
                    p = np.clip(np.asarray(f(D, u, idx[tr], y[tr], idx[te]), float), 1, 10)
                    if rnd: p = np.round(p)
                    mae = np.abs(p - y[te]).mean()
                    rho = spearmanr(p, y[te])[0] if p.std() > 1e-9 and y[te].std() > 0 else 0.0
                    acc[nm].append((1 - mae / c, rho, mae))
            for nm in preds: rec[nm][n].append(np.mean(acc[nm], 0))
    return rec

def show_curve(rec, sizes=(5, 10, 20, 40, 80, 160), label=''):
    print(f"--- {label}  (members per size: " + ', '.join(f"{n}:{len(next(iter(rec.values()))[n])}" for n in sizes) + ')')
    for nm, r in rec.items():
        print(f"{nm:30s} skill " + ' '.join(f"{np.mean([a[0] for a in r[n]]):+.3f}" if r[n] else '   .  ' for n in sizes)
              + ' | rho ' + ' '.join(f"{np.mean([a[1] for a in r[n]]):.3f}" if r[n] else '  .  ' for n in sizes)
              + ' | mae ' + ' '.join(f"{np.mean([a[2] for a in r[n]]):.3f}" if r[n] else '  .  ' for n in sizes), flush=True)

def small(D, f, lo=10, hi=59, folds=5):
    """Real small members (lo..hi ratings): 5-fold CV each. Returns micro skill vs the visible-mean constant, mean rho over members with 20+, micro mae."""
    from sklearn.model_selection import KFold
    E = C = 0.0; N = 0; rh = []
    for u, rs in D._by.items():
        if not (lo <= len(rs) <= hi): continue
        idx, y = D.of(u); p = np.zeros(len(y)); c = np.zeros(len(y))
        for tr, te in KFold(folds, shuffle=True, random_state=0).split(idx):
            p[te] = np.clip(f(D, u, idx[tr], y[tr], idx[te]), 1, 10); c[te] = y[tr].mean()
        E += np.abs(p - y).sum(); C += np.abs(c - y).sum(); N += len(y)
        if len(y) >= 20 and p.std() > 1e-9 and y.std() > 0: rh.append(spearmanr(p, y)[0])
    return 1 - E / C, float(np.mean(rh)), E / N

def bench(D, preds, do_small=True, sizes=(10, 40), draws=4):
    us = [D.owner] + D.users()
    for nm, f in preds.items():
        t0 = time.time(); r = full(D, {nm: f}, verbose=False)[nm]; o = r['owner']
        cu = curve(D, {nm: f}, us, sizes=sizes, draws=draws)[nm]
        s = small(D, f) if do_small else (np.nan, np.nan, np.nan)
        print(f"{nm:34s} OWN mae {o['mae']:.3f} mac {o['macro_mae']:.3f} rho {o['rho']:.3f} | OTH skill {r['skill']:.3f} rho {r['orho']:.3f} | "
              + ' '.join(f"n={n}: {np.mean([a[0] for a in cu[n]]):+.3f}/{np.mean([a[1] for a in cu[n]]):.3f}" for n in sizes)
              + f" | SMALL skill {s[0]:+.3f} rho {s[1]:.3f} mae {s[2]:.3f} [{time.time() - t0:.0f}s]", flush=True)
