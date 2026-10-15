"""Cross-fitted historical checks, never forward calibration or a safety claim."""
from dataclasses import dataclass
import hashlib

import numpy as np

from .franchise import series
from .lib import fit


def folds(catalog, keys):
    """Five deterministic title folds, dealing whole movie franchises together."""
    groups = {}
    for i, key in enumerate(keys):
        group = series(catalog.info[int(key)])
        token = f'franchise:{group}' if group is not None else f'title:{int(key)}'
        groups.setdefault(token, []).append(i)
    ordered = sorted(groups, key=lambda s: hashlib.sha256(f'20261013|T5|statements|{s}'.encode()).digest())
    assignment = np.zeros(len(keys), dtype=int)
    for i, token in enumerate(ordered):
        assignment[groups[token]] = i % 5
    return assignment


def wilson(low, n):
    z = 1.959963984540054
    p = low / n
    den = 1 + z*z/n
    middle = (p + z*z/(2*n)) / den
    half = z * np.sqrt(p*(1-p)/n + z*z/(4*n*n)) / den
    return max(0, middle-half), min(1, middle+half)


def bands(keys, ratings, predictions):
    """Disjoint thirds, ordered by prediction then numeric title key; low is <=5."""
    y, p = np.asarray(ratings), np.asarray(predictions)
    if len(p) < 30:
        return None, 'fewer than 30 out-of-fold predictions'
    if not np.isfinite(p).all():
        return None, 'a fold has no training history'
    if np.ptp(p) < 0.15:
        return None, 'out-of-fold predictions have less than 0.15 points of spread'
    ordered = np.lexsort((np.asarray(keys), p))
    parts = np.array_split(ordered, 3)
    if min(map(len, parts)) < 10:
        return None, 'fewer than ten predictions per band'
    out = []
    for name, rows in zip(('bottom', 'middle', 'top'), parts):
        n, low = len(rows), int((y[rows] <= 5).sum())
        out.append(dict(band=name, n=n, mean=float(y[rows].mean()), low_count=low,
                        low_fraction=low/n, wilson=wilson(low, n), title_keys=np.asarray(keys)[rows].tolist()))
    return out, None


@dataclass
class CrossFit:
    predictions: np.ndarray
    folds: np.ndarray
    fallback_folds: tuple
    table: object
    suppressed: object


def cross_fit(features, keys, ratings):
    keys, y = np.asarray(keys, dtype=np.int64), np.asarray(ratings, dtype=float)
    rows = features.catalog.rows(keys)
    assignments = folds(features.catalog, keys)
    predictions = np.full(len(y), np.nan)
    fallback, differentiated = [], False
    for fold in range(5):
        test, train = assignments == fold, assignments != fold
        if not test.any():
            continue
        if not train.any():
            fallback.append(fold)
            continue
        model = fit(features, rows[train], y[train])
        predictions[test] = model.predict(rows[test])
        if model.fallback:
            fallback.append(fold)
        differentiated |= bool(model.statements)
    table, reason = bands(keys, y, predictions)
    if not differentiated:
        table, reason = None, 'no supported differentiated fold fit (history-only median fallback below 40 ratings)'
    if fallback:
        table, reason = None, 'at least one fold requires the history-only median fallback or has no training history'
    return CrossFit(predictions, assignments, tuple(fallback), table, reason)
