"""Loader for a pack built by pull.py.

    from pack import Pack
    p = Pack()                      # the newest pack under ~/goodwatch-research/taste/packs, or Pack(folder)
    r = p.ratings                   # tier A ratings, in entry order per member
    i = p.title_index(r['title_key'])
    p.titles['fingerprint'][i]      # uint8, 255 where a score is missing

    python3 pack.py [folder]        # check the files against MANIFEST.json and print what the pack holds
    python3 pack.py diff A B        # which titles and columns differ between the title files of two packs

What is in a pack
-----------------
Member tables (`ratings`, `wishlist`, `skipped`, `not_interested`, `favorite`, `watch_state`, `watch_log`,
`imports`, `import_items`, `settings`) are dicts of equally long numpy arrays, sorted by member.

- `member` is a row number in `members`; `members['hash']` is the keyed hash that stands in for the member id.
  `members` also has `is_owner`, `tier` (0 is A, 1 is B), `n_ratings` and `stratum` (a row number in `strata`).
- `title_key` is 1e12 + tmdb id for a movie and 2e12 + tmdb id for a show (0: the row names no title). Turn it into
  a row number of the title files with `title_index`.
- Times are milliseconds since 1970 in UTC. A missing time is `NAT`. A missing whole number is -1.
- A column of words (`state`, `origin`, `source`, ...) is `{'codes': array, 'vocab': list}`; -1 is missing.
  `words(column)` gives the words back.
- `ratings` holds tier A members only. Per rating: `score`, `created_at` (the write time), `updated_at`, `edited`,
  `provenance` (a row number in `provenance_names`: typed, bulk, import), `in_bulk`, `sitting` and `position` (both
  count from 0 per member; a new sitting starts after 6 hours without a rating), `has_review`,
  `import_score_kept`. `wishlist` has `sitting`, `position` and `in_bulk` of its own.
- Tier B members' ratings are not here. Their other rows are, and `tier_b` lists their hashes. The rating columns
  of their import items are -1. Nothing in this module opens the gate file.

Title files, loaded when first used: `titles` (keys, flags `in_pool`, `touched`, `in_catalog`, `has_fingerprint`,
`fingerprint`, `num` columns with NaN or -1 for missing, `text` columns, `emb_row`) and `detail` (texts, tags,
related ids, and for touched titles `cast`, `crew`, `seasons`). `emb(name)` maps an embedding file into memory.
"""
import hashlib
import json
import os
import pickle
import sys

import numpy as np

ROOT = os.path.expanduser('~/goodwatch-research/taste')
NAT = np.iinfo(np.int64).min
TABLES = ('ratings', 'wishlist', 'skipped', 'not_interested', 'favorite', 'watch_state', 'watch_log', 'imports',
          'import_items', 'settings')


def words(column):
    """The words of a coded column, None where missing."""
    vocab = column['vocab']
    return [None if c < 0 else vocab[c] for c in column['codes'].tolist()]


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def newest():
    packs = os.path.join(ROOT, 'packs')
    found = sorted(d for d in os.listdir(packs) if os.path.exists(os.path.join(packs, d, 'MANIFEST.json')))
    if not found:
        raise FileNotFoundError(f'no pack under {packs}')
    return os.path.join(packs, found[-1])


class Pack:
    def __init__(self, folder=None):
        self.folder = os.path.abspath(os.path.expanduser(folder)) if folder else newest()
        self.manifest = json.load(open(os.path.join(self.folder, 'MANIFEST.json')))
        core = self._load('pack.pkl')
        self.until = core['until']
        self.members = core['members']
        self.tier_b = core['tier_b']
        self.tier_names = core['tier_names']
        self.provenance_names = core['provenance_names']
        self.strata = core['strata']
        for name in TABLES:
            setattr(self, name, core[name])
        self._titles = self._detail = None

    def _load(self, name):
        with open(os.path.join(self.folder, name), 'rb') as f:
            return pickle.load(f)

    @property
    def titles(self):
        if self._titles is None:
            self._titles = self._load('titles.pkl')
        return self._titles

    @property
    def detail(self):
        if self._detail is None:
            self._detail = self._load('titles_detail.pkl')
        return self._detail

    @property
    def owner(self):
        """The owner's row number in `members`."""
        return int(np.flatnonzero(self.members['is_owner'])[0])

    def emb(self, name):
        """A text embedding matrix ('text_en_v1' or 'text_multi_v1'); row `titles['emb_row'][i]` is title i."""
        return np.load(os.path.join(self.folder, f'emb_{name}.npy'), mmap_mode='r')

    def title_index(self, keys):
        """Row numbers in the title files for an array of title keys; -1 where the key is not a title."""
        all_keys = self.titles['key']
        keys = np.asarray(keys, dtype=np.int64)
        at = np.minimum(np.searchsorted(all_keys, keys), len(all_keys) - 1)
        return np.where(all_keys[at] == keys, at, -1)

    def info(self, i):
        """Everything known about title i as one dict, in the shape the first loop's pack used."""
        t, d = self.titles, self.detail
        out = {'media_type': t['media_types'][t['media_type'][i]], 'tmdb_id': int(t['tmdb_id'][i]),
               'release_date': None if t['release_date'][i] == NAT else int(t['release_date'][i])}
        for c, v in t['num'].items():
            x = v[i]
            if v.dtype.kind == 'f':
                out[c] = None if np.isnan(x) else float(x)
            elif v.dtype == np.int8:
                out[c] = None if x < 0 else bool(x)
            else:
                out[c] = None if x < 0 else int(x)
        for c, v in t['text'].items():
            out[c] = v[i]
        for c, v in d['cols'].items():
            out[c] = v[i]
        for c in ('cast', 'crew', 'seasons'):
            out[c] = d[c][i]
        return out

    def check(self):
        """Compare every data file with the hash in the manifest. Returns the names that differ."""
        return [name for name, digest in self.manifest['files_sha256'].items()
                if sha256(os.path.join(self.folder, name)) != digest]

    def summary(self):
        t = self.titles
        lines = [f'pack {self.folder}', f'until {self.manifest["until"]}',
                 f'members {len(self.members["hash"])} (tier A {int((self.members["tier"] == 0).sum())}, '
                 f'tier B {len(self.tier_b)})']
        for name in TABLES:
            table = getattr(self, name)
            lines.append(f'{name}: {len(table["member"])} rows')
        r = self.ratings
        dated = bool((r['created_at'] != NAT).all() and (r['updated_at'] != NAT).all())
        lines.append(f'ratings: all with both dates {dated}; provenance values '
                     f'{sorted(set(r["provenance"].tolist()))} of {self.provenance_names}')
        lines.append(f'titles {len(t["key"])}: pool {int(t["in_pool"].sum())}, touched {int(t["touched"].sum())}, '
                     f'with a fingerprint {int(t["has_fingerprint"].sum())}')
        return '\n'.join(lines)


def _same(x, y):
    if isinstance(x, np.ndarray):
        return (x == y) | ((x != x) & (y != y)) if x.dtype.kind == 'f' else (x == y)
    return np.array([a == b for a, b in zip(x, y)], dtype=bool)


def diff(a, b):
    """Print how the title files of two pack folders differ: titles added or removed, and per column the number of
    titles whose value changed."""
    out = []
    for name, groups in (('titles.pkl', ('num', 'text')), ('titles_detail.pkl', ('cols',))):
        x, y = (pickle.load(open(os.path.join(f, name), 'rb')) for f in (a, b))
        if not np.array_equal(x['key'], y['key']):
            both = np.intersect1d(x['key'], y['key'])
            out.append(f'{name}: {len(x["key"]) - len(both)} titles only in A, {len(y["key"]) - len(both)} only in B')
            continue
        changed = np.zeros(len(x['key']), bool)
        cols = [(k, x[k], y[k]) for k in x if k in y and k not in groups and k != 'key'
                and isinstance(x[k], (np.ndarray, list)) and len(x[k]) == len(x['key'])]
        cols += [(f'{g}.{c}', x[g][c], y[g][c]) for g in groups for c in x[g]]
        for label, u, v in cols:
            same = _same(u, v)
            same = same.all(axis=1) if getattr(same, 'ndim', 1) > 1 else same
            if not same.all():
                out.append(f'{name}: {label} differs for {int((~same).sum())} titles')
                changed |= ~same
        out.append(f'{name}: {int(changed.sum())} of {len(changed)} titles differ in any column')
    print('\n'.join(out))


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == 'diff':
        diff(sys.argv[2], sys.argv[3])
    else:
        p = Pack(sys.argv[1] if len(sys.argv) > 1 else None)
        print(p.summary())
        bad = p.check()
        print('files match the manifest' if not bad else f'FILES DIFFER FROM THE MANIFEST: {bad}')
