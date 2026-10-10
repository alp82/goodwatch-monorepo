from contextlib import ExitStack
# extra_requirements:
# qdrant-client==1.19.1

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from mongoengine import get_db
from qdrant_client import models as qm

from f.db.mongodb import (
    init_mongodb,
    close_mongodb,
)
from f.db.qdrant import QdrantConnector
from f.db.cratedb import CrateConnector
from f.sync.copy import sync_state
from f.sync.copy.deleted_titles import delete_titles_from_qdrant, flag_spike, flagged_among, flagged_oldest_first
from f.sync.copy.tmdb_streaming import SCHEDULED_LEASE_WAIT_SECONDS, publication_lease
from f.sync.copy.qdrant_retry import (
    REQUEST_TIMEOUT_SECONDS, insert_points, update_points, write_with_retry,
)
from f.dna.models import CoreScores
from f.sync.models.qdrant_schemas import MEDIA_COLLECTION
from f.sync.models.qdrant_models import QdrantMediaPoint
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails

# Tunables
# ids per loop. A batch holds the full TMDB details documents; 2000 popular titles peaked near
# the 4 GB worker limit.
BATCH_SIZE = 500
UPSERT_BATCH_SIZE = 1000  # points per Qdrant write request
# Window for "recent" updates of a run restricted to ids. A scheduled run reads from its
# last successful run instead (f/sync/copy/sync_state).
HOURS_TO_FETCH = 24 * 2
SYNC_JOB = "vector_data"

# The 74 raw 0-10 scores in the same dimension order as fingerprint_v1, for Dot
# distance. Written only when the collection has this named vector.
FINGERPRINT_RAW_VECTOR = "fingerprint_v1_raw"

# Started after every scheduled copy (not after targeted ones).
TITLE_SNAPSHOT_SCRIPT = "f/sync/copy/title_snapshot"

# ---- Helpers ---------------------------------------------------------------


def _compute_release_year(details: dict, media_type: str) -> Optional[int]:
    if media_type == "movie":
        d = details.get("release_date")
    else:
        d = details.get("first_air_date")
    if isinstance(d, datetime):
        return d.year
    if isinstance(d, str):
        try:
            return datetime.strptime(d, "%Y-%m-%d").year
        except Exception:
            return None
    return None


def _compute_release_decade(year: Optional[int]) -> Optional[int]:
    if year is None:
        return None
    return (year // 10) * 10


def _raw_fingerprint(scores: dict) -> Optional[List[float]]:
    """The raw scores in CoreScores order, the order fingerprint_v1 is built in."""
    try:
        validated = CoreScores(**scores)
    except Exception:
        return None
    return [float(getattr(validated, name)) for name in CoreScores.model_fields]


def _utc_stamp() -> str:
    """The UTC time for a log line. Windmill keeps only the tail of a log, without times."""
    return f"{datetime.utcnow().isoformat(timespec='seconds')}Z"


def _collection_vector_names(client) -> set:
    vectors = client.get_collection(MEDIA_COLLECTION).config.params.vectors
    return set(vectors) if isinstance(vectors, dict) else set()


# ---- Mongo fetchers --------------------------------------------------------


def _fetch_tmdb_ids_keyset(
    collection,
    base_selector: dict,
    last_tmdb_id: Optional[int],
    limit: int,
    *,
    overfetch_factor: int = 3,
    use_compound_hint: bool = False,
) -> Tuple[List[int], Optional[int]]:
    """
    Keyset pagination over an index to fetch distinct tmdb_id quickly.

    Uses {updated_at:1, tmdb_id:1} only when requested for date-filtered scans.
    Otherwise prefers {tmdb_id:1}, avoiding a full date-index scan for targeted IDs.
    If the requested index is absent, falls back to {tmdb_id:1} or no hint.

    Returns (ids, next_last_tmdb_id).
    """
    selector = dict(base_selector or {})
    if last_tmdb_id is not None:
        if "tmdb_id" in selector and isinstance(selector["tmdb_id"], dict):
            selector["tmdb_id"] = {**selector["tmdb_id"], "$gt": last_tmdb_id}
        else:
            selector["tmdb_id"] = {"$gt": last_tmdb_id}

    fetch_n = max(limit * overfetch_factor, limit)

    # Determine available indexes
    idx_info = collection.index_information()

    def _has_index(keys: list[tuple[str, int]]) -> bool:
        for meta in idx_info.values():
            # PyMongo stores index keys as a list of (field, direction) tuples
            if list(meta.get("key", [])) == keys:
                return True
        return False

    compound_keys = [("updated_at", 1), ("tmdb_id", 1)]
    tmdb_only_keys = [("tmdb_id", 1)]
    can_hint_compound = _has_index(compound_keys)
    can_hint_tmdb_only = _has_index(tmdb_only_keys)

    cursor = (
        collection.find(selector, {"tmdb_id": 1, "_id": 0}, no_cursor_timeout=True)
        .sort("tmdb_id", 1)
        .limit(fetch_n)
        .batch_size(min(fetch_n, 10_000))
    )

    # Apply hint only if we KNOW it's present
    try:
        if use_compound_hint and can_hint_compound:
            cursor = cursor.hint(compound_keys)
        elif can_hint_tmdb_only:
            cursor = cursor.hint(tmdb_only_keys)
        # else: no hint
    except Exception:
        # If hint setting itself errors (rare), just proceed without hint
        pass

    ids: List[int] = []
    prev: Optional[int] = None
    for doc in cursor:
        tid = doc["tmdb_id"]
        if tid != prev:  # dedupe adjacent duplicates from multiple rows
            ids.append(tid)
            prev = tid
            if len(ids) >= limit:
                break

    next_last = ids[-1] if ids else last_tmdb_id
    return ids, next_last


def _with_fingerprint(dna_collection):
    """Keep the ids whose DNA has a fingerprint vector, the only titles the copy writes."""
    def keep(ids: List[int]) -> List[int]:
        return sorted(doc["tmdb_id"] for doc in dna_collection.find(
            {"tmdb_id": {"$in": ids}, "vector_fingerprint": {"$exists": True}}, {"_id": 0, "tmdb_id": 1}))
    return keep


def _drivers(c_details, c_imdb, c_dna, c_tropes, *, recent_only: bool) -> list:
    """The (collection, keep) drivers whose changed documents pick the titles to copy.

    The details drive every run. In the recent window, the IMDb ratings (the daily dataset
    ingest changes them without touching the details), the DNA and the tropes also drive it.
    Every write of new DNA or a fingerprint moves the DNA's updated_at, including when it sets
    dna_generated_at, so updated_at alone finds them. Every trope crawl or reviewed import
    moves the trope document's updated_at, and the payload's `tropes` feed the search text.
    All three are kept to titles with a fingerprint, the only ones the copy writes.
    """
    if not recent_only:
        return [(c_details, None)]
    with_fingerprint = _with_fingerprint(c_dna)
    return [(c_details, None), (c_imdb, with_fingerprint), (c_dna, with_fingerprint),
            (c_tropes, with_fingerprint)]


def _driver_batches(drivers: list, base_selector: dict, *, use_compound_hint: bool, carried_ids=()):
    """Batches of tmdb ids from each (collection, keep) driver in turn. keep, when set, filters
    each batch. An id comes only once.

    carried_ids, the titles an earlier run selected but could not write, come first. No
    driver has to select them again.
    """
    seen: set = set()
    carried = sorted(set(carried_ids))
    for start in range(0, len(carried), BATCH_SIZE):
        ids = carried[start:start + BATCH_SIZE]
        seen.update(ids)
        yield ids
    for collection, keep in drivers:
        last_tmdb_id: Optional[int] = None
        while True:
            ids, last_tmdb_id = _fetch_tmdb_ids_keyset(
                collection,
                base_selector=base_selector,
                last_tmdb_id=last_tmdb_id,
                limit=BATCH_SIZE,
                overfetch_factor=3,
                use_compound_hint=use_compound_hint,
            )
            if not ids:
                break
            ids = [tmdb_id for tmdb_id in ids if tmdb_id not in seen]
            if keep and ids:
                ids = keep(ids)
            seen.update(ids)
            if ids:
                yield ids


def _fetch_map_by_ids(
    collection, ids: List[int], projection: dict | None = None
) -> Dict[int, dict]:
    if not ids:
        return {}
    proj = projection or {}
    return {
        doc["tmdb_id"]: doc for doc in collection.find({"tmdb_id": {"$in": ids}}, proj)
    }


def _fetch_multimap_by_ids(collection, ids: List[int]) -> Dict[int, List[dict]]:
    res = defaultdict(list)
    if not ids:
        return {}
    for doc in collection.find({"tmdb_id": {"$in": ids}}):
        res[doc["tmdb_id"]].append(doc)
    return dict(res)


# ---- Builders --------------------------------------------------------------


def _build_payload(
    media_type: str,
    tmdb_id: int,
    details: dict | None,
    imdb: dict | None,
    meta: dict | None,
    rotten: dict | None,
    providers_from_tmdb: dict | None,
    providers_all_rows: List[dict] | None,
    dna: dict | None,
    tropes: dict | None,
) -> Tuple[Dict[str, Any], Dict[str, List[float]]]:
    """
    Returns (payload, vectors). Will return empty vectors if no DNA vectors available.
    """
    payload: Dict[str, Any] = {
        "tmdb_id": tmdb_id,
        "media_type": media_type,
    }

    # --- Details-lite
    if details:
        payload["title"] = details.get("title")
        payload["original_title"] = details.get("original_title")
        payload["poster_path"] = details.get("poster_path")
        payload["backdrop_path"] = details.get("backdrop_path")

        release_year = _compute_release_year(details, media_type)
        payload["genres"] = [
            g.get("name") for g in details.get("genres", []) if g.get("name")
        ]
        payload["release_year"] = release_year
        payload["release_decade"] = _compute_release_decade(release_year)
        payload["is_anime"] = None  # may be filled by DNA below
        payload["production_method"] = None  # may be filled by DNA below

        # scores from TMDB core
        vc = details.get("vote_count")
        va = details.get("vote_average")
        payload["tmdb_user_score_rating_count"] = vc if vc else None
        payload["tmdb_user_score_normalized_percent"] = (va * 10) if va else None

    # --- Scores (imdb/meta/rotten/goodwatch combined like your score job)
    if imdb or meta or rotten or details:
        # Derive normalized fields (mirror your score script)
        def _avg(vals):
            vals = [v for v in vals if v is not None]
            return sum(vals) / len(vals) if vals else None

        def _sum(vals):
            vals = [v for v in vals if v is not None]
            return sum(vals) if vals else None

        tmdb_norm = payload.get("tmdb_user_score_normalized_percent")
        imdb_norm = imdb.get("user_score_normalized_percent") if imdb else None
        meta_user_norm = meta.get("user_score_normalized_percent") if meta else None
        meta_meta_norm = meta.get("meta_score_normalized_percent") if meta else None
        rotten_aud_norm = (
            rotten.get("audience_score_normalized_percent") if rotten else None
        )
        rotten_tom_norm = (
            rotten.get("tomato_score_normalized_percent") if rotten else None
        )

        payload["imdb_user_score_normalized_percent"] = imdb_norm
        payload["metacritic_user_score_normalized_percent"] = meta_user_norm
        payload["metacritic_meta_score_normalized_percent"] = meta_meta_norm
        payload["rotten_tomatoes_audience_score_normalized_percent"] = rotten_aud_norm
        payload["rotten_tomatoes_tomato_score_normalized_percent"] = rotten_tom_norm

        # counts
        payload["imdb_user_score_rating_count"] = (imdb or {}).get(
            "user_score_vote_count"
        )
        payload["metacritic_user_score_rating_count"] = (meta or {}).get(
            "user_score_vote_count"
        )
        payload["metacritic_meta_score_review_count"] = (meta or {}).get(
            "meta_score_vote_count"
        )
        payload["rotten_tomatoes_audience_score_rating_count"] = (rotten or {}).get(
            "audience_score_vote_count"
        )
        payload["rotten_tomatoes_tomato_score_review_count"] = (rotten or {}).get(
            "tomato_score_vote_count"
        )

        # Goodwatch aggregates (like your script)
        goodwatch_user = _avg([tmdb_norm, imdb_norm, meta_user_norm, rotten_aud_norm])
        goodwatch_user_count = _sum(
            [
                (details or {}).get("vote_count"),
                (imdb or {}).get("user_score_vote_count"),
                (meta or {}).get("user_score_vote_count"),
                (rotten or {}).get("audience_score_vote_count"),
            ]
        )

        goodwatch_official = _avg([meta_meta_norm, rotten_tom_norm])
        goodwatch_official_count = _sum(
            [
                (meta or {}).get("meta_score_vote_count"),
                (rotten or {}).get("tomato_score_vote_count"),
            ]
        )

        payload["goodwatch_user_score_normalized_percent"] = goodwatch_user
        payload["goodwatch_user_score_rating_count"] = goodwatch_user_count
        payload["goodwatch_official_score_normalized_percent"] = goodwatch_official
        payload["goodwatch_official_score_review_count"] = goodwatch_official_count
        payload["goodwatch_overall_score_normalized_percent"] = _avg(
            [goodwatch_user, goodwatch_official]
        )
        payload["goodwatch_overall_score_voting_count"] = _sum(
            [goodwatch_user_count, goodwatch_official_count]
        )

    # --- Streaming (tuples + codes)
    streaming_tuples: List[Tuple[str, str]] = []
    # From TMDB details.watch_providers
    if details:
        results = (details.get("watch_providers") or {}).get("results", {})
        if isinstance(results, dict):
            for cc, data in results.items():
                link = data.get("link")
                if not link:
                    continue
                for stype, lst in data.items():
                    if stype == "link":
                        continue
                    for entry in lst or []:
                        svc = entry.get("provider_id")
                        if svc and cc:
                            streaming_tuples.append((svc, cc))
    # From your own provider rows (merged)
    for row in providers_all_rows or []:
        cc = row.get("country_code")
        for sl in row.get("streaming_links", []) or []:
            svc = sl.get("provider_id")
            if svc and cc:
                streaming_tuples.append((svc, cc))

    # Deduplicate tuples while preserving order
    streaming_seen = set()
    streaming_uniq = []
    for t in streaming_tuples:
        if t not in streaming_seen:
            streaming_uniq.append(t)
            streaming_seen.add(t)
    payload["streaming_availability"] = [f"{svc}_{cc}" for (svc, cc) in streaming_uniq]

    # --- DNA (vectors + payload enrichments)
    vectors: Dict[str, List[float]] = {"fingerprint_v1": []}
    if dna:
        dna_root = dna.get("dna") or {}
        # suitability/context
        soc = dna_root.get("social_suitability") or {}
        ctx = dna_root.get("viewing_context") or {}
        for k in [
            "solo_watch",
            "date_night",
            "group_party",
            "family",
            "partner",
            "friends",
            "kids",
            "teens",
            "adults",
            "intergenerational",
            "public_viewing_safe",
        ]:
            payload[f"suitability_{k}"] = soc.get(k)
        for k in [
            "is_thought_provoking",
            "is_pure_escapism",
            "is_background_friendly",
            "is_comfort_watch",
            "is_binge_friendly",
            "is_drop_in_friendly",
        ]:
            payload[f"context_{k}"] = ctx.get(k)

        # is_anime, production_method
        payload["is_anime"] = dna_root.get("is_anime")
        prod = dna_root.get("production_info") or {}
        payload["production_method"] = prod.get("method")

        # essence text/tags not stored (kept in Crate), but that’s fine

        # fingerprintStructured + flat
        fp_scores = (dna_root.get("fingerprint") or {}).get("scores")
        if fp_scores:
            payload["fingerprint_scores_v1"] = fp_scores

        # vectors: both are built from the scores, so they can't disagree with each other
        # or with the payload. The stored vector_fingerprint only says the title has one;
        # it can be older than the scores. Without valid scores no vector is written.
        if dna.get("vector_fingerprint"):
            raw = _raw_fingerprint(fp_scores) if isinstance(fp_scores, dict) else None
            if raw:
                vectors["fingerprint_v1"] = raw
                vectors[FINGERPRINT_RAW_VECTOR] = raw

    # --- Tropes (optional tags list for payload filtering)
    if tropes and tropes.get("tropes"):
        payload["tropes"] = [t.get("name") for t in tropes["tropes"] if t.get("name")]

    return payload, vectors


# ---- Main copy loop --------------------------------------------------------


def _published_streaming(media_type: str, ids: List[int]) -> Dict[int, List[str]]:
    """Scheduled catch-up uses the same published country snapshot as priority."""
    connector = CrateConnector()
    try:
        table = "movie" if media_type == "movie" else "show"
        connector.run(f"REFRESH TABLE {table}")
        rows = connector.select(
            f"SELECT tmdb_id, streaming_availabilities FROM {table} WHERE tmdb_id = ANY(?)",
            (ids,),
        )
        return {
            row["tmdb_id"]: [f"{service}_{country}" for country, service in (
                combo.split("_", 1) for combo in row["streaming_availabilities"])]
            for row in rows if row.get("streaming_availabilities") is not None
        }
    finally:
        connector.disconnect()


def copy_to_qdrant(
    qc: QdrantConnector,
    media_type: str,  # "movie" | "show"
    query_selector: dict,
    *, recent_only: bool = True, strict_writes: bool = False,
    since: Optional[datetime] = None, carried_ids=(),
):
    """
    Combined copy into Qdrant.
    - a recent copy takes the titles whose drivers changed since `since`, by default in
      the last HOURS_TO_FETCH hours, and the `carried_ids` of an earlier run.
    - a title with a fingerprint is left out while Crate has no published streaming for
      it. The result lists those in `unknown_streaming_ids`.
    - only writes points **with vectors**: creates missing points and, for
      existing ones, replaces the fingerprint vectors and the payload. Vectors
      that other writers own stay untouched.
    - qc must use REQUEST_TIMEOUT_SECONDS as its transport timeout. Each retained
      write batch has a bounded retry budget within the publication lease margin.
    """
    is_movie = media_type == "movie"
    db = get_db()
    # collections
    if is_movie:
        c_details = TmdbMovieDetails._get_collection()
    else:
        c_details = TmdbTvDetails._get_collection()
    c_imdb = db.imdb_movie_rating if is_movie else db.imdb_tv_rating
    c_meta = db.metacritic_movie_rating if is_movie else db.metacritic_tv_rating
    c_rotten = (
        db.rotten_tomatoes_movie_rating if is_movie else db.rotten_tomatoes_tv_rating
    )
    c_prov = db.tmdb_movie_providers if is_movie else db.tmdb_tv_providers
    c_dna = db.dna_movie if is_movie else db.dna_tv
    c_tropes = db.tv_tropes_movie_tags if is_movie else db.tv_tropes_tv_tags

    updated = {"$gte": since or datetime.utcnow() - timedelta(hours=HOURS_TO_FETCH)}
    sel = dict(query_selector or {})

    drivers = _drivers(c_details, c_imdb, c_dna, c_tropes, recent_only=recent_only)
    # fingerprint_v1_raw may not exist in the collection yet; check once per media type.
    write_raw_fingerprint = FINGERPRINT_RAW_VECTOR in _collection_vector_names(qc.client)

    total_upserts = 0
    total_payload_updates = 0
    publication_stats: dict = {
        "batches": 0, "attempts": 0, "retries": 0, "errors": {},
    }

    processed = 0
    # Titles with a fingerprint that Crate has no published streaming for yet. They aren't written.
    unknown_streaming_ids: set = set()
    carried = set(carried_ids)
    carried_written = 0
    # Titles whose stored vector_fingerprint differs from their scores, and titles with a
    # stored one but no valid scores to build the vector from. The second kind isn't written.
    stale_stored_fingerprints = 0
    invalid_fingerprint_scores = 0
    # Titles deleted on TMDB: collected over the whole run, removed once at the end.
    flagged_ids: set = set()

    # Prefer compound hint if we filter by updated_at
    base_selector = {"updated_at": updated, **sel} if recent_only else sel
    use_compound_hint = "updated_at" in base_selector

    print(f"{_utc_stamp()} {media_type} copy starts: "
          f"{'changes since ' + updated['$gte'].isoformat() if recent_only else 'every title'}, "
          f"{len(carried)} carried ids", flush=True)
    for ids in _driver_batches(drivers, base_selector, use_compound_hint=use_compound_hint, carried_ids=carried):
        processed += len(ids)
        print(f"\n{_utc_stamp()} {media_type} ids fetched: "
              f"{processed} (last_tmdb_id={ids[-1]})", flush=True)

        batch_flagged_ids = flagged_among(c_details, ids)
        flagged_ids |= batch_flagged_ids

        # fetch maps by id
        details_map = _fetch_map_by_ids(c_details, ids)
        imdb_map = _fetch_map_by_ids(c_imdb, ids)
        meta_map = _fetch_map_by_ids(c_meta, ids)
        rotten_map = _fetch_map_by_ids(c_rotten, ids)
        dna_map = _fetch_map_by_ids(c_dna, ids)
        # providers: need both “latest row” per id (to get updated_at) and all rows (for merging tuples)
        providers_multimap = _fetch_multimap_by_ids(c_prov, ids)
        tropes_map = _fetch_map_by_ids(c_tropes, ids)

        # build points
        upsert_buffer: List[Tuple[int, Dict[str, Any], Dict[str, List[float]]]] = []

        for tmdb_id in ids:
            d = details_map.get(tmdb_id)
            if not d or tmdb_id in batch_flagged_ids:
                # we still might have scores or providers, but no details: skip creating new points
                continue

            payload, vectors = _build_payload(
                media_type=media_type,
                tmdb_id=tmdb_id,
                details=d,
                imdb=imdb_map.get(tmdb_id),
                meta=meta_map.get(tmdb_id),
                rotten=rotten_map.get(tmdb_id),
                providers_from_tmdb=(d.get("watch_providers") or {}).get("results")
                if d
                else None,
                providers_all_rows=providers_multimap.get(tmdb_id, []),
                dna=dna_map.get(tmdb_id),
                tropes=tropes_map.get(tmdb_id),
            )

            have_vectors = bool(vectors["fingerprint_v1"])
            stored_fingerprint = (dna_map.get(tmdb_id) or {}).get("vector_fingerprint")
            if stored_fingerprint and not have_vectors:
                invalid_fingerprint_scores += 1
            elif stored_fingerprint and list(stored_fingerprint) != vectors["fingerprint_v1"]:
                stale_stored_fingerprints += 1
            if have_vectors:
                upsert_buffer.append((tmdb_id, payload, vectors))
            # else: skip this id quietly (no vectors yet)

        # Every writer reads the current aggregate and finishes its vector write
        # under the same title leases used by streaming reconciliation.
        for start in range(0, len(upsert_buffer), UPSERT_BATCH_SIZE):
            batch = upsert_buffer[start:start + UPSERT_BATCH_SIZE]
            with ExitStack() as leases:
                # A scheduled copy waits out the seconds-long leases of the streaming sync and
                # the priority publish; a targeted publish fails fast and is retried.
                lease_wait = 0 if strict_writes else SCHEDULED_LEASE_WAIT_SECONDS
                checks = [leases.enter_context(publication_lease(db, media_type, tmdb_id, lease_wait))
                          for tmdb_id, _, _ in sorted(batch, key=lambda item: item[0])]
                for check_owned in checks:
                    check_owned()
                published_streaming = _published_streaming(media_type, [item[0] for item in batch])
                points = []
                for tmdb_id, payload, vectors in batch:
                    # NULL/missing aggregates are unknown; only an explicit empty
                    # array is evidence that clearing existing availability is safe.
                    if tmdb_id not in published_streaming:
                        unknown_streaming_ids.add(tmdb_id)
                        continue
                    payload["streaming_availability"] = published_streaming[tmdb_id]
                    points.append(qm.PointStruct(
                        id=int(QdrantMediaPoint.make_point_id(media_type, tmdb_id)),
                        payload=payload, vector={
                            name: values for name, values in vectors.items()
                            if name != FINGERPRINT_RAW_VECTOR or write_raw_fingerprint
                        },
                    ))
                if not points:
                    continue
                def check_publication_owned() -> None:
                    for check_owned in checks:
                        check_owned()

                result = write_with_retry(
                    qc.client, MEDIA_COLLECTION,
                    insert_points(points) + update_points(points),
                    check_publication_owned,
                )
                publication_stats["batches"] += 1
                for field in ("attempts", "retries"):
                    publication_stats[field] += result[field]
                for classification, count in result["errors"].items():
                    error_counts = publication_stats["errors"]
                    error_counts[classification] = (
                        error_counts.get(classification, 0) + count
                    )
                total_upserts += len(points)
                carried_written += sum(1 for point in points if point.payload["tmdb_id"] in carried)

    print(f"{_utc_stamp()} {media_type} copy done: {processed} selected, "
          f"{total_upserts} written, {len(unknown_streaming_ids)} without published streaming; "
          f"deletion starts", flush=True)
    # Every flagged title is checked, not only the ones this run iterated over, oldest flag
    # first within the per-run budget, and nothing while the flags spike.
    spike = flag_spike(c_details, db.tmdb_daily_dump_data, media_type)
    oldest_first = flagged_oldest_first(c_details, sel)
    deleted_titles = delete_titles_from_qdrant(
        qc.client, MEDIA_COLLECTION, media_type, oldest_first + sorted(flagged_ids - set(oldest_first)),
        QdrantMediaPoint.make_point_id, spike=spike,
    )

    print(f"{_utc_stamp()} {media_type} deletion done", flush=True)

    return {"selected": processed, "upserts": total_upserts, "payload_updates": total_payload_updates,
            "skipped_unknown_streaming": len(unknown_streaming_ids),
            "unknown_streaming_ids": sorted(unknown_streaming_ids),
            "carried": len(carried), "carried_written": carried_written,
            "stale_stored_fingerprints": stale_stored_fingerprints,
            "invalid_fingerprint_scores": invalid_fingerprint_scores,
            "publication": publication_stats, "deleted_titles": deleted_titles}


# ---- Entrypoint for Windmill ----------------------------------------------


def main(
    movie_ids: Optional[List[str]] = None,
    show_ids: Optional[List[str]] = None,
):
    """Publish the fingerprints changed since the last successful run, optionally restricting
    each media type to IDs."""
    def _id_selector(ids: Optional[List[str]]) -> dict:
        if not ids:
            return {}
        return {"tmdb_id": {"$in": [int(x) for x in ids]}}

    # Routine publication must not disable/rebuild the collection's live HNSW
    # graph. Only the isolated migration destination needs bulk-load tuning.
    with ExitStack() as stack:
        init_mongodb()
        stack.callback(close_mongodb)
        qc = QdrantConnector(timeout=REQUEST_TIMEOUT_SECONDS)
        stack.callback(qc.close)
        result = {}
        for key, media_type, ids in (("movies", "movie", movie_ids), ("shows", "show", show_ids)):
            # A media type restricted to ids doesn't cover every change, so it keeps the
            # fixed window and leaves the sync state alone.
            selection = None if ids else sync_state.begin(get_db(), SYNC_JOB, media_type)
            result[key] = copy_to_qdrant(
                qc, media_type, _id_selector(ids), since=selection.since if selection else None,
                carried_ids=selection.carried_ids if selection else ())
            # The ids stay out of the job result; their number is skipped_unknown_streaming.
            unknown_streaming_ids = result[key].pop("unknown_streaming_ids")
            if selection:
                # Reached only when the whole media type succeeded: a failure raises above.
                # The titles left out for their streaming are carried to the next run, which
                # no driver would make select them again. A carried title that was written,
                # lost its fingerprint or was deleted on TMDB is not among them any more.
                sync_state.commit(get_db(), selection, {
                    count: result[key][count]
                    for count in ("selected", "upserts", "skipped_unknown_streaming", "carried", "carried_written")
                }, carried_ids=unknown_streaming_ids)
                result[key]["selection"] = selection.report()
    if not movie_ids and not show_ids:
        result["title_snapshot"] = _start_title_snapshot()
    return result


def _start_title_snapshot() -> str:
    """Starts the title snapshot publisher after a scheduled copy; it publishes only when a title
    analysis changed. Failing to start it doesn't fail the copy: the nightly run catches up."""
    import wmill

    try:
        return wmill.run_script_by_path_async(path=TITLE_SNAPSHOT_SCRIPT, args={})
    except Exception as error:
        print(f"Could not start {TITLE_SNAPSHOT_SCRIPT}: {error}", flush=True)
        return f"not started: {error}"
