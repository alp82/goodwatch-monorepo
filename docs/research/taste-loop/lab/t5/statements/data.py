"""Rating-free catalog interface. Joins use title keys, never embedding/cache rows."""
from dataclasses import dataclass, field
import hashlib
import json

import numpy as np

CRAFT = ('direction', 'acting', 'cinematography', 'editing', 'music_composition',
         'dialogue_quality', 'narrative_structure', 'rewatchability')
AUD = ('imdb_user_score_normalized_percent', 'tmdb_user_score_normalized_percent',
       'rotten_tomatoes_audience_score_normalized_percent')
CRIT = ('metacritic_meta_score_normalized_percent', 'rotten_tomatoes_tomato_score_normalized_percent')


def encoded(value):
    """Canonical bytes also make artifacts independent of archive timestamps."""
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
                      allow_nan=False).encode('utf-8')


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


@dataclass
class Catalog:
    """Only title data; callers supply already eligible early ratings separately.

    complete_series optionally records *exhaustive* franchise membership from frozen facts.
    The current pack lacks that evidence: never infer it from observed membership.
    """
    keys: np.ndarray
    fingerprint: np.ndarray
    fp_keys: tuple
    in_pool: np.ndarray
    has_fingerprint: np.ndarray
    info: dict
    complete_series: dict = field(default_factory=dict)

    def __post_init__(self):
        self.keys = np.asarray(self.keys, dtype=np.int64)
        if len(set(self.keys.tolist())) != len(self.keys):
            raise ValueError('duplicate catalog title key')
        self.info = {int(k): dict(v) for k, v in self.info.items()}
        if set(self.info) != set(self.keys.tolist()):
            raise ValueError('catalog facts must join exactly on title keys')
        order = np.argsort(self.keys)
        self.keys = self.keys[order]
        self.fingerprint = np.asarray(self.fingerprint, dtype=float)[order].copy()
        self.fingerprint[self.fingerprint == 255] = np.nan
        self.in_pool = np.asarray(self.in_pool, dtype=bool)[order]
        self.has_fingerprint = np.asarray(self.has_fingerprint, dtype=bool)[order]
        self.fp_keys = tuple(self.fp_keys)
        if self.fingerprint.shape != (len(self.keys), len(self.fp_keys)):
            raise ValueError('fingerprint shape/key order mismatch')
        self.index = {int(k): i for i, k in enumerate(self.keys)}

    @property
    def pool(self):
        return self.in_pool & self.has_fingerprint

    def identity(self):
        fp = [[None if not np.isfinite(x) else float(x) for x in row] for row in self.fingerprint]
        return digest(dict(keys=self.keys.tolist(), fp_keys=self.fp_keys, fingerprint=fp,
                           in_pool=self.in_pool.tolist(), has_fingerprint=self.has_fingerprint.tolist(),
                           info=self.info, complete_series=self.complete_series))

    def rows(self, keys):
        try:
            return np.array([self.index[int(k)] for k in keys], dtype=int)
        except KeyError as e:
            raise ValueError('history title absent from catalog') from e


def from_pack(pack):
    """Read titles only, without touching member tables or the pack's default loader."""
    t = pack.titles
    return Catalog(t['key'], t['fingerprint'], tuple(t['fingerprint_keys']), t['in_pool'],
                   t['has_fingerprint'], {int(k): pack.info(i) for i, k in enumerate(t['key'])})
