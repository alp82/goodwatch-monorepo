"""Sequential residual fits/shrinkage adapted from profile/lib.py.

Evidence cutoffs are fixed here, not caller-tunable. Trust lives in trust.py and
never uses this final fit's in-sample predictions.
"""
from dataclasses import dataclass

import numpy as np
from threadpoolctl import threadpool_limits

GATES = dict(quality=40, gap=80, kinds=80, facts=80, themes=80)
Z = 1.645
MIN_EFFECT = 0.15
MIN_SIDE = 8


@dataclass
class Statement:
    family: str
    key: object
    x: np.ndarray
    center: float
    b: float
    se: float
    scale: float
    n_high: int
    n_low: int
    high: np.ndarray
    low: np.ndarray

    def contrib(self, rows):
        return self.b * np.where(np.isfinite(self.x[rows]), self.x[rows] - self.center, 0)

    def effect(self):
        return self.b * self.scale, (self.b - Z * self.se) * self.scale, (self.b + Z * self.se) * self.scale


@dataclass
class Profile:
    usual: float
    statements: list
    fallback: bool
    n: int

    def predict(self, rows):
        return np.clip(self.usual + sum((s.contrib(rows) for s in self.statements), np.zeros(len(rows))), 1, 10)


def support(x):
    good = np.isfinite(x)
    if good.sum() < 2:
        return np.zeros(len(x), bool), np.zeros(len(x), bool)
    lo, hi = np.quantile(x[good], [1 / 3, 2 / 3])
    if hi - lo < 1e-12:
        # A rare binary contrast can have identical terciles; retain its actual sides.
        lo, hi = x[good].min(), x[good].max()
    if hi - lo < 1e-12:
        return np.zeros(len(x), bool), np.zeros(len(x), bool)
    return good & (x >= hi), good & (x <= lo)


def shown(b, se, scale, high, low):
    return (high >= MIN_SIDE and low >= MIN_SIDE and abs(b * scale) >= MIN_EFFECT
            and abs(b) > Z * se)


@threadpool_limits.wrap(limits=1)
def fit(features, rows, ratings):
    """Fit solely on the supplied eligible history subset, including all centering."""
    rows, y = np.asarray(rows, dtype=int), np.asarray(ratings, dtype=float)
    if len(rows) != len(y) or not len(y) or not np.isfinite(y).all() or np.any((y < 1) | (y > 10)):
        raise ValueError('nonempty aligned ratings in 1..10 required')
    if len(y) < 40:
        return Profile(float(np.median(y)), [], True, len(y))
    usual, statements = float(y.mean()), []
    # Quality and lean share a least-squares block as in the old pipeline.
    columns = [('public quality', features.quality, 40), ('audiences over critics', features.gap, 80)]
    use = []
    for name, x, gate in columns:
        high, low = support(x[rows])
        if np.isfinite(x[rows]).sum() >= gate and min(high.sum(), low.sum()) >= MIN_SIDE:
            use.append((name, x))
    while use:
        mask = np.logical_and.reduce([np.isfinite(x[rows]) for _, x in use])
        # Adding lean cannot reduce quality below its own usable-data cutoff.
        if mask.sum() < (80 if len(use) == 2 or use[0][0] == 'audiences over critics' else 40):
            use = [item for item in use if item[0] != 'audiences over critics']
            continue
        centered = [x[rows][mask] - x[rows][mask].mean() for _, x in use]
        design = np.c_[np.ones(mask.sum()), *centered]
        if np.linalg.matrix_rank(design) < design.shape[1]:
            use.pop()
            continue
        beta = np.linalg.lstsq(design, y[mask], rcond=None)[0]
        variance = np.sum((y[mask] - design @ beta) ** 2) / max(mask.sum() - len(beta), 1)
        errors = np.sqrt(np.maximum(variance * np.diag(np.linalg.pinv(design.T @ design)), 0))
        candidates, drop = [], []
        for j, (name, x) in enumerate(use):
            b, se = float(beta[j + 1]), float(errors[j + 1])
            if name == 'audiences over critics':
                tau2 = (0.15 * (float(y.std()) or 1)) ** 2
                shrink = tau2 / (tau2 + se ** 2)
                b, se = b * shrink, se * np.sqrt(shrink)
            high, low = support(np.where(mask, x[rows], np.nan))
            if not shown(b, se, 1, high.sum(), low.sum()):
                drop.append(j)
            candidates.append(Statement('quality', name, x, float(x[rows][mask].mean()), b, se, 1,
                                        int(high.sum()), int(low.sum()), *support(x)))
        if not drop:
            statements.extend(candidates)
            break
        weakest = min(drop, key=lambda j: abs(candidates[j].b) / max(candidates[j].se, 1e-12))
        use.pop(weakest)
    r = y - usual - sum((s.contrib(rows) for s in statements), np.zeros(len(rows)))
    if len(y) >= GATES['kinds']:
        lab = features.kinds
        counts = np.bincount(lab[rows], minlength=6)
        means = np.bincount(lab[rows], weights=r, minlength=6) / np.maximum(counts, 1)
        noise = r.var() / np.maximum(counts, 1)
        ok = (counts >= MIN_SIDE) & (len(y) - counts >= MIN_SIDE)
        tau2 = max(float(np.sum((means[ok] ** 2 - noise[ok]) * counts[ok]) / max(counts[ok].sum(), 1)), 0)
        shrink = np.divide(tau2, tau2 + noise, out=np.zeros(6), where=tau2 + noise > 0)
        for j in range(6):
            b, se = float(means[j] * shrink[j]), float(np.sqrt(noise[j] * shrink[j]))
            if shown(b, se, 1, counts[j], len(y) - counts[j]):
                statements.append(Statement('kinds', j, (lab == j).astype(float), 0, b, se, 1,
                                            int(counts[j]), int(len(y) - counts[j]), lab == j, lab != j))
        r = y - usual - sum((s.contrib(rows) for s in statements), np.zeros(len(rows)))
    for family, x, names, scales, limit in (
        ('facts', features.facts, features.fact_names, np.ones(features.facts.shape[1]), 4),
        ('themes', features.themes, list(range(16)), features.theme_scale, 2),
    ):
        if len(y) < GATES[family]:
            continue
        taken, tau2 = set(), None
        for _ in range(limit):
            candidates = []
            for j, name in enumerate(names):
                if family == 'themes' and features.theme_thirds[1, j] <= features.theme_thirds[0, j]:
                    continue
                known = np.isfinite(x[rows, j])
                high, low = ((x[rows, j] == 1), (x[rows, j] == 0)) if family == 'facts' else (
                    x[rows, j] >= features.theme_thirds[1, j], x[rows, j] <= features.theme_thirds[0, j])
                if min(high.sum(), low.sum()) < MIN_SIDE or scales[j] < 1e-12:
                    continue
                center = float(x[rows, j][known].mean())
                xc = x[rows, j][known] - center
                v = float(xc @ xc)
                if v < 1e-12:
                    continue
                b = float(xc @ (r[known] - r[known].mean()) / v)
                noise = float(r[known].var() / v)
                candidates.append((j, name, center, b, noise, int(high.sum()), int(low.sum())))
            if tau2 is None:
                tau2 = max(float(np.mean([(b*b - noise) * scales[j]**2 for j, _, _, b, noise, _, _ in candidates])), 0) if candidates else 0
            selected = []
            for j, name, center, b, noise, nh, nl in candidates:
                prior = tau2 / scales[j]**2
                shrink = prior / (prior + noise) if prior + noise > 0 else 0
                b, se = b * shrink, float(np.sqrt(noise * shrink))
                if j not in taken and shown(b, se, scales[j], nh, nl):
                    selected.append((abs(b) / max(se, 1e-12), j, name, center, b, se, nh, nl))
            if not selected:
                break
            _, j, name, center, b, se, nh, nl = sorted(selected, key=lambda a: (-a[0], a[1]))[0]
            taken.add(j)
            high, low = (x[:, j] == 1, x[:, j] == 0) if family == 'facts' else (
                x[:, j] >= features.theme_thirds[1, j], x[:, j] <= features.theme_thirds[0, j])
            s = Statement(family, name, x[:, j], center, b, se, float(scales[j]), nh, nl, high, low)
            statements.append(s)
            r = r - s.contrib(rows)
    return Profile(usual, statements, False, len(y))
