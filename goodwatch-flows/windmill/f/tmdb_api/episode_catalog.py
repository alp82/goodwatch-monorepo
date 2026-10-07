"""The rules of the episode catalog, without any I/O (docs/episode-catalog.md).

The fetch job (f/tmdb_api/tmdb_fetch_episodes_from_api) and the Crate copy
(f/sync/copy/tmdb_episodes) apply them. Design:
docs/research/season-episode-scores/tmdb-episode-catalog.md.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Callable, Iterable, Optional

# Mongo collections: the crawl state lives on the show's tmdb_tv_details document.
DETAILS_COLLECTION = "tmdb_tv_details"
SEASON_COLLECTION = "tmdb_tv_season_details"
# Small bookkeeping documents: the change feed's last run and the Crate copy's checkpoint.
STATE_COLLECTION = "tmdb_episode_catalog_state"

# TMDB answers a 21st appended item with HTTP 400, status_code 27.
MAX_APPENDED_SEASONS = 20
# Most of an episode's bytes, and nothing reads them.
DROPPED_EPISODE_FIELDS = ("crew", "guest_stars")

# Every show is fetched again after this long at the latest.
STALE_AFTER_DAYS = 30
# A show with an episode this close is fetched daily.
AIRING_AHEAD_DAYS = 7
AIRING_BEHIND_DAYS = 14
DAILY = timedelta(days=1)
# TMDB rejects a change feed range longer than this.
CHANGES_MAX_WINDOW_DAYS = 14
CHANGES_OVERLAP = timedelta(days=1)

# A season whose last episode is no finale stays open this long, so a weekly season
# survives the gap before TMDB lists its next episodes.
OPEN_SEASON_GAP_DAYS = 45
OVER_STATUSES = ("Ended", "Canceled")

# The columns the copy owns and compares; the key is (show_id, tmdb_id).
EPISODE_COLUMNS = (
    "season_tmdb_id",
    "season_number",
    "episode_number",
    "name",
    "air_date",
    "runtime",
    "still_path",
    "episode_type",
    "tmdb_user_score_original",
    "tmdb_user_score_rating_count",
)


# ===== Fetching =====

def season_batches(season_numbers: Iterable) -> list[list[int]]:
    """The season numbers of one show, split into the requests that fetch them."""
    numbers = sorted({int(number) for number in season_numbers if number is not None})
    return [numbers[i:i + MAX_APPENDED_SEASONS] for i in range(0, len(numbers), MAX_APPENDED_SEASONS)]


def needs_request(stored_season_numbers: list, changed_at: Optional[datetime], updated_at: Optional[datetime]) -> bool:
    """Whether a show is asked for at all.

    A show whose stored details list no season gets no request, unless TMDB's change
    feed named it since its episodes were last fetched: then the stored details may be
    older than a season TMDB just added.
    """
    if stored_season_numbers:
        return True
    return changed_at is not None and (updated_at is None or changed_at > updated_at)


@dataclass
class ShowSeasons:
    """What one fetch of a show returned."""

    # One document per fetched season, as stored in tmdb_tv_season_details.
    seasons: list[dict] = field(default_factory=list)
    # The season numbers TMDB lists today.
    listed_season_numbers: list[int] = field(default_factory=list)
    # Listed seasons that no response carried.
    missing_season_numbers: list[int] = field(default_factory=list)
    # A request after the first that failed.
    error: Optional[BaseException] = None

    @property
    def complete(self) -> bool:
        """Every listed season was fetched, and at least one is listed.

        Only then may episodes and seasons that are no longer listed be removed.
        """
        return bool(self.listed_season_numbers) and not self.missing_season_numbers and self.error is None


def season_document(show_tmdb_id: int, season_id: Optional[int], season_number: int, payload: dict) -> dict:
    """The stored form of an appended season. The appended form has no integer id, so it comes from seasons[]."""
    return {
        "tmdb_id": show_tmdb_id,
        "season_number": season_number,
        "season_id": season_id,
        "name": payload.get("name"),
        "air_date": payload.get("air_date"),
        "overview": payload.get("overview"),
        "poster_path": payload.get("poster_path"),
        "vote_average": payload.get("vote_average"),
        "episodes": [
            {key: value for key, value in episode.items() if key not in DROPPED_EPISODE_FIELDS}
            for episode in payload.get("episodes") or []
        ],
    }


def collect_show_seasons(
    tmdb_id: int, stored_season_numbers: Iterable, get: Callable[[int, list[int]], dict]
) -> ShowSeasons:
    """Fetch every season TMDB lists for a show, 20 per request.

    `get(tmdb_id, season_numbers)` returns /tv/{id} with those seasons appended. The
    first request asks for the seasons the stored details name; its answer lists the
    seasons of today, and the rest is asked from that list. A first request that fails
    raises. A later one that fails keeps what was fetched and leaves the show incomplete.
    """
    first_batch = (season_batches(stored_season_numbers) or [[]])[0]
    response = get(tmdb_id, first_batch)
    season_ids = {
        int(season["season_number"]): season.get("id")
        for season in response.get("seasons") or []
        if season.get("season_number") is not None
    }
    result = ShowSeasons(listed_season_numbers=sorted(season_ids))
    payloads = {}

    def keep(batch: list[int], response: dict):
        for number in batch:
            payload = response.get(f"season/{number}")
            if number in season_ids and isinstance(payload, dict):
                payloads[number] = payload

    keep(first_batch, response)
    for batch in season_batches(set(season_ids) - set(first_batch)):
        try:
            keep(batch, get(tmdb_id, batch))
        except Exception as error:
            result.error = error
            break

    result.seasons = [
        season_document(tmdb_id, season_ids[number], number, payloads[number]) for number in sorted(payloads)
    ]
    result.missing_season_numbers = sorted(set(season_ids) - set(payloads))
    return result


# ===== Rows =====

def parse_air_date(value) -> Optional[date]:
    """TMDB's date string, a Crate timestamp in milliseconds, or a date, as a date. None when unknown."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        return (datetime(1970, 1, 1) + timedelta(milliseconds=value)).date()
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def air_date_millis(value) -> Optional[int]:
    """Midnight UTC of TMDB's date in milliseconds, as Crate stores it. TMDB gives no time and no time zone."""
    day = parse_air_date(value)
    if day is None:
        return None
    return int(datetime(day.year, day.month, day.day, tzinfo=timezone.utc).timestamp() * 1000)


def episode_rows(show_id: int, season_documents: Iterable[dict]) -> list[dict]:
    """The catalog rows of one show from its stored season documents, one per episode id.

    After a partial fetch an episode can sit in an older document of another season as
    well; the document written last wins.
    """
    rows = {}
    oldest_first = sorted(season_documents, key=lambda document: document.get("updated_at") or datetime.min)
    for document in oldest_first:
        for episode in document.get("episodes") or []:
            episode_id = episode.get("id")
            if not episode_id:
                continue
            rows[episode_id] = {
                "show_id": show_id,
                "tmdb_id": episode_id,
                "season_tmdb_id": document.get("season_id"),
                "season_number": document["season_number"],
                "episode_number": episode.get("episode_number"),
                "name": episode.get("name") or None,
                "air_date": air_date_millis(episode.get("air_date")),
                "runtime": episode.get("runtime"),
                "still_path": episode.get("still_path") or None,
                "episode_type": episode.get("episode_type") or None,
                "tmdb_user_score_original": episode.get("vote_average") or None,
                "tmdb_user_score_rating_count": episode.get("vote_count") or None,
            }
    return sorted(rows.values(), key=lambda row: (row["season_number"], row["episode_number"] or 0, row["tmdb_id"]))


@dataclass
class EpisodeDiff:
    # Rows to insert or update. An update also clears removed_at.
    upserts: list[dict]
    # Ids of live stored episodes TMDB no longer lists.
    removed_ids: list[int]


def diff_episodes(fetched: list[dict], stored: list[dict], may_remove: bool) -> EpisodeDiff:
    """What to write so one show's stored episodes match the fetched ones.

    The episode id is the identity: a renumbered episode is an update of its row, and
    an episode TMDB re-added under a new id is a new row beside the removed old one.
    Nothing is removed unless the fetch was complete (`may_remove`).
    """
    stored_by_id = {row["tmdb_id"]: row for row in stored}
    upserts = []
    for row in fetched:
        current = stored_by_id.get(row["tmdb_id"])
        if (
            current is None
            or current.get("removed_at") is not None
            or any(current.get(column) != row.get(column) for column in EPISODE_COLUMNS)
        ):
            upserts.append(row)
    removed_ids = []
    if may_remove:
        fetched_ids = {row["tmdb_id"] for row in fetched}
        removed_ids = sorted(
            episode_id for episode_id, row in stored_by_id.items()
            if episode_id not in fetched_ids and row.get("removed_at") is None
        )
    return EpisodeDiff(upserts=upserts, removed_ids=removed_ids)


# ===== When a show is due =====

def next_refresh_at(now: datetime, air_dates: Iterable) -> datetime:
    """When a show that was just fetched is due again.

    Daily while an episode aired in the last 14 days or is due within 7 days. A show
    whose next episode is further ahead is due a week before it. Everything else waits
    for the 30-day cycle. TMDB's change feed makes a show due at once (changes.py).
    """
    today = now.date()
    days = [day for day in (parse_air_date(air_date) for air_date in air_dates) if day is not None]
    airing_from = today - timedelta(days=AIRING_BEHIND_DAYS)
    airing_until = today + timedelta(days=AIRING_AHEAD_DAYS)
    if any(airing_from <= day <= airing_until for day in days):
        return now + DAILY
    stale_at = now + timedelta(days=STALE_AFTER_DAYS)
    upcoming = [day for day in days if day > airing_until]
    if upcoming:
        week_before = min(upcoming) - timedelta(days=AIRING_AHEAD_DAYS)
        return min(stale_at, datetime(week_before.year, week_before.month, week_before.day))
    return stale_at


def changes_window(now: datetime, last_success_at: Optional[datetime]) -> tuple[date, date]:
    """The start and end date to ask TMDB's change feed for, both inclusive.

    From a day before the last successful run, so nothing between two runs is missed,
    and never more than TMDB's 14 days: a longer outage is healed by the 30-day cycle.
    """
    end = now.date()
    start = ((last_success_at or now) - CHANGES_OVERLAP).date()
    return max(start, end - timedelta(days=CHANGES_MAX_WINDOW_DAYS)), end


# ===== Aired and still airing =====
#
# Both depend on the calendar. Whoever reads the episode table (the Episode list, Seen,
# Caught up, Next episode) applies these rules when reading. The one stored value is
# show.aired_episode_count, which the copy writes each time it copies a show.

def has_aired(episode: dict, today: date) -> bool:
    """An episode has aired when it is not removed and its air date is today or earlier.

    TMDB's date has no time zone, so this is right to the day. An episode without a
    date has not aired.
    """
    if episode.get("removed_at") is not None:
        return False
    day = parse_air_date(episode.get("air_date"))
    return day is not None and day <= today


def aired_episode_count(episodes: Iterable[dict], today: date) -> int:
    """How many regular episodes of a show have aired: specials (season 0) do not count.

    Stored as show.aired_episode_count and compared with how many episodes a member has
    watched, so a Seen show with new episodes is found without reading its episodes.
    """
    return sum(1 for episode in episodes if (episode.get("season_number") or 0) > 0 and has_aired(episode, today))


def airing_season_number(episodes: Iterable[dict], show_status: Optional[str], today: date) -> Optional[int]:
    """The number of the show's season that is still airing, or None.

    Only the highest-numbered regular season with a dated episode can be airing, and
    only while the show is not Ended or Canceled. It is airing when it has an episode
    dated after today, or when its last aired episode is no finale and aired within
    the last 45 days. An episode without a date never keeps a season open: TMDB's
    "Returning Series" is the default nobody corrects, and such a season would never end.
    """
    if show_status in OVER_STATUSES:
        return None
    dated = [
        (episode["season_number"], day, episode)
        for episode in episodes
        if episode.get("removed_at") is None
        and (episode.get("season_number") or 0) > 0
        and (day := parse_air_date(episode.get("air_date"))) is not None
    ]
    if not dated:
        return None
    latest_season = max(season_number for season_number, _, _ in dated)
    season = [(day, episode) for season_number, day, episode in dated if season_number == latest_season]
    if any(day > today for day, _ in season):
        return latest_season
    last_day, last_episode = max(season, key=lambda entry: (entry[0], entry[1].get("episode_number") or 0))
    still_open = last_episode.get("episode_type") != "finale" and (today - last_day).days <= OPEN_SEASON_GAP_DAYS
    return latest_season if still_open else None
