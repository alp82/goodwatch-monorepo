# extra_requirements:
# requests
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Bounded TVDB title and external-identity workers; successful snapshots survive failures."""

from datetime import timedelta
from time import monotonic
from urllib.parse import quote

from f.sync.copy.sync_state import utc_now
from f.tvdb.api import ApiError, Deferred
from f.tvdb.ids import checked_id, tmdb_id
from f.tvdb.store import (
    claim,
    enqueue,
    enqueue_many,
    exclusive,
    finish,
    record_run,
    runtime,
    safe_publish,
)


class IdentityError(ValueError):
    pass


def remote_id(data, source_type):
    ids = {
        str(r["id"])
        for r in data.get("remoteIds") or []
        if r.get("type") == source_type and r.get("id")
    }
    if len(ids) > 1:
        raise IdentityError("Conflicting external IDs")
    return next(iter(ids), None)


def title_data(db, api, doc):
    kind = doc["media_type"]
    if tmdb_id(doc.get("tmdb_id")) is None:
        raise IdentityError("Invalid local TMDB title ID")
    tvdb = checked_id(doc.get("source_tvdb_id")) or checked_id(doc.get("tvdb_id"))
    if not tvdb:
        imdb = doc.get("imdb_id")
        if not imdb or not imdb.startswith("tt") or not imdb[2:].isdigit():
            raise IdentityError("No usable title identity")
        hits = api.get("/search/remoteid/" + quote(imdb, safe=""))["data"]
        if not isinstance(hits, list):
            raise ValueError("Malformed TVDB search")
        candidates = {
            h[kind]["id"]
            for h in hits
            if isinstance(h.get(kind), dict) and checked_id(h[kind].get("id"))
        }
        if not candidates:
            raise ApiError(404)
        if len(candidates) != 1:
            raise IdentityError("Ambiguous TVDB title identity")
        tvdb = candidates.pop()
    path = "/movies/" if kind == "movie" else "/series/"
    data = api.get(path + str(tvdb) + "/extended")["data"]
    if (
        not isinstance(data, dict)
        or data.get("id") != tvdb
        or not isinstance(data.get("characters"), list)
    ):
        raise ValueError("Incomplete TVDB title snapshot")
    tmdb = remote_id(data, 10 if kind == "movie" else 12)
    imdb = remote_id(data, 2)
    if tmdb and tmdb != str(doc["tmdb_id"]):
        raise IdentityError("TVDB title TMDB identity mismatch")
    if imdb and doc.get("imdb_id") and imdb != doc["imdb_id"]:
        raise IdentityError("TVDB title IMDb identity mismatch")
    if not tmdb and not (imdb and imdb == doc.get("imdb_id")):
        raise IdentityError("TVDB title identity unverified")
    actors = []
    for c in data["characters"]:
        if c.get("peopleType") != "Actor":
            continue
        if not checked_id(c.get("id")) or not checked_id(c.get("peopleId")):
            raise ValueError("Malformed TVDB actor credit")
        if c.get("movieId") not in (None, tvdb if kind == "movie" else None) or c.get(
            "seriesId"
        ) not in (None, tvdb if kind == "show" else None):
            raise IdentityError("Character belongs to another title")
        actors.append(c)
    # Map only roles with portraits, and deduplicate actors across this title.
    enqueue_many(
        db.tvdb_entities,
        [
            (
                f"person:{c['peopleId']}",
                {"kind": "person", "tvdb_id": c["peopleId"]},
                doc.get("priority", 0),
            )
            for c in actors
            if c.get("image")
        ],
    )
    return {
        "tvdb_id": tvdb,
        "name": data.get("name"),
        "characters": actors,
        "remote_ids": data.get("remoteIds") or [],
        "status": "ok",
    }


def entity_data(db, api, doc):
    kind, tvdb = doc["kind"], doc["tvdb_id"]
    path = {"person": "/people/", "movie": "/movies/", "show": "/series/"}[kind]
    data = api.get(
        path + str(tvdb) + "/extended" + ("" if kind == "person" else "?short=true")
    )["data"]
    if not isinstance(data, dict) or data.get("id") != tvdb:
        raise IdentityError("TVDB entity identity mismatch")
    raw_tmdb = remote_id(data, {"person": 15, "movie": 10, "show": 12}[kind])
    tmdb = tmdb_id(raw_tmdb)
    fields = {
        "tmdb_id": tmdb,
        "mapping_error": "invalid_tmdb_id"
        if raw_tmdb is not None and tmdb is None
        else None,
        "rejected_tmdb_id": raw_tmdb if raw_tmdb is not None and tmdb is None else None,
        "remote_ids": data.get("remoteIds") or [],
        "name": data.get("name"),
        "status": "ok",
    }
    if kind != "person" and tmdb:
        source = "tmdb_movie_details" if kind == "movie" else "tmdb_tv_details"
        local = db[source].find_one({"tmdb_id": tmdb, "tmdb_deleted": {"$ne": True}})
        if local:
            enqueue(
                db.tvdb_titles,
                f"{kind}:{tmdb}",
                {
                    "media_type": kind,
                    "tmdb_id": tmdb,
                    "tvdb_id": tvdb,
                    "imdb_id": remote_id(data, 2),
                    "tmdb_deleted": False,
                },
                1000000,
            )
    return fields


def run(
    db,
    api,
    mode="titles",
    max_seconds=240,
    max_items=1000,
    publish=None,
    timer=monotonic,
):
    if (
        mode not in ("titles", "mappings")
        or not 1 <= max_seconds <= 1500
        or not 1 <= max_items <= 5000
    ):
        raise ValueError("Invalid TVDB worker bounds")
    col = db.tvdb_titles if mode == "titles" else db.tvdb_entities
    report = {
        "mode": mode,
        "processed": 0,
        "ok": 0,
        "not_found": 0,
        "errors": 0,
        "requests": 0,
        "invalid_mappings": 0,
        "publication_errors": 0,
    }
    start, initial = timer(), api.requests
    while timer() - start < max_seconds and report["processed"] < max_items:
        now = utc_now()
        doc = claim(col, now)
        if not doc:
            break
        try:
            if doc.get("tmdb_deleted"):
                fields = {"status": "removed", "characters": []}
            else:
                fields = (
                    title_data(db, api, doc)
                    if mode == "titles"
                    else entity_data(db, api, doc)
                )
            # Identity mapping changes are also revisioned; publishers can replay after a failure.
            finish(
                col,
                doc,
                fields
                | {
                    "updated_at": utc_now(),
                    "fetched_at": now,
                    "error": None,
                    "due_at": now + timedelta(days=30 if mode == "titles" else 180),
                },
            )
            if mode == "mappings" and doc["kind"] == "person":
                db.tvdb_titles.update_many(
                    {"characters.peopleId": doc["tvdb_id"]},
                    {"$set": {"updated_at": utc_now(), "publish_pending": True}},
                )
            if mode == "mappings" and fields.get("tmdb_id") and doc["kind"] != "person":
                db.tvdb_categories.update_many(
                    {
                        "nominees."
                        + ("movie" if doc["kind"] == "movie" else "series")
                        + ".id": doc["tvdb_id"]
                    },
                    {"$set": {"updated_at": utc_now(), "publish_pending": True}},
                )
            report["ok"] += 1
            report["invalid_mappings"] += bool(fields.get("mapping_error"))
        except Deferred:
            finish(col, doc, {"due_at": now + timedelta(minutes=5)})
            report["deferred"] = True
            break
        except (ApiError, ValueError) as error:
            if isinstance(error, ApiError) and error.status in (401, 403):
                finish(
                    col,
                    doc,
                    {"due_at": now + timedelta(hours=1), "error": "authentication"},
                )
                raise
            missing = isinstance(error, ApiError) and error.status == 404
            # A 404/error never erases a previous successful snapshot. Confirm removals through reconciliation.
            finish(
                col,
                doc,
                {
                    "due_at": now + timedelta(days=30 if missing else 1),
                    "error": type(error).__name__,
                    "attempted_at": now,
                },
            )
            report["not_found" if missing else "errors"] += 1
        report["processed"] += 1
        if publish and report["processed"] % 25 == 0:
            safe_publish(publish, report)
    if publish:
        safe_publish(publish, report)
    report["requests"] = api.requests - initial
    report["elapsed_seconds"] = round(timer() - start, 2)
    return report


def main(mode: str = "titles", max_minutes: float = 4, max_items: int = 1000):
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb
    from f.tvdb.publish import publish

    db, api = runtime()
    connector = None
    try:
        with exclusive(db, mode, 30):
            connector = CrateConnector()
            report = run(
                db,
                api,
                mode,
                int(max_minutes * 60),
                max_items,
                publish=lambda: publish(db, connector, limit=100),
            )
            return record_run(db, mode, report)
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()
