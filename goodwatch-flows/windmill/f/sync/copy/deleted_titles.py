"""Delete-on-sync for titles that TMDB permanently removed (tmdb_deleted in Mongo)."""

from typing import Any, Iterable

# Raw pymongo filters on tmdb_movie_details / tmdb_tv_details.
# A missing field counts as not deleted.
NOT_DELETED_FILTER = {"tmdb_deleted": {"$ne": True}}
FLAGGED_FILTER = {"tmdb_deleted": True}

# Safety net: an upstream bug must not be able to wipe the catalog.
MAX_DELETED_TITLES_PER_RUN = 1000
DELETE_BATCH_SIZE = 500

# Derived tables keyed by (media_tmdb_id, media_type). User-owned tables
# (user_score, user_wishlist, ...) are intentionally not listed.
TITLE_KEYED_TABLES = (
    "media_image",
    "media_video",
    "trope",
    "alternative_title",
    "translation",
    "release_event",
    "person_appeared_in",
    "person_worked_on",
    "streaming_evidence",
    "streaming_availability",
)
MEDIA_TABLES = {"movie": "movie", "show": "show"}


def normalize_tmdb_ids(tmdb_ids: Iterable) -> list[int]:
    return sorted({int(tmdb_id) for tmdb_id in tmdb_ids})


def find_flagged_tmdb_ids(details_collection: Any, selector: dict | None = None) -> list[int]:
    """Flagged titles matching the caller's selector (id selector and/or updated_at window)."""
    cursor = details_collection.find((selector or {}) | FLAGGED_FILTER, {"tmdb_id": 1, "_id": 0})
    return normalize_tmdb_ids(doc["tmdb_id"] for doc in cursor)


def flagged_among(details_collection: Any, tmdb_ids: Iterable) -> set[int]:
    """Cheap per-batch guard for flows that are driven by a non-details collection."""
    ids = normalize_tmdb_ids(tmdb_ids)
    if not ids:
        return set()
    return set(find_flagged_tmdb_ids(details_collection, {"tmdb_id": {"$in": ids}}))


def batches(ids: list[int]):
    for i in range(0, len(ids), DELETE_BATCH_SIZE):
        yield ids[i:i + DELETE_BATCH_SIZE]


def titles_present_in_crate(connector: Any, media_type: str, ids: list[int]) -> list[int]:
    """Flagged titles that still have a title row; all flagged titles are checked on every run."""
    media_table = MEDIA_TABLES[media_type]
    present = []
    for batch in batches(ids):
        rows = connector.select(f"SELECT tmdb_id FROM {media_table} WHERE tmdb_id = ANY(?)", (batch,))
        present.extend(int(row["tmdb_id"]) for row in rows)
    return sorted(present)


def exceeds_delete_cap(media_type: str, ids: list[int], store: str) -> bool:
    if len(ids) <= MAX_DELETED_TITLES_PER_RUN:
        return False
    print(
        f"!!! REFUSING to delete {len(ids)} {media_type} titles from {store}: more than "
        f"MAX_DELETED_TITLES_PER_RUN={MAX_DELETED_TITLES_PER_RUN}. Check the tmdb_deleted "
        f"flags in Mongo before deleting manually.",
        flush=True,
    )
    return True


def delete_titles_from_crate(connector: Any, media_type: str, tmdb_ids: Iterable) -> dict:
    """Remove titles and all their derived rows from CrateDB, scoped by media type.

    Only ever driven by an explicit id list; movie and show tmdb_ids collide.
    """
    if media_type not in MEDIA_TABLES:
        raise ValueError(f"unknown media_type: {media_type}")
    ids = normalize_tmdb_ids(tmdb_ids)
    result = {"titles_flagged": len(ids), "titles_deleted": 0, "rows_deleted": {}, "skipped_over_cap": False}
    if not ids:
        return result
    # The flagged set only grows, so the deletes and the cap apply to what is still published.
    ids = titles_present_in_crate(connector, media_type, ids)
    if not ids:
        return result
    if exceeds_delete_cap(media_type, ids, "CrateDB"):
        result["skipped_over_cap"] = True
        return result

    # Children first, the title row last: an interrupted run leaves the title
    # flagged and visible to the next run instead of orphaning derived rows.
    statements = [
        (table, f"DELETE FROM {table} WHERE media_type = ? AND media_tmdb_id = ANY(?)", True)
        for table in TITLE_KEYED_TABLES
    ]
    if media_type == "show":
        statements.append(("season", "DELETE FROM season WHERE show_id = ANY(?)", False))
    media_table = MEDIA_TABLES[media_type]
    statements.append((media_table, f"DELETE FROM {media_table} WHERE tmdb_id = ANY(?)", False))

    for table, sql, with_media_type in statements:
        deleted = 0
        for batch in batches(ids):
            connector.run(sql, (media_type, batch) if with_media_type else (batch,))
            deleted += max(connector.cur.rowcount or 0, 0)
        connector.run(f"REFRESH TABLE {table}")
        result["rows_deleted"][table] = deleted

    result["titles_deleted"] = result["rows_deleted"][media_table]
    print(
        f"Deleted {result['titles_deleted']} of {len(ids)} flagged {media_type} titles "
        f"from CrateDB: {result['rows_deleted']}",
        flush=True,
    )
    return result


def delete_titles_from_qdrant(client: Any, collection: str, media_type: str, tmdb_ids: Iterable, make_point_id) -> dict:
    """Remove the points of flagged titles, addressed by the same point ids the upsert uses."""
    ids = normalize_tmdb_ids(tmdb_ids)
    result = {"titles_flagged": len(ids), "points_requested": 0, "skipped_over_cap": False}
    if not ids:
        return result
    # All flagged titles are checked on every run; only points that still exist are deleted.
    point_ids = []
    for batch in batches([int(make_point_id(media_type, tmdb_id)) for tmdb_id in ids]):
        records = client.retrieve(collection_name=collection, ids=batch, with_payload=False, with_vectors=False)
        point_ids.extend(int(record.id) for record in records)
    if not point_ids:
        return result
    if exceeds_delete_cap(media_type, point_ids, "Qdrant"):
        result["skipped_over_cap"] = True
        return result
    for batch in batches(point_ids):
        client.delete(collection_name=collection, points_selector=batch, wait=True)
        result["points_requested"] += len(batch)
    print(f"Requested deletion of {result['points_requested']} {media_type} points from {collection}", flush=True)
    return result


def main() -> None:
    """Shared importable delete-on-sync helper; no standalone input."""
