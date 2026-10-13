"""Rating-independent text/tag features, cached in this folder (feats.pkl)."""
import os, pickle, re
import numpy as np, scipy.sparse as sp
HERE = os.path.dirname(os.path.abspath(__file__))
_C = None
def _tagmat(lists, min_df=2):
    from collections import Counter
    c = Counter(t for l in lists for t in set(l))
    vocab = sorted(t for t, n in c.items() if n >= min_df); ix = {t: i for i, t in enumerate(vocab)}
    r, cc = [], []
    for i, l in enumerate(lists):
        for t in set(l):
            if t in ix: r.append(i); cc.append(ix[t])
    return sp.csr_matrix((np.ones(len(r), dtype=np.float32), (r, cc)), shape=(len(lists), len(vocab))), vocab
def build(D):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.decomposition import TruncatedSVD, PCA
    I = D.info; out = {}
    low = lambda l: [str(t).strip().lower() for t in (l or [])]
    out['tropes'] = _tagmat([list(x['tropes'] or []) for x in I], 3)
    out['keywords'] = _tagmat([low(x['keywords']) for x in I], 3)
    out['essence_tags'] = _tagmat([low(x['essence_tags']) for x in I], 2)
    out['essence_words'] = _tagmat([[w for t in low(x['essence_tags']) for w in re.findall(r"[a-z0-9']+", t) if len(w) > 2] for x in I], 3)
    misc = []
    for x in I:
        l = ['genre:' + g for g in (x['genres'] or [])] + ['hl:' + k for k in (x['fingerprint_highlight_keys'] or [])]
        l += [k for k in x if (k.startswith('suitability_') or k.startswith('context_')) and x[k]]
        l += ['method:' + str(x['production_method']), 'anim:' + str(x['animation_style']), 'lang:' + str(x['original_language_code']), 'type:' + x['media_type']]
        if x['is_anime']: l.append('anime')
        l += ['cert:' + c for c in (x['age_certifications'] or []) if c.startswith('US_') or c.startswith('DE_')]
        l += ['country:' + c for c in (x['origin_country_codes'] or [])]
        misc.append(l)
    out['misc'] = _tagmat(misc, 3)
    txt = [((x['essence_text'] or '') + ' ' + (x['synopsis'] or '')) for x in I]
    tv = TfidfVectorizer(min_df=3, max_df=0.5, sublinear_tf=True, stop_words='english', ngram_range=(1, 2), max_features=60000)
    T = tv.fit_transform(txt).astype(np.float32); out['tfidf'] = (T, list(tv.get_feature_names_out()))
    tv2 = TfidfVectorizer(min_df=3, max_df=0.5, sublinear_tf=True, stop_words='english', ngram_range=(1, 2), max_features=40000)
    T2 = tv2.fit_transform([x['essence_text'] or '' for x in I]).astype(np.float32); out['tfidf_ess'] = (T2, list(tv2.get_feature_names_out()))
    out['tfidf_svd'] = TruncatedSVD(128, random_state=0).fit_transform(T).astype(np.float32)
    # all tags tf-idf -> svd (topic space of tags)
    from sklearn.feature_extraction.text import TfidfTransformer
    A = sp.hstack([out[k][0] for k in ('tropes', 'keywords', 'essence_words', 'misc')]).tocsr()
    out['tags_svd'] = TruncatedSVD(96, random_state=0).fit_transform(TfidfTransformer(sublinear_tf=True).fit_transform(A)).astype(np.float32)
    for k, E in D.emb.items():
        E = E / np.linalg.norm(E, axis=1, keepdims=True)
        out['emb_' + k] = E.astype(np.float32)
        out['pca_' + k] = PCA(64, random_state=0).fit_transform(E).astype(np.float32)
    out['has_tropes'] = np.array([bool(x['tropes']) for x in I])
    return out
def get(D):
    global _C
    if _C is None:
        p = os.path.join(HERE, 'feats.pkl')
        if os.path.exists(p): _C = pickle.load(open(p, 'rb'))
        else:
            _C = build(D); pickle.dump(_C, open(p + '.tmp', 'wb'), protocol=4); os.replace(p + '.tmp', p)
    return _C
