"""Shared Mongo eligibility, expiring country claims and fenced persistence.

updated_at always means the last verified successful scrape, including no offers.
Both scheduled and targeted jobs claim here immediately before making a request.
"""

from datetime import datetime, timedelta
from uuid import uuid4
from random import uniform

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.collection import Collection
from pymongo.database import Database

FRESHNESS = timedelta(days=7)
LEASE_DURATION = timedelta(minutes=5)
MAPPING_REFRESH_BACKOFF = timedelta(minutes=30)


def eligibility(now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    return {
        "$and": [
            {"country_identity_error": None},
            {
                "$or": [
                    {"next_fetch_at": {"$lte": now}},
                    {
                        "next_fetch_at": None,
                        "$or": [
                            {"updated_at": None},
                            {"updated_at": {"$lte": now - FRESHNESS}},
                        ],
                    },
                ]
            },
            {
                "$or": [
                    {"lease_expires_at": None},
                    {"lease_expires_at": {"$lte": now}},
                ]
            },
        ]
    }


def claim(
    db: Database,
    collection: Collection,
    identity: ObjectId,
    now: datetime | None = None,
    *, refresh_for_mapping: bool = False,
) -> dict | None:
    now = now or datetime.utcnow()
    if upstream_deadline(db, now) is not None:
        return None
    selector = eligibility(now)
    lease = {"lease_token": uuid4().hex, "lease_expires_at": now + LEASE_DURATION}
    if refresh_for_mapping:
        # A failed identity lookup can invalidate even a recent successful scrape.
        # Bypass its freshness deadline, never an active claim or failure backoff.
        selector = {"$and": [
            {"country_identity_error": None},
            {"$or": [{"lease_expires_at": None}, {"lease_expires_at": {"$lte": now}}]},
            {"$or": [{"mapping_refresh_after": None}, {"mapping_refresh_after": {"$lte": now}}]},
            {"$or": [{"consecutive_failures": None}, {"consecutive_failures": 0},
                     {"next_fetch_at": {"$lte": now}}]},
        ]}
        # Retain this after a successful HTTP response: its provider names may
        # still be unmapped, and repeated publication must not hammer the source.
        lease["mapping_refresh_after"] = now + MAPPING_REFRESH_BACKOFF
    return collection.find_one_and_update(
        {"_id": identity, **selector},
        {"$set": lease},
        return_document=ReturnDocument.AFTER,
    )


def fence(document: dict, now: datetime) -> dict:
    return {
        "_id": document["_id"],
        "lease_token": document["lease_token"],
        "lease_expires_at": {"$gt": now},
    }


def save_success(
    collection: Collection,
    document: dict,
    links: list[dict],
    now: datetime | None = None,
) -> bool:
    now = now or datetime.utcnow()
    result = collection.update_one(
        fence(document, now),
        {
            "$set": {
                "streaming_links": links,
                "updated_at": now,
                "next_fetch_at": now + FRESHNESS,
                "consecutive_failures": 0,
                "is_selected": False,
            },
            "$unset": {
                "lease_token": "",
                "lease_expires_at": "",
                "error_message": "",
                "failed_at": "",
                "identity_repair_pending": "",
            },
        },
    )
    return result.modified_count == 1


def upstream_deadline(
    db: Database, now: datetime | None = None
) -> datetime | None:
    now = now or datetime.utcnow()
    state = db.tmdb_streaming_upstream.find_one({"_id": "tmdb_watch"}) or {}
    deadline = state.get("blocked_until")
    return deadline if deadline and deadline > now else None


def save_failure(
    db: Database,
    collection: Collection,
    document: dict,
    error: object,
    *,
    rate_limited: bool = False,
    retry_at: datetime | None = None,
    now: datetime | None = None,
) -> bool:
    now = now or datetime.utcnow()
    failures = (document.get("consecutive_failures") or 0) + 1
    minutes = (30, 120, 360)[min(failures - 1, 2)]
    deadline = now + timedelta(minutes=minutes * uniform(1, 1.1))
    if retry_at is not None:
        deadline = max(deadline, retry_at)
    result = collection.update_one(
        fence(document, now),
        {
            "$set": {
                "failed_at": now,
                "error_message": str(error)[:1000],
                "next_fetch_at": deadline,
                "consecutive_failures": failures,
                "is_selected": False,
            },
            "$unset": {"lease_token": "", "lease_expires_at": ""},
        },
    )
    if rate_limited:
        # Even a worker whose lease expired observed a real upstream limit.
        db.tmdb_streaming_upstream.update_one(
            {"_id": "tmdb_watch"},
            {"$max": {"blocked_until": deadline}},
            upsert=True,
        )
    return result.modified_count == 1


def main() -> None:
    pass


def country_from_url(url: str | None, tmdb_id: int, media_type: str) -> str:
    """Validate the source identity before allowing HTTP or identity writes."""
    import re
    from urllib.parse import parse_qs, urlparse

    if (
        not isinstance(url, str)
        or not isinstance(tmdb_id, int)
        or isinstance(tmdb_id, bool)
        or tmdb_id <= 0
    ):
        raise ValueError("Invalid TMDB provider identity")
    if media_type not in ("movie", "tv"):
        raise ValueError("Expected movie or tv identity")
    parsed = urlparse(url)
    expected = "movie" if media_type == "movie" else "tv"
    locales = parse_qs(parsed.query).get("locale", [])
    if (
        parsed.scheme != "https"
        or parsed.hostname not in {"www.themoviedb.org", "themoviedb.org"}
        or parsed.port not in (None, 443)
        or parsed.username
        or parsed.password
        or not re.fullmatch(
            rf"/{expected}/{int(tmdb_id)}(?:-[^/]*)?/watch/?", parsed.path
        )
        or len(locales) != 1
        or not re.fullmatch(r"[A-Za-z]{2}", locales[0])
    ):
        raise ValueError("Invalid or ambiguous TMDB country watch URL")
    return locales[0].upper()


def identity_map(documents: list[dict], media_type: str) -> tuple[dict, dict]:
    countries, errors = {}, {}
    for document in documents:
        try:
            country = country_from_url(
                document.get("tmdb_watch_url"), document["tmdb_id"], media_type
            )
            stored = document.get("country_code")
            if stored and (
                not isinstance(stored, str) or stored.upper() != country
            ):
                raise ValueError("Country code conflicts with watch URL")
            countries.setdefault(country, []).append(document)
        except (ValueError, TypeError, KeyError) as error:
            errors[document["_id"]] = str(error)
    for country, matches in countries.items():
        if len(matches) > 1:
            for document in matches:
                errors[document["_id"]] = (
                    f"Duplicate identity: {document['tmdb_id']}/{country}"
                )
    return countries, errors


def normalization_update(document: dict, country: str) -> tuple[dict, dict]:
    # Compare the fields used to derive state: never overwrite a concurrent scrape,
    # retry or replacement claim while migrating legacy records.
    fields: dict = {"country_code": country, "country_identity_ready": True}
    if document.get("next_fetch_at") is None:
        fields["next_fetch_at"] = (
            document["updated_at"] + FRESHNESS
            if document.get("updated_at")
            else datetime(1970, 1, 1)
        )
    if document.get("consecutive_failures") is None:
        fields["consecutive_failures"] = 0
    selector = {
        "_id": document["_id"],
        **{
            key: document.get(key)
            for key in (
                "updated_at",
                "next_fetch_at",
                "lease_token",
                "tmdb_watch_url",
                "country_code",
            )
        },
    }
    return selector, {"$set": fields, "$unset": {"country_identity_error": ""}}


def normalize_document(
    collection: Collection, document: dict, country: str
) -> bool:
    selector, update = normalization_update(document, country)
    return collection.update_one(selector, update).matched_count == 1


def ensure_indexes(collection: Collection) -> None:
    collection.create_index(
        [("next_fetch_at", 1), ("lease_expires_at", 1)],
        name="country_eligibility",
    )
    collection.create_index(
        [("next_fetch_at", 1), ("lease_expires_at", 1)],
        name="pending_identity_refresh",
        partialFilterExpression={"identity_repair_pending": {"$exists": True}},
    )
    final_index = collection.index_information().get("country_identity")
    if final_index:
        if (final_index.get("key") != [("tmdb_id", 1), ("country_code", 1)]
                or not final_index.get("unique") or final_index.get("partialFilterExpression")
                or final_index.get("sparse")):
            raise RuntimeError("country_identity index does not enforce full unique identity")
        return
    collection.create_index(
        [("tmdb_id", 1), ("country_code", 1)],
        unique=True,
        partialFilterExpression={"country_identity_ready": True},
        name="validated_country_identity",
    )


def select_country_ids(collection: Collection, now: datetime, batch_size: int = 5) -> list[str]:
    """Give pending repairs two slots while keeping ordinary due work moving."""
    identities = []
    def take(selector, order, limit):
        if limit <= 0:
            return
        cursor = collection.find({"$and": [selector, eligibility(now),
            {"_id": {"$nin": identities}}]}, {"_id": 1}).sort(order, 1).limit(limit)
        identities.extend(row["_id"] for row in cursor)
    pending = {"identity_repair_pending": {"$exists": True}, "next_fetch_at": {"$lte": now}}
    take(pending, "next_fetch_at", min(2, batch_size))
    for selector, order in (
        ({"next_fetch_at": {"$lte": now}}, "next_fetch_at"),
        ({"next_fetch_at": None, "updated_at": None}, "updated_at"),
        ({"next_fetch_at": None, "updated_at": {"$lte": now - FRESHNESS}}, "updated_at"),
    ):
        take({**selector, "identity_repair_pending": {"$exists": False}}, order, batch_size - len(identities))
    take(pending, "next_fetch_at", batch_size - len(identities))
    return [str(identity) for identity in identities]


def backfill(
    collection: Collection,
    media_type: str,
    after_id: ObjectId | None = None,
    batch_size: int = 1000,
    dry_run: bool = False,
) -> dict:
    if not 1 <= batch_size <= 10000:
        raise ValueError("batch_size must be between 1 and 10000")
    if not dry_run:
        ensure_indexes(collection)
    selector = {"_id": {"$gt": after_id}} if after_id is not None else {}
    documents = list(
        collection.find(selector).sort("_id", 1).limit(batch_size)
    )
    identities = {}
    errors, updated = [], 0
    for document in documents:
        tmdb_id = document.get("tmdb_id")
        if tmdb_id not in identities:
            identities[tmdb_id] = identity_map(
                list(collection.find({"tmdb_id": tmdb_id})), media_type
            )
        countries, invalid = identities[tmdb_id]
        if document["_id"] in invalid:
            if not dry_run:
                record_identity_error(
                    collection, document, invalid[document["_id"]]
                )
            errors.append(
                {"id": str(document["_id"]), "error": invalid[document["_id"]]}
            )
            continue
        country = next(
            country
            for country, matches in countries.items()
            if any(d["_id"] == document["_id"] for d in matches)
        )
        if not dry_run:
            updated += normalize_document(collection, document, country)
    return {
        "scanned": len(documents),
        "updated": updated,
        "errors": errors,
        "after_id": str(documents[-1]["_id"]) if documents else None,
        "done": len(documents) < batch_size,
        "dry_run": dry_run,
    }


def initialize_countries(
    collection: Collection,
    tmdb_id: int,
    providers: dict,
    media_type: str,
    original_title: str | None = None,
    popularity: float | None = None,
) -> dict:
    from pymongo.errors import DuplicateKeyError

    if collection.database.provider_identity_unresolved.find_one({
        "media": media_type, "tmdb_id": tmdb_id, "status": {"$in": ["unresolved", "resolved_alias"]},
    }):
        raise ValueError(f"Quarantined provider identity requires resolution: {media_type}/{tmdb_id}")
    documents = list(collection.find({"tmdb_id": tmdb_id}))
    countries, errors = identity_map(documents, media_type)
    if errors:
        raise ValueError(f"Ambiguous existing provider identities: {errors}")
    ids, count_new = [str(document["_id"]) for document in documents], 0
    now = datetime.utcnow()
    for country, matches in countries.items():
        normalize_document(collection, matches[0], country)
    for country_key, provider in providers.items():
        url = provider.get("link")
        if not url:
            continue
        country = country_from_url(url, tmdb_id, media_type)
        if country != country_key.upper():
            raise ValueError(f"Watch country {country_key} conflicts with URL")
        if country in countries:
            refresh_url(collection, countries[country][0], country, url)
            continue
        selector, update = insertion_update(
            tmdb_id, country, url, original_title, popularity, now
        )
        try:
            inserted = collection.update_one(selector, update, upsert=True)
            count_new += int(inserted.upserted_id is not None)
        except DuplicateKeyError:
            pass  # Another initializer created the same validated country.
        saved = collection.find_one(selector)
        if saved is None:
            raise RuntimeError("Initialized country disappeared")
        identity = str(saved["_id"])
        if identity not in ids:
            ids.append(identity)
    return {"ids": ids, "count_new_documents": count_new}


def insertion_update(
    tmdb_id: int,
    country: str,
    url: str,
    original_title: str | None,
    popularity: float | None,
    now: datetime,
) -> tuple[dict, dict]:
    selector = {
        "tmdb_id": tmdb_id,
        "country_code": country,
        "country_identity_ready": True,
    }
    update = {
        "$setOnInsert": {
            "tmdb_watch_url": url,
            "created_at": now,
            "next_fetch_at": datetime(1970, 1, 1),
            "consecutive_failures": 0,
            "original_title": original_title,
            "popularity": popularity,
        }
    }
    return selector, update


def record_identity_error(
    collection: Collection, document: dict, error: str
) -> None:
    # Exclude an invalid identity from work without changing its last good source
    # data. A subsequent successful normalization clears this repairable state.
    collection.update_one(
        {
            "_id": document["_id"],
            "tmdb_watch_url": document.get("tmdb_watch_url"),
            "country_code": document.get("country_code"),
        },
        {"$set": {"country_identity_error": error}},
    )


def refresh_url(collection: Collection, document: dict, country: str, url: str) -> bool:
    """URL metadata can change without creating a new country or touching a claim."""
    return collection.update_one(
        {"_id": document["_id"], "tmdb_watch_url": document.get("tmdb_watch_url"),
         "country_code": country},
        {"$set": {"tmdb_watch_url": url}},
    ).matched_count == 1
