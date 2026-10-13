"""The best predictor so far: boosted trees on the 74 standardized attributes plus title facts."""
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
_X = None
def features(D):
    global _X
    if _X is None:
        f = lambda v: np.nan if v is None else float(v)
        cols = ['goodwatch_overall_score_normalized_percent', 'imdb_user_score_normalized_percent', 'metacritic_meta_score_normalized_percent',
                'rotten_tomatoes_tomato_score_normalized_percent', 'rotten_tomatoes_audience_score_normalized_percent', 'tmdb_user_score_normalized_percent', 'release_year']
        genres = sorted({g for x in D.info for g in (x['genres'] or [])})
        F = np.array([[f(x[c]) for c in cols] + [x['media_type'] == 'show', x['original_language_code'] == 'en', x['original_language_code'] == 'ja',
                      np.log10(max(x['goodwatch_overall_score_voting_count'] or 1, 1))] + [g in (x['genres'] or []) for g in genres] for x in D.info], dtype=float)
        _X = np.hstack([D.Z, F])
    return _X
def predict(D, user, tr_idx, tr_y, te_idx):
    X = features(D)
    return HistGradientBoostingRegressor(max_depth=3, max_iter=150, learning_rate=0.05, min_samples_leaf=8, l2_regularization=1.0, random_state=3).fit(X[tr_idx], tr_y).predict(X[te_idx])
