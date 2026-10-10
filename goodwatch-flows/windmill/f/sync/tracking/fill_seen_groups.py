"""Fill the watches of a Seen press whose show had no episode list when it was pressed.

docs/implementation/tracking/data-model.md, section 6, "The fill job" (C5). It looks for
a show that is Seen with a standing press and no watch of that press's group, and, once
the show's episodes are copied, inserts the group's watches for the regular episodes that
had aired by the UTC day of the press. It never changes a state row, and running it
again writes nothing. The migration (f/sync/tracking/migrate_watch_history) fills the
shows it migrates through the same code.
"""
from collections import Counter, defaultdict
from typing import Iterable, Optional

from f.db.cratedb import CrateConnector
from f.sync.tracking.rules import LOG_COLUMNS, group_rows, standing_presses

ROWS_PER_INSERT = 500
SHOWS_PER_READ = 25
SAMPLE_SIZE = 5

REFRESH = "REFRESH TABLE user_watch_log, user_watch_state"
SELECT_STATES = ("SELECT user_id, tmdb_id, media_type, state, state_changed_at, pass, seen_press_group, "
                 "seen_press_from FROM user_watch_state")
SELECT_GROUP_SIZES = ("SELECT user_id, group_id, count(*) AS n FROM user_watch_log "
                      "WHERE user_id = ANY(?) AND group_id = ANY(?) GROUP BY user_id, group_id")
SELECT_SHOWS = "SELECT tmdb_id, episodes_updated_at FROM show WHERE tmdb_id = ANY(?)"
SELECT_EPISODES = ("SELECT show_id, tmdb_id, season_number, episode_number, air_date FROM episode "
                   "WHERE show_id = ANY(?) AND season_number > 0 AND removed_at IS NULL")
SELECT_WATCHED = ("SELECT tmdb_id, season_number, episode_number, pass FROM user_watch_log "
                  "WHERE user_id = ? AND media_type = 'show' AND tmdb_id = ANY(?) AND season_number > 0")


def for_member(sql: str, user_id: Optional[str]) -> tuple[str, tuple]:
    """The statement for one member, or as it is for all."""
    if not user_id:
        return sql, ()
    return f"{sql} {'AND' if ' WHERE ' in sql else 'WHERE'} user_id = ?", (user_id,)


def insert_rows(connector, table: str, columns: Iterable[str], conflict: Iterable[str], rows: list[dict]) -> int:
    """Insert the rows that are not there yet, 500 per request. Returns how many were inserted."""
    columns = list(columns)
    quoted = ", ".join(f'"{column}"' for column in columns)
    sql = (f"INSERT INTO {table} ({quoted}) VALUES ({', '.join('?' for _ in columns)}) "
           f"ON CONFLICT ({', '.join(conflict)}) DO NOTHING")
    inserted = 0
    for start in range(0, len(rows), ROWS_PER_INSERT):
        data = [[row[column] for column in columns] for row in rows[start:start + ROWS_PER_INSERT]]
        results = connector.cur.executemany(sql, data)
        if not isinstance(results, list) or len(results) != len(data):
            raise RuntimeError(f"Incomplete bulk result while writing {table}")
        errors = [result for result in results if result.get("error_message") or result.get("error")
                  or result.get("rowcount", -1) < 0]
        if errors:
            raise RuntimeError(
                f"{len(errors)} of {len(data)} rows failed in {table}; run again, rows that are there are skipped. "
                f"First: {errors[0]}")
        inserted += sum(result["rowcount"] for result in results)
    if rows:
        print(f"Inserted {inserted} of {len(rows)} rows into {table}; the others were there.", flush=True)
    return inserted


def episode_lists(connector, show_ids: Iterable[int]) -> tuple[dict[int, list[dict]], dict[int, str]]:
    """The regular episodes of each show whose episodes are copied, and why each other show has no list."""
    show_ids = sorted(set(show_ids))
    copied = {}
    for start in range(0, len(show_ids), 1000):
        for row in connector.select(SELECT_SHOWS, (show_ids[start:start + 1000],)):
            copied[row["tmdb_id"]] = row["episodes_updated_at"] is not None
    # A show is read only when the copy has marked it, which it does after writing the show's rows.
    lists = {show_id: [] for show_id in show_ids if copied.get(show_id)}
    missing = {show_id: "not in the catalog" if show_id not in copied else "episodes not copied yet"
               for show_id in show_ids if show_id not in lists}
    listed = sorted(lists)
    for start in range(0, len(listed), SHOWS_PER_READ):
        for row in connector.select(SELECT_EPISODES, (listed[start:start + SHOWS_PER_READ],)):
            lists[row["show_id"]].append(row)
    return lists, missing


def plan_groups(connector, presses: list[dict]) -> tuple[list[dict], dict]:
    """The watches to insert for these presses, and what was found, counted per press."""
    stats = Counter({name: 0 for name in (
        "presses", "groups already filled", "presses on shows that are not in the catalog",
        "presses on shows whose episodes are not copied yet", "presses with nothing left to add",
        "groups to fill", "episode watches")})
    stats["presses"] = len(presses)
    if not presses:
        return [], dict(stats)

    filled = set()
    users = sorted({press["user_id"] for press in presses})
    groups = sorted({press["seen_press_group"] for press in presses})
    for start in range(0, len(users), 500):
        for row in connector.select(SELECT_GROUP_SIZES, (users[start:start + 500], groups)):
            filled.add((row["user_id"], row["group_id"]))
    empty = [press for press in presses if (press["user_id"], press["seen_press_group"]) not in filled]
    stats["groups already filled"] = len(presses) - len(empty)

    lists, missing = episode_lists(connector, (press["tmdb_id"] for press in empty))
    by_member = defaultdict(list)
    for press in empty:
        reason = missing.get(press["tmdb_id"])
        if reason == "not in the catalog":
            stats["presses on shows that are not in the catalog"] += 1
        elif reason:
            stats["presses on shows whose episodes are not copied yet"] += 1
        else:
            by_member[press["user_id"]].append(press)

    rows = []
    for user_id, member_presses in by_member.items():
        watched = defaultdict(set)
        for row in connector.select(SELECT_WATCHED, (user_id, sorted({press["tmdb_id"] for press in member_presses}))):
            watched[(row["tmdb_id"], row["pass"])].add((row["season_number"], row["episode_number"]))
        for press in member_presses:
            group = group_rows(press, lists[press["tmdb_id"]], watched[(press["tmdb_id"], press["pass"])])
            stats["groups to fill" if group else "presses with nothing left to add"] += 1
            rows += group
    stats["episode watches"] = len(rows)
    return rows, dict(stats)


def fill_presses(connector, presses: list[dict], dry_run: bool) -> tuple[list[dict], dict]:
    """Plan the watches of these presses and, unless it is a dry run, insert them."""
    rows, stats = plan_groups(connector, presses)
    stats["inserted"] = 0 if dry_run else insert_rows(connector, "user_watch_log", LOG_COLUMNS, ("user_id", "watch_id"), rows)
    return rows, stats


def fill_seen_groups(connector, dry_run: bool = True, user_id: Optional[str] = None) -> dict:
    if not dry_run:
        connector.run(REFRESH)
    presses = standing_presses(connector.select(*for_member(SELECT_STATES, user_id)))
    rows, stats = fill_presses(connector, presses, dry_run)
    result = {"dry_run": dry_run, **stats, "sample": rows[:SAMPLE_SIZE]}
    print(result, flush=True)
    return result


def main(dry_run: bool = True, user_id: str = ""):
    # Windmill passes None for an argument the caller left out, so the defaults above don't apply.
    # Only an explicit false writes.
    dry_run = dry_run is not False
    connector = CrateConnector()
    try:
        return fill_seen_groups(connector, dry_run=dry_run, user_id=user_id or None)
    finally:
        connector.disconnect()


if __name__ == "__main__":
    main()
