# extra_requirements:
# requests
# pymongo
# mongoengine
# wmill

"""Optional Wikidata URL hints; never changes verified/crawled Letterboxd data.

Primary property definitions:
https://www.wikidata.org/wiki/Property:P6127 (Letterboxd slug and formatter)
https://www.wikidata.org/wiki/Property:P4947 (TMDB movie ID)
https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual#Query_limits

One read-only WDQS export can save an IMDb redirect for each mapped movie.
These are candidate URLs, not proof of identity: the crawler must still verify
the page's external IDs. Numeric `film:` values are omitted because their
redirect behavior has not been verified. Existing crawled URLs always win.
"""
import csv
import io
import re
from collections import defaultdict
from datetime import datetime

import requests
from pymongo import UpdateOne

from f.external_ids.imdb_ids import effective_imdb_id

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "GoodWatchBot/0.1 (+https://goodwatch.app; hello@goodwatch.app) letterboxd-id-mapping"
QUERY = """SELECT ?item ?tmdb ?imdb ?letterboxd WHERE {
  hint:Query hint:optimizer "None" .
  ?item wdt:P4947 ?tmdb .
  ?item wdt:P6127 ?letterboxd .
  OPTIONAL { ?item wdt:P345 ?imdb }
}"""
COLUMNS = ["item", "tmdb", "imdb", "letterboxd"]
ENTITY = re.compile(r"https?://www\.wikidata\.org/entity/Q[1-9][0-9]*")
SLUG = re.compile(r"[a-z0-9]+(?:[-_][a-z0-9]+)*")
COLLECTION = "letterboxd_movie_rating"


class ExportError(RuntimeError):
    pass


def parse(text):
    """Reject malformed/truncated CSV before any candidate data reaches Mongo."""
    if not text.endswith(("\n", "\r")):
        raise ExportError("Wikidata CSV lacks its final line terminator")
    reader = csv.reader(io.StringIO(text), strict=True)
    try:
        if next(reader, None) != COLUMNS:
            raise ExportError("Unexpected Wikidata CSV columns")
        rows = []
        for number, values in enumerate(reader, 2):
            if not values:
                continue
            if len(values) != len(COLUMNS) or not ENTITY.fullmatch(values[0]):
                raise ExportError(f"Malformed or truncated Wikidata CSV at line {number}")
            rows.append(dict(zip(COLUMNS, values)))
        return rows
    except csv.Error as error:
        raise ExportError("Malformed or truncated Wikidata CSV") from error


def fetch_rows(http=requests, min_rows=1000):
    """One export, no retries. A 429 includes Retry-After and ends the job."""
    response = http.post(ENDPOINT, data={"query": QUERY},
                         headers={"User-Agent": USER_AGENT, "Accept": "text/csv"}, timeout=90)
    if response.status_code == 429:
        raise ExportError("Wikidata HTTP 429; stopping without retry; Retry-After: "
                          + str(response.headers.get("Retry-After")))
    if response.status_code != 200:
        raise ExportError(f"Wikidata export HTTP {response.status_code}; stopping without retry")
    rows = parse(response.text)
    if len(rows) < min_rows:
        raise ExportError(f"Wikidata export has only {len(rows)} rows; expected at least {min_rows}")
    return rows


def collect(rows):
    """One URL/IMDb per TMDB movie, with globally shared URLs rejected."""
    grouped = defaultdict(lambda: {"urls": set(), "imdb": set(), "items": set()})
    owners = defaultdict(set)
    invalid_ids = set()
    stats = {"rows": len(rows), "invalid": 0, "ambiguous": 0, "shared_url": 0}
    for row in rows:
        tmdb, slug, imdb = (row[key].strip() for key in ("tmdb", "letterboxd", "imdb"))
        if not re.fullmatch(r"[1-9][0-9]*", tmdb):
            stats["invalid"] += 1
            continue
        tmdb_id = int(tmdb)
        url = f"https://letterboxd.com/film/{slug}/"
        if SLUG.fullmatch(slug):
            owners[url].add(tmdb_id)
        if not SLUG.fullmatch(slug) or (imdb and not re.fullmatch(r"tt[0-9]+", imdb)):
            stats["invalid"] += 1
            invalid_ids.add(tmdb_id)
            continue
        grouped[tmdb_id]["urls"].add(url)
        grouped[tmdb_id]["items"].add(row["item"].rsplit("/", 1)[-1])
        if imdb:
            grouped[tmdb_id]["imdb"].add(imdb)
    accepted = {}
    for tmdb_id, group in grouped.items():
        if tmdb_id in invalid_ids or len(group["urls"]) != 1 or len(group["imdb"]) > 1:
            stats["ambiguous"] += 1
            continue
        url = next(iter(group["urls"]))
        if len(owners[url]) != 1:
            stats["shared_url"] += 1
            continue
        accepted[tmdb_id] = {"url": url, "imdb_id": next(iter(group["imdb"]), None),
                             "items": sorted(group["items"])}
    stats["unambiguous"] = len(accepted)
    return accepted, stats


def plan(db, candidates, now=None):
    """Read only: attach hints to existing uncrawled queue entries after corroboration."""
    now = now or datetime.utcnow()
    changes = []
    stats = {"not_queued": 0, "already_crawled": 0, "missing_movie": 0,
             "imdb_mismatch": 0, "existing_hint_conflict": 0, "unchanged": 0, "planned": 0}
    ids = sorted(candidates)
    for offset in range(0, len(ids), 1000):
        batch = ids[offset:offset + 1000]
        queued = {row["tmdb_id"]: row for row in db[COLLECTION].find({"tmdb_id": {"$in": batch}},
                  {"tmdb_id": 1, "imdb_id": 1, "letterboxd_url": 1, "wikidata_url": 1, "tmdb_deleted": 1})}
        # Cached/crawled entries need no repeat reads of the much larger TMDB documents.
        needing = [tmdb_id for tmdb_id, row in queued.items()
                   if not row.get("letterboxd_url") and not row.get("wikidata_url") and not row.get("tmdb_deleted")]
        details = {row["tmdb_id"]: row for row in db.tmdb_movie_details.find({"tmdb_id": {"$in": needing}},
                   {"tmdb_id": 1, "imdb_id": 1, "imdb_id_override": 1, "tmdb_deleted": 1})} if needing else {}
        for tmdb_id in batch:
            queued_row, movie = queued.get(tmdb_id), details.get(tmdb_id)
            candidate = candidates[tmdb_id]
            if queued_row is None:
                stats["not_queued"] += 1
                continue
            if queued_row.get("letterboxd_url"):
                stats["already_crawled"] += 1
                continue
            old = queued_row.get("wikidata_url")
            if old == candidate["url"]:
                stats["unchanged"] += 1
                continue
            if old:
                stats["existing_hint_conflict"] += 1
                continue
            if not movie or movie.get("tmdb_deleted") or queued_row.get("tmdb_deleted"):
                stats["missing_movie"] += 1
                continue
            imdb_id, _ = effective_imdb_id(movie, True)
            if not imdb_id or (candidate["imdb_id"] and candidate["imdb_id"] != imdb_id):
                stats["imdb_mismatch"] += 1
                continue
            changes.append({"filter": {"_id": queued_row["_id"], "imdb_id": queued_row.get("imdb_id"),
                                        "letterboxd_url": {"$in": [None, ""]},
                                        "wikidata_url": {"$in": [None, ""]}},
                            "set": {"wikidata_url": candidate["url"], "wikidata_imdb_id": candidate["imdb_id"],
                                    "wikidata_items": candidate["items"], "wikidata_url_at": now}})
        if (offset + len(batch)) % 10000 == 0:
            print(f"Letterboxd mappings: checked {offset + len(batch)}, planned {len(changes)}", flush=True)
    stats["planned"] = len(changes)
    return changes, stats


def apply(db, changes):
    """Apply a previously reviewed plan in batches, without source-record upserts."""
    matched = modified = 0
    for offset in range(0, len(changes), 1000):
        batch = changes[offset:offset + 1000]
        operations = [UpdateOne(change["filter"], {"$set": change["set"]}) for change in batch]
        result = db[COLLECTION].bulk_write(operations, ordered=False)
        matched += result.matched_count
        modified += result.modified_count
    return {"matched": matched, "modified": modified}


def main(dry_run: bool = True):
    from mongoengine import get_db
    from f.db.mongodb import init_mongodb, close_mongodb
    rows = fetch_rows()
    candidates, stats = collect(rows)
    init_mongodb()
    try:
        db = get_db()
        changes, planning = plan(db, candidates)
        result = {"dry_run": dry_run, **stats, **planning}
        if not dry_run:
            result.update(apply(db, changes))
        return result
    finally:
        close_mongodb()
