from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any, Callable, Iterator, Optional
from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from mongoengine import get_db
from pydantic import BaseModel

from f.db.cratedb import CrateConnector
from f.db.mongodb import (
    init_mongodb,
    close_mongodb,
    build_query_selector_for_object_ids,
)
from f.sync.models.crate_models import (
    Movie,
    Show,
    StreamingAvailability,
)
from f.sync.models.crate_schemas import SCHEMAS

BATCH_SIZE = 5000
SUB_BATCH_SIZE = 50000
HOURS_TO_FETCH = 24*2


# ===== Helper Functions =====

def to_timestamp(dt_input: str) -> Optional[float]:
    """Convert datetime to Unix timestamp."""
    if isinstance(dt_input, datetime):
        return dt_input.timestamp()
    if isinstance(dt_input, str):
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%dT%H:%M:%S.%fZ')
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%d %H:%M:%S.%f')
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%d %H:%M:%S UTC')
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%d')
            return dt.timestamp()
        except Exception:
            pass

        raise Exception(f"cannot convert datetime to timestamp: {dt_input}")
        

def fetch_documents_in_batch(tmdb_ids: list[int], collection: Any) -> dict:
    projection = {
        "tmdb_id": 1,
        "watch_providers": 1,
        "updated_at": 1,
    }
    return {
        doc["tmdb_id"]: doc for doc in collection.find({"tmdb_id": {"$in": tmdb_ids}}, projection)
    }


def fetch_all_documents_in_batch(tmdb_ids: list[int], collection: Any) -> dict:
    results = defaultdict(list)
    for doc in collection.find({"tmdb_id": {"$in": tmdb_ids}}):
        results[doc["tmdb_id"]].append(doc)
    return dict(results)


def upsert_in_batches(connector: CrateConnector, table: str, records: list[BaseModel]) -> dict:
    """Process and insert entities and return upsert results."""
    total_result = {"records_received": 0, "rows_upserted": 0}
    
    if records:
        print(f"    Upserting {len(records)} of type {table}")
        for i in range(0, len(records), SUB_BATCH_SIZE):
            batch = records[i:i + SUB_BATCH_SIZE]
            if batch:
                result = connector.upsert_many(
                    table=table,
                    records=batch,
                    conflict_columns=SCHEMAS[table]["primary_key"],
                    silent=True,
                )
                total_result["records_received"] += result["records_received"]
                total_result["rows_upserted"] += result["rows_upserted"]
    
    return total_result

@contextmanager
def publication_lease(db: Any, media_type: str, tmdb_id: int) -> Iterator[Callable[[], None]]:
    """Serialize scheduled/targeted streaming snapshots, independently of demand."""
    collection = db.streaming_publication_leases
    identity = f"{media_type}:{tmdb_id}"
    token = str(uuid4())
    now = datetime.utcnow()
    try:
        collection.update_one(
            {"_id": identity, "expires_at": {"$lte": now}},
            {"$set": {"token": token, "expires_at": now + timedelta(minutes=15)}},
            upsert=True,
        )
    except DuplicateKeyError as error:
        raise RuntimeError(f"Streaming publication busy for {identity}") from error

    def check_owned() -> None:
        # Leave more time than the Crate request timeout before takeover can
        # happen. Check again after the writes; an expired worker cannot succeed.
        if not collection.find_one({"_id": identity, "token": token,
                                    "expires_at": {"$gt": datetime.utcnow() + timedelta(minutes=4)}}):
            raise RuntimeError(f"Streaming publication lease lost for {identity}")

    try:
        yield check_owned
        check_owned()
    finally:
        collection.delete_one({"_id": identity, "token": token})


def availability_key(row: dict) -> tuple:
    return tuple(row[field] for field in (
        "media_tmdb_id", "media_type", "country_code", "streaming_service_id", "streaming_type"
    ))


def reconcile_availability(
    tmdb_id: int, media_type: str, existing: list[dict], details: dict,
    providers: list[dict], service_ids: dict,
) -> tuple[dict, dict, dict]:
    """Replace confirmed source scopes and retain the other source's contribution."""
    api_results = (details.get("watch_providers") or {}).get("results")
    api_results = api_results if details.get("updated_at") and isinstance(api_results, dict) else {}
    verified = {row["country_code"]: row for row in providers
                if row.get("country_code") and row.get("updated_at")
                and not row.get("consecutive_failures") and not row.get("country_identity_error")}
    rows = {}
    for original in existing:
        row = StreamingAvailability(**original).model_dump()
        country = row["country_code"]
        api_confirmed = country in api_results
        scrape_confirmed = country in verified
        if api_confirmed:
            row.update(tmdb_link=None, display_priority=None)
        if scrape_confirmed:
            row.update(stream_url=None, price_dollar=None, quality=None)
        # Legacy rows without attribution survive unless both sources confirmed
        # the country. Otherwise a failed source could lose its old availability.
        api_present = row.get("tmdb_link") is not None or row.get("display_priority") is not None
        scrape_present = any(row.get(field) is not None for field in ("stream_url", "price_dollar", "quality"))
        unknown = not any(original.get(field) is not None for field in (
            "tmdb_link", "display_priority", "stream_url", "price_dollar", "quality"))
        if api_present or scrape_present or (unknown and not (api_confirmed and scrape_confirmed)):
            rows[availability_key(row)] = row

    def entry(country: str, stream_type: str, service_id: int) -> dict:
        key = (tmdb_id, media_type, country, service_id, stream_type)
        if key not in rows:
            rows[key] = StreamingAvailability(
                media_tmdb_id=tmdb_id, media_type="movie" if media_type == "movie" else "show", country_code=country,
                streaming_type=stream_type, streaming_service_id=service_id,
            ).model_dump()
        return rows[key]

    for country, data in api_results.items():
        for stream_type in ("flatrate", "free", "ads", "rent", "buy"):
            for offer in data.get(stream_type, []) or []:
                service_id = offer.get("provider_id")
                if service_id is not None:
                    entry(country, stream_type, service_id).update(
                        tmdb_link=data.get("link"), display_priority=offer.get("display_priority"))
    for country, provider in verified.items():
        for offer in provider.get("streaming_links", []) or []:
            service_id = service_ids.get(offer.get("provider_name"))
            if service_id is None:
                raise RuntimeError(
                    f"Unmapped streaming provider {offer.get('provider_name')!r} "
                    f"for {media_type}:{tmdb_id} in {country}"
                )
            entry(country, offer["stream_type"], service_id).update(
                stream_url=offer.get("stream_url"), price_dollar=offer.get("price_dollar"),
                quality=offer.get("quality"))
    return rows, verified, api_results


def copy_media(
    connector: CrateConnector,
    query_selector: dict = {},
    media_type: str = "movie",
    *, recent_only: bool = True,
) -> dict:
    is_movie = media_type == "movie"
    mongo_db = get_db()
    mongo_details = mongo_db.tmdb_movie_details if is_movie else mongo_db.tmdb_tv_details
    mongo_providers = mongo_db.tmdb_movie_providers if is_movie else mongo_db.tmdb_tv_providers
    media_table_name = "movie" if is_movie else "show"
    MediaClass = Movie if is_movie else Show
    updated_at_filter = {"updated_at": {"$gte": datetime.utcnow() - timedelta(hours=HOURS_TO_FETCH)}} if recent_only else {}
    streaming_services = connector.select("SELECT tmdb_id, name FROM streaming_service")
    service_ids = {service["name"]: service["tmdb_id"] for service in streaming_services}
    entity_counts = defaultdict(lambda: {"records_received": 0, "rows_upserted": 0})
    publication = {"status": "success", "titles": {}}
    targeted_ids = query_selector.get("tmdb_id", {}).get("$in") if not recent_only else None
    start = 0
    last_tmdb_id: int | None = None
    while True:
        if targeted_ids is not None:
            tmdb_ids = targeted_ids[start:start + BATCH_SIZE]
        else:
            # Either source can change independently. Merge bounded keyset pages
            # so API-only updates reach the same reconciler without a second writer.
            pipeline = [{"$match": query_selector | updated_at_filter}]
            if last_tmdb_id is not None:
                pipeline.append({"$match": {"tmdb_id": {"$gt": last_tmdb_id}}})
            pipeline += [{"$group": {"_id": "$tmdb_id"}}, {"$sort": {"_id": 1}},
                         {"$limit": BATCH_SIZE}]
            candidates = {row["_id"] for row in mongo_providers.aggregate(pipeline)}
            # ObjectId selectors refer to provider documents in this entrypoint.
            # Preserve that legacy interface instead of applying them to details.
            if "_id" not in query_selector:
                candidates.update(row["_id"] for row in mongo_details.aggregate(pipeline))
            tmdb_ids = sorted(candidates)[:BATCH_SIZE]
            if tmdb_ids:
                last_tmdb_id = tmdb_ids[-1]
        if not tmdb_ids:
            break
        for tmdb_id in tmdb_ids:
            with publication_lease(mongo_db, media_type, tmdb_id) as check_owned:
                # Read each source snapshot while holding the shared title lock.
                details_by_id = fetch_documents_in_batch([tmdb_id], mongo_details)
                providers_by_id = fetch_all_documents_in_batch([tmdb_id], mongo_providers)
                check_owned()
                connector.run("REFRESH TABLE streaming_availability")
                existing_by_id = {tmdb_id: connector.select(
                    "SELECT * FROM streaming_availability WHERE media_tmdb_id = ANY(?) AND media_type = ?",
                    ([tmdb_id], media_type),
                )}
                providers = providers_by_id.get(tmdb_id, [])
                existing = existing_by_id[tmdb_id]
                rows, verified, api_results = reconcile_availability(
                    tmdb_id, media_type, existing, details_by_id.get(tmdb_id, {}), providers, service_ids)
                deferred = sorted({row["country_code"] for row in providers
                                   if row.get("country_code") and row["country_code"] not in verified})
                summary = {"verified_countries": sorted(verified), "deferred_countries": deferred,
                           "api_countries": sorted(api_results), "provider_state": "present" if providers else "absent",
                           "streaming_availability": (sorted({f"{row['streaming_service_id']}_{row['country_code']}" for row in rows.values()})
                                                      if existing or verified or api_results else None)}
                if deferred or not providers:
                    publication["status"] = "partial_success"
                if targeted_ids is not None:
                    publication["titles"][str(tmdb_id)] = summary
                if not verified and not api_results:
                    continue
                old_rows = {availability_key(row): StreamingAvailability(**row).model_dump() for row in existing}
                changed: list[BaseModel] = [StreamingAvailability(**row) for key, row in rows.items() if row != old_rows.get(key)]
                # Exact source snapshots must clear NULL fields too. Write additions
                # before removals so failed inserts cannot erase retained source data.
                if changed:
                    check_owned()
                    result = connector.upsert_many(
                        table="streaming_availability", records=changed,
                        conflict_columns=SCHEMAS["streaming_availability"]["primary_key"],
                        silent=True, replace_nulls=True,
                    )
                    for field in ("records_received", "rows_upserted"):
                        entity_counts["streaming_availability"][field] += result[field]
                for key in old_rows.keys() - rows.keys():
                    check_owned()
                    connector.run(
                        "DELETE FROM streaming_availability WHERE media_tmdb_id = ? AND media_type = ? "
                        "AND country_code = ? AND streaming_service_id = ? AND streaming_type = ?", key)
                metadata = {}
                for field in ("created_at", "updated_at"):
                    timestamps = [row[field] for row in providers if row.get("updated_at") and row.get(field)]
                    if timestamps:
                        metadata[f"tmdb_providers_{field}"] = to_timestamp(max(timestamps))
                media = MediaClass(
                    tmdb_id=tmdb_id,
                    streaming_country_codes=sorted({row["country_code"] for row in rows.values()}),
                    streaming_service_ids=sorted({row["streaming_service_id"] for row in rows.values()}),
                    streaming_availabilities=sorted({f"{row['country_code']}_{row['streaming_service_id']}" for row in rows.values()}),
                    **metadata,
                )
                check_owned()
                result = upsert_in_batches(connector, media_table_name, [media])
                check_owned()
                for field in ("records_received", "rows_upserted"):
                    entity_counts["movies" if is_movie else "shows"][field] += result[field]
        start += BATCH_SIZE
    return dict(entity_counts) | {"publication": publication}


def main(movie_ids: list[str] = [], show_ids: list[str] = [], skip_movies = False):
    init_mongodb()
    connector = CrateConnector()

    results = {}

    if skip_movies:
        results["movies"] = None
    else:
        # Process movies
        if movie_ids is None or len(movie_ids) == 0:
            print("Processing all movies...")
            movie_query_selector = {}
        else:
            movie_query_selector = build_query_selector_for_object_ids(ids=movie_ids)
        
        results["movies"] = copy_media(
            connector=connector, 
            query_selector=movie_query_selector,
            media_type="movie"
        )
    
    # Process shows
    if show_ids is None or len(show_ids) == 0:
        print("\nProcessing all shows...")
        show_query_selector = {}
    else:
        show_query_selector = build_query_selector_for_object_ids(ids=show_ids)
    
    results["shows"] = copy_media(
        connector=connector, 
        query_selector=show_query_selector,
        media_type="show"
    )

    connector.disconnect()
    close_mongodb()
    
    return results


if __name__ == "__main__":
    main()