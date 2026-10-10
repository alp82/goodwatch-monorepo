"""Move today's watch history into user_watch_log and user_watch_state.

docs/implementation/tracking/data-model.md, section 6; the steps to run it are in
docs/implementation/tracking/migration.md. It reads user_watch_history, user_score,
user_wishlist and the episode catalog, and writes only the two new tables. Every id is
derived from the old row and every insert skips a row that is there, so a run that
stopped is started again and a second run writes nothing twice.

A show whose episodes are not copied yet becomes Seen with its press and no watches;
a later run, or the fill job (f/sync/tracking/fill_seen_groups), adds them.
"""
from collections import Counter
from datetime import datetime, timezone
from typing import Optional

from f.db.cratedb import CrateConnector
from f.sync.tracking import rules
from f.sync.tracking.fill_seen_groups import (
    REFRESH,
    SAMPLE_SIZE,
    SELECT_STATES,
    episode_lists,
    fill_presses,
    for_member,
    insert_rows,
)

LARGEST_MEMBERS = 5
LOG_KEY = ("user_id", "watch_id")
STATE_KEY = ("user_id", "tmdb_id", "media_type")

SELECT_HISTORY = ("SELECT user_id, tmdb_id, media_type, first_watched_at, last_watched_at, created_at, updated_at "
                  "FROM user_watch_history")
SELECT_SCORES = "SELECT user_id, tmdb_id, media_type, created_at, updated_at FROM user_score"
SELECT_WISHLIST = "SELECT user_id, tmdb_id, media_type FROM user_wishlist"
SELECT_MOVIE_LOG = "SELECT user_id, tmdb_id, watch_id, origin FROM user_watch_log WHERE media_type = 'movie'"
SELECT_MEMBER_LOG = ("SELECT user_id, watch_id, media_type, tmdb_id, season_number, episode_number, watched_at, "
                     "watched_at_precision, origin, group_id, import_id, pass FROM user_watch_log WHERE user_id = ?")
DELETE_WATCHES = "DELETE FROM user_watch_log WHERE user_id = ? AND watch_id = ANY(?)"


def title_key(row: dict) -> tuple:
    return row["user_id"], row["tmdb_id"], row["media_type"]


def migrate(connector, dry_run: bool = True, user_id: Optional[str] = None, since: Optional[int] = None) -> dict:
    """Plan what the old rows become and, unless it is a dry run, write it.

    Returns the counts of the plan, the largest members, the Want to See rows on titles
    that become Seen, five planned rows of each kind, and for a real run how many rows
    were inserted.
    """
    started_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if not dry_run:
        connector.run(REFRESH)
    history = connector.select(*for_member(SELECT_HISTORY, user_id))
    scores = connector.select(*for_member(SELECT_SCORES, user_id))
    wishlist = connector.select(*for_member(SELECT_WISHLIST, user_id))
    states = connector.select(*for_member(SELECT_STATES, user_id))
    movie_log = connector.select(*for_member(SELECT_MOVIE_LOG, user_id))
    plan = rules.plan_titles(history, scores, movie_log, since=since)

    written = None
    if dry_run:
        # What the state table will hold: its rows, and the planned ones where it has none.
        existing = {title_key(row) for row in states}
        states = states + [row for row in plan.state_rows if title_key(row) not in existing]
    else:
        written = {
            "movie watches": insert_rows(connector, "user_watch_log", rules.LOG_COLUMNS, LOG_KEY, plan.movie_watches),
            "score-owned watches": insert_rows(connector, "user_watch_log", rules.LOG_COLUMNS, LOG_KEY, plan.score_watches),
            "state rows": insert_rows(connector, "user_watch_state", rules.STATE_COLUMNS, STATE_KEY, plan.state_rows),
        }
        removed = 0
        replaced = {}
        for member, watch_id in plan.replaced_score_watches:
            replaced.setdefault(member, []).append(watch_id)
        for member, watch_ids in replaced.items():
            connector.run(DELETE_WATCHES, (member, watch_ids))
            removed += max(connector.cur.rowcount or 0, 0)
        # The presses are read back, so a show whose state the new build has changed gets no watches.
        connector.run(REFRESH)
        states = connector.select(*for_member(SELECT_STATES, user_id))

    episode_watches, groups = fill_presses(connector, rules.standing_presses(states), dry_run)
    if written is not None:
        written |= {"episode watches": groups["inserted"], "score-owned watches removed": removed}

    log_rows_per_member = Counter(row["user_id"] for row in plan.movie_watches + plan.score_watches + episode_watches)
    planned = {
        "movie watches": len(plan.movie_watches),
        "show presses": len(plan.presses),
        "episode watches": len(episode_watches),
        "score-owned watches": len(plan.score_watches),
        "state rows": len(plan.state_rows),
        "state rows: movie": sum(1 for row in plan.state_rows if row["media_type"] == "movie"),
        "state rows: show": len(plan.presses),
        "score-owned watches to remove": len(plan.replaced_score_watches),
        "members": len({row["user_id"] for row in plan.state_rows}),
        # Every standing press that was looked at, also one made in the webapp or migrated earlier.
        "show presses with a group to fill": groups["groups to fill"],
        "show presses whose group is filled already": groups["groups already filled"],
        "show presses on shows that are not in the catalog": groups["presses on shows that are not in the catalog"],
        "show presses on shows whose episodes are not copied yet": groups["presses on shows whose episodes are not copied yet"],
        "show presses with nothing aired by their day": groups["presses with nothing left to add"],
        "skipped": dict(plan.skipped),
    }
    result = {
        "dry_run": dry_run,
        "started_at": started_at,
        "planned": planned,
        "written": written,
        "largest members": [{"user_id": member, "log rows": count}
                            for member, count in log_rows_per_member.most_common(LARGEST_MEMBERS)],
        "want to see rows on titles that become seen": rules.want_to_see_overlap(plan, wishlist),
        "samples": {
            "movie watches": plan.movie_watches[:SAMPLE_SIZE],
            "score-owned watches": plan.score_watches[:SAMPLE_SIZE],
            "show presses": plan.presses[:SAMPLE_SIZE],
            "episode watches": episode_watches[:SAMPLE_SIZE],
        },
    }
    for name in ("dry_run", "started_at", "planned", "written", "largest members",
                 "want to see rows on titles that become seen"):
        print(f"{name}: {result[name]}", flush=True)
    return result


def verify_migration(connector, user_id: Optional[str] = None) -> dict:
    """Check the two new tables against the old ones. Reads only. See rules.verify for what is checked."""
    connector.run(REFRESH)
    history = connector.select(*for_member(SELECT_HISTORY, user_id))
    scores = connector.select(*for_member(SELECT_SCORES, user_id))
    states = connector.select(*for_member(SELECT_STATES, user_id))
    members = sorted({row["user_id"] for row in history + states}
                     | {row["user_id"] for row in scores if row["media_type"] == "movie"})
    log_rows = [row for member in members for row in connector.select(SELECT_MEMBER_LOG, (member,))]
    migrated = [press for press in rules.standing_presses(states)
                if press["seen_press_group"].startswith(rules.MIGRATION_GROUP_PREFIX)]
    lists, _ = episode_lists(connector, (press["tmdb_id"] for press in migrated))
    report = rules.verify(history, scores, states, log_rows, lists)
    for name in ("ok", "counts", "problems"):
        print(f"{name}: {report[name]}", flush=True)
    return report


def since_millis(since: Optional[str]) -> Optional[int]:
    """An ISO time such as 2026-10-08T12:00:00Z in milliseconds. A time without a zone is UTC."""
    if not since:
        return None
    moment = datetime.fromisoformat(since)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return int(moment.timestamp() * 1000)


def main(dry_run: bool = True, verify: bool = False, user_id: str = "", since: str = ""):
    # Windmill passes None for an argument the caller left out, so the defaults above don't apply.
    # Only an explicit false writes.
    dry_run = dry_run is not False
    check, user_id, since = verify is True, user_id or None, since_millis(since)
    connector = CrateConnector()
    try:
        if check:
            report = verify_migration(connector, user_id=user_id)
            if not report["ok"]:
                raise RuntimeError(f"The migrated tables do not match the old ones: {sorted(report['problems'])}")
            return report
        return migrate(connector, dry_run=dry_run, user_id=user_id, since=since)
    finally:
        connector.disconnect()


if __name__ == "__main__":
    main()
