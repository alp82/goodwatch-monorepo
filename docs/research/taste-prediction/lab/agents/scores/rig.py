"""Repeated cross-validation with paired comparisons.

run:    python3 rig.py run <variant> [<variant> ...]     stores every prediction in res/<variant>.pkl
table:  python3 rig.py table [base]                       paired differences against the base variant

Per variant: owner 10-fold x 3 split seeds; each of the 22 other members 5-fold x 3 seeds; learning curve: every member
with 40+ ratings, 20 / 40 / 80 visible ratings, 4 draws each (same draws for every variant).
"""
import os, sys, pickle, time, zlib, warnings, numpy as np
warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, LAB); sys.path.insert(0, HERE)
import harness
from harness import metrics, cv
RES = os.path.join(HERE, 'res'); os.makedirs(RES, exist_ok=True)
SEEDS = (0, 1, 2); SIZES = (20, 40, 80); DRAWS = 4

def variants():
    import smodel
    m = smodel.make; V = {}
    for mode, tree in (('F', 150), ('L', 0)):                 # F: the full leader. L: no tree consensus (pure hierarchical ridge) + member trees
        V[f'{mode}:base'] = m(tree=tree)
        for b in ('mcu', 'miss', 'shr', 'relw', 'logc', 'gap', 'peer', 'curve', 'pop', 'seas', 'leanx', 'audx'): V[f'{mode}:{b}'] = m((b,), tree=tree)
        V[f'{mode}:lean'] = m(tree=tree, extra='lean'); V[f'{mode}:src6'] = m(tree=tree, extra='src6'); V[f'{mode}:gapre'] = m(tree=tree, extra='gap')
        V[f'{mode}:pscale2'] = m(tree=tree, pscale=2.0); V[f'{mode}:pscale3'] = m(tree=tree, pscale=3.0)
    V.update(COMBOS(m))
    import sfeats; shape = sfeats.load(os.path.join(LAB, 'agents', 'badscores', 'shape.py'), 'badscores_shape')
    def shaped(f): return lambda D, user, a, b, c: shape.shape_point(lambda x, y, z: f(D, user, x, y, z), a, b, c, alpha=0.5)
    V['S:base'] = shaped(m()); V['S:lean'] = shaped(m(extra='lean'))      # S: through the output shape (no learning curve)
    return V

def COMBOS(m):
    try:
        import combos; return combos.get(m)
    except ImportError: return {}

def run(name, f, D):
    out = {'owner': {}, 'others': {}, 'curve': {}}; t0 = time.time()
    for s in SEEDS: out['owner'][s] = cv(D, f, D.owner, 10, seed=s)[0]
    for u in D.users():
        out['others'][u] = np.array([cv(D, f, u, 5, seed=s)[0] for s in SEEDS])
    for u, rs in D._by.items():
        if len(rs) < 40 or name.startswith('S:'): continue
        idx, y = D.of(u); r = np.random.RandomState(zlib.crc32(u.encode()) % 100000)
        for n in SIZES:
            if len(y) < n + 20: continue
            acc = []
            for d in range(DRAWS):
                perm = r.permutation(len(y)); tr = perm[:n]; te = perm[n:n + 300]
                p = np.clip(np.asarray(f(D, u, idx[tr], y[tr], idx[te]), float), 1, 10); acc.append((te, p))
            out['curve'][(u, n)] = acc
    pickle.dump(out, open(os.path.join(RES, name.replace(':', '_') + '.pkl'), 'wb'))
    print(f'{name} done [{time.time() - t0:.0f}s]', flush=True)

def summarize(D, R):
    """Per-unit numbers for one stored variant."""
    idx, y = D.of(D.owner); S = {}
    P = np.array([R['owner'][s] for s in SEEDS]); S['own_err'] = np.abs(np.clip(P, 1, 10) - y).mean(0)       # per rating, mean over seeds
    ms = [metrics(p, y) for p in P]; S['own'] = {k: float(np.mean([m[k] for m in ms])) for k in ('mae', 'macro_mae', 'rho', 'mae_bad', 'auc_bad')}
    band = np.where(y <= 5, 0, np.where(y <= 7, 1, 2)); S['band'] = band
    sk, rh = [], []
    for u in D.users():
        _, yu = D.of(u); c = np.abs(yu - yu.mean()).mean(); ms = [metrics(p, yu) for p in R['others'][u]]
        sk.append(np.mean([1 - m['mae'] / c for m in ms])); rh.append(np.mean([m['rho'] for m in ms]))
    S['oth_skill'] = np.array(sk); S['oth_rho'] = np.array(rh)
    cu = {}
    for (u, n), acc in R['curve'].items():
        _, yu = D.of(u); cu[(u, n)] = np.mean([np.abs(p - yu[te]).mean() / np.abs(yu[te] - yu.mean()).mean() for te, p in acc])
    S['curve'] = cu
    return S

def paired(a, b):
    d = np.asarray(a) - np.asarray(b); return d.mean(), d.std(ddof=1) / np.sqrt(len(d))

def table(D, base, names=None, out=sys.stdout):
    L = lambda n: pickle.load(open(os.path.join(RES, n.replace(':', '_') + '.pkl'), 'rb'))
    mode = base.split(':')[0]
    if names is None: names = sorted(f[:-4].replace('_', ':', 1) for f in os.listdir(RES) if f.startswith(mode + '_') and f.endswith('.pkl'))
    B = summarize(D, L(base)); b = B['band']; rows = []
    print(f"base {base}: owner mae {B['own']['mae']:.3f} macro {B['own']['macro_mae']:.3f} rho {B['own']['rho']:.3f} bad {B['own']['mae_bad']:.2f} auc {B['own']['auc_bad']:.3f} | others skill {B['oth_skill'].mean():.3f} rho {B['oth_rho'].mean():.3f}", file=out)
    print(f"{'variant':26s} | owner d_mae (se)    z  | d_macro  d_rho  | others d_skill (se)   z   up/22 d_rho | curve 20-80 d_relmae (se)   z   | n=20   n=40   n=80", file=out)
    for n in names:
        if n == base: continue
        S = summarize(D, L(n)); dm, se = paired(S['own_err'], B['own_err'])
        dmac = np.mean([paired(S['own_err'][b == k], B['own_err'][b == k])[0] for k in range(3)])
        ds, ses = paired(S['oth_skill'], B['oth_skill']); up = int((S['oth_skill'] > B['oth_skill']).sum())
        us = sorted({u for u, _ in S['curve']})
        if not us: print(f"{n:26s} | {dm:+.4f} ({se:.4f}) {dm / se:+5.1f} | {dmac:+.4f} {S['own']['rho'] - B['own']['rho']:+.4f} | {ds:+.4f} ({ses:.4f}) {ds / ses:+5.1f}  {up:2d}   {S['oth_rho'].mean() - B['oth_rho'].mean():+.4f} | (no curve)  abs: owner mae {S['own']['mae']:.3f} macro {S['own']['macro_mae']:.3f} rho {S['own']['rho']:.3f} bad {S['own']['mae_bad']:.2f} auc {S['own']['auc_bad']:.3f} others {S['oth_skill'].mean():.3f}", file=out); continue
        per = [np.mean([S['curve'][(u, k)] - B['curve'][(u, k)] for k in SIZES if (u, k) in S['curve']]) for u in us]
        dc, sec = np.mean(per), np.std(per, ddof=1) / np.sqrt(len(per))
        bn = [np.mean([S['curve'][k] - B['curve'][k] for k in S['curve'] if k[1] == sz]) for sz in SIZES]
        print(f"{n:26s} | {dm:+.4f} ({se:.4f}) {dm / se:+5.1f} | {dmac:+.4f} {S['own']['rho'] - B['own']['rho']:+.4f} | {ds:+.4f} ({ses:.4f}) {ds / ses:+5.1f}  {up:2d}   {S['oth_rho'].mean() - B['oth_rho'].mean():+.4f} | {dc:+.4f} ({sec:.4f}) {dc / sec:+5.1f} | " + ' '.join(f'{v:+.4f}' for v in bn), file=out)
        rows.append((n, dm, se, ds, ses, dc, sec))
    return rows

if __name__ == '__main__':
    D = harness.Data()
    if sys.argv[1] == 'run':
        V = variants()
        for n in sys.argv[2:]:
            if os.path.exists(os.path.join(RES, n.replace(':', '_') + '.pkl')) and '--force' not in sys.argv: continue
            if n.startswith('--'): continue
            run(n, V[n], D)
    else:
        for base in (sys.argv[2:] or ['L:base', 'F:base']): table(D, base); print()
