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
    StreamingEvidence,
)
from f.sync.models.crate_schemas import SCHEMAS
from f.sync.availability_evidence import build_evidence, quarantine_evidence
from f.tmdb_web.provider_identity import provider_name_from_url

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
        "watch_providers_check": 1,
        "watch_providers_attempted_at": 1,
        "watch_providers_error": 1,
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
    if db.provider_identity_maintenance.find_one({"_id": "repair", "active": True}):
        raise RuntimeError("Provider identity maintenance in progress")
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
        if db.provider_identity_maintenance.find_one({"_id": "repair", "active": True}):
            raise RuntimeError("Provider identity maintenance in progress")
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


def scoped_provider_id(
    name: str, country: str, stream_type: str, catalog: dict[str, list[dict]],
    api_results: dict,
) -> int | None:
    """Resolve exact catalog or title API names in the same offer scope."""
    candidates = catalog.get(name, [])
    identities = {row["tmdb_id"] for row in candidates}
    if len(identities) == 1:
        return next(iter(identities))
    if not identities:
        # TMDB title offers can use a different name from its provider catalog
        # (e.g. JustWatchTV / JustWatch TV). The verified title API supplies a
        # TMDB ID; JustWatch clickout IDs belong to a different namespace.
        api_ids = {offer.get("provider_id")
                   for offer in (api_results.get(country, {}).get(stream_type, []) or [])
                   if offer.get("provider_name") == name}
        if len(api_ids) == 1:
            identity = next(iter(api_ids))
            if type(identity) is int and identity > 0 and any(
                row["tmdb_id"] == identity for candidates in catalog.values() for row in candidates
            ):
                return identity
        return None
    api_ids = {offer.get("provider_id")
               for offer in (api_results.get(country, {}).get(stream_type, []) or [])
               if offer.get("provider_name") == name and offer.get("provider_id") in identities}
    if api_ids:
        return next(iter(api_ids)) if len(api_ids) == 1 else None
    country_ids = {row["tmdb_id"] for row in candidates
                   if country in (row.get("order_by_country") or {})}
    return next(iter(country_ids)) if len(country_ids) == 1 else None


class UnmappedStreamingProvider(RuntimeError):
    def __init__(self, name: str, tmdb_id: int, media_type: str, country: str):
        super().__init__(f"Unmapped streaming provider {name!r} for {media_type}:{tmdb_id} in {country}")
        self.country = country


def reconcile_availability(
    tmdb_id: int, media_type: str, existing: list[dict], details: dict,
    providers: list[dict], service_ids: dict[str, list[dict]],
    deferred_countries: set[str] | None = None,
) -> tuple[dict, dict, dict]:
    """Replace confirmed source scopes and retain the other source's contribution."""
    api_results = (details.get("watch_providers") or {}).get("results")
    api_results = api_results if details.get("updated_at") and isinstance(api_results, dict) else {}
    frozen = {row.get("country_code") for row in providers if row.get("identity_repair_pending")}
    api_results = {country: result for country, result in api_results.items() if country not in frozen}
    verified = {row["country_code"]: row for row in providers
                if row.get("country_code") and row.get("updated_at")
                and row["country_code"] not in (deferred_countries or set())
                and not row.get("consecutive_failures") and not row.get("country_identity_error")
                and not row.get("identity_repair_pending")}
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
            provider_name = provider_name_from_url(offer.get("stream_url")) or offer.get("provider_name")
            service_id = scoped_provider_id(provider_name, country, offer["stream_type"], service_ids, api_results)
            if service_id is None:
                raise UnmappedStreamingProvider(provider_name, tmdb_id, media_type, country)
            entry(country, offer["stream_type"], service_id).update(
                stream_url=offer.get("stream_url"), price_dollar=offer.get("price_dollar"),
                quality=offer.get("quality"))
    return rows, verified, api_results


def refresh_unmapped_country(provider: dict, media_type: str) -> dict:
    import wmill

    return wmill.run_script(
        path="f/tmdb_web/tmdb_crawl_providers/fetch",
        args={"next_id": {"id": str(provider["_id"]), "type": "movie" if media_type == "movie" else "tv"},
              "refresh_for_mapping": True},
        timeout=90,
    )


@contextmanager
def publication_snapshot(
    db: Any, connector: CrateConnector, tmdb_id: int, media_type: str,
    details_collection: Any, providers_collection: Any, service_ids: dict,
) -> Iterator[tuple]:
    """Retry unresolved countries once, without holding a write lease during HTTP."""
    refresh_outcomes = {}
    deferred = set()
    while True:
        with publication_lease(db, media_type, tmdb_id) as check_owned:
            details = fetch_documents_in_batch([tmdb_id], details_collection).get(tmdb_id, {})
            providers = fetch_all_documents_in_batch([tmdb_id], providers_collection).get(tmdb_id, [])
            check_owned()
            connector.run("REFRESH TABLE streaming_availability")
            existing = connector.select(
                "SELECT * FROM streaming_availability WHERE media_tmdb_id = ANY(?) AND media_type = ?",
                ([tmdb_id], media_type),
            )
            try:
                rows, verified, api_results = reconcile_availability(
                    tmdb_id, media_type, existing, details, providers, service_ids, deferred)
            except UnmappedStreamingProvider as error:
                country = error.country
                if country in refresh_outcomes:
                    deferred.add(country)
                    continue
                provider = next(row for row in providers if row.get("country_code") == country)
            else:
                yield check_owned, existing, providers, rows, verified, api_results, refresh_outcomes, details
                return
        # The fetch job owns the country claim, retry state and source writes.
        # Re-read both source snapshots and published state after reacquiring the
        # publication lease; another publisher may have run while we fetched.
        try:
            result = refresh_unmapped_country(provider, media_type)
            refresh_outcomes[country] = result.get("outcome", "failed")
        except Exception:
            refresh_outcomes[country] = "failed"
        print(f"Provider mapping refresh for {media_type}:{tmdb_id}/{country}: {refresh_outcomes[country]}")


def copy_media(
    connector: CrateConnector,
    query_selector: dict = {},
    media_type: str = "movie",
    *, recent_only: bool = True,
) -> dict:
    if media_type not in ("movie", "show"):
        raise ValueError("Unsupported streaming media type")
    is_movie = media_type == "movie"
    mongo_db = get_db()
    mongo_details = mongo_db.tmdb_movie_details if is_movie else mongo_db.tmdb_tv_details
    mongo_providers = mongo_db.tmdb_movie_providers if is_movie else mongo_db.tmdb_tv_providers
    media_table_name = "movie" if is_movie else "show"
    MediaClass = Movie if is_movie else Show
    cutoff = datetime.utcnow() - timedelta(hours=HOURS_TO_FETCH)
    updated_at_filter = {"$or": [{field: {"$gte": cutoff}} for field in ("updated_at", "failed_at")]} if recent_only else {}
    details_filter = {"$or": [{field: {"$gte": cutoff}} for field in ("updated_at", "watch_providers_attempted_at")]} if recent_only else {}
    # Failure/pending invalidation must not require a new whole-catalog scan.
    # Index creation is idempotent; deploy these before enabling the new writer.
    mongo_providers.create_index([("failed_at", 1), ("tmdb_id", 1)])
    mongo_details.create_index([("watch_providers_attempted_at", 1), ("tmdb_id", 1)])
    for marker in ("identity_repair_pending", "country_identity_error"):
        mongo_providers.create_index([("tmdb_id", 1)], name=f"evidence_{marker}",
                                     partialFilterExpression={marker: {"$exists": True}})
    streaming_services = connector.select(
        "SELECT tmdb_id, name, media_type, order_by_country FROM streaming_service WHERE media_type = ?",
        (media_type,),
    )
    service_ids: dict[str, list[dict]] = defaultdict(list)
    for service in streaming_services:
        if service.get("media_type", media_type) == media_type:
            service_ids[service["name"]].append(service)
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
            invalidation_match = {"$or": [{"identity_repair_pending": {"$exists": True, "$nin": [None, False, ""]}}, {"country_identity_error": {"$exists": True, "$nin": [None, False, ""]}}]}
            invalidation_pipeline = [{"$match": {"$and": [query_selector, invalidation_match]}}]
            if last_tmdb_id is not None:
                invalidation_pipeline.append({"$match": {"tmdb_id": {"$gt": last_tmdb_id}}})
            invalidation_pipeline += [{"$group": {"_id": "$tmdb_id"}}, {"$sort": {"_id": 1}}, {"$limit": BATCH_SIZE}]
            candidates.update(row["_id"] for row in mongo_providers.aggregate(invalidation_pipeline))
            if not query_selector:
                quarantine_query = {"media": "movie" if is_movie else "tv", "status": {"$in": ["unresolved", "resolved_alias"]}}
                if last_tmdb_id is not None:
                    quarantine_query["tmdb_id"] = {"$gt": last_tmdb_id}
                candidates.update(row["tmdb_id"] for row in mongo_db.provider_identity_unresolved.find(quarantine_query).sort("tmdb_id", 1).limit(BATCH_SIZE))
            # ObjectId selectors refer to provider documents in this entrypoint.
            # Preserve that legacy interface instead of applying them to details.
            if "_id" not in query_selector:
                candidates.update(row["_id"] for row in mongo_details.aggregate(
                    [{"$match": query_selector | details_filter}] + pipeline[1:]))
            tmdb_ids = sorted(candidates)[:BATCH_SIZE]
            if tmdb_ids:
                last_tmdb_id = tmdb_ids[-1]
        if not tmdb_ids:
            break
        for tmdb_id in tmdb_ids:
            unresolved = mongo_db.provider_identity_unresolved.find_one({
                "media": "movie" if is_movie else "tv", "tmdb_id": tmdb_id,
                "status": {"$in": ["unresolved", "resolved_alias"]},
            })
            if unresolved:
                # Quarantined source identities are not an empty availability
                # snapshot. Freeze the entire published title, including API
                # contributions, until its identity is authoritatively resolved.
                # Invalidate evidence even while legacy offers remain frozen.
                with publication_lease(mongo_db, media_type, tmdb_id) as check_owned:
                    check_owned()
                    connector.run("REFRESH TABLE streaming_evidence")
                    previous = connector.select("SELECT * FROM streaming_evidence WHERE media_tmdb_id = ANY(?) AND media_type = ?", ([tmdb_id], media_type))
                    evidence = [StreamingEvidence(**row) for row in quarantine_evidence(previous)]
                    if evidence:
                        connector.upsert_many(table="streaming_evidence", records=evidence,
                            conflict_columns=SCHEMAS["streaming_evidence"]["primary_key"], silent=True, replace_nulls=True)
                publication["status"] = "partial_success"
                if targeted_ids is not None:
                    publication["titles"][str(tmdb_id)] = {
                        "provider_state": "quarantined", "identity_resolution": unresolved["status"],
                        "deferred_country_count": unresolved["source_country_count"],
                        "unidentified_country_count": unresolved["source_document_count"],
                        "streaming_availability": None,
                    }
                continue
            with publication_snapshot(
                mongo_db, connector, tmdb_id, media_type, mongo_details, mongo_providers, service_ids,
            ) as snapshot:
                check_owned, existing, providers, rows, verified, api_results, refresh_outcomes, details = snapshot
                unverified = [
                    row for row in providers
                    if verified.get(row.get("country_code")) is not row
                ]
                deferred = sorted({row["country_code"] for row in unverified
                                   if row.get("country_code")})
                summary = {"provider_refresh_outcomes": refresh_outcomes, "verified_countries": sorted(verified), "deferred_countries": deferred,
                           "api_countries": sorted(api_results), "provider_state": "present" if providers else "absent",
                           "deferred_country_count": len(unverified),
                           "unidentified_country_count": sum(not row.get("country_code") for row in unverified),
                           "streaming_availability": (sorted({f"{row['streaming_service_id']}_{row['country_code']}" for row in rows.values()})
                                                      if existing or verified or api_results else None)}
                if unverified or not providers:
                    publication["status"] = "partial_success"
                if targeted_ids is not None:
                    publication["titles"][str(tmdb_id)] = summary
                check_owned()
                connector.run("REFRESH TABLE streaming_evidence")
                prior_evidence = connector.select(
                    "SELECT country_code FROM streaming_evidence WHERE media_tmdb_id = ANY(?) AND media_type = ?",
                    ([tmdb_id], media_type))
                evidence = [StreamingEvidence(**record) for record in build_evidence(
                    tmdb_id, media_type, details, providers, rows, verified, scoped_provider_id, service_ids,
                    [record["country_code"] for record in prior_evidence])]
                if evidence:
                    check_owned()
                    connector.upsert_many(table="streaming_evidence", records=evidence,
                        conflict_columns=SCHEMAS["streaming_evidence"]["primary_key"], silent=True, replace_nulls=True)
                    check_owned()
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
