"""Rating-free features adapted from profile/feats.py, without its global caches."""
from dataclasses import dataclass

import numpy as np

from . import artifact, franchise
from .data import AUD, CRIT


def number(value):
    return np.nan if value is None else float(value)


def row_mean(rows):
    n = np.isfinite(rows).sum(1)
    return np.divide(np.nansum(rows, axis=1), n, out=np.full(len(rows), np.nan), where=n > 0)


@dataclass
class Features:
    catalog: object
    model: dict
    kinds: np.ndarray
    themes: np.ndarray
    theme_scale: np.ndarray
    theme_thirds: np.ndarray
    quality: np.ndarray
    gap: np.ndarray
    facts: np.ndarray
    fact_names: tuple
    franchise_states: tuple


def build(catalog, model):
    kinds, themes = artifact.transform(catalog, model)
    infos = [catalog.info[int(k)] for k in catalog.keys]
    aud = row_mean(np.array([[number(x.get(k)) for k in AUD] for x in infos]))
    crit = row_mean(np.array([[number(x.get(k)) for k in CRIT] for x in infos]))
    # Keep missing public scores unknown. Per-feature fits omit them; no rating-based imputation.
    quality = row_mean(np.c_[aud, crit]) / 10
    gap = np.where(np.isfinite(aud) & np.isfinite(crit), (aud - crit) / 10, np.nan)
    later, states = franchise.classify(catalog)
    facts = {franchise.LABEL: later}
    facts['a series (not a movie)'] = np.array([number(None) if x.get('media_type') is None else float(x['media_type'] == 'show') for x in infos])
    for field, label, value in (('production_method', 'animated', 'Animation'),
                                ('original_language_code', 'not in English', 'en')):
        facts[label] = np.array([np.nan if x.get(field) is None else float((x[field] != value) if field == 'original_language_code' else (x[field] == value)) for x in infos])
    for field, label in (('is_anime', 'anime'), ('context_is_thought_provoking', 'thought-provoking'),
                         ('context_is_pure_escapism', 'pure escapism'), ('context_is_comfort_watch', 'a comfort watch'),
                         ('context_is_background_friendly', 'fine in the background'),
                         ('context_is_binge_friendly', 'made for bingeing'), ('suitability_kids', 'suitable for kids')):
        facts[label] = np.array([number(x.get(field)) for x in infos])
    years = np.array([number(x.get('release_year')) for x in infos])
    facts['made before 1990'] = np.where(np.isfinite(years), years < 1990, np.nan)
    facts['made since 2015'] = np.where(np.isfinite(years), years >= 2015, np.nan)
    pool_themes = themes[catalog.pool]
    thirds = np.quantile(pool_themes, [1 / 3, 2 / 3], axis=0)
    scale = np.array([pool_themes[pool_themes[:, j] >= thirds[1, j], j].mean() -
                      pool_themes[pool_themes[:, j] <= thirds[0, j], j].mean() for j in range(16)])
    return Features(catalog, model, kinds, themes, scale, thirds, quality, gap,
                    np.array(list(facts.values())).T, tuple(facts), states)
