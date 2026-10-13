"""Hierarchical ridge with tree consensus, blended with the text agent's per-member trees (baseline columns + 51 text columns)
instead of the baseline trees. Trees get weight 0.5 * n / (n + 100), none under 20 ratings."""
import os, importlib.util, numpy as np, preds, pool
_s = importlib.util.spec_from_file_location('text_best', os.path.join(preds.LAB, 'agents', 'text', 'best.py')); _t = importlib.util.module_from_spec(_s); _s.loader.exec_module(_t)
def _trees(D, user, tr_idx, tr_y, te_idx):
    T = _t._setup(D)
    try: return _t._gbm(T['XP'][tr_idx], np.asarray(tr_y, float), T['XP'][te_idx])
    except ValueError: return np.full(len(te_idx), np.mean(tr_y))
predict = preds.blend(pool.make(k=0, own=300., tree=150), _trees)
