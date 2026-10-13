"""Benchmark harness: how well does a predictor guess a member's rating of a title they have not rated?

A predictor is a Python file with one function:

    def predict(D, user, tr_idx, tr_y, te_idx) -> array of predicted ratings (1 to 10), one per te_idx

    D       the data pack (see class Data below)
    user    the member's id
    tr_idx  title rows (into D arrays) this member has rated, visible to the predictor
    tr_y    their ratings for tr_idx
    te_idx  title rows to predict. The member's ratings of these are hidden.

For the member being predicted, use ONLY tr_idx/tr_y. D.others(user) gives every other member's ratings (fair game,
including their ratings of the test titles). Never read D.ratings directly for the predicted member.

Run:   python3 harness.py path/to/predictor.py "short name" [--others] [--quick]
       owner: 10-fold CV over the owner's ratings.  --others: also 5-fold CV for every other member with 60+ ratings.
       --quick: 5 folds for the owner, no ledger entry (for iterating).
Every full run appends one line to ledger.jsonl.
"""
import importlib.util, json, pickle, sys, time, os
import numpy as np
from scipy.stats import spearmanr
from sklearn.model_selection import StratifiedKFold
HERE = os.path.dirname(os.path.abspath(__file__))

class Data:
    def __init__(self):
        p = pickle.load(open(os.path.join(HERE, 'pack.pkl'), 'rb'))
        self.owner = p['owner']
        self.keys = p['keys']                  # [(media_type, tmdb_id)] per title row
        self.info = p['info']                  # per title row: dict of Crate columns (title, genres, keywords, tropes, essence_tags,
                                               # essence_text, synopsis, source scores, suitability_*, context_*, cast, crew, ...)
        self.person_names = p['person_names']  # person tmdb id -> name
        self.fp_keys = p['fingerprint_keys']   # the 74 attribute names
        self.fp = p['fingerprint']             # titles x 74, raw scores 0..10
        self.Z = (self.fp - p['pool_mean']) / p['pool_std']   # standardized against the well-known catalog (1,000+ votes)
        self.emb = p['emb']                    # {'text_en_v1': titles x 768, 'text_multi_v1': titles x 384} text embeddings
        self.signals = p['signals']            # {'wishlist'|'skipped'|'favorite': [(user_id, title row)]} for all members
        self.ratings = p['ratings']            # [(user_id, title row, score 1..10, updated_at ms)] all members, development part only
        self.n = len(self.keys)
        self._by = {}
        for r in self.ratings: self._by.setdefault(r[0], []).append(r)
    def of(self, user):
        rs = self._by.get(user, []); return np.array([r[1] for r in rs]), np.array([r[2] for r in rs], dtype=float)
    def others(self, user):
        """Every other member's ratings: (user ids, title rows, scores)."""
        rs = [r for r in self.ratings if r[0] != user]
        return np.array([r[0] for r in rs]), np.array([r[1] for r in rs]), np.array([r[2] for r in rs], dtype=float)
    def users(self, least=60):
        return [u for u, rs in self._by.items() if len(rs) >= least and u != self.owner]

def metrics(p, y):
    p = np.clip(np.asarray(p, dtype=float), 1, 10); e = np.abs(p - y)
    bad, mid, hi = y <= 5, (y >= 6) & (y <= 7), y >= 8
    band = [e[b].mean() for b in (bad, mid, hi) if b.any()]
    auc = None
    if bad.any() and (~bad).any():
        a, b = -p[bad], -p[~bad]; auc = float((a[:, None] > b[None, :]).mean() + 0.5 * (a[:, None] == b[None, :]).mean())
    rho = spearmanr(p, y)[0] if p.std() > 0 else 0.0
    return {'mae': float(e.mean()), 'rmse': float(np.sqrt(((p - y) ** 2).mean())), 'rho': float(rho),
            'macro_mae': float(np.mean(band)),                       # mean of the error on bad (1-5), middle (6-7), high (8-10) titles
            'mae_bad': float(e[bad].mean()) if bad.any() else None, 'mae_mid': float(e[mid].mean()) if mid.any() else None,
            'mae_hi': float(e[hi].mean()) if hi.any() else None, 'pred_bad': float(p[bad].mean()) if bad.any() else None,
            'pred_hi': float(p[hi].mean()) if hi.any() else None, 'auc_bad': auc, 'n': int(len(y)), 'n_bad': int(bad.sum())}

def cv(D, predict, user, folds, seed=0):
    idx, y = D.of(user); p = np.zeros(len(y))
    band = np.where(y <= 5, 0, np.where(y <= 7, 1, 2))
    if np.bincount(band, minlength=3)[np.unique(band)].min() < folds: band = np.zeros(len(y), int)
    for tr, te in StratifiedKFold(folds, shuffle=True, random_state=seed).split(idx, band):
        p[te] = predict(D, user, idx[tr], y[tr], idx[te])
    return p, y

def run(path, name, others=False, quick=False):
    spec = importlib.util.spec_from_file_location('pred', path); mod = importlib.util.module_from_spec(spec)
    sys.path.insert(0, os.path.dirname(os.path.abspath(path))); spec.loader.exec_module(mod)
    D = Data(); t0 = time.time()
    p, y = cv(D, mod.predict, D.owner, 5 if quick else 10)
    out = {'name': name, 'file': os.path.abspath(path), 'owner': metrics(p, y)}
    if others:
        rows = []
        for u in D.users():
            pu, yu = cv(D, mod.predict, u, 5); mu = metrics(pu, yu)
            const = np.abs(yu - yu.mean()).mean()
            rows.append({'user': u[:8], 'n': len(yu), 'mae': mu['mae'], 'skill': 1 - mu['mae'] / const, 'rho': mu['rho'], 'auc_bad': mu['auc_bad']})
        out['others'] = {'users': len(rows), 'mean_skill': float(np.mean([r['skill'] for r in rows])), 'mean_rho': float(np.mean([r['rho'] for r in rows])),
                         'mean_mae': float(np.mean([r['mae'] for r in rows])), 'per_user': rows}
    out['seconds'] = round(time.time() - t0, 1)
    o = out['owner']
    print(f"{name}: OWNER mae {o['mae']:.3f} macro {o['macro_mae']:.3f} rho {o['rho']:.3f} | bad: mae {o['mae_bad']:.2f} pred {o['pred_bad']:.2f} auc {o['auc_bad']:.3f} | hi: mae {o['mae_hi']:.2f} pred {o['pred_hi']:.2f}"
          + (f" || OTHERS({out['others']['users']}) skill {out['others']['mean_skill']:.3f} rho {out['others']['mean_rho']:.3f}" if others else '') + f" [{out['seconds']}s]")
    if not quick:
        with open(os.path.join(HERE, 'ledger.jsonl'), 'a') as f: f.write(json.dumps(out) + '\n')
    return out

if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    run(a[0], a[1] if len(a) > 1 else os.path.basename(a[0]), others='--others' in sys.argv, quick='--quick' in sys.argv)
