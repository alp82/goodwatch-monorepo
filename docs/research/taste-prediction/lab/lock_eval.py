"""Final check: fit on all development ratings, predict the locked quarter the agents never saw.  python3 lock_eval.py file.py [file2.py ...]"""
import sys, pickle, importlib.util, os, json
import numpy as np
sys.path.insert(0, '../lab'); import harness
D = harness.Data(); locked = pickle.load(open('locked.pkl', 'rb'))
by = {}
for u, i, s, _ in locked: by.setdefault(u, []).append((i, s))
for path in sys.argv[1:]:
    spec = importlib.util.spec_from_file_location('p' + str(abs(hash(path))), path); mod = importlib.util.module_from_spec(spec)
    sys.path.insert(0, os.path.dirname(os.path.abspath(path))); spec.loader.exec_module(mod)
    def one(u):
        tr, y = D.of(u); te = np.array([i for i, _ in by[u]]); yt = np.array([s for _, s in by[u]], dtype=float)
        return harness.metrics(mod.predict(D, u, tr, y, te), yt), yt, y
    o, _, _ = one(D.owner); rows = []
    for u in D.users():
        if u not in by: continue
        mu, yt, y = one(u); rows.append((1 - mu['mae'] / np.abs(yt - y.mean()).mean(), mu['rho']))
    print(f"{path.split('lab/')[-1][:60]:60s} LOCKED owner(n={o['n']},bad={o['n_bad']}) mae {o['mae']:.3f} macro {o['macro_mae']:.3f} rho {o['rho']:.3f} bad: mae {o['mae_bad']:.2f} pred {o['pred_bad']:.2f} auc {o['auc_bad']:.3f} | others({len(rows)}) skill {np.mean([r[0] for r in rows]):.3f} rho {np.mean([r[1] for r in rows]):.3f}", flush=True)
