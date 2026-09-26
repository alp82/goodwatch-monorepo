"""Delete-on-sync for titles that are gone: flagged tmdb_deleted in Mongo, or missing from Mongo."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Iterable

# Raw pymongo filters on tmdb_movie_details / tmdb_tv_details.
# A missing field counts as not deleted.
NOT_DELETED_FILTER = {"tmdb_deleted": {"$ne": True}}
FLAGGED_FILTER = {"tmdb_deleted": True}

# Per-run budget: a run deletes the rows of at most this many titles per media type,
# oldest flag first, so a backlog drains over several runs instead of blocking deletion.
# Above the real inflow of any 12 h before the sweep of long-stale titles that started
# on 2026-09-25 (#184), and under 1 % of the movie catalog.
MAX_DELETED_TITLES_PER_RUN = 10_000
DELETE_BATCH_SIZE = 500

# Spike guard, the signature of an upstream bug: titles flagged in the last
# FLAG_SPIKE_WINDOW that TMDB's daily export still listed at most EXPORT_LISTING_WINDOW
# before the flag. A title TMDB really removed drops out of the export; a live title
# that a bug flags doesn't. Real history up to 2026-09-26: at most 105 movies and 5
# shows per 24 h (#184), while the fetcher refreshes about 10,000 movies an hour.
FLAG_SPIKE_WINDOW = timedelta(hours=24)
EXPORT_LISTING_WINDOW = timedelta(hours=36)
MAX_LISTED_NEW_FLAGS = 500
# Titles missing from Mongo have no flag time. After the #165 repair there were none,
# so more than this many means the Mongo reads are broken, not that titles are gone.
MAX_ORPHANED_TITLES = 1000

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
# The columns that tell a title's rows apart within a table, after the title's
# (media_tmdb_id, media_type). Together they form the table's primary key.
ROW_KEY_COLUMNS = {
    "media_image": ("image_type", "url_path", "language_code"),
    "media_video": ("tmdb_id",),
    "trope": ("name",),
    "alternative_title": ("country_code",),
    "translation": ("language_code", "country_code"),
    "release_event": ("country_code", "release_date", "release_type", "certification"),
    "person_appeared_in": ("person_tmdb_id", "credit_id"),
    "person_worked_on": ("person_tmdb_id", "credit_id"),
    "streaming_evidence": ("country_code",),
}
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
    # Columns that tell one title's rows apart; empty where rows are not addressed singly.
    key_columns: tuple[str, ...] = ()

    @property
    def primary_key(self) -> tuple[str, ...]:
        """The columns that address a single row: the title scope, then the row key."""
        return (self.id_column, *(("media_type",) if self.media_type_column else ()), *self.key_columns)

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
    *(TitleTable(table, "media_tmdb_id", key_columns=ROW_KEY_COLUMNS.get(table, ())) for table in TITLE_KEYED_TABLES),
    TitleTable("season", "show_id", media_types=("show",), media_type_column=False),
)
MEDIA_TITLE_TABLES = {
    media_type: TitleTable(table, "tmdb_id", media_types=(media_type,), media_type_column=False)
    for media_type, table in MEDIA_TABLES.items()
}


def normalize_tmdb_ids(tmdb_ids: Iterable) -> list[int]:
    return sorted({int(tmdb_id) for tmdb_id in tmdb_ids})


def ordered_tmdb_ids(tmdb_ids: Iterable) -> list[int]:
    """The ids as ints without duplicates, in the given order."""
    return list(dict.fromkeys(int(tmdb_id) for tmdb_id in tmdb_ids))


def find_flagged_tmdb_ids(details_collection: Any, selector: dict | None = None) -> list[int]:
    """Flagged titles matching the caller's selector (id selector and/or updated_at window)."""
    cursor = details_collection.find((selector or {}) | FLAGGED_FILTER, {"tmdb_id": 1, "_id": 0})
    return normalize_tmdb_ids(doc["tmdb_id"] for doc in cursor)


def flagged_oldest_first(details_collection: Any, selector: dict | None = None) -> list[int]:
    """Flagged titles matching the selector, oldest flag first; a missing flag time counts as oldest."""
    cursor = details_collection.find((selector or {}) | FLAGGED_FILTER, {"tmdb_id": 1, "tmdb_deleted_at": 1, "_id": 0})
    flags = sorted((doc.get("tmdb_deleted_at") or datetime.min, int(doc["tmdb_id"])) for doc in cursor)
    return ordered_tmdb_ids(tmdb_id for _, tmdb_id in flags)


def flag_spike(details_collection: Any, daily_dump_collection: Any, media_type: str,
               now: datetime | None = None) -> dict:
    """Whether the recent flags look like an upstream bug rather than titles TMDB removed.

    Counts the titles flagged in the last FLAG_SPIKE_WINDOW whose TMDB daily export entry
    was written at most EXPORT_LISTING_WINDOW before the flag, and trips above
    MAX_LISTED_NEW_FLAGS. While it trips, callers delete nothing of this media type.
    """
    since = (now or datetime.utcnow()) - FLAG_SPIKE_WINDOW
    flagged_at = {
        int(doc["tmdb_id"]): doc["tmdb_deleted_at"]
        for doc in details_collection.find(FLAGGED_FILTER | {"tmdb_deleted_at": {"$gte": since}},
                                           {"tmdb_id": 1, "tmdb_deleted_at": 1, "_id": 0})
    }
    ids = sorted(flagged_at)
    listed = set()
    for i in range(0, len(ids), MONGO_LOOKUP_BATCH_SIZE):
        batch = ids[i:i + MONGO_LOOKUP_BATCH_SIZE]
        selector = {"type": DAILY_DUMP_TYPES[media_type], "tmdb_id": {"$in": batch + [str(tmdb_id) for tmdb_id in batch]}}
        for entry in daily_dump_collection.find(selector, {"tmdb_id": 1, "updated_at": 1, "_id": 0}):
            tmdb_id = int(entry["tmdb_id"])
            written_at = entry.get("updated_at")
            if written_at and written_at >= flagged_at[tmdb_id] - EXPORT_LISTING_WINDOW:
                listed.add(tmdb_id)
    window_hours = FLAG_SPIKE_WINDOW.total_seconds() / 3600
    spike = {"new_flags": len(ids), "listed_new_flags": len(listed), "threshold": MAX_LISTED_NEW_FLAGS,
             "window_hours": window_hours, "tripped": len(listed) > MAX_LISTED_NEW_FLAGS}
    if spike["tripped"]:
        print(
            f"!!! FLAG SPIKE: {len(listed)} of the {len(ids)} {media_type} titles flagged tmdb_deleted in the "
            f"last {window_hours:g} h were still in a TMDB daily export shortly before the flag (threshold "
            f"MAX_LISTED_NEW_FLAGS={MAX_LISTED_NEW_FLAGS}). Deleting no {media_type} titles until the flags "
            f"are checked. Examples: {sorted(listed)[:20]}",
            flush=True,
        )
    return spike


def refuse_on_spike(media_type: str, store: str, spike: dict, result: dict) -> bool:
    result["spike"] = spike
    if not spike["tripped"]:
        return False
    print(f"!!! REFUSING to delete {media_type} titles from {store}: flag spike, see above.", flush=True)
    result["refused_spike"] = True
    return True


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


def title_table(media_type: str, name: str) -> TitleTable:
    """The table `name` as a table of this media type's titles."""
    for table in title_tables(media_type):
        if table.name == name:
            return table
    raise ValueError(f"not a {media_type} title table: {name}")


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




def restrict_plan(plan: dict[str, list[int]], tmdb_ids: Iterable) -> dict[str, list[int]]:
    keep = set(tmdb_ids)
    restricted = {table: [tmdb_id for tmdb_id in ids if tmdb_id in keep] for table, ids in plan.items()}
    return {table: ids for table, ids in restricted.items() if ids}


def plan_within_budget(connector: Any, media_type: str, ordered_ids: list[int]) -> tuple[dict[str, list[int]], bool]:
    """The rows of the first MAX_DELETED_TITLES_PER_RUN titles in `ordered_ids` that still have rows.

    Plans chunk by chunk and stops once the budget is full, so a large flagged set costs
    no more than the chunks needed. Also returns whether titles may be left for later runs.
    """
    plan: dict[str, list[int]] = {}
    taken = 0
    for start in range(0, len(ordered_ids), DELETE_BATCH_SIZE):
        chunk = ordered_ids[start:start + DELETE_BATCH_SIZE]
        chunk_plan = plan_flagged_title_rows(connector, media_type, chunk)
        with_rows = set(planned_titles(chunk_plan))
        candidates = [tmdb_id for tmdb_id in chunk if tmdb_id in with_rows]
        chosen = candidates[:MAX_DELETED_TITLES_PER_RUN - taken]
        for table, ids in restrict_plan(chunk_plan, chosen).items():
            plan.setdefault(table, []).extend(ids)
        taken += len(chosen)
        if taken >= MAX_DELETED_TITLES_PER_RUN:
            more_left = len(candidates) > len(chosen) or start + DELETE_BATCH_SIZE < len(ordered_ids)
            return plan, more_left
    return plan, False


def apply_plan(connector: Any, media_type: str, plan: dict[str, list[int]], result: dict, reason: str) -> dict:
    """Delete a plan that already fits the budget and passed the guard."""
    titles = planned_titles(plan)
    result["titles_planned"] = len(titles)
    if result.get("budget_reached"):
        print(
            f"Budget: deleting the rows of {len(titles)} {media_type} titles ({reason}) in this run, "
            f"MAX_DELETED_TITLES_PER_RUN={MAX_DELETED_TITLES_PER_RUN}. The rest follow in later runs.",
            flush=True,
        )
    if not titles:
        return result
    result["rows_deleted"] = delete_title_rows(connector, media_type, plan)
    result["titles_deleted"] = result["rows_deleted"].get(MEDIA_TABLES[media_type], 0)
    print(
        f"Deleted the rows of {len(titles)} {media_type} titles ({reason}), "
        f"{result['titles_deleted']} of them with a title row, from CrateDB: {result['rows_deleted']}",
        flush=True,
    )
    return result


def delete_titles_from_crate(connector: Any, media_type: str, tmdb_ids: Iterable, *, spike: dict) -> dict:
    """Remove flagged titles and all their derived rows from CrateDB, scoped by media type.

    Only ever driven by an explicit id list, in deletion order (oldest flag first, see
    flagged_oldest_first). A title whose title row is already gone still loses its child
    rows. A run deletes at most MAX_DELETED_TITLES_PER_RUN titles that still have rows,
    and nothing while `spike` (see flag_spike) trips.
    """
    if media_type not in MEDIA_TABLES:
        raise ValueError(f"unknown media_type: {media_type}")
    ids = ordered_tmdb_ids(tmdb_ids)
    result = {"titles_flagged": len(ids), "titles_planned": 0, "titles_deleted": 0, "rows_deleted": {},
              "budget_reached": False, "refused_spike": False}
    if not ids or refuse_on_spike(media_type, "CrateDB", spike, result):
        return result
    plan, result["budget_reached"] = plan_within_budget(connector, media_type, ids)
    return apply_plan(connector, media_type, plan, result, "tmdb_deleted flags")


def delete_flagged_titles_from_crate(connector: Any, media_type: str, details_collection: Any,
                                     daily_dump_collection: Any, selector: dict | None = None) -> dict:
    """The details copy's deletion step: guard, then the flagged titles oldest first."""
    spike = flag_spike(details_collection, daily_dump_collection, media_type)
    flagged_ids = flagged_oldest_first(details_collection, selector)
    return delete_titles_from_crate(connector, media_type, flagged_ids, spike=spike)


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
    """Delete the Crate rows of titles that are missing from Mongo, lowest tmdb_id first.

    Refuses everything when more than MAX_ORPHANED_TITLES titles look orphaned, and
    deletes at most MAX_DELETED_TITLES_PER_RUN titles per run.
    """
    if media_type not in MEDIA_TABLES:
        raise ValueError(f"unknown media_type: {media_type}")
    plan = plan_orphaned_title_rows(connector, media_type, details_collection, daily_dump_collection)
    orphans = planned_titles(plan)
    result = {"titles_with_rows": len(orphans), "titles_planned": 0, "titles_deleted": 0, "rows_deleted": {},
              "budget_reached": len(orphans) > MAX_DELETED_TITLES_PER_RUN, "refused_spike": False,
              "titles_by_table": {table: len(ids) for table, ids in plan.items()}}
    if dry_run:
        return result | {"plan": plan}
    if len(orphans) > MAX_ORPHANED_TITLES:
        print(
            f"!!! REFUSING to delete {len(orphans)} {media_type} titles missing from Mongo from CrateDB: more than "
            f"MAX_ORPHANED_TITLES={MAX_ORPHANED_TITLES}. Check the Mongo details and daily dump reads first.",
            flush=True,
        )
        result["refused_spike"] = True
        return result
    plan = restrict_plan(plan, orphans[:MAX_DELETED_TITLES_PER_RUN])
    return apply_plan(connector, media_type, plan, result, "titles missing from Mongo")


def delete_titles_from_qdrant(client: Any, collection: str, media_type: str, tmdb_ids: Iterable, make_point_id,
                              *, spike: dict) -> dict:
    """Remove the points of flagged titles, addressed by the same point ids the upsert uses.

    `tmdb_ids` is in deletion order (oldest flag first). A run deletes at most
    MAX_DELETED_TITLES_PER_RUN points that still exist, and nothing while `spike` trips.
    """
    ids = ordered_tmdb_ids(tmdb_ids)
    result = {"titles_flagged": len(ids), "points_requested": 0, "budget_reached": False, "refused_spike": False}
    if not ids or refuse_on_spike(media_type, "Qdrant", spike, result):
        return result
    # Flagged titles are checked in order until the budget is full; only points that still exist are deleted.
    ordered_points = [int(make_point_id(media_type, tmdb_id)) for tmdb_id in ids]
    point_ids = []
    for start in range(0, len(ordered_points), DELETE_BATCH_SIZE):
        batch = ordered_points[start:start + DELETE_BATCH_SIZE]
        records = client.retrieve(collection_name=collection, ids=batch, with_payload=False, with_vectors=False)
        existing = {int(record.id) for record in records}
        point_ids.extend(point_id for point_id in batch if point_id in existing)
        if len(point_ids) >= MAX_DELETED_TITLES_PER_RUN:
            result["budget_reached"] = len(point_ids) > MAX_DELETED_TITLES_PER_RUN or start + DELETE_BATCH_SIZE < len(ordered_points)
            point_ids = point_ids[:MAX_DELETED_TITLES_PER_RUN]
            break
    for batch in batches(point_ids):
        client.delete(collection_name=collection, points_selector=batch, wait=True)
        result["points_requested"] += len(batch)
    if point_ids:
        print(f"Requested deletion of {result['points_requested']} {media_type} points from {collection}", flush=True)
    return result


def main() -> None:
    """Shared importable delete-on-sync helper; no standalone input."""
