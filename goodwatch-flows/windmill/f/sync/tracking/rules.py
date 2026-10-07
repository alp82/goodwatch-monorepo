"""What today's watch history becomes in the watch log, without any I/O.

docs/implementation/tracking/data-model.md, section 6. The migration
(f/sync/tracking/migrate_watch_history) and the fill job (f/sync/tracking/fill_seen_groups)
apply these rules. Every time is in the milliseconds Crate stores and returns.
"""
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Iterable, Optional

from f.tmdb_api.episode_catalog import has_aired

LOG_COLUMNS = (
    "user_id", "watch_id", "media_type", "tmdb_id", "episode_tmdb_id", "season_number", "episode_number",
    "watched_at", "watched_at_precision", "origin", "group_id", "import_id", "pass", "created_at", "updated_at",
)
STATE_COLUMNS = (
    "user_id", "tmdb_id", "media_type", "state", "state_changed_at", "pass", "seen_press_group", "seen_press_from",
    "rate_prompt_dismissed_at", "seen_question", "created_at", "updated_at",
)
GROUP_ORIGINS = ("seen", "season", "upto")
# The group of a migrated show starts with this; a press made in the webapp carries the browser's id.
MIGRATION_GROUP_PREFIX = "mig-seen-"


def movie_watch_id(movie_id: int) -> str:
    return f"mig-movie-{movie_id}"


def score_watch_id(movie_id: int) -> str:
    return f"score-{movie_id}"


def migration_group(show_id: int) -> str:
    return f"{MIGRATION_GROUP_PREFIX}{show_id}"


def group_watch_id(group: str, episode_id: int) -> str:
    return f"g-{group}-{episode_id}"


def utc_day(millis: int) -> date:
    return (datetime(1970, 1, 1) + timedelta(milliseconds=millis)).date()


def first_time(row: dict, *columns: str) -> Optional[int]:
    return next((row[column] for column in columns if row.get(column) is not None), None)


def last_change(row: dict) -> Optional[int]:
    times = [row[column] for column in ("updated_at", "created_at", "last_watched_at") if row.get(column) is not None]
    return max(times) if times else None


def log_row(user_id: str, watch_id: str, media_type: str, tmdb_id: int, created_at: int, **fields) -> dict:
    return {
        "user_id": user_id, "watch_id": watch_id, "media_type": media_type, "tmdb_id": tmdb_id,
        "episode_tmdb_id": None, "season_number": None, "episode_number": None,
        "watched_at": None, "watched_at_precision": "unknown", "origin": "single",
        "group_id": None, "import_id": None, "pass": 1, "created_at": created_at, "updated_at": created_at,
    } | fields


def seen_row(user_id: str, tmdb_id: int, media_type: str, changed_at: int, **fields) -> dict:
    return {
        "user_id": user_id, "tmdb_id": tmdb_id, "media_type": media_type, "state": "seen",
        "state_changed_at": changed_at, "pass": 1, "seen_press_group": None, "seen_press_from": None,
        "rate_prompt_dismissed_at": None, "seen_question": None, "created_at": changed_at, "updated_at": changed_at,
    } | fields


@dataclass
class Plan:
    """The rows a run inserts, apart from the episode watches, which need the episode list."""
    movie_watches: list[dict] = field(default_factory=list)
    score_watches: list[dict] = field(default_factory=list)
    # Every state row: of the movies, the score-owned movies and the shows.
    state_rows: list[dict] = field(default_factory=list)
    # The shows' state rows again: each is a Seen press whose group is filled from the episode list.
    presses: list[dict] = field(default_factory=list)
    # (user_id, watch_id) of a score's watch written earlier for a movie that now has a watch row.
    replaced_score_watches: list[tuple[str, str]] = field(default_factory=list)
    skipped: Counter = field(default_factory=Counter)


def plan_titles(
    history: Iterable[dict], scores: Iterable[dict], movie_log: Iterable[dict], since: Optional[int] = None
) -> Plan:
    """What the rows of user_watch_history and user_score become.

    `movie_log` is the movie rows user_watch_log holds already. With `since`, only the old
    rows and scores changed at or after that time are planned: the second run after the
    switch, which must not bring back what a member has removed in the new build.
    """
    plan = Plan()
    history = list(history)
    watched_movies = {(row["user_id"], row["tmdb_id"]) for row in history if row["media_type"] == "movie"}
    logged, score_watches = set(), set()
    for row in movie_log:
        (score_watches if row["origin"] == "score" else logged).add((row["user_id"], row["tmdb_id"]))

    def recent(row: dict) -> bool:
        return since is None or (last_change(row) or 0) >= since

    for row in history:
        if not recent(row):
            continue
        user_id, tmdb_id, media_type = row["user_id"], row["tmdb_id"], row["media_type"]
        watched_at = first_time(row, "first_watched_at", "last_watched_at", "created_at", "updated_at")
        if watched_at is None:
            plan.skipped["old rows without a time"] += 1
        elif media_type == "movie":
            plan.movie_watches.append(log_row(
                user_id, movie_watch_id(tmdb_id), "movie", tmdb_id, first_time(row, "created_at") or watched_at,
                watched_at=watched_at, watched_at_precision="moment"))
            plan.state_rows.append(seen_row(user_id, tmdb_id, "movie", watched_at))
            if (user_id, tmdb_id) in score_watches:
                plan.replaced_score_watches.append((user_id, score_watch_id(tmdb_id)))
        elif media_type == "show":
            press = seen_row(user_id, tmdb_id, "show", watched_at,
                             seen_press_group=migration_group(tmdb_id), seen_press_from="not_started")
            plan.state_rows.append(press)
            plan.presses.append(press)
        else:
            plan.skipped[f"old rows of media type {media_type}"] += 1

    for row in scores:
        key = (row["user_id"], row["tmdb_id"])
        # Rating a show records no watch. A movie with a watch, old or logged since, needs none.
        if row["media_type"] != "movie" or key in watched_movies or key in logged or not recent(row):
            continue
        rated_at = first_time(row, "updated_at", "created_at")
        if rated_at is None:
            plan.skipped["scores without a time"] += 1
            continue
        plan.score_watches.append(log_row(key[0], score_watch_id(key[1]), "movie", key[1], rated_at, origin="score"))
        plan.state_rows.append(seen_row(key[0], key[1], "movie", rated_at))
    return plan


def group_rows(press: dict, episodes: Iterable[dict], watched: Iterable[tuple[int, int]] = ()) -> list[dict]:
    """The watches of a Seen press: one per regular episode that had aired by the UTC day of the press.

    `press` is the show's state row. `watched` holds the (season, number) the member has
    watched in the row's pass already. The rows carry the press's own group, its pass,
    and the time of the press as the time they were recorded, so filling a group later is
    no activity of the member.
    """
    pressed_at = press["state_changed_at"]
    day, group, watched = utc_day(pressed_at), press["seen_press_group"], set(watched)
    return [
        log_row(
            press["user_id"], group_watch_id(group, episode["tmdb_id"]), "show", press["tmdb_id"], pressed_at,
            episode_tmdb_id=episode["tmdb_id"], season_number=episode["season_number"],
            episode_number=episode["episode_number"], origin="seen", group_id=group, **{"pass": press["pass"]})
        for episode in sorted(episodes, key=lambda e: (e["season_number"] or 0, e["episode_number"] or 0, e["tmdb_id"]))
        if (episode["season_number"] or 0) > 0
        and has_aired(episode, day)
        and (episode["season_number"], episode["episode_number"]) not in watched
    ]


def standing_presses(state_rows: Iterable[dict]) -> list[dict]:
    """The state rows whose Seen press has a group to fill: a Seen show, a press, not made on a Seen show."""
    return [
        row for row in state_rows
        if row["media_type"] == "show" and row["state"] == "seen" and row.get("seen_press_group")
        and row.get("seen_press_from") and row["seen_press_from"] != "seen"
    ]


def want_to_see_overlap(plan: Plan, wishlist: Iterable[dict]) -> dict:
    """How many Want to See rows are on titles this plan makes Seen, by what makes them Seen."""
    kinds = {}
    for name, rows in (("movie watches", plan.movie_watches), ("score-owned movies", plan.score_watches),
                       ("show presses", plan.presses)):
        kinds.update({(row["user_id"], row["tmdb_id"], row["media_type"]): name for row in rows})
    counts = Counter({"movie watches": 0, "score-owned movies": 0, "show presses": 0})
    for row in wishlist:
        kind = kinds.get((row["user_id"], row["tmdb_id"], row["media_type"]))
        if kind:
            counts[kind] += 1
    return dict(counts) | {"total": sum(counts.values())}


# ---------------------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------------------

def malformed_log_row(row: dict) -> Optional[str]:
    """Why a log row breaks invariant 6 of the data model, or None."""
    if (row["watched_at_precision"] == "unknown") != (row["watched_at"] is None):
        return "the precision and the date disagree"
    if (row["origin"] in GROUP_ORIGINS) != (row["group_id"] is not None):
        return "a group origin without a group id, or a group id without one"
    if (row["origin"] == "import") != (row["import_id"] is not None):
        return "an import without its id, or an import id without one"
    if row["origin"] == "score" and (row["watched_at"] is not None or row["media_type"] != "movie"):
        return "a score's watch with a date or on a show"
    if row["media_type"] == "movie" and (row["season_number"] is not None or row["pass"] != 1):
        return "a movie watch with an episode or a pass"
    if row["media_type"] == "show" and row["season_number"] is None:
        return "a show watch without an episode"
    return None


def malformed_state_row(row: dict) -> Optional[str]:
    """Why a state row breaks invariant 2, 3 or 7 of the data model, or None."""
    group, pressed_from = row.get("seen_press_group"), row.get("seen_press_from")
    if (group is None) != (pressed_from is None):
        return "half a Seen press"
    if group is not None and row["state"] != "seen":
        return "a Seen press on a show that is not Seen"
    if row["media_type"] == "movie" and (row["state"] != "seen" or row["pass"] != 1):
        return "a movie that is not Seen in pass 1"
    return None


def verify(
    history: Iterable[dict],
    scores: Iterable[dict],
    state_rows: Iterable[dict],
    log_rows: Iterable[dict],
    episodes_by_show: dict[int, list[dict]],
    sample: int = 20,
) -> dict:
    """Check the migrated tables against the old ones.

    `episodes_by_show` holds the episode list of every show whose episodes were copied;
    a show that is missing from it has no list yet. Returns the counts, and under
    `problems` what must be empty, each with its number and up to `sample` examples.
    """
    history, scores, state_rows = list(history), list(scores), list(state_rows)
    title = lambda row: (row["user_id"], row["tmdb_id"], row["media_type"])  # noqa: E731
    states = {title(row): row for row in state_rows}
    score_keys = {title(row) for row in scores}
    logs = defaultdict(list)
    group_sizes = Counter()
    problems = defaultdict(list)
    counts = Counter()
    for row in log_rows:
        logs[title(row)].append(row)
        if row["group_id"] is not None:
            group_sizes[(row["user_id"], row["group_id"])] += 1
        counts[f"log rows: {row['media_type']}, {row['origin']}"] += 1
        reason = malformed_log_row(row)
        if reason:
            problems["malformed log rows"].append((row["user_id"], row["watch_id"], reason))
    for row in state_rows:
        counts[f"state rows: {row['media_type']}"] += 1
        reason = malformed_state_row(row)
        if reason:
            problems["malformed state rows"].append((*title(row), reason))

    # Every old row has its state row, and a movie its watch.
    for row in history:
        key = title(row)
        counts[f"old rows: {row['media_type']}"] += 1
        if states.get(key, {}).get("state") != "seen":
            problems["old rows without a Seen state row"].append(key)
        if row["media_type"] == "movie" and not any(watch["origin"] != "score" for watch in logs.get(key, ())):
            problems["old movie rows without a watch"].append(key)

    # The score's watch (invariant 4), and a movie's state row exactly while it has a watch (invariant 3).
    for key in score_keys:
        if key[2] == "movie" and not logs.get(key):
            problems["scored movies without a watch"].append(key)
    for key, watches in logs.items():
        by_score = [watch for watch in watches if watch["origin"] == "score"]
        if by_score and (len(watches) > 1 or key not in score_keys):
            problems["score's watches beside another watch or without a score"].append(key)
        if key[2] == "movie" and key not in states:
            problems["movies with a watch and no state row"].append(key)
    for key in states:
        if key[2] == "movie" and not logs.get(key):
            problems["movie state rows without a watch"].append(key)

    # The group of every migrated show against today's episode list.
    for row in standing_presses(state_rows):
        if not row["seen_press_group"].startswith(MIGRATION_GROUP_PREFIX):
            continue
        found = group_sizes[(row["user_id"], row["seen_press_group"])]
        counts["episode watches of migrated shows"] += found
        if row["tmdb_id"] not in episodes_by_show:
            counts["migrated shows: no episode list yet"] += 1
            continue
        expected = len(group_rows(row, episodes_by_show[row["tmdb_id"]]))
        counts["episode watches expected from the episode lists"] += expected
        if found >= expected:
            counts["migrated shows: group complete"] += 1
        elif found == 0:
            counts["migrated shows: still to fill"] += 1
        else:
            counts["migrated shows: group incomplete"] += 1
            problems["shows with an incomplete group"].append((*title(row), f"{found} of {expected}"))

    # No member lost a Seen title: watch history and scores before, Seen states and scores after.
    before = {title(row) for row in history} | score_keys
    after = {key for key, row in states.items() if row["state"] == "seen"} | score_keys
    problems["Seen titles lost"] += sorted(before - after)
    counts["titles that count as Seen: before"] = len(before)
    counts["titles that count as Seen: after"] = len(after)
    counts["members: before"] = len({key[0] for key in before})
    counts["members: after"] = len({key[0] for key in after})

    found = {name: {"count": len(rows), "examples": sorted(rows, key=str)[:sample]} for name, rows in problems.items() if rows}
    return {"ok": not found, "counts": dict(sorted(counts.items())), "problems": found}
