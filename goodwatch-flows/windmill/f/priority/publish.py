# extra_requirements:
# qdrant-client==1.15.1

"""Publish only the TMDB titles just crawled, using the scheduled sync transformations."""

from f.db.cratedb import CrateConnector
from f.db.mongodb import close_mongodb, init_mongodb
from f.db.qdrant import QdrantConnector
from f.sync.copy.dna_data import copy_media as copy_dna
from f.sync.copy.vector_data import copy_to_qdrant
from f.sync.copy.all_ratings import copy_media as copy_ratings
from f.sync.copy.tmdb_details import copy_media as copy_details
from f.sync.copy.tmdb_streaming import copy_media as copy_streaming
from f.sync.copy.tvtropes import copy_media as copy_tvtropes


def normalize_ids(values: list) -> list[int]:
    normalized = []
    for value in values:
        if isinstance(value, bool) or not str(value).isascii() or not str(value).isdigit():
            raise ValueError(f"Invalid TMDB ID: {value!r}")
        tmdb_id = int(value)
        if tmdb_id <= 0:
            raise ValueError(f"Invalid TMDB ID: {value!r}")
        if tmdb_id not in normalized:
            normalized.append(tmdb_id)
    return normalized


def main(next_ids: dict):
    # These are TMDB IDs, never Mongo ObjectIDs: each source has different _ids.
    targets = {
        "movie": normalize_ids(next_ids.get("movie_ids", [])),
        "show": normalize_ids(next_ids.get("tv_ids", [])),
    }
    if not any(targets.values()):
        return {}

    init_mongodb()
    connector = None
    qdrant = None
    try:
        connector = CrateConnector()
        qdrant = QdrantConnector(timeout=180)
        results = {}
        for media_type, ids in targets.items():
            if not ids:
                continue
            selector = {"tmdb_id": {"$in": ids}}
            results[media_type] = {}
            # Details first creates the base rows; subsequent partial upserts enrich them.
            for name, sync in (
                ("details", copy_details),
                ("ratings", copy_ratings),
                ("streaming", copy_streaming),
                ("tvtropes", copy_tvtropes),
                ("dna", copy_dna),
            ):
                query = selector | ({"tropes": {"$ne": None}} if name == "tvtropes" else {})
                if name == "dna":
                    # Failed/incomplete DNA generation must not erase existing data.
                    query |= {"dna": {"$ne": None}, "vector_fingerprint": {"$ne": None}}
                result = sync(
                    connector=connector,
                    query_selector=query,
                    media_type=media_type,
                    recent_only=False,
                )
                results[media_type][name] = result
                if name == "details":
                    count = result.get("movies" if media_type == "movie" else "shows", {}).get("rows_upserted", 0)
                    if count != len(ids):
                        raise RuntimeError(f"Published {count} of {len(ids)} requested {media_type} details")
            # Rebuild vector payloads after all source crawlers finish. Titles without
            # existing vectors are skipped by the shared transformation.
            results[media_type]["vectors"] = copy_to_qdrant(
                qdrant, media_type, selector, recent_only=False, strict_writes=True,
            )
        return results
    finally:
        try:
            if connector is not None:
                connector.disconnect()
        finally:
            try:
                if qdrant is not None:
                    qdrant.close()
            finally:
                close_mongodb()
