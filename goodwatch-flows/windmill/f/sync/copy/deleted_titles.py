"""Delete-on-sync for titles that are gone: flagged tmdb_deleted in Mongo, or missing from Mongo."""

from dataclasses import dataclass
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
# How the TMDB daily dump names each media type.
DAILY_DUMP_TYPES = {"movie": "movie", "show": "tv"}
# Full-table DISTINCT scans are bounded explicitly; a truncated scan only sweeps less.
MAX_SCANNED_TITLES = 10_000_000
MONGO_LOOKUP_BATCH_SIZE = 10_000


@dataclass(frozen=True)
class TitleTable:
    """A Crate table whose rows belong to a title, and how a statement scopes them to titles.

    Movie and show tmdb_ids collide, so every scope includes the media type: through a
    media_type column, or through a table that only holds rows of one media type.
    """

    name: str
    id_column: str
    media_types: tuple[str, ...] = ("movie", "show")
    media_type_column: bool = True

    def scope(self, media_type: str, with_ids: bool = True) -> str:
        if media_type not in self.media_types:
            raise ValueError(f"{self.name} holds no {media_type} rows")
        conditions = ["media_type = ?"] if self.media_type_column else []
        if with_ids:
            conditions.append(f"{self.id_column} = ANY(?)")
        return " AND ".join(conditions)

    def params(self, media_type: str, *rest) -> tuple:
        return (media_type, *rest) if self.media_type_column else tuple(rest)


# In delete order: children first, the title row last, so an interrupted run leaves
# the title visible to the next run instead of orphaning its rows.
CHILD_TABLES = (
    *(TitleTable(table, "media_tmdb_id") for table in TITLE_KEYED_TABLES),
    TitleTable("season", "show_id", media_types=("show",), media_type_column=False),
)
MEDIA_TITLE_TABLES = {
    media_type: TitleTable(table, "tmdb_id", media_types=(media_type,), media_type_column=False)
    for media_type, table in MEDIA_TABLES.items()
}


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


def title_tables(media_type: str) -> list[TitleTable]:
    """Every table holding rows of this media type's titles, in delete order."""
    if media_type not in MEDIA_TABLES:
        raise ValueError(f"unknown media_type: {media_type}")
    return [table for table in CHILD_TABLES if media_type in table.media_types] + [MEDIA_TITLE_TABLES[media_type]]


def titles_with_rows(connector: Any, table: TitleTable, media_type: str, ids: list[int] | None = None) -> list[int]:
    """The titles among `ids` (all titles, for None) that have at least one row in `table`."""
    select = f"SELECT DISTINCT {table.id_column} AS tmdb_id FROM {table.name}"
    if ids is None:
        where = table.scope(media_type, with_ids=False)
        sql = f"{select}{' WHERE ' + where if where else ''} LIMIT {MAX_SCANNED_TITLES}"
        return normalize_tmdb_ids(row["tmdb_id"] for row in connector.select(sql, table.params(media_type)))
    present = []
    for batch in batches(ids):
        rows = connector.select(f"{select} WHERE {table.scope(media_type)}", table.params(media_type, batch))
        present.extend(row["tmdb_id"] for row in rows)
    return normalize_tmdb_ids(present)


def plan_flagged_title_rows(connector: Any, media_type: str, tmdb_ids: Iterable) -> dict[str, list[int]]:
    """Per table, the given titles that still have rows there, whether or not their title row is left."""
    ids = normalize_tmdb_ids(tmdb_ids)
    if not ids:
        return {}
    plan = {table.name: titles_with_rows(connector, table, media_type, ids) for table in title_tables(media_type)}
    return {table: table_ids for table, table_ids in plan.items() if table_ids}


def planned_titles(plan: dict[str, list[int]]) -> list[int]:
    return normalize_tmdb_ids(tmdb_id for ids in plan.values() for tmdb_id in ids)


def delete_title_rows(connector: Any, media_type: str, plan: dict[str, list[int]]) -> dict[str, int]:
    """Delete the planned titles' rows table by table, children before title rows.

    `plan` maps a table name to the titles whose rows go; returns the rows deleted per table.
    """
    tables = {table.name: table for table in title_tables(media_type)}
    unknown = set(plan) - set(tables)
    if unknown:
        raise ValueError(f"not a {media_type} title table: {sorted(unknown)}")
    rows_deleted = {}
    for name, table in tables.items():
        ids = normalize_tmdb_ids(plan.get(name, ()))
        if not ids:
            continue
        deleted = 0
        for batch in batches(ids):
            connector.run(f"DELETE FROM {name} WHERE {table.scope(media_type)}", table.params(media_type, batch))
            deleted += max(connector.cur.rowcount or 0, 0)
        connector.run(f"REFRESH TABLE {name}")
        rows_deleted[name] = deleted
    return rows_deleted


def exceeds_delete_cap(media_type: str, ids: list[int], store: str, reason: str = "tmdb_deleted flags") -> bool:
    if len(ids) <= MAX_DELETED_TITLES_PER_RUN:
        return False
    print(
        f"!!! REFUSING to delete {len(ids)} {media_type} titles from {store}: more than "
        f"MAX_DELETED_TITLES_PER_RUN={MAX_DELETED_TITLES_PER_RUN}. Check the {reason} "
        f"in Mongo before deleting manually.",
        flush=True,
    )
    return True


def apply_plan(connector: Any, media_type: str, plan: dict[str, list[int]], result: dict, reason: str) -> dict:
    """Delete a plan unless it covers more titles than the cap allows."""
    titles = planned_titles(plan)
    result["titles_with_rows"] = len(titles)
    if not titles:
        return result
    if exceeds_delete_cap(media_type, titles, "CrateDB", reason):
        result["skipped_over_cap"] = True
        return result
    result["rows_deleted"] = delete_title_rows(connector, media_type, plan)
    result["titles_deleted"] = result["rows_deleted"].get(MEDIA_TABLES[media_type], 0)
    print(
        f"Deleted the rows of {len(titles)} {media_type} titles ({reason}), "
        f"{result['titles_deleted']} of them with a title row, from CrateDB: {result['rows_deleted']}",
        flush=True,
    )
    return result


def delete_titles_from_crate(connector: Any, media_type: str, tmdb_ids: Iterable) -> dict:
    """Remove flagged titles and all their derived rows from CrateDB, scoped by media type.

    Only ever driven by an explicit id list. A title whose title row is already gone
    still loses its child rows. The flagged set only grows, so the cap applies to the
    titles that still have rows.
    """
    if media_type not in MEDIA_TABLES:
        raise ValueError(f"unknown media_type: {media_type}")
    ids = normalize_tmdb_ids(tmdb_ids)
    result = {"titles_flagged": len(ids), "titles_with_rows": 0, "titles_deleted": 0,
              "rows_deleted": {}, "skipped_over_cap": False}
    plan = plan_flagged_title_rows(connector, media_type, ids)
    return apply_plan(connector, media_type, plan, result, "tmdb_deleted flags")


def ids_found(collection: Any, selector: dict, ids: list[int], *, as_strings: bool = False) -> set[int]:
    """The ids among `ids` that have a document matching `selector`."""
    found = set()
    for i in range(0, len(ids), MONGO_LOOKUP_BATCH_SIZE):
        batch = ids[i:i + MONGO_LOOKUP_BATCH_SIZE]
        values = batch + [str(tmdb_id) for tmdb_id in batch] if as_strings else batch
        for doc in collection.find(selector | {"tmdb_id": {"$in": values}}, {"tmdb_id": 1, "_id": 0}):
            found.add(int(doc["tmdb_id"]))
    return found


def plan_orphaned_title_rows(connector: Any, media_type: str, details_collection: Any,
                             daily_dump_collection: Any) -> dict[str, list[int]]:
    """Per table, the titles with rows there that are missing from Mongo.

    A title is missing from Mongo when it has no details document and the TMDB daily
    dump never listed it. Titles the dump lists but that are not fetched yet are kept
    (tmdb_daily publishes stub title rows for them), and so are rows of titles that have
    a details document but no title row, because the details copy owns them. Flagged
    titles have a details document, so they are left to delete_titles_from_crate.
    """
    rows_by_table = {table.name: titles_with_rows(connector, table, media_type) for table in title_tables(media_type)}
    candidates = normalize_tmdb_ids(tmdb_id for ids in rows_by_table.values() for tmdb_id in ids)
    missing = sorted(set(candidates) - ids_found(details_collection, {}, candidates))
    dump_selector = {"type": DAILY_DUMP_TYPES[media_type]}
    gone = set(missing) - ids_found(daily_dump_collection, dump_selector, missing, as_strings=True)
    plan = {table: sorted(gone.intersection(ids)) for table, ids in rows_by_table.items()}
    return {table: ids for table, ids in plan.items() if ids}


def sweep_orphaned_titles(connector: Any, media_type: str, details_collection: Any, daily_dump_collection: Any,
                          *, dry_run: bool = False) -> dict:
    """Delete every Crate row of titles that are missing from Mongo, capped like the flagged path."""
    if media_type not in MEDIA_TABLES:
        raise ValueError(f"unknown media_type: {media_type}")
    plan = plan_orphaned_title_rows(connector, media_type, details_collection, daily_dump_collection)
    result = {"titles_with_rows": len(planned_titles(plan)), "titles_deleted": 0, "rows_deleted": {},
              "skipped_over_cap": False, "titles_by_table": {table: len(ids) for table, ids in plan.items()}}
    if dry_run:
        return result | {"plan": plan}
    return apply_plan(connector, media_type, plan, result, "titles missing from Mongo")


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
