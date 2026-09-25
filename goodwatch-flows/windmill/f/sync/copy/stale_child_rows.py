"""Delete the Crate child rows of live titles that TMDB no longer lists (#166).

The details copy upserts a title's images, videos, alternative titles, translations,
release events and credits. After a batch's upserts, the rows of those titles whose
key the payload no longer lists are deleted, like stale seasons.

A missing list only counts as "TMDB lists none" when the payload is known to be
complete for that table (`listed_scopes`). Everything else keeps its rows.

Composite keys are compared in Python: the batch's existing keys are selected per
title, diffed against the keys the upsert just wrote, and the stale rows are deleted
by their full primary key. This keeps the comparison testable and lets every title
be verified first: if any key the upsert wrote is not found in Crate, the key
normalization is not trusted and that title keeps all its rows in that table.
"""

from collections import defaultdict
from typing import Any, Iterable

from f.sync.copy.deleted_titles import TitleTable, normalize_tmdb_ids, title_table

STALE_ROW_TABLES = (
    "media_image",
    "media_video",
    "alternative_title",
    "translation",
    "release_event",
    "person_appeared_in",
    "person_worked_on",
)
# Lists that only a full details payload makes authoritative: MongoEngine drops an
# empty top-level list, so "TMDB returned none" and "not fetched" look the same.
TOP_LEVEL_LIST_TABLES = ("media_video", "alternative_title", "translation")

STALE_ROW_TITLES_PER_SELECT = 500
STALE_ROWS_PER_DELETE = 1000
# Safety net: a copy batch that would delete more than this share of its titles'
# rows in one table is refused, since that points to a bug rather than TMDB edits.
MAX_STALE_SHARE = 0.5
MIN_ROWS_FOR_SHARE_CHECK = 1000
# The copy writes release dates as epoch seconds; Crate returns epoch milliseconds.
EPOCH_SECONDS_COLUMNS = ("release_date",)

# A scope that makes every row of the title's table authoritative.
ALL_ROWS = None


def credits_object(doc: dict, is_movie: bool) -> Any:
    return doc.get("credits" if is_movie else "aggregate_credits")


def is_full_details_payload(doc: dict, is_movie: bool) -> bool:
    """Whether the document came from a full details fetch.

    Every append comes from one TMDB request, and the save writes each key of the
    response. Nested lists are stored as `[]`, so the `images` and credits objects are
    present on every full fetch; an absent top-level list then means TMDB lists none.
    """
    return isinstance(doc.get("images"), dict) and isinstance(credits_object(doc, is_movie), dict)


def listed_scopes(doc: dict, is_movie: bool) -> dict[str, frozenset[str] | None]:
    """Per table, which of the title's rows the payload lists authoritatively.

    A table missing from the result keeps all its rows. `ALL_ROWS` covers every row;
    for media_image, a set of image types covers only rows of those types.
    """
    if doc.get("tmdb_deleted") is True:
        # The tmdb_deleted path removes all rows of flagged titles.
        return {}
    scopes: dict[str, frozenset[str] | None] = {}
    full = is_full_details_payload(doc, is_movie)

    images = doc.get("images")
    if isinstance(images, dict):
        image_types = frozenset(image_type for image_type, listed in images.items() if isinstance(listed, list))
        if image_types:
            scopes["media_image"] = image_types

    credits = credits_object(doc, is_movie)
    if isinstance(credits, dict):
        if isinstance(credits.get("cast"), list):
            scopes["person_appeared_in"] = ALL_ROWS
        # A show's created_by is a top-level list, so its crew needs the full payload.
        if isinstance(credits.get("crew"), list) and (is_movie or full):
            scopes["person_worked_on"] = ALL_ROWS

    release_dates = doc.get("release_dates")
    if is_movie and isinstance(release_dates, dict) and isinstance(release_dates.get("results"), list):
        scopes["release_event"] = ALL_ROWS

    if full:
        for table in TOP_LEVEL_LIST_TABLES:
            scopes[table] = ALL_ROWS
    return scopes


def normalized_key(table: TitleTable, values: dict) -> tuple:
    """A row's key as Crate returns it."""
    return tuple(
        round(values[column] * 1000) if column in EPOCH_SECONDS_COLUMNS and isinstance(values[column], float)
        else values[column]
        for column in table.key_columns
    )


def written_keys(table: TitleTable, records: Iterable) -> dict[int, set[tuple]]:
    """The row keys the upsert wrote, per title."""
    keys = defaultdict(set)
    for record in records:
        values = record.model_dump()
        keys[int(values[table.id_column])].add(normalized_key(table, values))
    return keys


def empty_stats() -> dict[str, int]:
    return {"titles_checked": 0, "titles_unverified": 0, "rows_deleted": 0, "batches_refused": 0}


def find_stale_rows(connector: Any, table: TitleTable, media_type: str, scopes: dict[int, frozenset[str] | None],
                    kept: dict[int, set[tuple]], stats: dict) -> tuple[list[tuple], int]:
    """The primary keys of the scoped titles' rows the payload no longer lists, and the rows checked."""
    columns = ", ".join(table.primary_key)
    stale, checked = [], 0
    title_ids = normalize_tmdb_ids(scopes)
    for i in range(0, len(title_ids), STALE_ROW_TITLES_PER_SELECT):
        batch = title_ids[i:i + STALE_ROW_TITLES_PER_SELECT]
        rows = connector.select(f"SELECT {columns} FROM {table.name} WHERE {table.scope(media_type)}",
                                table.params(media_type, batch))
        existing = defaultdict(dict)
        for row in rows:
            existing[int(row[table.id_column])][normalized_key(table, row)] = tuple(row[column] for column in table.primary_key)
        for tmdb_id in batch:
            have = existing.get(tmdb_id, {})
            if not kept.get(tmdb_id, set()) <= set(have):
                stats["titles_unverified"] += 1
                continue
            checked += len(have)
            image_types = scopes[tmdb_id]
            stale.extend(
                primary_key for key, primary_key in have.items()
                if key not in kept.get(tmdb_id, set()) and (image_types is ALL_ROWS or key[0] in image_types)
            )
    return stale, checked


def delete_rows(connector: Any, table: TitleTable, primary_keys: list[tuple]) -> int:
    sql = f"DELETE FROM {table.name} WHERE " + " AND ".join(f"{column} = ?" for column in table.primary_key)
    deleted = 0
    for i in range(0, len(primary_keys), STALE_ROWS_PER_DELETE):
        results = connector.cur.executemany(sql, [list(key) for key in primary_keys[i:i + STALE_ROWS_PER_DELETE]])
        deleted += sum(max(result.get("rowcount") or 0, 0) for result in results or [])
    return deleted


def delete_stale_child_rows(connector: Any, media_type: str, scopes_by_title: dict[int, dict],
                            records_by_table: dict[str, list]) -> dict[str, dict[str, int]]:
    """Delete the rows of a copied batch's titles that their payloads no longer list.

    `scopes_by_title` maps each copied title to its `listed_scopes`; `records_by_table`
    holds the records the batch just upserted. Returns counts per table.
    """
    result = {}
    for name in STALE_ROW_TABLES:
        stats = result[name] = empty_stats()
        scopes = {tmdb_id: scopes[name] for tmdb_id, scopes in scopes_by_title.items() if name in scopes}
        if not scopes:
            continue
        table = title_table(media_type, name)
        stats["titles_checked"] = len(scopes)
        # The upserted rows must be visible to the SELECT that verifies them.
        connector.run(f"REFRESH TABLE {name}")
        kept = written_keys(table, records_by_table.get(name, ()))
        stale, checked = find_stale_rows(connector, table, media_type, scopes, kept, stats)
        if not stale:
            continue
        if checked >= MIN_ROWS_FOR_SHARE_CHECK and len(stale) > MAX_STALE_SHARE * checked:
            stats["batches_refused"] += 1
            print(f"!!! REFUSING to delete {len(stale)} of {checked} {media_type} rows from {name}: more than "
                  f"MAX_STALE_SHARE={MAX_STALE_SHARE}. Check the payloads before deleting manually.", flush=True)
            continue
        stats["rows_deleted"] = delete_rows(connector, table, stale)
        connector.run(f"REFRESH TABLE {name}")
        print(f"    Deleted {stats['rows_deleted']} stale {name} rows of {len(scopes)} {media_type}s", flush=True)
    return result


def add_stats(total: dict[str, dict[str, int]], batch: dict[str, dict[str, int]]) -> None:
    for name, stats in batch.items():
        for key, value in stats.items():
            total.setdefault(name, empty_stats())[key] += value


def main() -> None:
    """Shared importable helper of the details copy; no standalone input."""
