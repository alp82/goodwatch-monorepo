"""A small made-up pack with the layout of a real one, for tests: <root>/packs/synth and <root>/gate/synth.

Ratings come from a model with a title quality, a member offset and a member taste on a few fingerprint attributes,
so that a predictor which learns from the population has something to find. No real member data is involved.
"""
import hashlib
import json
import os
import pickle

import numpy as np

NAT = np.iinfo(np.int64).min
K = 74
FACTS = ('goodwatch_overall_score_normalized_percent', 'imdb_user_score_normalized_percent',
         'metacritic_meta_score_normalized_percent', 'rotten_tomatoes_tomato_score_normalized_percent',
         'rotten_tomatoes_audience_score_normalized_percent', 'tmdb_user_score_normalized_percent')
GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Romance']


def entry_order(member, written):
    n = len(member)
    sitting, position, bulk = np.zeros(n, np.int32), np.zeros(n, np.int32), np.zeros(n, bool)
    cuts = np.flatnonzero(np.diff(member)) + 1
    for a, b in zip(np.r_[0, cuts].tolist(), np.r_[cuts, n].tolist()):
        t = written[a:b]
        sitting[a:b] = np.r_[0, np.cumsum(np.diff(t) >= 6 * 3600 * 1000)]
        position[a:b] = np.arange(b - a)
        for i in range(b - a - 4):
            if t[i + 4] - t[i] <= 2000:
                bulk[a + i:a + i + 5] = True
    return sitting, position, bulk


def sha256(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def build(root, n_members=60, n_titles=400, seed=1):
    rng = np.random.default_rng(seed)
    pack_dir, gate_dir = os.path.join(root, 'packs', 'synth'), os.path.join(root, 'gate', 'synth')
    os.makedirs(pack_dir), os.makedirs(gate_dir)

    # titles
    shows = n_titles // 4
    key = np.sort(np.r_[10**12 + np.arange(1, n_titles - shows + 1), 2 * 10**12 + np.arange(1, shows + 1)])
    media = (key >= 2 * 10**12).astype(np.uint8)
    fp = rng.integers(0, 11, size=(n_titles, K)).astype(np.uint8)
    has_fp = np.ones(n_titles, bool)
    has_fp[rng.choice(n_titles, 8, replace=False)] = False
    fp[~has_fp] = 255
    in_catalog = np.ones(n_titles, bool)
    in_catalog[np.flatnonzero(~has_fp)[:3]] = False
    quality = rng.normal(0, 0.9, n_titles)
    gw = np.clip(65 + 12 * quality + rng.normal(0, 4, n_titles), 5, 99)
    num = {c: np.clip(gw + rng.normal(0, 5, n_titles), 1, 100) for c in FACTS}
    num[FACTS[0]] = gw.copy()
    for c in FACTS:
        num[c][~in_catalog] = np.nan
    num['metacritic_meta_score_normalized_percent'][rng.random(n_titles) < 0.2] = np.nan
    num['release_year'] = rng.integers(1970, 2026, n_titles).astype(np.int64)
    num['goodwatch_overall_score_voting_count'] = rng.integers(200, 500000, n_titles).astype(np.int64)
    num['release_year'][~in_catalog] = -1
    num['goodwatch_overall_score_voting_count'][~in_catalog] = -1
    series = np.random.default_rng(seed + 1000)                  # its own generator: the rest stays as it was
    num['movie_series_id'] = np.where(series.random(n_titles) < 0.3, series.integers(1, 30, n_titles), -1)
    num['movie_series_id'][media == 1] = -1
    release = ((num['release_year'] - 1970) * 365.25 * 86400 * 1000).astype(np.int64)
    release[~in_catalog] = NAT
    genres = [sorted(rng.choice(GENRES, rng.integers(1, 3), replace=False).tolist()) for _ in range(n_titles)]
    text = {'title': [f'Title {i}' for i in range(n_titles)],
            'genres': [g if c else None for g, c in zip(genres, in_catalog)],
            'original_language_code': [rng.choice(['en', 'ja', 'fr']) if c else None for c in in_catalog],
            'origin_country_codes': [['US'] if i % 3 else None for i in range(n_titles)],
            'production_method': ['Live-Action'] * n_titles, 'animation_style': [None] * n_titles}
    titles = {'format': 1, 'key': key, 'media_type': media, 'media_types': ['movie', 'show'],
              'tmdb_id': (key % 10**12).astype(np.int32), 'in_catalog': in_catalog,
              'in_pool': in_catalog & (num['goodwatch_overall_score_voting_count'] >= 1000),
              'touched': np.ones(n_titles, bool), 'has_poster': in_catalog.copy(), 'has_fingerprint': has_fp,
              'fingerprint_complete': has_fp.copy(), 'fingerprint_keys': [f'attr{i}' for i in range(K)],
              'fingerprint': fp, 'fingerprint_missing': 255, 'release_date': release, 'num': num, 'text': text,
              'emb_row': np.full(n_titles, -1, np.int32)}

    # members and ratings
    tier = (np.arange(n_members) % 3 == 2).astype(np.uint8)      # every third member is tier B
    tier[0] = 0
    is_owner = np.zeros(n_members, bool)
    is_owner[0] = True
    hashes = [hashlib.sha256(f'member{i}'.encode()).hexdigest()[:16] for i in range(n_members)]
    z = (np.where(fp == 255, 5, fp) - 5.0) / 3.0
    rows = {c: [] for c in ('member', 'title_key', 'created_at', 'score')}
    wish = {c: [] for c in ('member', 'title_key', 'created_at')}
    skip = {c: [] for c in ('member', 'title_key', 'created_at')}
    t0 = 1_700_000_000_000
    for u in range(n_members):
        n = 150 if u == 0 else int(rng.choice([3, 7, 12, 18, 25, 45, 70, 110]))
        chosen = rng.choice(n_titles, n, replace=False)
        w = rng.normal(0, 0.35, 4)
        offset = rng.normal(0, 0.8)
        s = 6.6 + offset + 1.1 * quality[chosen] + z[chosen][:, :4] @ w + rng.normal(0, 0.9, n)
        s = np.clip(np.round(s), 1, 10).astype(np.int8)
        gaps = rng.integers(3000, 15000, n)
        gaps[rng.random(n) < 0.15] = 900                           # typed fast: under 2 seconds
        if n >= 25 and u % 4 == 1:
            gaps[n // 2] = 7 * 3600 * 1000                         # a later sitting
        if u == 0:
            gaps[[40, 90, 120]] = 30 * 3600 * 1000
        if u % 7 == 3 and n >= 18:
            gaps[8:16] = 0                                         # a bulk write of 9 ratings
        t = t0 + u * 1000 + np.cumsum(gaps)
        rows['member'] += [u] * n
        rows['title_key'] += key[chosen].tolist()
        rows['created_at'] += t.tolist()
        rows['score'] += s.tolist()
        rest = np.setdiff1d(np.arange(n_titles), chosen)
        visits = u == 0 or (n >= 25 and u % 4 == 1)               # members who come back: T2b has something to cut
        # their adds and skips are written during their visits, a second after one of their ratings (the one as far
        # along their ratings as the drawn time is along their span)
        when = (lambda x: np.sort(t[((x - t[0]) * (n - 1)) // max(t[-1] - t[0], 1)] + 1000) if visits else x)
        picked = []
        for table, k in ((wish, 6), (skip, 10)):
            pick = rng.choice(rest, k, replace=False)
            picked += pick.tolist()
            table['member'] += [u] * k
            table['title_key'] += key[pick].tolist()
            table['created_at'] += when(np.sort(rng.integers(t[0], t[-1] + 1, k))).tolist()
        if visits:                                                # and add more titles to Want to See
            more = np.random.default_rng(seed + 3000 + u)         # its own generator: the rest stays as it was
            pick = more.choice(np.setdiff1d(rest, picked), 8, replace=False)
            wish['member'] += [u] * 8
            wish['title_key'] += key[pick].tolist()
            wish['created_at'] += when(more.integers(t[0], t[-1] + 1, 8)).tolist()
    R = {'member': np.array(rows['member'], np.int32), 'title_key': np.array(rows['title_key'], np.int64),
         'created_at': np.array(rows['created_at'], np.int64), 'score': np.array(rows['score'], np.int8)}
    R['updated_at'] = R['created_at'].copy()
    late = np.random.default_rng(seed + 2000).random(len(R['member'])) < 0.03   # edited a day after the last rating
    R['updated_at'][late] = R['created_at'].max() + 86400 * 1000
    R['sitting'], R['position'], R['in_bulk'] = entry_order(R['member'], R['created_at'])
    n = len(R['member'])
    R['has_review'], R['import_score_kept'] = (np.zeros(n, bool) for _ in range(2))
    R['edited'] = R['updated_at'] > R['created_at']
    R['provenance'] = R['in_bulk'].astype(np.uint8)

    def side(table, extra):
        order = np.lexsort((table['created_at'], table['member']))
        out = {'member': np.array(table['member'], np.int32)[order],
               'title_key': np.array(table['title_key'], np.int64)[order],
               'created_at': np.array(table['created_at'], np.int64)[order]}
        out['updated_at'] = out['created_at'].copy()
        if extra:
            out['sitting'], out['position'], out['in_bulk'] = entry_order(out['member'], out['created_at'])
        return out

    empty = {'member': np.zeros(0, np.int32), 'title_key': np.zeros(0, np.int64),
             'created_at': np.zeros(0, np.int64), 'updated_at': np.zeros(0, np.int64)}
    take = (lambda table, m: {c: v[m] for c, v in table.items()})
    in_b = tier[R['member']] == 1
    members = {'hash': hashes, 'is_owner': is_owner, 'tier': tier,
               'n_ratings': np.bincount(R['member'], minlength=n_members).astype(np.int32),
               'stratum': np.zeros(n_members, np.int8)}
    tier_b = [h for h, t in zip(hashes, tier) if t == 1]
    pack = {'format': 1, 'until': int(R['created_at'].max()) + 1, 'seed': seed, 'members': members,
            'tier_names': ['A', 'B'], 'tier_b': tier_b, 'provenance_names': ['typed', 'bulk', 'import'],
            'strata': ['all'], 'ratings': take(R, ~in_b), 'wishlist': side(wish, True), 'skipped': side(skip, False),
            'not_interested': dict(empty), 'favorite': dict(empty), 'watch_state': dict(empty),
            'watch_log': dict(empty), 'imports': {'member': np.zeros(0, np.int32)},
            'import_items': {'member': np.zeros(0, np.int32)}, 'settings': {'member': np.zeros(0, np.int32)}}
    gate = {'format': 1, 'until': pack['until'], 'members': tier_b, 'provenance_names': pack['provenance_names'],
            'ratings': take(R, in_b), 'import_item_ratings': {}}
    for name, obj, folder in (('pack.pkl', pack, pack_dir), ('titles.pkl', titles, pack_dir),
                              ('titles_detail.pkl', {}, pack_dir), ('gate.pkl', gate, gate_dir)):
        with open(os.path.join(folder, name), 'wb') as f:
            pickle.dump(obj, f)
    manifest = {'format': 1, 'until': 'synthetic', 'pack_folder': os.path.abspath(pack_dir),
                'gate_folder': os.path.abspath(gate_dir),
                'files_sha256': {n: sha256(os.path.join(pack_dir, n)) for n in ('pack.pkl', 'titles.pkl')},
                'gate_sha256': {'gate.pkl': sha256(os.path.join(gate_dir, 'gate.pkl'))}}
    with open(os.path.join(pack_dir, 'MANIFEST.json'), 'w') as f:
        json.dump(manifest, f)
    return pack_dir


if __name__ == '__main__':
    import sys
    print(build(sys.argv[1]))
