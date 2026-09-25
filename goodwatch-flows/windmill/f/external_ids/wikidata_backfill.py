"""Weekly backfill of missing IMDb, Rotten Tomatoes and Metacritic ids from Wikidata (#150).

Where each id goes, and who wins:

- IMDb. TMDB's id (`tmdb_movie_details.imdb_id`, `tmdb_tv_details.external_ids.imdb_id`)
  always wins and is never written here. When TMDB has none, Wikidata's id goes into
  `imdb_id_override` (with `imdb_id_override_source` and `imdb_id_override_at`) on the
  details document. The effective id (TMDB, else the override) is mirrored into
  `imdb_*_rating.imdb_id` with `imdb_id_source`, which is where the IMDb dataset ingest
  (#149) maps tconsts to TMDB ids, and into the Crate `show`/`movie` `imdb_id` and
  `imdb_url` columns.
- Rotten Tomatoes and Metacritic. `rotten_tomatoes_url` / `metacritic_url` on the
  rating documents. A URL the crawler found (`url_source` "crawl", or no `url_source`
  on older documents) is never replaced. An empty URL is filled from Wikidata with
  `url_source: "wikidata"` and `url_verified_at` (when Wikidata confirmed it). A URL
  this job filled follows Wikidata when Wikidata changes it. Wikidata's current value
  is always kept in `wikidata_url`, so a crawler can fall back to it.

An id is skipped, and counted in the report, when Wikidata gives a title more than one,
when the title is deleted on TMDB, or when another title already holds the same IMDb id
or URL. Disagreements with TMDB ids and crawled URLs are counted and sampled, never acted
on. Nothing is removed when Wikidata drops a value.

Every changed document's previous values go to `_backup_<YYYYMMDD>_wikidata_ids` first.
"""
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, Optional

from pymongo import InsertOne, UpdateOne

from f.external_ids.imdb_ids import imdb_url, tmdb_imdb_id, valid_imdb_id
from f.external_ids.wikidata import WikidataIds, collect_ids, fetch_exports

KINDS = {
    "tv": {"details": "tmdb_tv_details", "imdb_rating": "imdb_tv_rating", "table": "show",
           "tmdb_imdb_field": "external_ids.imdb_id", "is_movie": False},
    "movie": {"details": "tmdb_movie_details", "imdb_rating": "imdb_movie_rating", "table": "movie",
              "tmdb_imdb_field": "imdb_id", "is_movie": True},
}
SITES = {
    "rotten_tomatoes": {"collection": "rotten_tomatoes_{kind}_rating", "url_field": "rotten_tomatoes_url"},
    "metacritic": {"collection": "metacritic_{kind}_rating", "url_field": "metacritic_url"},
}
OVERRIDE_FIELDS = ("imdb_id_override", "imdb_id_override_source", "imdb_id_override_at")
URL_FIELDS = ("url_source", "url_verified_at", "wikidata_url")
SOURCE = "wikidata"
READ_BATCH = 10_000
WRITE_BATCH = 1_000
CRATE_BATCH = 5_000
SAMPLE_LIMIT = 20


@dataclass
class Change:
    collection: str
    doc_id: object
    tmdb_id: int
    set_fields: dict
    previous: dict
    # Fields for a document that does not exist yet (upsert by tmdb_id).
    insert: Optional[dict] = None


def backup_collection_name(now: datetime) -> str:
    return f"_backup_{now:%Y%m%d}_wikidata_ids"


def count(stats: dict, key: str, amount: int = 1):
    stats[key] = stats.get(key, 0) + amount


def sample(stats: dict, key: str, value: dict):
    samples = stats.setdefault("samples", {}).setdefault(key, [])
    if len(samples) < SAMPLE_LIMIT:
        samples.append(value)


def normalize_url(url: str) -> str:
    return url.strip().lower().replace("http://", "https://").rstrip("/")


def url_owners(docs: Iterable[dict], url_field: str) -> dict[str, set]:
    owners: dict[str, set] = {}
    for doc in docs:
        url = doc.get(url_field)
        if isinstance(url, str) and url.strip():
            owners.setdefault(normalize_url(url), set()).add(doc["tmdb_id"])
    return owners


# ===== Planning (pure) =====


def plan_imdb(kind: str, wikidata: dict[int, WikidataIds], details: dict[int, dict],
              tmdb_owners: dict[str, set], stats: dict, now: datetime) -> list[Change]:
    """Overrides for titles TMDB has no IMDb id for. `stats["overrides"]` receives
    every title whose effective id comes from Wikidata after this run."""
    is_movie = KINDS[kind]["is_movie"]
    candidates = {}
    for tmdb_id, ids in wikidata.items():
        if not ids.imdb:
            continue
        doc = details.get(tmdb_id)
        if doc is None:
            count(stats, "not_in_catalog")
            continue
        if doc.get("tmdb_deleted"):
            count(stats, "tmdb_deleted")
            continue
        if len(ids.imdb) > 1:
            count(stats, "ambiguous")
            sample(stats, "ambiguous", {"tmdb_id": tmdb_id, "wikidata": sorted(ids.imdb), "items": sorted(ids.items)})
            continue
        (value,) = ids.imdb
        tmdb_value = tmdb_imdb_id(doc, is_movie)
        if tmdb_value == value:
            count(stats, "agree_with_tmdb")
        elif tmdb_value:
            count(stats, "disagree_with_tmdb")
            sample(stats, "disagree_with_tmdb",
                   {"tmdb_id": tmdb_id, "tmdb": tmdb_value, "wikidata": value, "items": sorted(ids.items)})
        else:
            candidates[tmdb_id] = value

    proposed = Counter(candidates.values())
    changes, overrides = [], {}
    for tmdb_id, value in candidates.items():
        other_owners = tmdb_owners.get(value, set()) - {tmdb_id}
        if other_owners or proposed[value] > 1:
            count(stats, "claimed_by_other_title")
            sample(stats, "claimed_by_other_title",
                   {"tmdb_id": tmdb_id, "wikidata": value, "tmdb_owners": sorted(other_owners)})
            continue
        doc = details[tmdb_id]
        overrides[tmdb_id] = value
        current = valid_imdb_id(doc.get("imdb_id_override"))
        if current == value:
            count(stats, "unchanged")
            continue
        count(stats, "changed" if current else "filled")
        set_fields = {"imdb_id_override": value, "imdb_id_override_source": SOURCE, "imdb_id_override_at": now}
        changes.append(Change(KINDS[kind]["details"], doc["_id"], tmdb_id, set_fields,
                              {field: doc.get(field) for field in OVERRIDE_FIELDS}))
    stats["overrides"] = overrides
    return changes


def plan_imdb_ratings(kind: str, overrides: dict[int, str], rating_docs: dict[int, dict],
                      details: dict[int, dict], stats: dict, now: datetime) -> list[Change]:
    """Mirror the overrides into `imdb_*_rating.imdb_id`, creating missing documents."""
    collection = KINDS[kind]["imdb_rating"]
    changes = []
    for tmdb_id, value in overrides.items():
        set_fields = {"imdb_id": value, "imdb_id_source": SOURCE}
        doc = rating_docs.get(tmdb_id)
        if doc is None:
            count(stats, "inserted")
            title = details.get(tmdb_id, {})
            insert = {"tmdb_id": tmdb_id, "original_title": title.get("original_title"),
                      "popularity": title.get("popularity"), "created_at": now}
            changes.append(Change(collection, None, tmdb_id, set_fields, {}, insert=insert))
        elif doc.get("imdb_id") == value and doc.get("imdb_id_source") == SOURCE:
            count(stats, "unchanged")
        else:
            count(stats, "updated")
            changes.append(Change(collection, doc["_id"], tmdb_id, set_fields,
                                  {field: doc.get(field) for field in set_fields}))
    return changes


def plan_urls(site: str, kind: str, wikidata: dict[int, WikidataIds], docs: dict[int, dict],
              owners: dict[str, set], stats: dict, now: datetime) -> list[Change]:
    url_field = SITES[site]["url_field"]
    collection = SITES[site]["collection"].format(kind=kind)
    candidates = {}
    for tmdb_id, ids in wikidata.items():
        values = getattr(ids, site)
        if not values:
            continue
        if len(values) > 1:
            count(stats, "ambiguous")
            sample(stats, "ambiguous", {"tmdb_id": tmdb_id, "wikidata": sorted(values), "items": sorted(ids.items)})
            continue
        doc = docs.get(tmdb_id)
        if doc is None:
            count(stats, "no_rating_document")
            continue
        if doc.get("tmdb_deleted"):
            count(stats, "tmdb_deleted")
            continue
        candidates[tmdb_id] = next(iter(values))

    proposed = Counter(normalize_url(value) for value in candidates.values())
    changes = []
    for tmdb_id, value in candidates.items():
        doc = docs[tmdb_id]
        key = normalize_url(value)
        stored = doc.get(url_field) if isinstance(doc.get(url_field), str) and doc.get(url_field).strip() else None
        set_fields = {}
        if stored and doc.get("url_source") != SOURCE:
            # Found by the crawler: never replaced, only compared.
            if normalize_url(stored) == key:
                count(stats, "agree_with_stored")
            else:
                count(stats, "disagree_with_stored")
                sample(stats, "disagree_with_stored", {"tmdb_id": tmdb_id, "stored": stored, "wikidata": value})
        else:
            other_owners = owners.get(key, set()) - {tmdb_id}
            if other_owners or proposed[key] > 1:
                count(stats, "claimed_by_other_title")
                sample(stats, "claimed_by_other_title",
                       {"tmdb_id": tmdb_id, "wikidata": value, "owners": sorted(other_owners)})
                continue
            if stored and normalize_url(stored) == key:
                count(stats, "unchanged")
            else:
                count(stats, "changed" if stored else "filled")
                set_fields.update({url_field: value, "url_source": SOURCE, "url_verified_at": now})
        if doc.get("wikidata_url") != value:
            set_fields["wikidata_url"] = value
        if set_fields:
            changes.append(Change(collection, doc["_id"], tmdb_id, set_fields,
                                  {field: doc.get(field) for field in set_fields}))
    return changes


# ===== Reading and writing =====


def find_by_tmdb_ids(collection, tmdb_ids: Iterable[int], projection: dict) -> dict[int, dict]:
    tmdb_ids = sorted(set(tmdb_ids))
    found = {}
    for start in range(0, len(tmdb_ids), READ_BATCH):
        for doc in collection.find({"tmdb_id": {"$in": tmdb_ids[start:start + READ_BATCH]}}, projection):
            found.setdefault(doc["tmdb_id"], doc)
    return found


def find_tmdb_owners(collection, field: str, imdb_values: Iterable[str]) -> dict[str, set]:
    """Titles whose TMDB IMDb id is one of `imdb_values`."""
    values = sorted(set(imdb_values))
    owners: dict[str, set] = {}
    for start in range(0, len(values), READ_BATCH):
        query = {field: {"$in": values[start:start + READ_BATCH]}, "tmdb_deleted": {"$ne": True}}
        for doc in collection.find(query, {"tmdb_id": 1, field: 1}):
            value = doc
            for part in field.split("."):
                value = (value or {}).get(part)
            value = valid_imdb_id(value)
            if value:
                owners.setdefault(value, set()).add(doc["tmdb_id"])
    return owners


def apply_changes(db, changes: list[Change], now: datetime) -> int:
    backup = db[backup_collection_name(now)]
    by_collection: dict[str, list[Change]] = {}
    for change in changes:
        by_collection.setdefault(change.collection, []).append(change)
    written = 0
    for collection, group in by_collection.items():
        for start in range(0, len(group), WRITE_BATCH):
            batch = group[start:start + WRITE_BATCH]
            backup.bulk_write([InsertOne({
                "collection": collection, "doc_id": change.doc_id, "tmdb_id": change.tmdb_id,
                "previous": change.previous, "set": change.set_fields,
                "inserted": change.insert is not None, "run_at": now,
            }) for change in batch], ordered=False)
            operations = []
            for change in batch:
                if change.insert is not None:
                    operations.append(UpdateOne({"tmdb_id": change.tmdb_id},
                                                {"$set": change.set_fields, "$setOnInsert": change.insert},
                                                upsert=True))
                else:
                    operations.append(UpdateOne({"_id": change.doc_id}, {"$set": change.set_fields}))
            db[collection].bulk_write(operations, ordered=False)
            written += len(operations)
    return written


def publish_overrides(connector, table: str, overrides: dict[int, str]) -> int:
    """Write the Wikidata-sourced IMDb ids to Crate. Rows missing in Crate are skipped;
    the details copy publishes the same values when it next copies the title."""
    sql = f"UPDATE {table} SET imdb_id = ?, imdb_url = ? WHERE tmdb_id = ?"
    rows = [[value, imdb_url(value), tmdb_id] for tmdb_id, value in sorted(overrides.items())]
    updated = 0
    for start in range(0, len(rows), CRATE_BATCH):
        results = connector.cur.executemany(sql, rows[start:start + CRATE_BATCH])
        updated += sum(max(result.get("rowcount", 0), 0) for result in results)
    return updated


def backfill(db, connector, exports: dict[str, list[dict]], now: datetime, dry_run: bool = False) -> dict:
    report = {"dry_run": dry_run, "planned_writes": 0, "writes": 0}
    for kind, conf in KINDS.items():
        kind_report = report[kind] = {"export": {"rows": len(exports[kind])}}
        wikidata = collect_ids(exports[kind], kind, kind_report["export"])
        kind_report["export"]["tmdb_ids"] = len(wikidata)
        changes: list[Change] = []

        imdb_tmdb_ids = [tmdb_id for tmdb_id, ids in wikidata.items() if ids.imdb]
        projection = {"_id": 1, "tmdb_id": 1, conf["tmdb_imdb_field"]: 1, "tmdb_deleted": 1,
                      "original_title": 1, "popularity": 1, **{field: 1 for field in OVERRIDE_FIELDS}}
        details = find_by_tmdb_ids(db[conf["details"]], imdb_tmdb_ids, projection)
        imdb_values = {value for tmdb_id in imdb_tmdb_ids for value in wikidata[tmdb_id].imdb}
        owners = find_tmdb_owners(db[conf["details"]], conf["tmdb_imdb_field"], imdb_values)
        imdb_stats = kind_report["imdb"] = {}
        changes += plan_imdb(kind, wikidata, details, owners, imdb_stats, now)
        overrides = imdb_stats.pop("overrides")
        imdb_stats["overrides"] = len(overrides)

        rating_docs = find_by_tmdb_ids(db[conf["imdb_rating"]], overrides,
                                       {"_id": 1, "tmdb_id": 1, "imdb_id": 1, "imdb_id_source": 1})
        changes += plan_imdb_ratings(kind, overrides, rating_docs, details, kind_report.setdefault("imdb_rating", {}), now)

        for site, site_conf in SITES.items():
            collection = db[site_conf["collection"].format(kind=kind)]
            url_field = site_conf["url_field"]
            site_tmdb_ids = [tmdb_id for tmdb_id, ids in wikidata.items() if getattr(ids, site)]
            docs = find_by_tmdb_ids(collection, site_tmdb_ids,
                                    {"_id": 1, "tmdb_id": 1, "tmdb_deleted": 1, url_field: 1,
                                     **{field: 1 for field in URL_FIELDS}})
            site_owners = url_owners(collection.find({url_field: {"$type": "string"}}, {"tmdb_id": 1, url_field: 1}),
                                     url_field)
            changes += plan_urls(site, kind, wikidata, docs, site_owners, kind_report.setdefault(site, {}), now)

        report["planned_writes"] += len(changes)
        if not dry_run:
            report["writes"] += apply_changes(db, changes, now)
            kind_report["crate_rows_updated"] = publish_overrides(connector, conf["table"], overrides)
    return report


def print_report(report: dict):
    for kind in KINDS:
        for section, stats in report[kind].items():
            if not isinstance(stats, dict):
                print(f"{kind} {section}: {stats}")
                continue
            counts = {key: value for key, value in stats.items() if key != "samples"}
            print(f"{kind} {section}: {counts}")
            for key, samples in stats.get("samples", {}).items():
                for entry in samples:
                    print(f"  {kind} {section} {key}: {entry}")
    print(f"planned writes: {report['planned_writes']}, writes: {report['writes']}, dry run: {report['dry_run']}")


def main(dry_run: bool = False):
    from mongoengine import get_db
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb, init_mongodb

    # Fetch first: a 429 or a partial export stops the run before anything is read or written.
    exports = fetch_exports()
    init_mongodb()
    connector = None if dry_run else CrateConnector()
    try:
        report = backfill(get_db(), connector, exports, datetime.utcnow(), dry_run=dry_run)
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()
    print_report(report)
    return report


if __name__ == "__main__":
    main()
