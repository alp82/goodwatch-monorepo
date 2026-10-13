"""Shared pieces for the structure agent's predictors. Nothing here reads ratings."""
import os, sys, numpy as np
from sklearn.cluster import KMeans
from sklearn.linear_model import RidgeCV
AL = np.logspace(-1, 4, 16)
CRAFT = ['direction', 'acting', 'cinematography', 'editing', 'music_composition', 'dialogue_quality', 'narrative_structure', 'rewatchability']
SCORES = ['goodwatch_overall_score_normalized_percent', 'imdb_user_score_normalized_percent', 'metacritic_meta_score_normalized_percent',
          'rotten_tomatoes_tomato_score_normalized_percent', 'rotten_tomatoes_audience_score_normalized_percent', 'tmdb_user_score_normalized_percent']
_c = {}
def scores(D):
    """Six public scores, missing filled with the median, standardized over the catalog."""
    if 'S' not in _c:
        f = lambda v: np.nan if v is None else float(v)
        S = np.array([[f(x[c]) for c in SCORES] for x in D.info]); S = np.where(np.isnan(S), np.nanmedian(S, 0), S)
        _c['S'] = (S - S.mean(0)) / S.std(0)
    return _c['S']
def cols(D):
    cr = [D.fp_keys.index(k) for k in CRAFT]; return cr, [i for i in range(len(D.fp_keys)) if i not in cr]
def regions(D, k=6, T=0.2):
    """Soft membership of every title in k regions of title space: k-means over the whole catalog on the 66 non-craft attributes."""
    if ('G', k) not in _c:
        A = D.Z[:, cols(D)[1]]; km = KMeans(k, n_init=10, random_state=0).fit(A); d = km.transform(A) ** 2
        G = np.exp(-(d - d.min(1, keepdims=True)) / (T * A.shape[1])); _c[('G', k)] = (G / G.sum(1, keepdims=True), km)
    return _c[('G', k)]
def chain(blocks, tr, y, te):
    """Each block is a ridge fitted on what the blocks before it left unexplained. Returns prediction, models, last residual."""
    r = y.astype(float).copy(); p = np.zeros(len(te)); ms = []
    for M in blocks:
        m = RidgeCV(alphas=AL).fit(M[tr], r); r = r - m.predict(M[tr]); p += m.predict(M[te]); ms.append(m)
    return p, ms, r
