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
from f.sync.models.qdrant_schemas import MEDIA_COLLECTION
from f.sync.models.qdrant_models import QdrantMediaPoint
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails

# Tunables
BATCH_SIZE = 2000  # ids per loop
UPSERT_BATCH_SIZE = 1000  # qdrant upsert chunk
HOURS_TO_FETCH = 24 * 2  # time window for "recent" updates

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


# ---- Mongo fetchers --------------------------------------------------------


def _fetch_tmdb_ids_keyset(
    collection,
    base_selector: dict,
    last_tmdb_id: Optional[int],
    limit: int,
    *,
    overfetch_factor: int = 3,
    use_compound_hint: bool = False,  # kept for compatibility; we'll auto-detect anyway
) -> Tuple[List[int], Optional[int]]:
    """
    Keyset pagination over an index to fetch distinct tmdb_id quickly.

    Prefers {updated_at:1, tmdb_id:1} if it exists (best for filtering by updated_at
    + sorting by tmdb_id). Falls back to {tmdb_id:1}. If neither exists, runs without hint.

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
        if can_hint_compound:
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
    vectors: Dict[str, List[float]] = {"essence_text_v1": [], "fingerprint_v1": []}
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

        # vectors
        v_ess = dna.get("vector_essence_text")
        v_fp = dna.get("vector_fingerprint")
        if v_ess and v_fp:
            vectors["essence_text_v1"] = v_ess
            vectors["fingerprint_v1"] = v_fp

    # --- Tropes (optional tags list for payload filtering)
    if tropes and tropes.get("tropes"):
        payload["tropes"] = [t.get("name") for t in tropes["tropes"] if t.get("name")]

    return payload, vectors


# ---- Main copy loop --------------------------------------------------------


def copy_to_qdrant(
    qc: QdrantConnector,
    media_type: str,  # "movie" | "show"
    query_selector: dict,
):
    """
    Combined copy into Qdrant.
    - only upserts points **with vectors** (to create/refresh fully).
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

    updated = {"$gte": datetime.utcnow() - timedelta(hours=HOURS_TO_FETCH)}
    sel = dict(query_selector or {})

    # Driver: details (typically largest / frequently updated)
    driver_collection = c_details

    total_upserts = 0
    total_payload_updates = 0

    last_tmdb_id: Optional[int] = None
    processed = 0

    # Prefer compound hint if we filter by updated_at
    base_selector = {"updated_at": updated, **sel}
    use_compound_hint = "updated_at" in base_selector

    while True:
        ids, last_tmdb_id = _fetch_tmdb_ids_keyset(
            driver_collection,
            base_selector=base_selector,
            last_tmdb_id=last_tmdb_id,
            limit=BATCH_SIZE,
            overfetch_factor=3,
            use_compound_hint=use_compound_hint,
        )
        if not ids:
            break

        processed += len(ids)
        print(f"\n{media_type} ids fetched: {processed} (last_tmdb_id={last_tmdb_id})")

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
        upsert_buffer: List[Tuple[str, Dict[str, Any], Dict[str, List[float]]]] = []

        for tmdb_id in ids:
            d = details_map.get(tmdb_id)
            if not d:
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

            pid = QdrantMediaPoint.make_point_id(media_type, tmdb_id)

            have_vectors = bool(vectors["essence_text_v1"]) and bool(
                vectors["fingerprint_v1"]
            )
            if have_vectors:
                upsert_buffer.append((pid, payload, vectors))
            # else: skip this id quietly (no vectors yet)

        if upsert_buffer:
            print(f"{media_type} start upload for {len(upsert_buffer)} points")
            qc.upsert_points(
                MEDIA_COLLECTION,
                upsert_buffer,  # List[Tuple[int, payload_dict, vectors_dict]]
                batch_size=UPSERT_BATCH_SIZE,
                parallel=1,
                wait=True,
            )
            total_upserts += len(upsert_buffer)
            upsert_buffer.clear()

    return {"upserts": total_upserts, "payload_updates": total_payload_updates}


# ---- Entrypoint for Windmill ----------------------------------------------


def main(
    movie_ids: List[str] = None,
    show_ids: List[str] = None,
):
    """
    - If you pass IDs, we'll restrict to those (across recent window).
    - payload_only=True -> update payloads even if vectors are missing.
    """
    movie_ids = movie_ids or []
    show_ids = show_ids or []

    init_mongodb()
    qc = QdrantConnector()

    # disable index building entirely
    # vectors will be stored, but not indexed until enabled after the copy process
    qc.client.update_collection(
        collection_name=MEDIA_COLLECTION,
        hnsw_config=qm.HnswConfigDiff(
            m=0,
        ),
    )

    def _id_selector(ids: List[str]) -> dict:
        if not ids:
            return {}
        # your build_query_selector_for_object_ids logic inlined:
        return {"tmdb_id": {"$in": [int(x) for x in ids]}}

    res = {}
    if movie_ids is not None:
        print("Copying MOVIES to Qdrant…")
        res["movies"] = copy_to_qdrant(qc, "movie", _id_selector(movie_ids))
    if show_ids is not None:
        print("Copying SHOWS to Qdrant…")
        res["shows"] = copy_to_qdrant(qc, "show", _id_selector(show_ids))

    # re-enable index building
    qc.client.update_collection(
        collection_name=MEDIA_COLLECTION,
        hnsw_config=qm.HnswConfigDiff(
            m=16,
        ),
    )

    qc.close()
    close_mongodb()

    return res
