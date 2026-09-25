"""Repair Rotten Tomatoes and Metacritic URLs that several titles share (#152).

The old crawlers stored guessed URLs, and a guess such as `m/good_night` landed on
every same-named title: on 2026-09-25, 146,855 RT movie documents shared 34,262 URLs.
At most one title in such a group is right, and the others block the Wikidata
backfill from filling their real URL.

Without fetching anything, a group keeps its URL on:
- the one holder whose Wikidata URL is the same, or else
- the one holder whose release year is the year in the slug (`dune_2021`).
The other holders lose the URL and its scores (reason `duplicate`, skipped for 90
days, previous values backed up to `_backup_<YYYYMMDD>_critic_urls`). A group without
such evidence is left for the crawl, which fetches the page once and keeps the URL on
the matching title (`crawl.decide`).
"""
import re
from datetime import datetime

from f.critic_sites import crawl
from f.critic_sites.matching import url_key

SLUG_YEAR = re.compile(r"[_-]((?:18|19|20)\d{2})$")
PROJECTION = {"tmdb_id": 1, "wikidata_url": 1, "release_year": 1, "popularity": 1, "tmdb_deleted": 1}


def keeper(key: str, holders: list[dict]):
    """The holder that keeps the URL, or None when nothing tells them apart."""
    wikidata = [doc for doc in holders if doc.get("wikidata_url") and url_key(doc["wikidata_url"]) == key]
    if len(wikidata) == 1:
        return wikidata[0]
    if wikidata:
        return None
    year = SLUG_YEAR.search(key)
    if year:
        dated = [doc for doc in holders if doc.get("release_year") == int(year.group(1))]
        if len(dated) == 1:
            return dated[0]
    return None


def clear(db, conf, kind: str, doc: dict, url: str, now: datetime) -> None:
    fields = [conf.url_field, "url_source", "url_verified_at", *conf.score_fields()]
    previous = {name: doc.get(name) for name in fields if doc.get(name) is not None}
    db[crawl.backup_collection_name(now)].insert_one({
        "collection": conf.collection(kind), "doc_id": doc["_id"], "tmdb_id": doc["tmdb_id"], "previous": previous,
        "reason": "duplicate (repair)", "run_at": now})
    db[conf.collection(kind)].update_one({"_id": doc["_id"]}, {
        "$set": {"rejected_url": url, "rejected_until": now + crawl.NEGATIVE_CACHE, "rejected_reason": "duplicate",
                 "crawl_status": "rejected", "updated_at": now, "next_crawl_at": now + crawl.NEGATIVE_CACHE},
        "$unset": {name: "" for name in fields}})
    if kind == "tv":
        db[conf.season_collection].delete_many({"tmdb_id": doc["tmdb_id"]})


def repair(db, site: str, now: datetime, dry_run: bool = True) -> dict:
    conf = crawl.SITES[site]
    report = {}
    for kind in crawl.DETAILS:
        collection = db[conf.collection(kind)]
        groups: dict[str, list] = {}
        for doc in collection.find({conf.url_field: {"$type": "string", "$gt": ""}, "tmdb_deleted": {"$ne": True}},
                                   {**PROJECTION, conf.url_field: 1}):
            groups.setdefault(url_key(doc[conf.url_field]), []).append(doc)
        stats = report[kind] = {"groups": 0, "holders": 0, "kept_by_wikidata_or_year": 0, "cleared": 0,
                                "left_for_crawl": 0}
        for key, holders in groups.items():
            if len(holders) < 2:
                continue
            stats["groups"] += 1
            stats["holders"] += len(holders)
            winner = keeper(key, holders)
            if winner is None:
                stats["left_for_crawl"] += len(holders)
                continue
            stats["kept_by_wikidata_or_year"] += 1
            for doc in holders:
                if doc is winner:
                    continue
                stats["cleared"] += 1
                if not dry_run:
                    full = collection.find_one({"_id": doc["_id"]})
                    clear(db, conf, kind, full, full[conf.url_field], now)
    return report


def main(site: str = "rotten_tomatoes", dry_run: bool = True):
    from mongoengine import get_db
    from f.db.mongodb import close_mongodb, init_mongodb

    init_mongodb()
    try:
        report = repair(get_db(), site, datetime.utcnow(), dry_run=dry_run)
        print(report, flush=True)
        return report
    finally:
        close_mongodb()
