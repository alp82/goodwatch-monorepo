"""Episode placement courtesy of Anime-Lists; tracker crosswalk courtesy of Fribb.

https://github.com/Anime-Lists/anime-lists (master XML is authoritative for TMDB)
https://github.com/Fribb/anime-lists (AniDB -> MyAnimeList, AniList and Kitsu only)
Owner approved server-side use in #646. Never substitutes TVDB placement for TMDB.
"""
import json
import xml.etree.ElementTree as ET


def integer(value, *, minimum=None):
    if isinstance(value, bool) or not str(value).lstrip('-').isdigit():
        raise ValueError(f'Invalid integer: {value!r}')
    result = int(value)
    if minimum is not None and result < minimum:
        raise ValueError(f'Integer below {minimum}: {value!r}')
    return result


def build_snapshot(master: bytes, crosswalk: bytes) -> dict:
    root = ET.fromstring(master)
    rows = json.loads(crosswalk)
    if root.tag != 'anime-list' or not isinstance(rows, list) or not rows:
        raise ValueError('Invalid Anime-Lists or Fribb document')
    ids = {}
    for row in rows:
        if not row.get('anidb_id'):
            continue
        anidb = integer(row['anidb_id'], minimum=1)
        entry = ids.setdefault(anidb, {'myanimelist': set(), 'anilist': set(), 'kitsu': set()})
        for source, field in [('myanimelist', 'mal_id'), ('anilist', 'anilist_id'), ('kitsu', 'kitsu_id')]:
            if row.get(field):
                entry[source].add(integer(row[field], minimum=1))
    entries = []
    for anime in root.findall('anime'):
        if not anime.get('tmdbtv'):
            continue
        anidb = integer(anime.get('anidbid'), minimum=1)
        season = anime.get('tmdbseason')
        entry = {
            'anidbId': anidb,
            'showId': integer(anime.get('tmdbtv'), minimum=1),
            'season': season if season == 'a' else integer(season, minimum=0) if season else None,
            'offset': integer(anime.get('tmdboffset') or '0'),
            'ranges': [],
            'ids': {key: sorted(values) for key, values in ids.get(anidb, {'myanimelist': [], 'anilist': [], 'kitsu': []}).items()},
        }
        for mapping in anime.findall('./mapping-list/mapping'):
            if mapping.get('tmdbseason') is None or mapping.get('anidbseason') != '1':
                continue
            if (mapping.text or '').strip() or not mapping.get('start') or not mapping.get('end'):
                entry['unsupportedReason'] = 'This Anime-Lists entry uses individual episode mappings that are not supported yet.'
                continue
            entry['ranges'].append({
                'start': integer(mapping.get('start'), minimum=1),
                'end': integer(mapping.get('end'), minimum=1),
                'season': integer(mapping.get('tmdbseason'), minimum=0),
                'offset': integer(mapping.get('offset') or '0'),
            })
        if any(r['end'] < r['start'] for r in entry['ranges']):
            raise ValueError('Reversed anime episode range')
        entries.append(entry)
    if not entries:
        raise ValueError('No anime TV mappings')
    return {'schemaVersion': 1, 'entries': entries}


def refresh_snapshot(master: bytes, crosswalk: bytes, db, *, dry_run: bool = True) -> dict:
    """Validate both downloads before a single-row atomic publication. No partial refresh."""
    import hashlib

    snapshot = build_snapshot(master, crosswalk)
    snapshot['sources'] = {
        'animeLists': hashlib.sha256(master).hexdigest(),
        'fribb': hashlib.sha256(crosswalk).hexdigest(),
    }
    payload = json.dumps(snapshot, separators=(',', ':'), sort_keys=True)
    previous = db.select("SELECT payload FROM anime_mapping_snapshot WHERE id = ?", ('current',))
    if previous:
        old = json.loads(previous[0]['payload'])
        if len(snapshot['entries']) < len(old['entries']) * 0.9:
            raise ValueError('Anime mapping snapshot shrank by more than 10%; keeping previous snapshot')
        for source in ('myanimelist', 'anilist', 'kitsu'):
            count = sum(len(e['ids'][source]) for e in snapshot['entries'])
            old_count = sum(len(e.get('ids', {}).get(source, [])) for e in old['entries'])
            if count < old_count * 0.9:
                raise ValueError(f'Anime {source} crosswalk shrank by more than 10%; keeping previous snapshot')
    version = hashlib.sha256(payload.encode()).hexdigest()
    if not dry_run:
        db.run(
            "INSERT INTO anime_mapping_snapshot (id, payload, version, refreshed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT (id) DO UPDATE SET payload = excluded.payload, version = excluded.version, refreshed_at = excluded.refreshed_at",
            ('current', payload, version),
        )
        db.run('REFRESH TABLE anime_mapping_snapshot')
    return {'dry_run': dry_run, 'entries': len(snapshot['entries']), 'bytes': len(payload.encode()), 'version': version,
            'unsupported': sum('unsupportedReason' in e for e in snapshot['entries'])}


MASTER_URL = 'https://raw.githubusercontent.com/Anime-Lists/anime-lists/master/anime-list-master.xml'
CROSSWALK_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json'
MAX_DOWNLOAD_BYTES = 32 * 1024 * 1024


def download(url: str) -> bytes:
    import urllib.request

    request = urllib.request.Request(url, headers={'User-Agent': 'GoodWatchBot/1.0 (+https://goodwatch.app)'})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read(MAX_DOWNLOAD_BYTES + 1)
    if len(data) > MAX_DOWNLOAD_BYTES:
        raise ValueError('Anime source exceeds the download size limit')
    return data


def main(dry_run: bool = True):
    # The schedule explicitly passes false after an operator reviews the first dry run.
    master, crosswalk = download(MASTER_URL), download(CROSSWALK_URL)
    from f.db.cratedb import CrateConnector

    db = CrateConnector()
    try:
        return refresh_snapshot(master, crosswalk, db, dry_run=dry_run is not False)
    finally:
        db.disconnect()
