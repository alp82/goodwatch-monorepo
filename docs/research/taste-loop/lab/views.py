"""Views: what a predictor may see, with the hidden labels physically absent.

A view is a folder:

    view.bin      the task, the predicted member's rows written before the block, and the titles to predict
    others.bin    the rows of every other tier A member (a hard link to one file per member)

and the shared title file `titles.npz`, which holds no member data at all. The answers are returned to the caller
and written, when asked, to a file outside the views folder. Nothing in a view names the member, the block, the
answer file, the pack or the gate.

What `predict(view)` receives (built from those files by sandbox.py):

    view['task']                      'T1'
    view['targets']['title']          title rows to predict, sorted by title key: no rating, no time, no order
    view['me']['ratings']             title, score, created_at, sitting, position, in_bulk, provenance, edited
    view['me']['want_to_see']         title, created_at, in_bulk
    view['me']['skip']                title, created_at
    view['me']['not_interested']      title, created_at
    view['others'][<same tables>]     the same columns plus `member` (a number that only groups rows)
    view['titles']                    see export_titles
    view['provenance_names']          ['typed', 'bulk', 'import']

Every `title` is a row number in view['titles']. Times are milliseconds since 1970.

T1 (PLAN.md 2.2): a member's ratings in entry order are cut at 5, 10, 20, 40, 80, 160, 320 and 640 ratings. A cut is
never placed between two ratings written less than 2 seconds apart (which keeps every bulk write whole); it moves to
the nearest place where it may be, the later one on a tie, and never below 5. Each block is predicted from what the
member wrote before its first rating. Ratings in a bulk write are never targets.

Edits. A rating keeps its first write time and carries its current score. A history rating that was edited at or
after the block's first rating (`updated_at` not before the cutoff) is left out of the view: its score at the time
is unknown. With `--others before` the same holds for other members' ratings. A target whose rating was edited
later stays a target and is flagged in the answers, so the measures can be given with and without such targets.

    python3 views.py T1 <member hash prefix | owner> <out folder>     # writes the views of one member, to look at
"""
import hashlib
import json
import os
import shutil
import sys

import numpy as np

from common import NAT, SEED, sha256_arrays

SCHEMA = 2
NOMINAL = (5, 10, 20, 40, 80, 160, 320, 640)
MOMENT_MS = 2000
MIN_RATINGS = 6
FOLDS = 5
MIN_CALIBRATION_HISTORY = 10
TWO_YEARS_MS = 2 * 365.25 * 86400 * 1000
RATING_COLS = ('score', 'created_at', 'sitting', 'position', 'in_bulk', 'provenance', 'edited')
OTHER_TABLES = {'want_to_see': ('wishlist', ('created_at', 'in_bulk')), 'skip': ('skipped', ('created_at',)),
                'not_interested': ('not_interested', ('created_at',))}
NUM_SKIP = ()


# ------------------------------------------------------------------ titles

def export_titles(pack, path):
    """Write the title data a predictor may see as one npz without pickles. Returns its content hash.

    key, media_type (0 movie, 1 show), in_catalog, in_pool, has_poster, has_fingerprint, fingerprint (uint8, 255 is
    missing), fingerprint_keys, release_date (ms, NAT missing), num.<column> (NaN or -1 missing), genres (titles x
    genre_names, bool), language, production_method, animation_style (codes into <name>_names, -1 missing),
    country_title and country (pairs of title row and code into country_names).
    Left out: `touched` and the embedding rows, which show which titles members interacted with, and the title text.
    """
    t = pack.titles
    n = len(t['key'])
    out = {'key': t['key'], 'media_type': t['media_type'], 'in_catalog': t['in_catalog'], 'in_pool': t['in_pool'],
           'has_poster': t['has_poster'], 'has_fingerprint': t['has_fingerprint'], 'fingerprint': t['fingerprint'],
           'fingerprint_keys': np.array(t['fingerprint_keys']), 'release_date': t['release_date']}
    for c, v in t['num'].items():
        out[f'num.{c}'] = v
    text = t['text']
    names = sorted({g for gs in text['genres'] if gs for g in gs})
    at = {g: j for j, g in enumerate(names)}
    genres = np.zeros((n, len(names)), bool)
    for i, gs in enumerate(text['genres']):
        for g in gs or ():
            genres[i, at[g]] = True
    out['genres'], out['genre_names'] = genres, np.array(names)
    for col, name in (('original_language_code', 'language'), ('production_method', 'production_method'),
                      ('animation_style', 'animation_style')):
        vocab = sorted({x for x in text[col] if x})
        at = {x: j for j, x in enumerate(vocab)}
        out[name] = np.array([at[x] if x else -1 for x in text[col]], np.int16)
        out[f'{name}_names'] = np.array(vocab)
    vocab = sorted({c for cs in text['origin_country_codes'] if cs for c in cs})
    at = {x: j for j, x in enumerate(vocab)}
    pairs = [(i, at[c]) for i, cs in enumerate(text['origin_country_codes']) for c in cs or ()]
    out['country_title'] = np.array([p[0] for p in pairs], np.int32)
    out['country'] = np.array([p[1] for p in pairs], np.int16)
    out['country_names'] = np.array(vocab)
    digest = sha256_arrays(out)
    if path:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + f'.tmp{os.getpid()}'
        with open(tmp, 'wb') as f:
            np.savez(f, **out)
        os.replace(tmp, path)
    return digest


# ------------------------------------------------------------------ T1 blocks

def t1_cuts(created_at, in_bulk):
    """The block starts of one member, as (position, nominal boundary) pairs, for ratings in entry order."""
    n = len(created_at)
    gap = np.diff(created_at)
    whole = in_bulk[1:] & in_bulk[:-1] & (gap <= MOMENT_MS)
    allowed = np.flatnonzero((gap >= MOMENT_MS) & ~whole) + 1            # a cut at c: history is rows 0..c-1
    allowed = allowed[allowed >= NOMINAL[0]]
    cuts = {}
    for b in NOMINAL:
        if b >= n or len(allowed) == 0:
            break
        d = np.abs(allowed - b)
        c = int(allowed[np.flatnonzero(d == d.min())[-1]])                # the later one on a tie
        cuts.setdefault(c, b)
    return sorted(cuts.items())


def t1_blocks(created_at, in_bulk):
    """[(start, end, nominal, target positions)] for one member; blocks without a target are left out."""
    cuts = t1_cuts(created_at, in_bulk)
    out = []
    for j, (c, b) in enumerate(cuts):
        e = cuts[j + 1][0] if j + 1 < len(cuts) else len(created_at)
        targets = c + np.flatnonzero(~in_bulk[c:e])
        if len(targets):
            out.append((c, e, b, targets))
    return out


# ------------------------------------------------------------------ building

def _rows(table, mask, cols, title_rows):
    out = {'title': title_rows[mask].astype(np.int32)}
    for c in cols:
        out[c] = table[c][mask]
    return out


def _fold_of(title_keys, seed):
    """A fold number per history rating: a fixed pseudo-random order of the titles, dealt round."""
    order = np.argsort([hashlib.sha256(f'{seed}|{int(k)}'.encode()).digest() for k in title_keys], kind='stable')
    fold = np.empty(len(title_keys), np.int64)
    fold[order] = np.arange(len(title_keys)) % FOLDS
    return fold


def _vid(*parts):
    return hashlib.sha256('|'.join(str(p) for p in parts).encode()).hexdigest()[:16]


MAGIC = b'TASTEVW1'


def save_arrays(path, arrays):
    """Named arrays in one file: a magic word, the length of a JSON header, the header (name, dtype, shape,
    offset), then the bytes. No pickle, no compression; read back with one read."""
    header, blobs, offset = [], [], 0
    for name in sorted(arrays):
        a = np.ascontiguousarray(arrays[name])
        assert a.dtype.kind in 'biufU', (name, a.dtype)
        header.append({'name': name, 'dtype': a.dtype.str, 'shape': list(a.shape), 'offset': offset,
                       'bytes': a.nbytes})
        blobs.append(a.tobytes())
        offset += a.nbytes
    head = json.dumps(header).encode()
    with open(path, 'wb') as f:
        f.write(MAGIC + len(head).to_bytes(8, 'little') + head + b''.join(blobs))


def load_arrays(name, dir_fd=None):
    with os.fdopen(os.open(name, os.O_RDONLY, dir_fd=dir_fd), 'rb') as f:
        data = f.read()
    assert data[:8] == MAGIC, 'not a view file'
    n = int.from_bytes(data[8:16], 'little')
    header = json.loads(data[16:16 + n])
    body = bytearray(data[16 + n:])
    out = {}
    for h in header:
        dtype = np.dtype(h['dtype'])
        out[h['name']] = np.frombuffer(body, dtype, int(np.prod(h['shape'], dtype=np.int64)),
                                       h['offset']).reshape(h['shape'])
    return out


def _save(path, arrays):
    save_arrays(path, arrays)


def _flat(prefix, table):
    return {f'{prefix}.{c}': v for c, v in table.items()}


def shuffled_scores(ratings, seed):
    """Each member's ratings permuted among that member's titles (the shuffled-label control)."""
    score = ratings['score'].copy()
    rng = np.random.default_rng(seed)
    member = ratings['member']
    for u in np.unique(member):
        at = np.flatnonzero(member == u)
        score[at] = score[at][rng.permutation(len(at))]
    return score


def build_t1(pack, folder, own=None, members=None, others_mode='all', shuffle_seed=None, write=True):
    """Build the T1 views of the given members (rows in pack.members; default: every eligible member of `own`).

    own           the ratings table the predicted members' rows come from. Default: pack.ratings (tier A). gate.py
                  passes the gate table; the others of a gate member are all tier A members.
    others_mode   'all': every other tier A member's rows. 'no-owner': the same without the owner (a population
                  fit with the owner left out). 'before': only what others had written before the block.
    shuffle_seed  permute every member's ratings among their titles first (control).

    Returns (index, keys, digest):
      index   one dict per view: vid, kind ('main' or 'cal'), member, block, parent (the main view a calibration
              view belongs to), fold.
      keys    vid -> the answers and what the measures need: title, score, sitting, same_sitting, media, provenance,
              has_fingerprint, old_title, edited (the rating was edited after it was first written), franchise (the
              movie series, else a number of the title's own), and history_score (the member's visible ratings).
      digest  one hash over everything the views hold.
    """
    assert others_mode in ('all', 'no-owner', 'before')
    T = pack.titles
    tier = pack.members['tier']
    pool = dict(pack.ratings)
    own_is_pool = own is None
    own = pool if own_is_pool else dict(own)
    if shuffle_seed is not None:
        pool['score'] = shuffled_scores(pool, shuffle_seed)
        if own_is_pool:
            own = pool
    pool_title = pack.title_index(pool['title_key'])
    own_title = pack.title_index(own['title_key'])
    assert (pool_title >= 0).all() and (own_title >= 0).all()
    side = {}
    for name, (table_name, cols) in OTHER_TABLES.items():
        table = getattr(pack, table_name)
        rows = pack.title_index(table['title_key'])
        keep = rows >= 0
        side[name] = ({c: v[keep] for c, v in table.items() if not isinstance(v, dict)}, rows[keep], cols)
    in_a = tier[pool['member']] == 0
    assert in_a.all()
    owner = pack.owner
    series = T['num'].get('movie_series_id')
    franchise = np.where(series > 0, series, -1 - np.arange(len(T['key']))).astype(np.int64) if series is not None \
        else -1 - np.arange(len(T['key']), dtype=np.int64)

    counts = np.bincount(own['member'], minlength=len(tier))
    eligible = np.flatnonzero(counts >= MIN_RATINGS)
    if members is not None:
        eligible = np.array([m for m in eligible if m in set(int(x) for x in members)], dtype=np.int64)

    if write:
        os.makedirs(os.path.join(folder, 'others'), exist_ok=True)
    index, keys, digests = [], {}, {}

    def others_arrays(u, before=None):
        arrays = {}
        m = pool['member'] != u
        if others_mode == 'no-owner':
            m &= pool['member'] != owner
        if before is not None:                              # written before the block and not edited since
            m &= (pool['created_at'] < before) & (pool['updated_at'] < before)
        rows = _rows(pool, m, RATING_COLS, pool_title)
        rows['member'] = pool['member'][m]
        arrays.update(_flat('ratings', rows))
        for name, (table, trow, cols) in side.items():
            m = (table['member'] != u) & (tier[table['member']] == 0)
            if others_mode == 'no-owner':
                m &= table['member'] != owner
            if before is not None:
                m &= table['created_at'] < before
            rows = _rows(table, m, cols, trow)
            rows['member'] = table['member'][m]
            arrays.update(_flat(name, rows))
        return arrays

    def emit(vid, u, history, targets, cutoff, others_file, others_digest):
        """history: positions in the member's rows that are visible; targets: positions to predict."""
        me = _rows(mine, history, RATING_COLS, mine_title)
        arrays = _flat('me.ratings', me)
        for name, (table, trow, cols) in side.items():
            m = (table['member'] == u) & (table['created_at'] < cutoff)
            arrays.update(_flat(f'me.{name}', _rows(table, m, cols, trow)))
        t_rows = mine_title[targets]
        order = np.argsort(T['key'][t_rows], kind='stable')
        arrays['targets.title'] = t_rows[order].astype(np.int32)
        arrays['task'] = np.array('T1')
        arrays['schema'] = np.array(SCHEMA)
        arrays['provenance_names'] = np.array(pack.provenance_names)
        digests[vid] = sha256_arrays(arrays) + others_digest
        if write:
            d = os.path.join(folder, 'views', vid)
            os.makedirs(d)
            _save(os.path.join(d, 'view.bin'), arrays)
            os.link(others_file, os.path.join(d, 'others.bin'))
        return targets[order]

    for u in eligible.tolist():
        at = np.flatnonzero(own['member'] == u)
        at = at[np.argsort(own['position'][at], kind='stable')]
        mine = {c: own[c][at] for c in ('title_key', 'updated_at') + RATING_COLS}
        mine_title = own_title[at]
        assert (np.diff(mine['created_at']) >= 0).all()
        blocks = t1_blocks(mine['created_at'], mine['in_bulk'])
        if not blocks:
            continue
        mh = pack.members['hash'][u]
        shared = None
        if others_mode != 'before':
            arrays = others_arrays(u)
            shared = (os.path.join(folder, 'others', f'{_vid(mh, others_mode)}.bin'), sha256_arrays(arrays))
            if write:
                _save(shared[0], arrays)
        release = T['release_date'][mine_title]
        for (c, e, nominal, targets) in blocks:
            cutoff = int(mine['created_at'][c])
            if shared is None:
                arrays = others_arrays(u, cutoff)
                o_file, o_digest = os.path.join(folder, 'others', f'{_vid(mh, nominal, "before")}.bin'), \
                    sha256_arrays(arrays)
                if write:
                    _save(o_file, arrays)
            else:
                o_file, o_digest = shared
            vid = _vid(mh, 'T1', nominal, 'main')
            history = np.flatnonzero(mine['updated_at'][:c] < cutoff)   # not edited at or after the cutoff
            order = emit(vid, u, history, targets, cutoff, o_file, o_digest)
            index.append({'vid': vid, 'kind': 'main', 'member': u, 'block': nominal, 'parent': None, 'fold': None})
            keys[vid] = {
                'title': mine_title[order], 'score': mine['score'][order].astype(np.int64),
                'sitting': mine['sitting'][order].astype(np.int64),
                'same_sitting': mine['sitting'][order] == mine['sitting'][c - 1],
                'media': T['media_type'][mine_title[order]].astype(np.int64),
                'provenance': mine['provenance'][order].astype(np.int64),
                'has_fingerprint': T['has_fingerprint'][mine_title[order]],
                'old_title': (release[order] != NAT) & (mine['created_at'][order] - release[order] >= TWO_YEARS_MS),
                'edited': mine['edited'][order].astype(bool) | (mine['updated_at'][order] > mine['created_at'][order]),
                'franchise': franchise[mine_title[order]],
                'history_score': mine['score'][history].astype(np.int64)}
            if len(history) >= MIN_CALIBRATION_HISTORY:
                fold = _fold_of(mine['title_key'][history], SEED)
                for f in range(FOLDS):
                    cal = _vid(mh, 'T1', nominal, 'cal', f)
                    order = emit(cal, u, history[fold != f], history[fold == f], cutoff, o_file, o_digest)
                    index.append({'vid': cal, 'kind': 'cal', 'member': u, 'block': nominal, 'parent': vid, 'fold': f})
                    keys[cal] = {'title': mine_title[order], 'score': mine['score'][order].astype(np.int64)}
    h = hashlib.sha256()
    for vid in sorted(digests):
        h.update(f'{vid}:{digests[vid]}\n'.encode())
    return index, keys, h.hexdigest()


def write_keys(path, index, keys):
    """The answer file: outside the views folder, named by nothing a view holds."""
    arrays = {}
    for v in index:
        for c, a in keys[v['vid']].items():
            arrays[f'{v["vid"]}.{c}'] = a
    os.makedirs(os.path.dirname(path), exist_ok=True)
    save_arrays(path, arrays)
    os.chmod(path, 0o600)


def load_view(view_folder, titles):
    """The dict a predictor receives. `view_folder` is a path or an open folder; `titles` comes from load_titles."""
    dir_fd = view_folder if isinstance(view_folder, int) else None
    at = (lambda name: name if dir_fd is not None else os.path.join(view_folder, name))
    view = {'titles': titles, 'me': {}, 'others': {}, 'targets': {}}
    for name, a in load_arrays(at('view.bin'), dir_fd).items():
        parts = name.split('.')
        if parts[0] == 'me':
            view['me'].setdefault(parts[1], {})[parts[2]] = a
        elif parts[0] == 'targets':
            view['targets'][parts[1]] = a
        elif name == 'provenance_names':
            view[name] = a.tolist()
        else:
            view[name] = a.item()
    for name, a in load_arrays(at('others.bin'), dir_fd).items():
        table, col = name.split('.')
        view['others'].setdefault(table, {})[col] = a
    return view


def load_titles(path):
    titles = {'num': {}}
    with np.load(path, allow_pickle=False) as z:
        for name in z.files:
            if name.startswith('num.'):
                titles['num'][name[4:]] = z[name]
            elif name.endswith('_names') or name == 'fingerprint_keys':
                titles[name] = z[name].tolist()
            else:
                titles[name] = z[name]
    return titles


if __name__ == '__main__':
    from pack import Pack
    if len(sys.argv) != 4 or sys.argv[1] != 'T1':
        sys.exit(__doc__)
    p = Pack()
    who = sys.argv[2]
    rows = [p.owner] if who == 'owner' else [i for i, h in enumerate(p.members['hash']) if h.startswith(who)]
    out = os.path.abspath(sys.argv[3])
    if os.path.exists(out):
        shutil.rmtree(out)
    index, keys, digest = build_t1(p, out, members=rows)
    export_titles(p, os.path.join(out, 'titles.npz'))
    write_keys(out.rstrip('/') + '-keys.bin', index, keys)
    print(f'{len(index)} views in {out}/views, titles in {out}/titles.npz, answers in {out.rstrip("/")}-keys.bin')
    print('read a file with views.load_arrays(path)')
    print(f'digest {digest}')
