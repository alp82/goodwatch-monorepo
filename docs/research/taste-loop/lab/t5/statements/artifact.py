"""Freeze six kinds and sixteen tag axes on the rating-free reference pool."""
import hashlib
import json
import os
from pathlib import Path
import platform

import numpy as np
import scipy
from scipy import sparse
import sklearn
from sklearn.cluster import KMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfTransformer
from threadpoolctl import threadpool_limits

from .data import CRAFT, encoded

RECIPE = dict(k=6, n_init=10, random_state=0, text_axes=16, text_seed=20261013,
              imputation='pool mean; all-missing column zero; zero SD one', threads=1,
              tags='binary namespaced tags, min_df=3; sublinear TF, smooth IDF, L2; SVD then pool z/clip 2.5')


def versions():
    return dict(python=platform.python_version(), numpy=np.__version__, scipy=scipy.__version__,
                sklearn=sklearn.__version__)


def tags(info):
    """Old tag recipe's rating-free families; retain whole tags and essence words."""
    out = set()
    for name in ('tropes', 'keywords', 'essence_tags', 'genres', 'fingerprint_highlight_keys',
                 'origin_country_codes', 'age_certifications'):
        out.update(name + ':' + str(t).strip().lower() for t in (info.get(name) or []))
    # Word splitting is text tokenization, never sequel detection.
    import re
    out.update('essence_word:' + w for t in (info.get('essence_tags') or [])
               for w in re.findall(r"[a-z0-9']+", str(t).lower()) if len(w) > 2)
    for name in ('production_method', 'animation_style', 'original_language_code', 'media_type'):
        if info.get(name) is not None:
            out.add(name + ':' + str(info[name]).lower())
    out.update(k for k, v in info.items() if (k.startswith('context_') or k.startswith('suitability_')) and v is True)
    if info.get('is_anime') is True:
        out.add('anime')
    return out


def tag_matrix(documents, vocabulary):
    lookup = {s: j for j, s in enumerate(vocabulary)}
    rows, cols = [], []
    for i, doc in enumerate(documents):
        for word in sorted(doc):
            if word in lookup:
                rows.append(i)
                cols.append(lookup[word])
    return sparse.csr_matrix((np.ones(len(rows)), (rows, cols)), shape=(len(documents), len(vocabulary)))


def standardize(raw):
    n = np.isfinite(raw).sum(0)
    mean = np.divide(np.nansum(raw, axis=0), n, out=np.zeros(raw.shape[1]), where=n > 0)
    filled = np.where(np.isfinite(raw), raw, mean)
    sd = filled.std(0)
    sd[sd < 1e-12] = 1
    return (filled - mean) / sd, mean, sd


def tfidf(matrix, idf):
    weighted = matrix.multiply(np.asarray(idf)).tocsr()
    norm = np.sqrt(weighted.multiply(weighted).sum(1)).A1
    return sparse.diags(1 / np.maximum(norm, 1e-12)) @ weighted


@threadpool_limits.wrap(limits=1)
def fit(catalog):
    """No history argument exists: neither ratings nor selection on ratings can enter."""
    selected = [i for i, key in enumerate(catalog.fp_keys) if key not in CRAFT]
    if len(selected) != 66 or not set(CRAFT).issubset(catalog.fp_keys):
        raise ValueError('expected 74 fingerprint keys with exactly 66 non-craft keys')
    pool = np.flatnonzero(catalog.pool)
    if len(pool) < 17:
        raise ValueError('reference pool too small for six kinds and sixteen text axes')
    x, mean, sd = standardize(catalog.fingerprint[pool][:, selected])
    documents = [tags(catalog.info[int(catalog.keys[i])]) for i in pool]
    counts = {}
    for doc in documents:
        for word in doc:
            counts[word] = counts.get(word, 0) + 1
    vocabulary = sorted(w for w, n in counts.items() if n >= 3)
    if len(vocabulary) < 17:
        raise ValueError('pool tags cannot support sixteen axes; do not silently lower dimension')
    matrix = tag_matrix(documents, vocabulary)
    with threadpool_limits(limits=1):
        km = KMeans(n_clusters=6, n_init=10, random_state=0).fit(x)
        if len(set(km.labels_.tolist())) != 6:
            raise ValueError('pool cannot support six distinct kinds; do not lower k')
        transformer = TfidfTransformer(sublinear_tf=True)
        text = transformer.fit_transform(matrix)
        svd = TruncatedSVD(n_components=16, random_state=20261013).fit(text)
        axes = svd.transform(text)
    _, text_mean, text_sd = standardize(axes)
    kind_names, exemplars = [], []
    key_names = [catalog.fp_keys[j] for j in selected]
    for j, center in enumerate(km.cluster_centers_):
        attributes = sorted(range(66), key=lambda a: (-center[a], key_names[a]))[:4]
        kind_names.append(', '.join(key_names[a].replace('_', ' ') for a in attributes))
        candidates = np.flatnonzero(km.labels_ == j)
        ordered = sorted(candidates, key=lambda i: (float(np.sum((x[i] - center) ** 2)), int(catalog.keys[pool[i]])))
        exemplars.append([int(catalog.keys[pool[i]]) for i in ordered[:3]])
    themes = []
    for component in svd.components_:
        hi = sorted(range(len(vocabulary)), key=lambda j: (-component[j], vocabulary[j]))[:4]
        lo = sorted(range(len(vocabulary)), key=lambda j: (component[j], vocabulary[j]))[:4]
        themes.append(dict(hi=[vocabulary[j] for j in hi], lo=[vocabulary[j] for j in lo]))
    return dict(schema=1, recipe=RECIPE, versions=versions(), catalog_sha256=catalog.identity(),
                fp_keys=key_names, mean=mean.tolist(), sd=sd.tolist(), centers=km.cluster_centers_.tolist(),
                pool_keys=catalog.keys[pool].tolist(), memberships=km.labels_.tolist(), kind_names=kind_names,
                exemplars=exemplars, vocabulary=vocabulary, idf=transformer.idf_.tolist(),
                components=svd.components_.tolist(), text_mean=text_mean.tolist(), text_sd=text_sd.tolist(),
                theme_names=themes)


def save(model, data_root):
    """Content-addressed private artifacts belong under an explicit data root."""
    root = Path(data_root).expanduser().resolve()
    repo = next(p for p in Path(__file__).resolve().parents if (p / '.git').exists())
    if root == repo or repo in root.parents:
        raise ValueError('artifacts must be outside the repository under the data root')
    payload = encoded(model)
    sha = hashlib.sha256(payload).hexdigest()
    folder = root / 'work' / 'statements' / sha
    for directory in (root / 'work', root / 'work' / 'statements', folder):
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(directory, 0o700)
    path = folder / 'model.json'
    if path.exists():
        if path.read_bytes() != payload:
            raise ValueError('existing content-addressed artifact changed')
    else:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as f:
            f.write(payload)
    os.chmod(path, 0o600)
    return path, sha


def load(path, expected_sha256, catalog):
    payload = Path(path).read_bytes()
    if hashlib.sha256(payload).hexdigest() != expected_sha256:
        raise ValueError('artifact hash changed')
    model = json.loads(payload)
    if model['schema'] != 1 or model['recipe'] != RECIPE or model['versions'] != versions():
        raise ValueError('artifact recipe or library versions changed')
    if model['catalog_sha256'] != catalog.identity():
        raise ValueError('catalog hash changed')
    return model


@threadpool_limits.wrap(limits=1)
def transform(catalog, model):
    """Out-of-pool titles go through the frozen means, centers, IDF and SVD."""
    if model['catalog_sha256'] != catalog.identity():
        raise ValueError('catalog hash changed')
    columns = [catalog.fp_keys.index(k) for k in model['fp_keys']]
    raw = catalog.fingerprint[:, columns]
    x = (np.where(np.isfinite(raw), raw, model['mean']) - model['mean']) / model['sd']
    distances = ((x[:, None, :] - np.asarray(model['centers'])[None, :, :]) ** 2).sum(2)
    docs = [tags(catalog.info[int(k)]) for k in catalog.keys]
    matrix = tfidf(tag_matrix(docs, model['vocabulary']), model['idf'])
    axes = np.asarray(matrix @ np.asarray(model['components']).T)
    axes = np.clip((axes - model['text_mean']) / model['text_sd'], -2.5, 2.5)
    return distances.argmin(1), axes
