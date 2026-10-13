#!/usr/bin/env python3
"""Build one pack: a read-only pull of production, rows written up to --until.

    python3 pull.py --until 2026-10-13T08:40:00Z --out ~/goodwatch-research/taste/packs/2026-10-13

Writes into --out (mode 700):
    pack.pkl            members, tiers, every member table; ratings of tier A members only
    titles.pkl          the title universe: keys, flags, fingerprints, public scores, facts
    titles_detail.pkl   the heavy title columns: texts, tags, related ids, people, seasons
    emb_text_en_v1.npy, emb_text_multi_v1.npy   text embeddings of the titles members touched
    MANIFEST.json, CENSUS.md
and into the gate folder (--gate, by default <root>/gate/<name> beside <root>/packs/<name>):
    gate.pkl            the ratings of tier B members, and the rating columns of their import items

Member tables are filtered on created_at <= --until. Title data is as of the pull: production rewrites title rows
all day, so the title files of two runs are equal only while production's titles did not change in between. The
member files depend on --until alone and name titles by key, never by position in the title files.

Member ids are replaced by a keyed hash before anything is stored; the key lives in <root>/key and is never
written anywhere else. Nothing here writes to production: every statement goes through crate.sql.

When --out is a folder under <root>/packs/, MANIFEST.json and CENSUS.md are also copied into the repository
folder above this one (counts only). A pack folder is never rewritten: an existing pack.pkl stops the run.
"""
import os

for _v in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS'):
    os.environ.setdefault(_v, '2')

import argparse
import datetime as dt
import hashlib
import hmac
import json
import pickle
import re
import secrets
import shutil
import subprocess
import sys
import time
from collections import defaultdict

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crate  # noqa: E402

LAB = os.path.dirname(os.path.abspath(__file__))
LOOP_DIR = os.path.dirname(LAB)
REPO = os.path.abspath(os.path.join(LAB, '..', '..', '..', '..'))
ROOT = os.path.expanduser('~/goodwatch-research/taste')
OLD_PULL = os.path.join(REPO, 'docs', 'research', 'taste-prediction', 'lab', 'build_pack.py')
FINGERPRINT_SOURCE = os.path.join(REPO, 'goodwatch-webapp', 'app', 'server', 'utils', 'fingerprint.ts')

FORMAT = 1
SEED = 20261013
TIER_B_SHARE = 0.35
STRATA = [('0', 0, 0), ('1 to 4', 1, 4), ('5 to 19', 5, 19), ('20 to 59', 20, 59), ('60 or more', 60, None)]
SITTING_GAP_MS = 6 * 3600 * 1000
BULK_MS = 2000
BULK_COUNT = 5
NAT = np.iinfo(np.int64).min  # a missing time
MISSING_SCORE = 255  # a missing fingerprint score, as in the title snapshot
PROVENANCE = ['typed', 'bulk', 'import']
POOL_RULE = ('poster_path is not null and goodwatch_overall_score_normalized_percent is not null '
             'and goodwatch_overall_score_voting_count >= 1000')
POOL_RULE_WORDS = 'movies and shows with a poster, a GoodWatch score and 1,000 or more votes'
EMBEDDINGS = {'text_en_v1': 768, 'text_multi_v1': 384}
QDRANT_COLLECTION = 'media_fingerprint_v1'
SETTING_KEYS = ['country_default', 'streaming_providers_default']

# Title columns, by how they are stored. From the first loop's build_pack.py and add_scores.py, plus
# movie_series_id and the release date.
T_FLOAT = ['popularity', 'imdb_user_score_normalized_percent', 'metacritic_meta_score_normalized_percent',
           'metacritic_user_score_normalized_percent', 'rotten_tomatoes_tomato_score_normalized_percent',
           'rotten_tomatoes_audience_score_normalized_percent', 'tmdb_user_score_normalized_percent',
           'goodwatch_overall_score_normalized_percent', 'goodwatch_user_score_normalized_percent',
           'goodwatch_official_score_normalized_percent']
T_INT = ['release_year', 'imdb_user_score_rating_count', 'goodwatch_overall_score_voting_count',
         'tmdb_user_score_rating_count', 'metacritic_user_score_rating_count', 'metacritic_meta_score_review_count',
         'rotten_tomatoes_audience_score_rating_count', 'rotten_tomatoes_tomato_score_review_count',
         'goodwatch_user_score_rating_count', 'goodwatch_official_score_review_count']
T_INT_MOVIE = ['runtime', 'movie_series_id']
T_BOOL = ['is_anime', 'suitability_solo_watch', 'suitability_date_night', 'suitability_group_party',
          'suitability_family', 'suitability_partner', 'suitability_friends', 'suitability_kids', 'suitability_teens',
          'suitability_adults', 'suitability_intergenerational', 'suitability_public_viewing_safe',
          'context_is_thought_provoking', 'context_is_pure_escapism', 'context_is_background_friendly',
          'context_is_comfort_watch', 'context_is_binge_friendly', 'context_is_drop_in_friendly']
T_LIGHT = ['title', 'genres', 'original_language_code', 'origin_country_codes', 'production_method',
           'animation_style']
T_DETAIL = ['keywords', 'tropes', 'essence_tags', 'essence_text', 'synopsis', 'production_company_ids',
            'tmdb_recommendation_ids', 'tmdb_similar_ids', 'fingerprint_highlight_keys', 'age_certifications']
PUBLIC_SCORES = [c for c in T_FLOAT if c != 'popularity']
CREW_JOBS = ['Director', 'Writer', 'Screenplay', 'Creator', 'Executive Producer', 'Producer',
             'Original Music Composer', 'Director of Photography', 'Novel', 'Story', 'Series Director']
CREW_DEPARTMENTS = ['Directing', 'Writing', 'Creator', 'Production', 'Sound', 'Camera']
SEASON_TABLES = [
    ('season', ['air_date', 'episode_count', 'vote_average'], ['show_id', 'tmdb_id']),
    ('imdb_season', ['imdb_user_score_original', 'imdb_user_score_rating_count', 'imdb_rated_episode_count'],
     ['show_id', 'season_number']),
    ('metacritic_season', ['metacritic_meta_score_original', 'metacritic_meta_score_review_count',
                           'metacritic_user_score_original', 'metacritic_user_score_rating_count'],
     ['show_id', 'season_number']),
    ('rotten_tomatoes_season', ['rotten_tomatoes_tomato_score_original', 'rotten_tomatoes_tomato_score_review_count',
                                'rotten_tomatoes_audience_score_original',
                                'rotten_tomatoes_audience_score_rating_count'], ['show_id', 'season_number']),
]


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


# ---------------------------------------------------------------- privacy

def secret_key():
    path = os.path.join(ROOT, 'key')
    if not os.path.exists(path):
        os.makedirs(ROOT, mode=0o700, exist_ok=True)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as f:
            f.write(secrets.token_hex(32))
    os.chmod(path, 0o600)
    return bytes.fromhex(open(path).read().strip())


def owner_id():
    """The owner's member id. Kept in the data folder; seeded once from the first loop's pull script."""
    path = os.path.join(ROOT, 'owner')
    if not os.path.exists(path):
        found = re.search(r"OWNER = '([0-9a-f-]{36})'", open(OLD_PULL).read())
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as f:
            f.write(found.group(1))
    return open(path).read().strip()


class Hasher:
    def __init__(self, key):
        self.key, self.cache = key, {}

    def __call__(self, value, kind='member'):
        k = (kind, value)
        if k not in self.cache:
            text = value if kind == 'member' else f'{kind}:{value}'
            self.cache[k] = hmac.new(self.key, text.encode(), hashlib.sha256).hexdigest()[:16]
        return self.cache[k]


# ---------------------------------------------------------------- columns

def title_key(media_type, tmdb_id):
    """One integer per title, the same as the Qdrant point id. 0 when the row names no movie or show."""
    if media_type not in ('movie', 'show') or tmdb_id is None:
        return 0
    return crate.point_id(media_type, tmdb_id)


def col_int(values, dtype=np.int32, null=-1):
    return np.array([null if v is None else v for v in values], dtype=dtype)


def col_time(values):
    return np.array([NAT if v is None else v for v in values], dtype=np.int64)


def col_code(values):
    vocab = sorted({v for v in values if v is not None})
    at = {v: i for i, v in enumerate(vocab)}
    return {'codes': np.array([-1 if v is None else at[v] for v in values], dtype=np.int32), 'vocab': vocab}


def _sortable(col):
    return col['codes'] if isinstance(col, dict) else col


def sort_table(table, first):
    """Order the rows by the columns in `first`, then by every other column, so the order is a property of the
    values alone."""
    names = list(first) + [n for n in table if n not in first]
    n = len(_sortable(table[names[0]]))
    idx = np.lexsort([_sortable(table[c]) for c in reversed(names)]) if n else np.zeros(0, np.int64)
    out = {}
    for name, col in table.items():
        out[name] = {'codes': col['codes'][idx], 'vocab': col['vocab']} if isinstance(col, dict) else col[idx]
    return out


def take(table, mask):
    return {n: ({'codes': c['codes'][mask], 'vocab': c['vocab']} if isinstance(c, dict) else c[mask])
            for n, c in table.items()}


def runs(member):
    """(start, end) of each member's rows in a table sorted by member."""
    if len(member) == 0:
        return []
    cuts = np.flatnonzero(np.diff(member)) + 1
    return list(zip(np.r_[0, cuts].tolist(), np.r_[cuts, len(member)].tolist()))


def entry_order(member, written):
    """Sitting number, position in entry order and the bulk mark, per member, for rows sorted by member and write
    time. Sitting and position count from 0. `bulk`: the row is one of 5 or more of the member's rows written within
    2 seconds. `moment_bulk` is the other reading (rows chained by gaps under 2 seconds, 5 or more in the chain),
    kept for the census only."""
    n = len(member)
    sitting, position = np.zeros(n, np.int32), np.zeros(n, np.int32)
    bulk, moment_bulk = np.zeros(n, bool), np.zeros(n, bool)
    for a, b in runs(member):
        t = written[a:b]
        gap = np.diff(t)
        assert (gap >= 0).all()
        sitting[a:b] = np.r_[0, np.cumsum(gap >= SITTING_GAP_MS)]
        position[a:b] = np.arange(b - a)
        for i in range(b - a - BULK_COUNT + 1):
            if t[i + BULK_COUNT - 1] - t[i] <= BULK_MS:
                bulk[a + i:a + i + BULK_COUNT] = True
        moment = np.r_[0, np.cumsum(gap >= BULK_MS)]
        moment_bulk[a:b] = np.bincount(moment)[moment] >= BULK_COUNT
    return sitting, position, bulk, moment_bulk


# ---------------------------------------------------------------- member tables

def pull_members(until, H):
    """Every member table up to `until`, as raw rows with the member id already replaced by its hash."""
    def rows(table, cols, order, where='created_at <= ?', args=None, page=5000):
        out = crate.paged(table, cols, where, [until] if args is None else args, order, page)
        for r in out:
            r['member'] = H(r.pop('user_id'))
        log(f'{table}: {len(out)} rows')
        return out

    simple = 'user_id, tmdb_id, media_type, created_at, updated_at'
    pk = ['user_id', 'tmdb_id', 'media_type']
    raw = {}
    raw['ratings'] = rows('user_score', f'{simple}, score, coalesce(char_length(review), 0) > 0 as has_review', pk)
    for name, table in (('wishlist', 'user_wishlist'), ('skipped', 'user_skipped'),
                        ('not_interested', 'user_not_interested'), ('favorite', 'user_favorite')):
        raw[name] = rows(table, simple, pk)
    raw['watch_state'] = rows('user_watch_state', f'{simple}, state, state_changed_at, pass', pk)
    raw['watch_log'] = rows(
        'user_watch_log',
        'user_id, watch_id, media_type, tmdb_id, episode_tmdb_id, season_number, episode_number, watched_at, '
        'watched_at_precision, origin, import_id, pass, created_at, updated_at', ['user_id', 'watch_id'],
        page=20000)
    for r in raw['watch_log']:
        del r['watch_id']
        r['import'] = None if r['import_id'] is None else H(r['import_id'], 'import')
        del r['import_id']
    raw['imports'] = rows('user_import', 'id, user_id, source, status, created_at, finished_at', ['id'])
    import_ids = [r['id'] for r in raw['imports']]
    raw['import_items'] = rows(
        'user_import_item',
        'import_id, row_index, user_id, tmdb_id, media_type, raw_rating, imdb_score, date_rated, current_score, '
        'prior_score, applied_score, applied_at, outcome, kind, apply_state', ['import_id', 'row_index'],
        'import_id = any(?)', [import_ids]) if import_ids else []
    for r in raw['imports']:
        r['import'] = H(r.pop('id'), 'import')
    for r in raw['import_items']:
        r['import'] = H(r.pop('import_id'), 'import')
        if r['applied_at'] is not None and r['applied_at'] > until:
            # applied after --until: as far as this pack goes, not applied yet
            r['applied_at'] = r['applied_score'] = r['prior_score'] = r['apply_state'] = None
    raw['setting_members'] = rows('user_setting', 'user_id, key', ['user_id', 'key'])
    raw['settings'] = rows('user_setting', 'user_id, key, value', ['user_id', 'key'],
                           'created_at <= ? and key = any(?)', [until, SETTING_KEYS])
    return raw


def assign_tiers(hashes, n_ratings, owner_hash):
    """Tier per member. A seeded split inside each stratum of rating count; the owner is always in A.

    The assignment is kept in <root>/tiers.json so that a later pull does not move a member from the gate into the
    open tier: members already in the file keep their tier, and only new members are split, by the same rule.
    Without the file, the same members give the same split.
    """
    path = os.path.join(ROOT, 'tiers.json')
    known = json.load(open(path)) if os.path.exists(path) else {}
    stratum = np.array([next(i for i, (_, lo, hi) in enumerate(STRATA) if n >= lo and (hi is None or n <= hi))
                        for n in n_ratings], dtype=np.int8)
    tier = {h: known[h] for h in hashes if h in known}
    new = 0
    for s in range(len(STRATA)):
        fresh = sorted(h for h, st in zip(hashes, stratum) if st == s and h not in tier and h != owner_hash)
        order = np.random.default_rng([SEED, s]).permutation(len(fresh))
        n_b = int(np.floor(TIER_B_SHARE * len(fresh) + 0.5))
        for rank, at in enumerate(order):
            tier[fresh[at]] = 'B' if rank < n_b else 'A'
        new += len(fresh)
    tier[owner_hash] = 'A'
    merged = dict(sorted({**known, **tier}.items()))
    if merged != known:
        fd = os.open(path + '.tmp', os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as f:
            json.dump(merged, f, indent=0, sort_keys=True)
        os.replace(path + '.tmp', path)
    return np.array([0 if tier[h] == 'A' else 1 for h in hashes], dtype=np.uint8), stratum, new


def build_member_tables(raw, until, owner_hash):
    hashes = sorted({r['member'] for rows in raw.values() for r in rows})
    assert owner_hash in hashes, 'the owner has no rows'
    at = {h: i for i, h in enumerate(hashes)}

    def m(rows):
        return np.array([at[r['member']] for r in rows], dtype=np.int32)

    def tk(rows):
        return np.array([title_key(r['media_type'], r['tmdb_id']) for r in rows], dtype=np.int64)

    def dated(rows):
        return {'member': m(rows), 'title_key': tk(rows), 'created_at': col_time([r['created_at'] for r in rows]),
                'updated_at': col_time([r['updated_at'] for r in rows])}

    T = {}
    # ratings, in entry order
    rr = raw['ratings']
    t = dated(rr)
    t['score'] = col_int([r['score'] for r in rr], np.int8, 0)
    t['has_review'] = np.array([bool(r['has_review']) for r in rr], dtype=bool)
    assert (t['score'] >= 1).all() and (t['score'] <= 10).all(), 'a rating outside 1 to 10'
    assert (t['created_at'] != NAT).all() and (t['updated_at'] != NAT).all(), 'a rating without a date'
    assert (t['title_key'] > 0).all()
    t = sort_table(t, ['member', 'created_at', 'updated_at', 'title_key'])
    t['sitting'], t['position'], t['in_bulk'], moment_bulk = entry_order(t['member'], t['created_at'])
    t['edited'] = t['created_at'] != t['updated_at']
    T['ratings'] = t

    w = sort_table(dated(raw['wishlist']), ['member', 'created_at', 'updated_at', 'title_key'])
    w['sitting'], w['position'], w['in_bulk'], _ = entry_order(w['member'], w['created_at'])
    T['wishlist'] = w
    for name in ('skipped', 'not_interested', 'favorite'):
        T[name] = sort_table(dated(raw[name]), ['member', 'created_at', 'updated_at', 'title_key'])

    ws = raw['watch_state']
    t = dated(ws)
    t['state'] = col_code([r['state'] for r in ws])
    t['state_changed_at'] = col_time([r['state_changed_at'] for r in ws])
    t['pass'] = col_int([r['pass'] for r in ws])
    T['watch_state'] = sort_table(t, ['member', 'title_key'])

    imports = sorted(raw['imports'], key=lambda r: r['import'])
    import_at = {r['import']: i for i, r in enumerate(imports)}
    T['imports'] = {
        'id': [r['import'] for r in imports], 'member': m(imports),
        'source': col_code([r['source'] for r in imports]), 'status': col_code([r['status'] for r in imports]),
        'created_at': col_time([r['created_at'] for r in imports]),
        'finished_at': col_time([r['finished_at'] for r in imports]),
    }

    wl = raw['watch_log']
    t = dated(wl)
    t['episode_tmdb_id'] = col_int([r['episode_tmdb_id'] for r in wl])
    t['season_number'] = col_int([r['season_number'] for r in wl])
    t['episode_number'] = col_int([r['episode_number'] for r in wl])
    t['watched_at'] = col_time([r['watched_at'] for r in wl])
    t['watched_at_precision'] = col_code([r['watched_at_precision'] for r in wl])
    t['origin'] = col_code([r['origin'] for r in wl])
    t['import'] = col_int([import_at.get(r['import'], -1) for r in wl])
    t['pass'] = col_int([r['pass'] for r in wl])
    T['watch_log'] = sort_table(t, ['member', 'created_at', 'title_key', 'season_number', 'episode_number'])

    ii = raw['import_items']
    t = {'import': col_int([import_at[r['import']] for r in ii]), 'row_index': col_int([r['row_index'] for r in ii]),
         'member': m(ii), 'title_key': tk(ii),
         'raw_rating': col_code([r['raw_rating'] for r in ii]),
         'source_score': col_int([r['imdb_score'] for r in ii], np.int8, -1),
         'date_rated': col_code([r['date_rated'] for r in ii]),
         'current_score': col_int([r['current_score'] for r in ii], np.int8, -1),
         'prior_score': col_int([r['prior_score'] for r in ii], np.int8, -1),
         'applied_score': col_int([r['applied_score'] for r in ii], np.int8, -1),
         'applied_at': col_time([r['applied_at'] for r in ii]),
         'outcome': col_code([r['outcome'] for r in ii]), 'kind': col_code([r['kind'] for r in ii]),
         'apply_state': col_code([r['apply_state'] for r in ii])}
    T['import_items'] = sort_table(t, ['import', 'row_index'])

    # provenance: an applied import item for the same member and title wins, then bulk, then typed
    it = T['import_items']
    applied_states = [i for i, v in enumerate(it['apply_state']['vocab']) if v in ('added', 'updated')]
    applied = np.isin(it['apply_state']['codes'], applied_states) & (it['applied_score'] > 0) & (it['title_key'] > 0)
    imported = {(int(a), int(b)): int(s) for a, b, s in
                zip(it['member'][applied], it['title_key'][applied], it['applied_score'][applied])}
    r = T['ratings']
    pairs = list(zip(r['member'].tolist(), r['title_key'].tolist()))
    is_import = np.array([p in imported for p in pairs], dtype=bool)
    r['provenance'] = np.where(is_import, 2, np.where(r['in_bulk'], 1, 0)).astype(np.uint8)
    # the rating still is what the import wrote
    r['import_score_kept'] = np.array([imported.get(p) == s for p, s in zip(pairs, r['score'].tolist())], dtype=bool)

    settings = defaultdict(dict)
    for row in raw['settings']:
        settings[at[row['member']]][row['key']] = row['value']
    who = sorted(settings)
    T['settings'] = {
        'member': np.array(who, dtype=np.int32),
        'country': col_code([settings[i].get('country_default') or None for i in who]),
        'has_streaming': np.array(['streaming_providers_default' in settings[i] for i in who], dtype=bool),
        'streaming': [parse_services(settings[i].get('streaming_providers_default')) for i in who],
    }

    n_ratings = np.bincount(T['ratings']['member'], minlength=len(hashes)).astype(np.int32)
    tier, stratum, new = assign_tiers(hashes, n_ratings.tolist(), owner_hash)
    members = {'hash': hashes, 'is_owner': np.array([h == owner_hash for h in hashes], dtype=bool), 'tier': tier,
               'n_ratings': n_ratings, 'stratum': stratum}
    return members, T, new, moment_bulk


def parse_services(value):
    """The saved streaming services: a comma-separated list of service ids."""
    if not value:
        return []
    return [int(p) if p.strip().isdigit() else p.strip() for p in value.split(',') if p.strip()]


# ---------------------------------------------------------------- titles

def fingerprint_keys():
    src = open(FINGERPRINT_SOURCE).read()
    block = src[src.index('VALID_FINGERPRINT_KEYS: readonly'):]
    block = block[block.index('= [') + 3:block.index(']', block.index('= ['))]
    keys = re.findall(r'"([a-z_]+)"', block)
    assert len(keys) == 74, len(keys)
    return keys


def pull_titles(touched_keys, fp_keys, until):
    """Every pool title and every touched title, one row each, keyed by title key. Also the number of these rows
    that production rewrote after `until`: zero in a pull made at `until`, and in a later run the reason the title
    files differ."""
    store, rewritten = {}, [0]
    for mt in ('movie', 'show'):
        ints = T_INT + (T_INT_MOVIE if mt == 'movie' else [])
        date = 'release_date' if mt == 'movie' else 'first_air_date as release_date'
        cols = ', '.join(['tmdb_id', '(poster_path is not null) as has_poster', 'fingerprint_scores', date,
                          'updated_at as row_updated_at']
                         + T_FLOAT + ints + T_BOOL + T_LIGHT + T_DETAIL)

        def keep(rows):
            for r in rows:
                fs = r.pop('fingerprint_scores')
                rewritten[0] += (r.pop('row_updated_at') or 0) > until
                fp = None if not fs else bytes(MISSING_SCORE if fs.get(k) is None else int(fs[k]) for k in fp_keys)
                store[title_key(mt, r['tmdb_id'])] = (r, fp)

        for page in crate.pages(mt, cols, POOL_RULE, [], ['tmdb_id'], page=1000):
            keep(page)
        log(f'{mt}: {sum(1 for k in store if k // 10**12 == (1 if mt == "movie" else 2))} pool titles')
        want = sorted(k % 10**12 for k in touched_keys
                      if k // 10**12 == (1 if mt == 'movie' else 2) and k not in store)
        for a in range(0, len(want), 500):
            keep(crate.paged(mt, cols, 'tmdb_id = any(?)', [want[a:a + 500]], ['tmdb_id'], page=1000))
        log(f'{mt}: {len(want)} more touched titles asked for')
    return store, rewritten[0]


def build_titles(store, touched_keys, fp_keys):
    keys = np.array(sorted(set(store) | set(touched_keys)), dtype=np.int64)
    n = len(keys)
    rows = [store.get(int(k)) for k in keys]
    info = [r[0] if r else {} for r in rows]
    fp = np.full((n, len(fp_keys)), MISSING_SCORE, dtype=np.uint8)
    for i, r in enumerate(rows):
        if r and r[1] is not None:
            fp[i] = np.frombuffer(r[1], dtype=np.uint8)
    touched = np.isin(keys, np.array(sorted(touched_keys), dtype=np.int64))
    num = {}
    for c in T_FLOAT:
        num[c] = np.array([np.nan if x.get(c) is None else x[c] for x in info], dtype=np.float64)
    for c in T_INT + T_INT_MOVIE:
        num[c] = col_int([x.get(c) for x in info], np.int64, -1)
    for c in T_BOOL:
        num[c] = np.array([-1 if x.get(c) is None else int(bool(x[c])) for x in info], dtype=np.int8)
    votes, score = num['goodwatch_overall_score_voting_count'], num['goodwatch_overall_score_normalized_percent']
    has_poster = np.array([bool(x.get('has_poster')) for x in info], dtype=bool)
    titles = {
        'format': FORMAT, 'key': keys, 'media_type': (keys // 10**12 - 1).astype(np.uint8),
        'media_types': ['movie', 'show'], 'tmdb_id': (keys % 10**12).astype(np.int32),
        'in_catalog': np.array([r is not None for r in rows], dtype=bool),
        'in_pool': has_poster & ~np.isnan(score) & (votes >= 1000),
        'touched': touched, 'has_poster': has_poster,
        'has_fingerprint': (fp != MISSING_SCORE).any(1), 'fingerprint_complete': (fp != MISSING_SCORE).all(1),
        'fingerprint_keys': list(fp_keys), 'fingerprint': fp, 'fingerprint_missing': MISSING_SCORE,
        'release_date': col_time([x.get('release_date') for x in info]),
        'num': num, 'text': {c: [x.get(c) for x in info] for c in T_LIGHT},
        'pool_rule': POOL_RULE_WORDS,
    }
    detail = {'format': FORMAT, 'key': keys, 'cols': {c: [x.get(c) for x in info] for c in T_DETAIL}}
    return titles, detail


def pull_people_and_seasons(titles, detail):
    """Cast, crew and per-season scores, for the titles members touched. The first loop asked for crew by job and
    department; production has no department on a show's crew, so shows had none. Rows without a department are
    kept here."""
    n = len(titles['key'])
    at = {int(k): i for i, k in enumerate(titles['key'])}
    cast, crew = [None] * n, [None] * n
    want = titles['touched'] & titles['in_catalog']
    for code, mt in enumerate(('movie', 'show')):
        ids = titles['tmdb_id'][want & (titles['media_type'] == code)].tolist()
        for a in range(0, len(ids), 200):
            chunk = ids[a:a + 200]
            c, w = defaultdict(list), defaultdict(set)
            for r in crate.paged('person_appeared_in', 'media_tmdb_id, person_tmdb_id, credit_id, order_default',
                                 'media_type = ? and media_tmdb_id = any(?) and order_default < 10', [mt, chunk],
                                 ['media_tmdb_id', 'person_tmdb_id', 'credit_id']):
                c[r['media_tmdb_id']].append((r['order_default'], r['person_tmdb_id']))
            for r in crate.paged('person_worked_on', 'media_tmdb_id, person_tmdb_id, credit_id, job',
                                 'media_type = ? and media_tmdb_id = any(?) and job = any(?) '
                                 'and (department = any(?) or department is null)',
                                 [mt, chunk, CREW_JOBS, CREW_DEPARTMENTS],
                                 ['media_tmdb_id', 'person_tmdb_id', 'credit_id']):
                w[r['media_tmdb_id']].add((r['job'], r['person_tmdb_id']))
            for t in chunk:
                i = at[title_key(mt, t)]
                cast[i] = list(dict.fromkeys(p for _, p in sorted(c[t])))
                crew[i] = [list(x) for x in sorted(w[t])]
        log(f'{mt}: people for {len(ids)} titles')
    people = sorted({p for x in cast if x for p in x} | {p for x in crew if x for _, p in x})
    names = {}
    for a in range(0, len(people), 2000):
        for r in crate.paged('person', 'tmdb_id, name', 'tmdb_id = any(?)', [people[a:a + 2000]], ['tmdb_id']):
            names[r['tmdb_id']] = r['name']
    detail['cast'], detail['crew'] = cast, crew
    detail['person_names'] = {p: names[p] for p in sorted(names)}

    shows = titles['tmdb_id'][want & (titles['media_type'] == 1)].tolist()
    seasons = defaultdict(lambda: defaultdict(dict))
    for a in range(0, len(shows), 200):
        chunk = shows[a:a + 200]
        for table, cols, order in SEASON_TABLES:
            extra = [c for c in order if c != 'show_id' and c != 'season_number']
            for r in crate.paged(table, ', '.join(['show_id', 'season_number'] + extra + cols), 'show_id = any(?)',
                                 [chunk], order):
                if r['season_number'] is None:
                    continue
                for c in cols:
                    if r[c] is not None:
                        seasons[r['show_id']][r['season_number']][c] = r[c]
        # episode scores are read one by one and summarised here: an aggregate in the database adds floats in an
        # order that can change from run to run
        eps = defaultdict(list)
        for r in crate.paged('imdb_episode', 'show_id, imdb_episode_id, season_number, imdb_user_score_original',
                             'show_id = any(?) and imdb_user_score_original is not null', [chunk],
                             ['show_id', 'imdb_episode_id']):
            if r['season_number'] is not None:
                eps[(r['show_id'], r['season_number'])].append(r['imdb_user_score_original'])
        for (show, season), v in eps.items():
            v = np.array(sorted(v), dtype=np.float64)
            seasons[show][season].update(ep_mean=float(v.mean()), ep_min=float(v.min()), ep_max=float(v.max()),
                                         ep_sd=float(v.std(ddof=1)) if len(v) > 1 else None, ep_n=int(len(v)))
    out = [None] * n
    for t in shows:
        out[at[title_key('show', t)]] = [dict(sorted({'season_number': s, **v}.items()))
                                         for s, v in sorted(seasons.get(t, {}).items())]
    detail['seasons'] = out
    log(f'seasons for {sum(1 for t in shows if seasons.get(t))} of {len(shows)} shows')


def pull_embeddings(titles):
    """Text embeddings for the titles members touched; emb_row says which row of the files a title has, or -1."""
    ids = titles['key'][titles['touched'] & titles['in_catalog']].tolist()
    got = {}
    for a in range(0, len(ids), 200):
        for pt in crate.qdrant_points(QDRANT_COLLECTION, ids[a:a + 200], list(EMBEDDINGS)):
            vec = pt.get('vector') or {}
            if all(vec.get(v) for v in EMBEDDINGS):
                got[pt['id']] = [np.asarray(vec[v], dtype=np.float32) for v in EMBEDDINGS]
    have = sorted(got)
    emb = {v: np.stack([got[k][j] for k in have]) if have else np.zeros((0, d), np.float32)
           for j, (v, d) in enumerate(EMBEDDINGS.items())}
    row = np.full(len(titles['key']), -1, dtype=np.int32)
    row[np.searchsorted(titles['key'], np.array(have, dtype=np.int64))] = np.arange(len(have), dtype=np.int32)
    titles['emb_row'] = row
    log(f'embeddings for {len(have)} of {len(ids)} touched titles')
    return emb


# ---------------------------------------------------------------- files

def dump(obj, path):
    """Pickle without the memo, so the bytes depend on the values and their order, not on which objects happen to
    be shared."""
    with open(path, 'wb') as f:
        p = pickle.Pickler(f, protocol=4)
        p.fast = True
        p.dump(obj)
    os.chmod(path, 0o600)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def iso(ms):
    return dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def parse_until(text):
    t = dt.datetime.fromisoformat(text.replace('Z', '+00:00'))
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    return int(t.timestamp() * 1000)


def git_commit():
    def run(*a):
        return subprocess.run(['git', '-C', REPO, *a], capture_output=True, text=True).stdout.strip()
    return run('rev-parse', 'HEAD'), bool(run('status', '--porcelain', '--', LAB))


def production_counts(until):
    """An independent count, by aggregate, of what the paged pull should have read."""
    out = {}
    for name, table in (('ratings', 'user_score'), ('wishlist', 'user_wishlist'), ('skipped', 'user_skipped'),
                        ('not_interested', 'user_not_interested'), ('favorite', 'user_favorite'),
                        ('watch_state', 'user_watch_state'), ('watch_log', 'user_watch_log'),
                        ('imports', 'user_import'), ('setting_members', 'user_setting')):
        r = crate.sql(f'select count(*) as n, count(distinct user_id) as u from {table} where created_at <= ?',
                      [until])[0]
        out[name] = {'rows': r['n'], 'members': r['u']}
    return out


# ---------------------------------------------------------------- census

def census(until, members, T, titles, counts, moment_bulk):
    """CENSUS.md: counts only."""
    L = []

    def table(head, rows):
        L.append('| ' + ' | '.join(head) + ' |')
        L.append('|' + '|'.join(['---'] + ['---:'] * (len(head) - 1)) + '|')
        for r in rows:
            L.append('| ' + ' | '.join(f'{v:,}' if isinstance(v, (int, np.integer)) else str(v) for v in r) + ' |')
        L.append('')

    def pct(a, b):
        return f'{100 * a / b:.1f}%' if b else 'n/a'

    n_members = len(members['hash'])
    R, W, S = T['ratings'], T['wishlist'], T['skipped']
    owner = int(np.flatnonzero(members['is_owner'])[0])
    per = lambda t: np.bincount(t['member'], minlength=n_members)  # noqa: E731
    nr, nw, ns = per(R), per(W), per(S)
    tkeys = titles['key']
    ti = lambda k: np.searchsorted(tkeys, k)  # noqa: E731

    L += ['# Census of the taste pack', '',
          f'Rows written up to {iso(until)} (T0). Counts only; built by `lab/pull.py` together with the pack.',
          'Every count covers all members, tier A and tier B together, unless it says otherwise.', '',
          '## Members and rows per table', '']
    names = [('ratings', 'user_score'), ('wishlist', 'user_wishlist (Want to See)'), ('skipped', 'user_skipped (Skip)'),
             ('not_interested', 'user_not_interested'), ('favorite', 'user_favorite'),
             ('watch_state', 'user_watch_state'), ('watch_log', 'user_watch_log'), ('imports', 'user_import'),
             ('import_items', 'user_import_item'), ('settings', 'user_setting, country and services'),
             ('setting_members', 'user_setting, any key (members only, nothing else pulled)')]
    table(['Table', 'Rows', 'Members'], [(label, counts[k]['rows'], counts[k]['members']) for k, label in names])
    L += [f'Members with a row in any table (any `user_setting` key counts): {n_members:,}.', '']

    L += ['## Members by number of ratings, and the tiers', '']
    rows = []
    for s, (label, _, _) in enumerate(STRATA):
        m = members['stratum'] == s
        rows.append((label, int(m.sum()), int((m & (members['tier'] == 0)).sum()),
                     int((m & (members['tier'] == 1)).sum()), int(nr[m].sum())))
    rows.append(('All', n_members, int((members['tier'] == 0).sum()), int((members['tier'] == 1).sum()),
                 int(nr.sum())))
    table(['Ratings per member', 'Members', 'Tier A', 'Tier B', 'Ratings'], rows)
    L += [f'The owner is in tier A and wrote {int(nr[owner]):,} of the {len(R["score"]):,} ratings. '
          f'Ratings: {int((titles["media_type"][ti(R["title_key"])] == 0).sum()):,} of movies, '
          f'{int((titles["media_type"][ti(R["title_key"])] == 1).sum()):,} of shows.', '']

    L += ['## Ratings by provenance', '']
    prov = R['provenance']
    not_owner = R['member'] != owner
    table(['Provenance', 'Ratings', 'Members', 'Ratings, owner apart'],
          [(name, int((prov == c).sum()), len(set(R['member'][prov == c].tolist())),
            int(((prov == c) & not_owner).sum())) for c, name in enumerate(PROVENANCE)])
    in_bulk_import = int((R['in_bulk'] & (prov == 2)).sum())
    L += ['- `import`: an applied import item exists for the same member and title. `bulk`: one of 5 or more of the '
          'member\'s ratings written within 2 seconds. `typed`: the rest.',
          f'- Of the imported ratings, {in_bulk_import:,} also sit in a bulk write, and '
          f'{int(R["import_score_kept"].sum()):,} still have the score the import wrote.',
          f'- Ratings in a bulk write whatever their provenance: {int(R["in_bulk"].sum()):,}. Under the other reading '
          f'of the rule (ratings chained by gaps under 2 seconds, 5 or more in the chain): '
          f'{int(moment_bulk.sum()):,}.',
          f'- Write time is `created_at`. It differs from `updated_at` (the `edited` flag) on '
          f'{int(R["edited"].sum()):,} of {len(prov):,} ratings ({pct(int(R["edited"].sum()), len(prov))}), from '
          f'{len(set(R["member"][R["edited"]].tolist())):,} members.',
          f'- Ratings with a review: {int(R["has_review"].sum()):,}.', '']

    L += ['## Sittings', '', 'A new sitting starts after 6 hours or more without a rating by that member.', '']
    sittings = np.zeros(n_members, np.int64)
    for a, b in runs(R['member']):
        sittings[R['member'][a]] = R['sitting'][b - 1] + 1
    days = np.zeros(n_members, np.int64)
    for a, b in runs(R['member']):
        days[R['member'][a]] = len(set((R['created_at'][a:b] // 86400000).tolist()))
    table(['Members with ratings', 'Members'],
          [('one sitting', int((sittings == 1).sum())), ('two or more sittings', int((sittings >= 2).sum())),
           ('five or more sittings', int((sittings >= 5).sum())),
           ('ratings on one day (UTC) only', int((days == 1).sum()))])
    later = R['sitting'] > 0
    L += [f'Ratings written in a second or later sitting: {int(later.sum()):,}, of which the owner '
          f'{int((later & ~not_owner).sum()):,}.', '']

    L += ['## Want to See, Skip, Not interested', '']
    w_sit = np.zeros(n_members, np.int64)
    for a, b in runs(W['member']):
        w_sit[W['member'][a]] = W['sitting'][b - 1] + 1
    table(['Members with', 'Members'],
          [('1 or more Want to See adds', int((nw >= 1).sum())), ('5 or more', int((nw >= 5).sum())),
           ('10 or more dated Want to See adds', int((nw >= 10).sum())), ('20 or more', int((nw >= 20).sum())),
           ('Want to See adds in two or more sittings', int((w_sit >= 2).sum())),
           ('1 or more Skips', int((ns >= 1).sum())), ('10 or more Skips', int((ns >= 10).sum())),
           ('10 or more Want to See adds and 10 or more Skips', int(((nw >= 10) & (ns >= 10)).sum()))])
    rated = {}
    for mm, k, c in zip(R['member'].tolist(), R['title_key'].tolist(), R['created_at'].tolist()):
        rated[(mm, k)] = c
    w_pairs = list(zip(W['member'].tolist(), W['title_key'].tolist(), W['created_at'].tolist()))
    w_later = [(mm, k) for mm, k, c in w_pairs if (mm, k) in rated and rated[(mm, k)] > c]
    w_before = [(mm, k) for mm, k, c in w_pairs if (mm, k) in rated and rated[(mm, k)] <= c]
    ni = T['not_interested']
    L += [f'- Every Want to See add has a date. Adds in a bulk write (5 or more within 2 seconds): '
          f'{int(W["in_bulk"].sum()):,} of {len(W["member"]):,}.',
          f'- Want to See titles later rated (the rating was written after the add): {len(w_later):,} rows from '
          f'{len({m for m, _ in w_later}):,} members.',
          f'- Want to See titles whose rating was written before the add or at the same moment: {len(w_before):,} '
          f'rows from {len({m for m, _ in w_before}):,} members.',
          f'- Want to See titles not rated: {len(w_pairs) - len(w_later) - len(w_before):,} rows from '
          f'{len({m for m, k, _ in w_pairs if (m, k) not in rated}):,} members.',
          f'- Not interested rows: {len(ni["member"]):,}, from {len(set(ni["member"].tolist())):,} members.', '']

    L += ['## Imports', '']
    it, im = T['import_items'], T['imports']
    both = (it['prior_score'] > 0) & (it['applied_score'] > 0)
    src_cur = (it['source_score'] > 0) & (it['current_score'] > 0)
    applied = it['applied_score'] > 0
    other_kind = np.isin(it['kind']['codes'], [i for i, v in enumerate(it['kind']['vocab']) if v != 'rating'])
    table(['Imports', 'Count'],
          [(f'{im["source"]["vocab"][s]}, {im["status"]["vocab"][st]}',
            int(((im['source']['codes'] == s) & (im['status']['codes'] == st)).sum()))
           for s in range(len(im['source']['vocab'])) for st in range(len(im['status']['vocab']))
           if ((im['source']['codes'] == s) & (im['status']['codes'] == st)).any()])
    L += [f'- Import items with an applied score: {int(applied.sum()):,}, from '
          f'{len(set(it["member"][applied].tolist())):,} members.',
          f'- Import pairs where a prior score and an applied score both exist: {int(both.sum()):,}; of these '
          f'{int((both & (it["prior_score"] != it["applied_score"])).sum()):,} differ.',
          f'- Import items where the source rating and the member\'s GoodWatch rating at preview both exist: '
          f'{int(src_cur.sum()):,}; of these {int((src_cur & (it["source_score"] != it["current_score"])).sum()):,} '
          f'differ.',
          f'- Import items that are not ratings (kind watch, want, favorite or review): {int(other_kind.sum()):,}, '
          f'of which {int((other_kind & (it["apply_state"]["codes"] >= 0)).sum()):,} were applied. Items that named '
          f'no movie or show: {int((it["title_key"] == 0).sum()):,}.', '']

    L += ['## Watching', '']
    st, lg = T['watch_state'], T['watch_log']
    st_mt = titles['media_type'][ti(st['title_key'])]
    seen = st['state']['codes'] == st['state']['vocab'].index('seen') if 'seen' in st['state']['vocab'] else \
        np.zeros(len(st_mt), bool)
    unrated = np.array([(a, b) not in rated for a, b in zip(st['member'].tolist(), st['title_key'].tolist())],
                       dtype=bool)
    rows = []
    for code, mt in enumerate(('Movies', 'Shows')):
        m = seen & unrated & (st_mt == code)
        per_m = np.bincount(st['member'][m], minlength=n_members)
        rows.append((mt, int((seen & (st_mt == code)).sum()), int(m.sum()), int((per_m >= 1).sum()),
                     int((per_m >= 10).sum())))
    table(['Seen', 'Rows', 'Seen but not rated', 'Members with one or more', 'Members with 10 or more'], rows)
    show_state = st_mt == 1
    not_started = st['state']['codes'] == (st['state']['vocab'].index('not_started')
                                           if 'not_started' in st['state']['vocab'] else -9)
    started = show_state & ~not_started
    per_started = np.bincount(st['member'][started], minlength=n_members)
    other = started & ~seen
    rows = [(v, int((show_state & (st['state']['codes'] == i)).sum()),
             len(set(st['member'][show_state & (st['state']['codes'] == i)].tolist())))
            for i, v in enumerate(st['state']['vocab'])]
    table(['Show status', 'Rows', 'Members'], rows)
    lg_origin = [(f'{lg["origin"]["vocab"][o]}, {lg["watched_at_precision"]["vocab"][p]}',
                  int(((lg['origin']['codes'] == o) & (lg['watched_at_precision']['codes'] == p)).sum()),
                  len(set(lg['member'][(lg['origin']['codes'] == o) & (lg['watched_at_precision']['codes'] == p)]
                          .tolist())))
                 for o in range(len(lg['origin']['vocab'])) for p in range(len(lg['watched_at_precision']['vocab']))
                 if ((lg['origin']['codes'] == o) & (lg['watched_at_precision']['codes'] == p)).any()]
    table(['Watch log rows by origin and date precision', 'Rows', 'Members'], lg_origin)
    dated_log = lg['watched_at'] != NAT
    L += [f'- Members with watch logs: {len(set(lg["member"].tolist())):,}; with a dated watch: '
          f'{len(set(lg["member"][dated_log].tolist())):,}.',
          f'- Members with a show status: {len(set(st["member"][started].tolist())):,}; with 5 or more started shows '
          f'that have a status: {int((per_started >= 5).sum()):,}.',
          f'- Members with a show status other than Seen (Watching, On hold, Dropped): '
          f'{len(set(st["member"][other].tolist())):,}.', '']

    L += ['## Titles', '']
    r_idx = ti(R['title_key'])
    distinct = np.unique(r_idx)
    pool = titles['in_pool']
    table(['Title universe', 'Titles'],
          [('all titles in the pack', len(tkeys)),
           ('touched by a member in any table', int(titles['touched'].sum())),
           ('touched and missing from the catalog', int((titles['touched'] & ~titles['in_catalog']).sum())),
           ('reference pool', int(pool.sum())),
           ('reference pool, movies', int((pool & (titles['media_type'] == 0)).sum())),
           ('reference pool, shows', int((pool & (titles['media_type'] == 1)).sum())),
           ('reference pool with a fingerprint', int((pool & titles['has_fingerprint']).sum())),
           ('touched with a fingerprint', int((titles['touched'] & titles['has_fingerprint']).sum())),
           ('touched with text embeddings', int((titles['emb_row'] >= 0).sum()))])
    L += [f'The reference pool is: {POOL_RULE_WORDS}.', '']
    rows = [('a fingerprint', int(titles['has_fingerprint'][distinct].sum()), int(titles['has_fingerprint'][r_idx].sum())),
            ('a complete fingerprint (all 74 scores)', int(titles['fingerprint_complete'][distinct].sum()),
             int(titles['fingerprint_complete'][r_idx].sum()))]
    for c in PUBLIC_SCORES:
        have = ~np.isnan(titles['num'][c])
        rows.append((f'`{c}`', int(have[distinct].sum()), int(have[r_idx].sum())))
    rows.append(('in the reference pool', int(pool[distinct].sum()), int(pool[r_idx].sum())))
    rows.append(('outside the reference pool', int((~pool[distinct]).sum()), int((~pool[r_idx]).sum())))
    table([f'Rated titles ({len(distinct):,}) and ratings ({len(r_idx):,}) with', 'Titles', 'Ratings'],
          [(a, f'{b:,} ({pct(b, len(distinct))})', f'{c:,} ({pct(c, len(r_idx))})') for a, b, c in rows])
    w_idx = ti(W['title_key'])
    gone = ~titles['in_catalog']
    L += [f'- Want to See adds outside the reference pool: {int((~pool[w_idx]).sum()):,} of {len(w_idx):,}.',
          f'- Ratings of titles without a fingerprint come from '
          f'{len(set(R["member"][~titles["has_fingerprint"][r_idx]].tolist())):,} members.',
          f'- Titles a member touched that are no longer in the `movie` or `show` table stay in the pack, flagged, '
          f'with no title data: {int(gone[r_idx].sum()):,} ratings, {int(gone[w_idx].sum()):,} Want to See adds and '
          f'{int(gone[ti(S["title_key"])].sum()):,} Skips are on such titles.', '']
    return '\n'.join(L)


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--until', required=True, help='ISO time; rows written up to it are pulled')
    ap.add_argument('--out', required=True, help='the pack folder')
    ap.add_argument('--gate', help='the folder for gate.pkl')
    ap.add_argument('--no-publish', action='store_true', help='do not copy the manifest and census to the repository')
    a = ap.parse_args()
    until = parse_until(a.until)
    out = os.path.abspath(os.path.expanduser(a.out))
    packs = os.path.join(ROOT, 'packs')
    real = os.path.dirname(out) == packs
    gate = os.path.abspath(os.path.expanduser(a.gate)) if a.gate else (
        os.path.join(ROOT, 'gate', os.path.basename(out)) if real else out.rstrip('/') + '_gate')
    if os.path.commonpath([gate, out]) == out:
        sys.exit('the gate folder must be outside the pack folder')
    if os.path.exists(os.path.join(out, 'pack.pkl')) or os.path.exists(os.path.join(gate, 'gate.pkl')):
        sys.exit(f'{out} or {gate} already holds a pack; packs are never rewritten')
    crate_now = crate.sql('select now() as now')[0]['now']
    if until > crate_now:
        sys.exit('--until is in the future')
    started = int(time.time() * 1000)
    for d in (out, gate):
        os.makedirs(d, mode=0o700, exist_ok=True)
        os.chmod(d, 0o700)
    if real:
        os.chmod(os.path.dirname(gate), 0o700)

    H = Hasher(secret_key())
    owner_hash = H(owner_id())
    running = crate.sql("select count(*) as n from user_import where status = 'running'")[0]['n']
    raw = pull_members(until, H)
    members, T, new_tiers, moment_bulk = build_member_tables(raw, until, owner_hash)
    counts = {k: {'rows': len(raw[k]), 'members': len({r['member'] for r in raw[k]})} for k in raw}
    expected = production_counts(until)
    mismatch = {k: (counts[k], expected[k]) for k in expected if counts[k] != expected[k]}
    if mismatch:
        sys.exit(f'the paged pull and the aggregate count disagree: {mismatch}')
    del raw

    touched = set()
    for name in ('ratings', 'wishlist', 'skipped', 'not_interested', 'favorite', 'watch_state', 'watch_log',
                 'import_items'):
        touched.update(k for k in np.unique(T[name]['title_key']).tolist() if k > 0)
    fp_keys = fingerprint_keys()
    store, rewritten = pull_titles(touched, fp_keys, until)
    titles, detail = build_titles(store, touched, fp_keys)
    del store
    pull_people_and_seasons(titles, detail)
    emb = pull_embeddings(titles)

    # tier split of the rating data
    tier_of_row = lambda t: members['tier'][t['member']]  # noqa: E731
    R = T['ratings']
    gate_ratings = take(R, tier_of_row(R) == 1)
    it = T['import_items']
    b_items = tier_of_row(it) == 1
    rating_cols = ['raw_rating', 'source_score', 'current_score', 'prior_score', 'applied_score']
    gate_items = take({c: it[c] for c in ['import', 'row_index', 'member', 'title_key'] + rating_cols}, b_items)
    open_items = dict(it)
    for c in rating_cols:
        if isinstance(it[c], dict):
            open_items[c] = {'codes': np.where(b_items, -1, it[c]['codes']).astype(np.int32), 'vocab': it[c]['vocab']}
        else:
            open_items[c] = np.where(b_items, -1, it[c]).astype(it[c].dtype)
    tier_b = [h for h, t in zip(members['hash'], members['tier']) if t == 1]
    tables = {k: v for k, v in T.items() if k not in ('ratings', 'import_items')}
    pack = {'format': FORMAT, 'until': until, 'seed': SEED, 'members': members, 'tier_names': ['A', 'B'],
            'tier_b': tier_b, 'provenance_names': PROVENANCE, 'strata': [s[0] for s in STRATA],
            'ratings': take(R, tier_of_row(R) == 0), 'import_items': open_items, **tables}
    gate_pack = {'format': FORMAT, 'until': until, 'members': tier_b, 'provenance_names': PROVENANCE,
                 'ratings': gate_ratings, 'import_item_ratings': gate_items}

    files = {}
    dump(pack, os.path.join(out, 'pack.pkl'))
    dump(titles, os.path.join(out, 'titles.pkl'))
    dump(detail, os.path.join(out, 'titles_detail.pkl'))
    for v in EMBEDDINGS:
        np.save(os.path.join(out, f'emb_{v}.npy'), emb[v])
        os.chmod(os.path.join(out, f'emb_{v}.npy'), 0o600)
    dump(gate_pack, os.path.join(gate, 'gate.pkl'))
    for name in sorted(os.listdir(out)):
        if name.endswith(('.pkl', '.npy')):
            files[name] = sha256(os.path.join(out, name))
    gate_sha = sha256(os.path.join(gate, 'gate.pkl'))

    # the census is over all members, tier A and tier B together
    text = census(until, members, T, titles, counts, moment_bulk)
    with open(os.path.join(out, 'CENSUS.md'), 'w') as f:
        f.write(text)

    commit, dirty = git_commit()
    tier_counts = {}
    for s, (label, _, _) in enumerate(STRATA):
        m = members['stratum'] == s
        tier_counts[label] = {'A': int((m & (members['tier'] == 0)).sum()), 'B': int((m & (members['tier'] == 1)).sum())}
    manifest = {
        'format': FORMAT,
        'until': iso(until), 'until_ms': until,
        'pull_started': iso(started), 'pull_finished': iso(int(time.time() * 1000)),
        'git_commit': commit, 'lab_has_uncommitted_changes': dirty,
        'code_sha256': {n: sha256(os.path.join(LAB, n)) for n in ('pull.py', 'crate.py', 'pack.py')
                        if os.path.exists(os.path.join(LAB, n))},
        'pack_folder': out.replace(os.path.expanduser('~'), '~'),
        'gate_folder': gate.replace(os.path.expanduser('~'), '~'),
        'files_sha256': files, 'gate_sha256': {'gate.pkl': gate_sha},
        'rows': {k: counts[k] for k in sorted(counts)},
        'rows_match_aggregate_count': True,
        'ratings': {'all': int(len(R['score'])), 'tier_a_in_pack': int(len(pack['ratings']['score'])),
                    'tier_b_in_gate': int(len(gate_ratings['score'])),
                    'by_provenance': {n: int((R['provenance'] == c).sum()) for c, n in enumerate(PROVENANCE)}},
        'members': {'all': len(members['hash']), 'tier_a': int((members['tier'] == 0).sum()),
                    'tier_b': int((members['tier'] == 1).sum()), 'with_ratings': int((members['n_ratings'] > 0).sum()),
                    'by_ratings_per_member': tier_counts},
        'split': {'seed': SEED, 'tier_b_share': TIER_B_SHARE, 'strata': [s[0] for s in STRATA],
                  'owner': 'always tier A, flagged is_owner',
                  'kept_in': '~/goodwatch-research/taste/tiers.json', 'members_newly_assigned': new_tiers},
        'reference_pool': {'rule': POOL_RULE_WORDS, 'where': POOL_RULE, 'titles': int(titles['in_pool'].sum()),
                           'with_fingerprint': int((titles['in_pool'] & titles['has_fingerprint']).sum())},
        'titles': {'all': int(len(titles['key'])), 'touched': int(titles['touched'].sum()),
                   'touched_missing_from_catalog': int((titles['touched'] & ~titles['in_catalog']).sum()),
                   'with_embeddings': int((titles['emb_row'] >= 0).sum()),
                   'rows_rewritten_in_production_after_until': int(rewritten)},
        'imports_running_at_pull': running,
        'rules': {'write_time': 'created_at', 'sitting_gap_hours': 6,
                  'bulk': '5 or more of the member\'s rows written within 2 seconds',
                  'provenance': 'import if an applied import item exists for the member and title, else bulk, '
                                'else typed',
                  'member_id': 'HMAC-SHA256 with a key kept outside the pack, first 16 hex characters'},
        'notes': [
            'pack.pkl holds the ratings of tier A members only. gate.pkl holds the ratings of tier B members.',
            'Everything else of tier B members stays in pack.pkl: Want to See, Skip, Not interested, favorites, watch '
            'state, watch log, settings, and their number of ratings. T2b has no gate. Watch state and the watch log '
            'therefore show which titles a tier B member has seen, not how they rated them.',
            'The rating columns of tier B members\' import items (raw rating, source, current, prior and applied '
            'score) are blanked in pack.pkl and kept in gate.pkl.',
            'Member tables are filtered on created_at <= until. Title files are as of the pull: their hashes repeat '
            'only while production\'s title rows did not change. titles.rows_rewritten_in_production_after_until '
            'counts the rows a run found changed since until; `python3 pack.py diff A B` lists what differs.',
        ],
    }
    with open(os.path.join(out, 'MANIFEST.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    if real and not a.no_publish:
        shutil.copy(os.path.join(out, 'MANIFEST.json'), os.path.join(LOOP_DIR, 'MANIFEST.json'))
        shutil.copy(os.path.join(out, 'CENSUS.md'), os.path.join(LOOP_DIR, 'CENSUS.md'))
        log(f'manifest and census copied to {LOOP_DIR}')
    for name, digest in files.items():
        log(digest, name)
    log(gate_sha, 'gate.pkl')
    log('done', out)


if __name__ == '__main__':
    main()
