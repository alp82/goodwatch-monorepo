"""Initialize country identities in bounded batches without per-country roundtrips."""

from collections import defaultdict
from datetime import datetime
from itertools import islice

from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection
from pymongo.errors import BulkWriteError

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_web.country_state import (
    country_from_url,
    ensure_indexes,
    identity_map,
    normalization_update,
    insertion_update,
)

TITLE_BATCH_SIZE = 500


def initialize_batch(
    collection: Collection, titles: list[dict], media_type: str
) -> dict:
    existing: dict[int, list[dict]] = defaultdict(list)
    projection = {
        "tmdb_id": 1,
        "tmdb_watch_url": 1,
        "country_code": 1,
        "updated_at": 1,
        "next_fetch_at": 1,
        "lease_token": 1,
        "consecutive_failures": 1,
        "country_identity_ready": 1,
    }
    for document in collection.find(
        {"tmdb_id": {"$in": [title["tmdb_id"] for title in titles]}},
        projection,
    ):
        existing[document["tmdb_id"]].append(document)
    operations: list[UpdateOne] = []
    errors: list[dict] = []
    quarantined = {row["tmdb_id"]: row["status"] for row in collection.database.provider_identity_unresolved.find({
        "media": media_type, "status": {"$in": ["unresolved", "resolved_alias"]},
        "tmdb_id": {"$in": [title["tmdb_id"] for title in titles]},
    }, {"tmdb_id": 1, "status": 1})}
    now = datetime.utcnow()
    for title in titles:
        tmdb_id = title["tmdb_id"]
        if quarantined.get(tmdb_id) == "resolved_alias":
            continue
        if tmdb_id in quarantined:
            errors.append({"id": str(tmdb_id), "error": "Quarantined provider identity requires resolution"})
            continue
        countries, invalid = identity_map(existing[tmdb_id], media_type)
        if invalid:
            errors.extend(
                {"id": str(identity), "error": message}
                for identity, message in invalid.items()
            )
            continue
        title_operations: list[UpdateOne] = []
        normalization_positions: dict[str, int] = {}
        for country, matches in countries.items():
            selector, update = normalization_update(matches[0], country)
            update["$set"].update(
                original_title=title.get("original_title"),
                popularity=title.get("popularity"),
            )
            normalization_positions[country] = len(title_operations)
            title_operations.append(UpdateOne(selector, update))
        try:
            for country_key, provider in title["watch_providers"][
                "results"
            ].items():
                url = provider.get("link")
                if not url:
                    continue
                country = country_from_url(url, tmdb_id, media_type)
                if country != country_key.upper():
                    raise ValueError(
                        "Provider country conflicts with watch URL"
                    )
                if country in countries:
                    document = countries[country][0]
                    selector, update = normalization_update(document, country)
                    update["$set"].update(
                        tmdb_watch_url=url,
                        original_title=title.get("original_title"),
                        popularity=title.get("popularity"),
                    )
                    title_operations[normalization_positions[country]] = UpdateOne(selector, update)
                    continue
                selector, update = insertion_update(
                    tmdb_id,
                    country,
                    url,
                    title.get("original_title"),
                    title.get("popularity"),
                    now,
                )
                title_operations.append(
                    UpdateOne(selector, update, upsert=True)
                )
        except (ValueError, TypeError, AttributeError) as error:
            errors.append({"tmdb_id": tmdb_id, "error": str(error)})
            continue
        operations.extend(title_operations)
    created = 0
    if operations:
        try:
            created = collection.bulk_write(
                operations, ordered=False
            ).upserted_count
        except BulkWriteError as error:
            # Only a concurrent normalized insertion can race this batch. Do not
            # hide validation, connection, write-concern or other database errors.
            details = error.details or {}
            if details.get("writeConcernErrors") or any(
                item["code"] != 11000
                for item in details.get("writeErrors", [])
            ):
                raise
            created = details.get("nUpserted", 0)
            errors.extend(
                {
                    "error": "Concurrent country identity conflict",
                    "operation": item["index"],
                }
                for item in details.get("writeErrors", [])
            )
    return {
        "count_new_documents": created,
        "errors": errors,
        "operations": len(operations),
    }


def initialize_documents() -> dict:
    db = get_db()
    counts: dict = {"identity_error_count": 0, "identity_errors": []}
    for media_type, count_key in (
        ("movie", "count_new_movies"),
        ("tv", "count_new_tv"),
    ):
        providers = db[f"tmdb_{media_type}_providers"]
        ensure_indexes(providers)
        counts[count_key] = 0
        cursor = (
            db[f"tmdb_{media_type}_details"]
            .find(
                {
                    "tmdb_deleted": {"$ne": True},
                    "watch_providers.results": {
                        "$exists": True,
                        "$ne": {},
                        "$not": {"$type": "array"},
                    },
                },
                {
                    "tmdb_id": 1,
                    "watch_providers.results": 1,
                    "original_title": 1,
                    "popularity": 1,
                },
            )
            .batch_size(TITLE_BATCH_SIZE)
        )
        seen = 0
        try:
            while titles := list(islice(cursor, TITLE_BATCH_SIZE)):
                result = initialize_batch(providers, titles, media_type)
                counts[count_key] += result["count_new_documents"]
                counts["identity_error_count"] += len(result["errors"])
                counts["identity_errors"].extend(
                    result["errors"][
                        : max(0, 100 - len(counts["identity_errors"]))
                    ]
                )
                seen += len(titles)
                print(
                    f"Initialized {media_type} titles={seen} batch_operations={result['operations']} identity_errors={len(result['errors'])}",
                    flush=True,
                )
        finally:
            cursor.close()
    return counts


def main() -> dict:
    init_mongodb()
    try:
        return initialize_documents()
    finally:
        close_mongodb()
