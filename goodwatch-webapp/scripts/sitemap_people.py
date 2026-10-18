"""Thirty stable, substantive cast/director pages connected to the title cohort."""
from collections import defaultdict
from sitemap_selection import previous_ids
from utils import title_to_dashed

PERSON_LIMIT = 30
MIN_COHORT_CREDITS = 3


def person_url(person_id, name):
    """Match personPath in app/utils/helpers.ts, including names without Latin letters."""
    slug = title_to_dashed(name).strip('-')
    return f'https://goodwatch.app/person/{person_id}' + (f'-{slug}' if slug else '')


def select_people(cursor, title_ids, previous=None):
    credits = defaultdict(set)
    for kind in ('movie', 'show'):
        ids = title_ids[kind]
        for table, role in (('person_appeared_in', 'order_default >= 0 AND order_default < 5'),
                            ('person_worked_on', "job = 'Director'")):
            cursor.execute(f'SELECT person_tmdb_id, media_tmdb_id FROM {table} '
                           f'WHERE media_type = ? AND media_tmdb_id = ANY(?) AND {role}', [kind, ids])
            for person_id, title_id in cursor.fetchall():
                credits[person_id].add((kind, title_id))
    eligible_ids = sorted(i for i, titles in credits.items() if len(titles) >= MIN_COHORT_CREDITS)
    if not eligible_ids:
        raise ValueError('No substantive people connected to the title cohort')
    cursor.execute("SELECT tmdb_id, name, popularity FROM person WHERE tmdb_id = ANY(?) "
                   "AND name IS NOT NULL AND trim(name) <> '' AND profile_path IS NOT NULL "
                   "AND (adult = false OR adult IS NULL) AND popularity > 0 "
                   "ORDER BY popularity DESC, tmdb_id ASC", [eligible_ids])
    ranked = cursor.fetchall()
    by_id = {r[0]: r for r in ranked}
    chosen = [i for i in previous_ids(previous, 'person') if i in by_id][:PERSON_LIMIT]
    for person_id, name, popularity in ranked:
        if len(chosen) >= PERSON_LIMIT:
            break
        if person_id not in chosen:
            chosen.append(person_id)
    if len(chosen) != PERSON_LIMIT:
        raise ValueError(f'Not enough substantive people: {len(chosen)} < {PERSON_LIMIT}')
    return [{'id': i, 'name': by_id[i][1], 'url': person_url(i, by_id[i][1]),
             'cohort_credits': len(credits[i])} for i in chosen]
