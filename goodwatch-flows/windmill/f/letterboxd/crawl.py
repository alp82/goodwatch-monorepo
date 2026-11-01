# extra_requirements:
# requests
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Movie aggregate scores only. Leased queue, verified identities and shared backoff."""
from datetime import datetime, timedelta
from uuid import uuid4

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from f.critic_sites import polite_http
from f.external_ids.imdb_ids import effective_imdb_id
from f.letterboxd.http import Client, SITE
from f.letterboxd.pages import IdentityMismatch, movie_url, parse
from f.letterboxd.seed import COLLECTION, ensure_indexes, seed

SCORE_FIELDS = ("user_score_original", "user_score_normalized_percent", "user_score_vote_count")
NEGATIVE_CACHE = timedelta(days=90)
ERROR_RETRY = timedelta(days=1)


def interval(details, now):
    released = details.get("release_date")
    if isinstance(released, str):
        try:
            released = datetime.fromisoformat(released[:10])
        except ValueError:
            released = None
    return timedelta(days=14 if isinstance(released, datetime) and now - released < timedelta(days=180) else 90)


def save(db, doc, now, status, **fields):
    db[COLLECTION].update_one({"_id": doc["_id"]}, {"$set": {
        "crawl_status": status, "crawled_at": now, **fields}})


def clear(db, doc, now, status, reason):
    previous = {key: doc[key] for key in (*SCORE_FIELDS, "letterboxd_url", "letterboxd_id") if key in doc}
    if previous:
        db.letterboxd_rating_history.insert_one({"tmdb_id": doc["tmdb_id"], "at": now,
                                                  "reason": reason, "previous": previous})
    save(db, doc, now, status, **dict.fromkeys(SCORE_FIELDS), letterboxd_url=None, letterboxd_id=None,
         crawl_error=reason, updated_at=now, next_crawl_at=now + NEGATIVE_CACHE)


def crawl_one(db, client, doc, now):
    details = db.tmdb_movie_details.find_one({"tmdb_id": doc["tmdb_id"]})
    if not details or details.get("tmdb_deleted"):
        clear(db, doc, now, "unavailable", "movie removed from catalog")
        db[COLLECTION].update_one({"_id": doc["_id"]}, {"$set": {"tmdb_deleted": True}})
        return "unavailable"
    imdb_id, _ = effective_imdb_id(details, True)
    if not imdb_id:
        clear(db, doc, now, "unavailable", "movie has no IMDb identity")
        return "unavailable"
    url = movie_url(doc.get("letterboxd_url")) if doc.get("verified_imdb_id") == imdb_id else None
    mapped_url = movie_url(doc.get("wikidata_url"))
    if mapped_url == doc.get("rejected_mapping_url"):
        mapped_url = None
    url = url or mapped_url
    url = url or f"https://letterboxd.com/imdb/{imdb_id}/"
    lookup = f"https://letterboxd.com/imdb/{imdb_id}/"
    from_mapping = bool(mapped_url and url == mapped_url)
    try:
        page = client.get(url)
        # A stale mapping/merged slug must not hide an otherwise resolvable movie.
        if url != lookup and page.status in (404, 410):
            if url == mapped_url:
                db[COLLECTION].update_one({"_id": doc["_id"]}, {"$set": {"rejected_mapping_url": mapped_url}})
            page = client.get(lookup)
            from_mapping = False
        if page.status in (404, 410):
            clear(db, doc, now, "not_found", f"HTTP {page.status}")
            return "not_found"
        if page.status != 200:
            raise polite_http.FetchError(f"HTTP {page.status}")
        try:
            rating = parse(page.text, page.url, doc["tmdb_id"], imdb_id)
        except IdentityMismatch:
            if not from_mapping:
                raise
            db[COLLECTION].update_one({"_id": doc["_id"]}, {"$set": {"rejected_mapping_url": mapped_url}})
            page = client.get(lookup)
            if page.status in (404, 410):
                clear(db, doc, now, "not_found", f"HTTP {page.status}")
                return "not_found"
            if page.status != 200:
                raise polite_http.FetchError(f"HTTP {page.status}")
            rating = parse(page.text, page.url, doc["tmdb_id"], imdb_id)
    except IdentityMismatch as error:
        clear(db, doc, now, "rejected", str(error))
        return "rejected"
    except (ValueError, KeyError, TypeError, OverflowError, polite_http.FetchError) as error:
        save(db, doc, now, "error", crawl_error=str(error)[:300], next_crawl_at=now + ERROR_RETRY)
        return "error"
    save(db, doc, now, "ok" if rating.score is not None else "unrated",
         letterboxd_url=rating.url, letterboxd_id=rating.lid, verified_imdb_id=imdb_id,
         user_score_original=rating.score,
         user_score_normalized_percent=round(rating.score * 20, 4) if rating.score is not None else None,
         user_score_vote_count=rating.votes, updated_at=now, crawl_error=None,
         extraction_version=1, next_crawl_at=now + interval(details, now))
    return "ok" if rating.score is not None else "unrated"


def run(db, client, max_seconds=1500, batch_size=25, tmdb_ids=None, clock=datetime.utcnow, publish=None,
        only_unseen=False):
    if not 0 < max_seconds <= 1500 or not 1 <= batch_size <= 100:
        raise ValueError("max_seconds must be 0..1500 and batch_size 1..100")
    now = clock()
    initial_requests = client.requests
    report = {"titles": 0, "ok": 0, "unrated": 0, "not_found": 0, "rejected": 0,
              "unavailable": 0, "error": 0, "requests": 0, "published": 0, "blocked": None}
    until = polite_http.blocked_until(db, SITE, now)
    if until:
        return {**report, "blocked": {"until": until.isoformat(), "reason": "blocked earlier"}}
    deadline, token = now + timedelta(seconds=max_seconds), uuid4().hex
    state = db[polite_http.STATE]
    try:
        state.update_one({"_id": SITE, "$or": [{"crawl_lease_until": {"$lte": now}},
                                                {"crawl_lease_until": {"$exists": False}}]},
                         {"$set": {"crawl_token": token, "crawl_lease_until": deadline + timedelta(minutes=5)}},
                         upsert=True)
    except DuplicateKeyError:
        return {**report, "stopped": "another crawler holds the lease"}
    try:
        errors = 0
        while clock() < deadline:
            query = {"next_crawl_at": {"$lte": clock()}, "tmdb_deleted": {"$ne": True}}
            if only_unseen:
                query["crawled_at"] = {"$exists": False}
            if tmdb_ids is not None:
                query["tmdb_id"] = {"$in": tmdb_ids}
            candidates = list(db[COLLECTION].find(query).sort("popularity", -1).limit(batch_size))
            if not candidates:
                report["stopped"] = "nothing due"
                break
            changed, stop = [], False
            for candidate in candidates:
                if clock() >= deadline:
                    stop = True
                    break
                doc = db[COLLECTION].find_one_and_update(
                    {"_id": candidate["_id"], "next_crawl_at": candidate["next_crawl_at"]},
                    {"$set": {"next_crawl_at": clock() + timedelta(hours=2)}},
                    return_document=ReturnDocument.BEFORE)
                if doc is None:
                    continue
                try:
                    status = crawl_one(db, client, doc, clock())
                except polite_http.SiteBlocked as blocked:
                    save(db, doc, clock(), "blocked", next_crawl_at=blocked.until,
                         crawl_error=blocked.reason)
                    report["blocked"] = {"until": blocked.until.isoformat(), "reason": blocked.reason}
                    stop = True
                    break
                report["titles"] += 1
                report[status] += 1
                if status != "error":
                    changed.append(doc["tmdb_id"])
                errors = errors + 1 if status == "error" else 0
                if errors >= 3:
                    until = clock() + timedelta(hours=6)
                    polite_http.record_block(db, SITE, until, "three consecutive crawl errors", None, None, clock())
                    report["blocked"] = {"until": until.isoformat(), "reason": "three consecutive crawl errors"}
                    stop = True
                    break
            if changed and publish:
                publish(changed)
                report["published"] += len(changed)
            print({**report, "requests": client.requests - initial_requests}, flush=True)
            if stop:
                break
        report["requests"] = client.requests - initial_requests
        return report
    finally:
        state.update_one({"_id": SITE, "crawl_token": token},
                         {"$unset": {"crawl_token": "", "crawl_lease_until": ""}})


def main(max_minutes: float = 25, batch_size: int = 25, tmdb_ids: list[int] | None = None):
    from mongoengine import get_db
    from f.db.mongodb import init_mongodb, close_mongodb
    from f.db.cratedb import CrateConnector
    from f.sync.copy.all_ratings import copy_media

    init_mongodb()
    connector = None
    try:
        db = get_db()
        ensure_indexes(db)
        if tmdb_ids is not None:
            seed(db, tmdb_ids=tmdb_ids)
        connector = CrateConnector()
        return run(db, Client(db), max_minutes * 60, batch_size, tmdb_ids,
                   publish=lambda ids: copy_media(connector, {"tmdb_id": {"$in": ids}},
                                                  "movie", recent_only=False))
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()
