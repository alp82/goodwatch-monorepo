"""Views: what a predictor may see, with the hidden labels physically absent.

A view is a folder:

    view.bin      the task, the predicted member's rows written before the block, and the titles to predict
    others.bin    the rows of every other tier A member (a hard link to one file per member)

and the shared title file `titles.npz`, which holds no member data at all. The answers are returned to the caller
and written, when asked, to a file outside the views folder. Nothing in a view names the member, the block, the
answer file, the pack or the gate.

What `predict(view)` receives (built from those files by sandbox.py):

    view['task']                      'T1', 'T2a' or 'T2b'
    view['targets']['title']          title rows to predict: no rating, no time, no order (T1: sorted by title key;
                                      T2a and T2b: one shuffled list)
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

T2a (PLAN.md 2.2), the hidden-title test: a member's rated titles that lie in the candidate universe (in the pool
and with a fingerprint) are dealt into folds by a seeded shuffle. A view hides one fold: at most 20 titles and at
most a fifth of the member's rated titles. The member's history is every other rating and every Want to See, Skip
and Not interested row, with the hidden titles removed from each of those lists. The targets are the hidden titles
and every universe title the member has not rated, in one shuffled list: nothing in the view says which is which.
There is no moment in time in T2a: the history is as of the pull.

T2b (PLAN.md 2.2), ranking later Want to See adds: one view per member. Some of the member's Want to See adds are
targets (split `sitting`: the adds in the last 40% of the member's add sittings; split `order`: the last 40% of the
member's adds in entry order). The view holds what the member wrote before the first target, and as targets every
candidate-universe title the member had not rated, added, skipped or marked Not interested by then, in one
shuffled list. A sitting of 10 or more adds is a transfer: its adds are never targets.

    python3 views.py T1|T2a|T2b <member hash prefix | owner> <out folder>     # writes the views of one member
"""
import hashlib
import json
import os
import shutil
import sys
import types

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
T2A_FOLD = 20                        # T2a: at most this many titles are hidden in one view,
T2A_MIN_FOLDS = 5                    # and at most a fifth of the member's rated titles
T2A_MIN_RATINGS = 20                 # T2a: members with 20 or more ratings,
T2A_MIN_HIGH = 5                     # at least 5 of them rated
T2A_HIGH = 8                         # 8 or more
T2A_CHECK_FOLD = 5                   # T2a fold check (item 004): at most 5 hidden titles in a view,
T2A_CHECK_RATINGS = 60               # for members other than the owner with fewer than 60 ratings
T2B_TRANSFER = 10                    # T2b: a sitting of this many Want to See adds or more is a transfer
T2B_SHARE = 0.4                      # T2b: the last 40% of the sittings (or of the adds) give the targets
T2B_MIN_TARGETS = 3                  # T2b: a member needs this many targets in the pool
SPLITS = ('sitting', 'order')


# ------------------------------------------------------------------ titles

def title_arrays(pack):
    """The title data a predictor may see, as named arrays without pickles.

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
    return out


def export_titles(pack, path):
    """Write title_arrays(pack) as one npz without pickles. Returns its content hash."""
    out = title_arrays(pack)
    digest = sha256_arrays(out)
    if path:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + f'.tmp{os.getpid()}'
        with open(tmp, 'wb') as f:
            np.savez(f, **out)
        os.replace(tmp, path)
    return digest


def franchise_of(titles):
    """Per title row: the movie series, else a number of the title's own (below zero)."""
    own = -1 - np.arange(len(titles['key']), dtype=np.int64)
    series = titles['num'].get('movie_series_id')
    return own if series is None else np.where(series > 0, series, own).astype(np.int64)


def title_facts(pack):
    """Per title row, what the T2a measures read from the pack's title data: the GoodWatch score (0..100), show or
    movie, animation (production method "Animation"), the franchise and the vote count. For run.py, never in a view."""
    t = pack.titles
    return {'g': t['num']['goodwatch_overall_score_normalized_percent'].astype(float), 'show': t['media_type'] == 1,
            'animation': np.array([m == 'Animation' for m in t['text']['production_method']], bool),
            'franchise': franchise_of(t), 'votes': t['num']['goodwatch_overall_score_voting_count'].astype(float)}


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


def _tables(pack, own=None, shuffle_seed=None):
    """What the views of both tasks are cut from: the tier A ratings (`pool`), the predicted members' ratings (`own`,
    the same table unless gate.py passes another), their title rows, and the Want to See, Skip and Not interested
    tables with theirs."""
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
    assert (tier[pool['member']] == 0).all()
    return types.SimpleNamespace(T=T, tier=tier, pool=pool, own=own, pool_title=pool_title, own_title=own_title,
                                 side=side, owner=pack.owner, franchise=franchise_of(T))


def _others_arrays(c, u, others_mode, before=None):
    """The rows of every tier A member but `u`, as the arrays of an others.bin."""
    arrays = {}
    pool, tier = c.pool, c.tier
    m = pool['member'] != u
    if others_mode == 'no-owner':
        m &= pool['member'] != c.owner
    if before is not None:                              # written before the block and not edited since
        m &= (pool['created_at'] < before) & (pool['updated_at'] < before)
    rows = _rows(pool, m, RATING_COLS, c.pool_title)
    rows['member'] = pool['member'][m]
    arrays.update(_flat('ratings', rows))
    for name, (table, trow, cols) in c.side.items():
        m = (table['member'] != u) & (tier[table['member']] == 0)
        if others_mode == 'no-owner':
            m &= table['member'] != c.owner
        if before is not None:
            m &= table['created_at'] < before
        rows = _rows(table, m, cols, trow)
        rows['member'] = table['member'][m]
        arrays.update(_flat(name, rows))
    return arrays


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
    ctx = _tables(pack, own, shuffle_seed)
    T, tier, own, own_title, side, franchise = ctx.T, ctx.tier, ctx.own, ctx.own_title, ctx.side, ctx.franchise

    counts = np.bincount(own['member'], minlength=len(tier))
    eligible = np.flatnonzero(counts >= MIN_RATINGS)
    if members is not None:
        eligible = np.array([m for m in eligible if m in set(int(x) for x in members)], dtype=np.int64)

    if write:
        os.makedirs(os.path.join(folder, 'others'), exist_ok=True)
    index, keys, digests = [], {}, {}

    def others_arrays(u, before=None):
        return _others_arrays(ctx, u, others_mode, before)

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


# ------------------------------------------------------------------ T2a: the hidden-title test

def t2a_universe(titles):
    """The candidate universe: titles in the pool with a fingerprint."""
    return titles['in_pool'] & titles['has_fingerprint']


def t2a_folds(title_keys, member_hash, seed=SEED, size=T2A_FOLD, least=T2A_MIN_FOLDS):
    """(fold number per title, number of folds) for a member's rated universe titles: a fixed pseudo-random order
    of the titles, dealt round. Folds of at most `size` titles, and never fewer than `least` folds: a view hides at
    most 20 titles, and with 5 folds a fifth of them rounded up (21 titles give folds of 5, 4, 4, 4, 4: 23.8%)."""
    n = len(title_keys)
    k = max(least, -(-n // size))
    order = np.argsort([hashlib.sha256(f'{seed}|T2a|{member_hash}|{int(key)}'.encode()).digest()
                        for key in title_keys], kind='stable')
    fold = np.empty(n, np.int64)
    fold[order] = np.arange(n) % k
    return fold, k


def _t2a_member(c, u):
    """One member's rows in entry order, their title rows, and the universe titles the member has not rated."""
    at = np.flatnonzero(c.own['member'] == u)
    at = at[np.argsort(c.own['position'][at], kind='stable')]
    mine = {col: c.own[col][at] for col in ('title_key', 'updated_at') + RATING_COLS}
    mine_title = c.own_title[at]
    universe = t2a_universe(c.T)
    unrated = universe.copy()
    unrated[mine_title] = False
    return mine, mine_title, universe[mine_title], np.flatnonzero(unrated)


def _t2a_arrays(c, pack, u, mine, mine_title, hidden, unrated, vid):
    """The arrays of one view.bin. hidden: positions in the member's rows whose ratings the view hides.
    Returns (arrays, the visible positions, where each hidden title stands in the target list)."""
    keep = np.ones(len(mine_title), bool)
    keep[hidden] = False
    history = np.flatnonzero(keep)
    hidden_rows = mine_title[hidden]
    arrays = _flat('me.ratings', _rows(mine, history, RATING_COLS, mine_title))
    for name, (table, trow, cols) in c.side.items():   # a hidden title on Want to See would hand over the answer
        m = (table['member'] == u) & ~np.isin(trow, hidden_rows)
        arrays.update(_flat(f'me.{name}', _rows(table, m, cols, trow)))
    targets = np.concatenate([unrated, hidden_rows]).astype(np.int32)
    order = np.random.default_rng([SEED, int(vid, 16)]).permutation(len(targets))
    arrays['targets.title'] = targets[order]            # one shuffled list: nothing marks the hidden titles
    place = np.empty(len(targets), np.int64)
    place[order] = np.arange(len(targets))
    arrays['task'] = np.array('T2a')
    arrays['schema'] = np.array(SCHEMA)
    arrays['provenance_names'] = np.array(pack.provenance_names)
    # the unrated titles still on the member's Want to See, Skip or Not interested list are certainly not hidden:
    # they stay in the list (the contract ranks every unrated title) and the measures leave them out (item 004)
    listed = set()
    for name, (table, trow, _) in c.side.items():
        listed |= set(trow[table['member'] == u].tolist())
    listed_rows = np.array(sorted(listed & set(unrated.tolist())), np.int64)
    listed_pos = np.sort(place[np.searchsorted(unrated, listed_rows)]) if len(listed_rows) else np.zeros(0, np.int64)
    return arrays, history, place[len(unrated):], listed_pos


def t2a_eligible(c):
    """Member rows with T2A_MIN_RATINGS or more ratings, T2A_MIN_HIGH or more of them rated T2A_HIGH or more."""
    n = len(c.tier)
    counts = np.bincount(c.own['member'], minlength=n)
    high = np.bincount(c.own['member'][c.own['score'] >= T2A_HIGH], minlength=n)
    return np.flatnonzero((counts >= T2A_MIN_RATINGS) & (high >= T2A_MIN_HIGH))


def build_t2a(pack, folder, members=None, others_mode='all', shuffle_seed=None, write=True, fold_check=False,
              own=None):
    """Build the T2a views of the given members (rows in pack.members; default: every eligible member).

    fold_check (item 004): only the eligible members other than the owner with fewer than T2A_CHECK_RATINGS
    ratings, and folds of at most T2A_CHECK_FOLD titles.

    Returns (index, keys, digest) as build_t1 does. One view per fold: kind 'main', block and fold the fold number.
    keys[vid] holds what the measures need and no view holds: title (the hidden title rows), pos (where each stands
    in the view's target list), score (the hidden ratings), sitting, franchise, history_score (the visible ratings),
    n_targets (the length of the target list), n_outside (the member's rated titles outside the universe, which
    are history in every view and never a target) and listed_pos (where the member's unrated Want to See, Skip and
    Not interested titles stand: the measures leave them out).
    """
    assert others_mode in ('all', 'no-owner')
    c = _tables(pack, own, shuffle_seed)
    eligible = t2a_eligible(c)
    if fold_check:
        counts = np.bincount(c.own['member'], minlength=len(c.tier))
        eligible = eligible[(eligible != c.owner) & (counts[eligible] < T2A_CHECK_RATINGS)]
    if members is not None:
        eligible = np.array([m for m in eligible if m in set(int(x) for x in members)], dtype=np.int64)
    if write:
        os.makedirs(os.path.join(folder, 'others'), exist_ok=True)
    index, keys, digests = [], {}, {}
    for u in eligible.tolist():
        mine, mine_title, in_universe, unrated = _t2a_member(c, u)
        rated = np.flatnonzero(in_universe)
        if len(rated) == 0:
            continue
        mh = pack.members['hash'][u]
        fold, k = t2a_folds(mine['title_key'][rated], mh, size=T2A_CHECK_FOLD, least=1) if fold_check else \
            t2a_folds(mine['title_key'][rated], mh)
        arrays = _others_arrays(c, u, others_mode)
        o_file, o_digest = os.path.join(folder, 'others', f'{_vid(mh, "T2a", others_mode)}.bin'), sha256_arrays(arrays)
        if write:
            _save(o_file, arrays)
        for f in range(k):
            hidden = rated[fold == f]
            if len(hidden) == 0:
                continue
            vid = _vid(mh, 'T2a', f, 'main', 'check') if fold_check else _vid(mh, 'T2a', f, 'main')
            arrays, history, pos, listed_pos = _t2a_arrays(c, pack, u, mine, mine_title, hidden, unrated, vid)
            digests[vid] = sha256_arrays(arrays) + o_digest
            if write:
                d = os.path.join(folder, 'views', vid)
                os.makedirs(d)
                _save(os.path.join(d, 'view.bin'), arrays)
                os.link(o_file, os.path.join(d, 'others.bin'))
            by_pos = np.argsort(pos, kind='stable')
            hidden, pos = hidden[by_pos], pos[by_pos]
            index.append({'vid': vid, 'kind': 'main', 'member': u, 'block': f, 'parent': None, 'fold': f})
            keys[vid] = {'title': mine_title[hidden], 'pos': pos, 'score': mine['score'][hidden].astype(np.int64),
                         'sitting': mine['sitting'][hidden].astype(np.int64),
                         'franchise': c.franchise[mine_title[hidden]],
                         'history_score': mine['score'][history].astype(np.int64),
                         'n_targets': np.array(len(arrays['targets.title']), np.int64),
                         'n_outside': np.array(int((~in_universe).sum()), np.int64), 'listed_pos': listed_pos}
    h = hashlib.sha256()
    for vid in sorted(digests):
        h.update(f'{vid}:{digests[vid]}\n'.encode())
    return index, keys, h.hexdigest()


def t2a_full_view(pack, u, titles, others_mode='all'):
    """The view of member `u` with nothing hidden, in memory: the whole history, and as targets every universe
    title the member has not rated. For top.py; no file is written."""
    c = _tables(pack)
    mine, mine_title, _, unrated = _t2a_member(c, u)
    arrays, _, _, _ = _t2a_arrays(c, pack, u, mine, mine_title, np.zeros(0, np.int64), unrated,
                               _vid(pack.members['hash'][u], 'T2a', 'full'))
    return view_of(arrays, _others_arrays(c, u, others_mode), titles)


# ------------------------------------------------------------------ T2b: ranking later Want to See adds

def t2b_targets(sitting, in_bulk, split):
    """Which of a member's Want to See adds (in entry order) are targets. A sitting of T2B_TRANSFER or more adds is
    a transfer and a bulk write is not a choice: neither is ever a target. `sitting`: the adds of the last 40% of the
    member's add sittings (rounded to the nearest, at least one; transfers count as sittings), for a member with two
    or more add sittings. `order`: the last 40% of the member's other adds in entry order (rounded to the nearest)."""
    sits, counts = np.unique(sitting, return_counts=True)
    may = ~np.isin(sitting, sits[counts >= T2B_TRANSFER]) & ~in_bulk
    target = np.zeros(len(sitting), bool)
    if split == 'sitting':
        order = list(dict.fromkeys(sitting.tolist()))
        if len(order) >= 2:
            k = max(1, int(np.floor(T2B_SHARE * len(order) + 0.5)))
            target = np.isin(sitting, order[-k:]) & may
    else:
        idx = np.flatnonzero(may)
        k = int(np.floor(T2B_SHARE * len(idx) + 0.5))
        if k:
            target[idx[len(idx) - k:]] = True
    return target


def build_t2b(pack, folder, members=None, others_mode='before', split='sitting', shuffle_seed=None, write=True):
    """Build the T2b views (one per kept member). Returns (index, keys, digest) as build_t1 does.

    keys[vid]: title (the target title rows, in list order), pos (their places in the target list), sitting (their
    add sitting), franchise, later_pos (places of the titles the member skipped or marked Not interested at or after
    the cutoff, targets left out), touched (title rows the member had rated, added, skipped or marked Not interested
    before the cutoff; none of them is in the list), own (the member's rated and added titles before the cutoff that
    lie in the universe), history_score, n_targets (the length of the list), n_outside (targets dropped: outside the
    universe), n_touched (targets dropped: touched before the cutoff), n_adds.

    shuffle_seed (control): the views are the real ones, but `pos` names as many random non-target titles of the
    list as there are targets.
    """
    assert others_mode in ('all', 'no-owner', 'before') and split in SPLITS
    c = _tables(pack)
    T, w = c.T, pack.wishlist
    universe = t2a_universe(T)
    w_row = pack.title_index(w['title_key'])
    candidates = np.flatnonzero((c.tier == 0) & (np.bincount(w['member'], minlength=len(c.tier)) > 0))
    if members is not None:
        candidates = np.array([m for m in candidates if m in set(int(x) for x in members)], dtype=np.int64)
    if write:
        os.makedirs(os.path.join(folder, 'others'), exist_ok=True)
    index, keys, digests = [], {}, {}
    for u in candidates.tolist():
        at = np.flatnonzero(w['member'] == u)
        at = at[np.lexsort((w['position'][at], w['created_at'][at]))]
        target = t2b_targets(w['sitting'][at], w['in_bulk'][at].astype(bool), split)
        if target.sum() < T2B_MIN_TARGETS:
            continue
        cutoff = int(w['created_at'][at][target].min())
        mine, mine_title, _, _ = _t2a_member(c, u)
        touched = set(mine_title[mine['created_at'] < cutoff].tolist())
        for name, (table, trow, _) in c.side.items():
            touched |= set(trow[(table['member'] == u) & (table['created_at'] < cutoff)].tolist())
        rows = w_row[at][target]
        inside = (rows >= 0) & universe[np.maximum(rows, 0)]
        fresh = np.array([r >= 0 and r not in touched for r in rows.tolist()], bool)
        chosen = np.unique(rows[inside & fresh])
        if len(chosen) < T2B_MIN_TARGETS:
            continue
        mh = pack.members['hash'][u]
        vid = _vid(mh, 'T2b', split, 'main')
        history = np.flatnonzero((mine['created_at'] < cutoff) & (mine['updated_at'] < cutoff))
        arrays = _flat('me.ratings', _rows(mine, history, RATING_COLS, mine_title))
        for name, (table, trow, cols) in c.side.items():
            arrays.update(_flat(f'me.{name}', _rows(table, (table['member'] == u) & (table['created_at'] < cutoff),
                                                     cols, trow)))
        listed = universe.copy()
        listed[list(touched)] = False
        listed = np.flatnonzero(listed).astype(np.int32)
        order = np.random.default_rng([SEED, int(vid, 16)]).permutation(len(listed))
        arrays['targets.title'] = listed[order]
        place = np.empty(len(listed), np.int64)
        place[order] = np.arange(len(listed))
        arrays['task'] = np.array('T2b')
        arrays['schema'] = np.array(SCHEMA)
        arrays['provenance_names'] = np.array(pack.provenance_names)
        pos = np.sort(place[np.searchsorted(listed, chosen)])
        if shuffle_seed is not None:                  # control: as many random non-target titles of the list
            others_pos = np.setdiff1d(np.arange(len(listed)), pos)
            pos = np.sort(np.random.default_rng([shuffle_seed, int(vid, 16)]).choice(others_pos, len(pos), False))
        later = set()
        for name in ('skip', 'not_interested'):
            table, trow, _ = c.side[name]
            later |= set(trow[(table['member'] == u) & (table['created_at'] >= cutoff)].tolist())
        later_rows = np.array(sorted((later - set(chosen.tolist())) & set(listed.tolist())), np.int64)
        later_pos = np.sort(place[np.searchsorted(listed, later_rows)]) if len(later_rows) else np.zeros(0, np.int64)
        others = _others_arrays(c, u, others_mode, cutoff if others_mode == 'before' else None)
        o_file = os.path.join(folder, 'others', f'{vid}.bin')
        o_digest = sha256_arrays(others)
        digests[vid] = sha256_arrays(arrays) + o_digest
        if write:
            _save(o_file, others)
            d = os.path.join(folder, 'views', vid)
            os.makedirs(d)
            _save(os.path.join(d, 'view.bin'), arrays)
            os.link(o_file, os.path.join(d, 'others.bin'))
        title = arrays['targets.title'][pos]
        sit_of = dict(zip(w_row[at][target].tolist(), w['sitting'][at][target].tolist()))
        own = np.array(sorted(t for t in set(mine_title[mine['created_at'] < cutoff].tolist())
                              | set(w_row[at][w['created_at'][at] < cutoff].tolist()) if t >= 0 and universe[t]),
                       np.int64)
        index.append({'vid': vid, 'kind': 'main', 'member': u, 'block': 0, 'parent': None, 'fold': None})
        keys[vid] = {'title': title.astype(np.int64), 'pos': pos,
                     'sitting': np.array([sit_of.get(t, -1) for t in title.tolist()], np.int64),
                     'franchise': c.franchise[title], 'later_pos': later_pos,
                     'touched': np.array(sorted(touched), np.int64), 'own': own,
                     'history_score': mine['score'][history].astype(np.int64),
                     'n_targets': np.array(len(listed), np.int64),
                     'n_outside': np.array(int((~inside).sum()), np.int64),
                     'n_touched': np.array(int((inside & ~fresh).sum()), np.int64),
                     'n_adds': np.array(len(at), np.int64)}
    h = hashlib.sha256()
    for vid in sorted(digests):
        h.update(f'{vid}:{digests[vid]}\n'.encode())
    return index, keys, h.hexdigest()


def n_targets(key):
    """How many targets the view of this answer row has (T2a: more than the hidden titles)."""
    return int(key['n_targets']) if 'n_targets' in key else len(key['score'])


def write_keys(path, index, keys):
    """The answer file: outside the views folder, named by nothing a view holds."""
    arrays = {}
    for v in index:
        for c, a in keys[v['vid']].items():
            arrays[f'{v["vid"]}.{c}'] = a
    os.makedirs(os.path.dirname(path), exist_ok=True)
    save_arrays(path, arrays)
    os.chmod(path, 0o600)


def view_of(view_arrays, others_arrays, titles):
    """The dict a predictor receives, from the arrays of a view.bin and an others.bin."""
    view = {'titles': titles, 'me': {}, 'others': {}, 'targets': {}}
    for name, a in view_arrays.items():
        parts = name.split('.')
        if parts[0] == 'me':
            view['me'].setdefault(parts[1], {})[parts[2]] = a
        elif parts[0] == 'targets':
            view['targets'][parts[1]] = a
        elif name == 'provenance_names':
            view[name] = a.tolist()
        else:
            view[name] = a.item()
    for name, a in others_arrays.items():
        table, col = name.split('.')
        view['others'].setdefault(table, {})[col] = a
    return view


def load_view(view_folder, titles):
    """The dict a predictor receives. `view_folder` is a path or an open folder; `titles` comes from load_titles."""
    dir_fd = view_folder if isinstance(view_folder, int) else None
    at = (lambda name: name if dir_fd is not None else os.path.join(view_folder, name))
    return view_of(load_arrays(at('view.bin'), dir_fd), load_arrays(at('others.bin'), dir_fd), titles)


def titles_of(arrays):
    """view['titles'] from the arrays of title_arrays (or of the npz that holds them)."""
    titles = {'num': {}}
    for name in arrays:
        if name.startswith('num.'):
            titles['num'][name[4:]] = arrays[name]
        elif name.endswith('_names') or name == 'fingerprint_keys':
            titles[name] = arrays[name].tolist()
        else:
            titles[name] = arrays[name]
    return titles


def load_titles(path):
    with np.load(path, allow_pickle=False) as z:
        return titles_of({name: z[name] for name in z.files})


if __name__ == '__main__':
    from pack import Pack
    if len(sys.argv) != 4 or sys.argv[1] not in ('T1', 'T2a', 'T2b'):
        sys.exit(__doc__)
    p = Pack()
    who = sys.argv[2]
    rows = [p.owner] if who == 'owner' else [i for i, h in enumerate(p.members['hash']) if h.startswith(who)]
    out = os.path.abspath(sys.argv[3])
    if os.path.exists(out):
        shutil.rmtree(out)
    index, keys, digest = {'T1': build_t1, 'T2a': build_t2a, 'T2b': build_t2b}[sys.argv[1]](p, out, members=rows)
    export_titles(p, os.path.join(out, 'titles.npz'))
    write_keys(out.rstrip('/') + '-keys.bin', index, keys)
    print(f'{len(index)} views in {out}/views, titles in {out}/titles.npz, answers in {out.rstrip("/")}-keys.bin')
    print('read a file with views.load_arrays(path)')
    print(f'digest {digest}')
