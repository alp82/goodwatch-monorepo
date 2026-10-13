"""risk agent: loads the pooled agent's point model under unique module handling, and the shared CV splitter."""
import os, sys, importlib.util, warnings, numpy as np
warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(os.path.dirname(HERE))
if LAB not in sys.path: sys.path.insert(0, LAB)
def load(path, name):
    s = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(s); sys.modules[name] = m; s.loader.exec_module(m); return m
_P = {}
def point_parts():
    """(linear part, tree part) of agents/pooled/best.py; best = (1 - l) * linear + l * trees, l = 0.5 n / (n + 100), linear alone under 20 ratings."""
    if not _P:
        pd = os.path.join(LAB, 'agents', 'pooled'); sys.path.insert(0, os.path.join(LAB, 'baselines'))
        # the pooled agent's files import each other by bare name (preds, pool): load them by path under those names only if free
        for nm in ('pool', 'preds'):
            if nm not in sys.modules: load(os.path.join(pd, nm + '.py'), nm)
        ht = load(os.path.join(pd, 'h_text.py'), 'pooled_h_text')
        _P['lin'] = sys.modules['pool'].make(k=0, own=300., tree=150); _P['tree'] = ht._trees
    return _P['lin'], _P['tree']
def blend(lin, tree, n):
    return lin if n < 20 else (1 - 0.5 * n / (n + 100.0)) * lin + 0.5 * n / (n + 100.0) * tree
def splits(y, folds, seed):
    from sklearn.model_selection import StratifiedKFold
    band = np.where(y <= 5, 0, np.where(y <= 7, 1, 2))
    if np.bincount(band, minlength=3)[np.unique(band)].min() < folds: band = np.zeros(len(y), int)
    return list(StratifiedKFold(folds, shuffle=True, random_state=seed).split(y, band))
def inner_parts(D, user, tr_idx, tr_y, te_idx, folds=5):
    """Out-of-fold (linear, trees) scores on the visible ratings and the two scores for the titles to predict."""
    from sklearn.model_selection import KFold
    lin, tree = point_parts(); n = len(tr_y); ol = np.zeros(n); ot = np.zeros(n)
    for a, b in KFold(min(folds, n), shuffle=True, random_state=1).split(tr_idx):
        ol[b] = lin(D, user, tr_idx[a], tr_y[a], tr_idx[b]); ot[b] = tree(D, user, tr_idx[a], tr_y[a], tr_idx[b]) if len(a) >= 20 else ol[b]
    pl = lin(D, user, tr_idx, tr_y, te_idx); pt = tree(D, user, tr_idx, tr_y, te_idx) if n >= 20 else pl
    return ol, ot, pl, pt
