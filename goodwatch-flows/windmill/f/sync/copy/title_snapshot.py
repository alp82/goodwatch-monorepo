"""Publish the title snapshot: every movie and show with a title analysis, as compact binary
columns in Redis, which the webapp loads into memory (`app/server/title-snapshot/`).

The stored format is the webapp's format 1 (`app/server/title-snapshot/format.server.ts`):

- `title-snapshot:<version>:<n>` holds the column bytes in chunks of at most 1 MB. ioredis
  keeps a reply buffer of about three times the largest value, so larger chunks would push
  the webapp past its memory budget.
- `title-snapshot:current` holds the JSON manifest naming the version. The webapp checks it
  once a minute and loads a new version when it appears.

Joined, the chunks are the columns one after another, little-endian, one value per title in
point id order: point id (float64), genre bits (uint32), release day (int32), votes
(uint32), popularity (float32), fingerprint (74 x uint8, 255 for a missing score), GoodWatch
score (uint8, 255 unknown), origin index (uint8, 255 unknown) and flags (uint8): 101 bytes
per title.

One run:

1. Reads a mark of the analyses in Crate: per table, the count and the sum of
   `dna_updated_at`. A new, changed or removed analysis moves it. When it equals the mark in
   the current manifest, the run exits without a new version, unless `force` is set.
2. Reads the titles from Crate in pages of `PAGE_SIZE` by tmdb_id, filtered on
   `dna_updated_at` (a timestamp with doc values). The 74 scores come from the typed
   `fingerprint_scores[...]` subcolumns; reading the whole object column is about five
   times slower and has pages near the 10 s timeout.
3. Writes the chunks of the new version, swaps `title-snapshot:current`, and deletes the
   chunks of every version but the new and the previous one.

It runs after each scheduled vector copy (`f/sync/copy/vector_data` starts it), nightly on
its own schedule, and on demand. The mark is compared, not the manifest's `builtAt`, because
`dna_updated_at` is the analysis's time in MongoDB: an analysis the DNA copy brings to Crate
hours later would be older than a snapshot built in between, and never published.
"""
# extra_requirements:
# redis==5.2.1

import json
import math
import sys
import time
import uuid
from array import array
from collections import Counter
from contextlib import nullcontext
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Callable, Iterable, Optional

from f.db.cratedb import CrateConnector
from f.db.redis import RedisConnector
from f.dna.models import CoreScores

FORMAT = 1
CURRENT_KEY = "title-snapshot:current"
LOCK_KEY = "title-snapshot:lock"
CHUNK_BYTES = 1024 * 1024
PAGE_SIZE = 2000
PAGE_ATTEMPTS = 3
LOCK_SECONDS = 1800

KEY_ORDER = list(CoreScores.model_fields)
FINGERPRINT_LENGTH = 74
MISSING_SCORE = 255
UNKNOWN_DAY = -2147483648
UNKNOWN_SCORE = 255
UNKNOWN_ORIGIN = 255
MAX_GENRES = 32
MAX_ORIGINS = 255
FLAG_POSTER = 1
FLAG_BACKDROP = 2
FLAG_ADULT = 4
FLAG_ANIME = 8
MOVIE_BASE = 1_000_000_000_000
SHOW_BASE = 2_000_000_000_000
BYTES_PER_TITLE = 8 + 4 + 4 + 4 + 4 + FINGERPRINT_LENGTH + 1 + 1 + 1
DAY_MS = 86_400_000
UINT32_MAX = 0xFFFFFFFF

TABLES = {"movie": ("movie", "release_date", MOVIE_BASE), "show": ("show", "last_air_date", SHOW_BASE)}

assert len(KEY_ORDER) == FINGERPRINT_LENGTH


# ---- Rows ------------------------------------------------------------------


def _round(value: float) -> int:
    """Rounds half up, as JavaScript's Math.round does."""
    return math.floor(value + 0.5)


def _select_columns(day_column: str) -> str:
    scores = ", ".join(f"fingerprint_scores['{key}']" for key in KEY_ORDER)
    return (
        f"tmdb_id, {scores}, genres, {day_column}, goodwatch_overall_score_normalized_percent,"
        " goodwatch_overall_score_voting_count, popularity, production_country_codes,"
        " original_language_code, poster_path, backdrop_path, adult, is_anime"
    )


def to_row(base: int, record: list) -> Optional[dict]:
    """A snapshot row from one Crate record in `_select_columns` order; None without scores."""
    tmdb_id = record[0]
    scores = record[1:1 + FINGERPRINT_LENGTH]
    if all(score is None for score in scores):
        return None
    (genres, day, score, votes, popularity, countries, language, poster, backdrop, adult,
     anime) = record[1 + FINGERPRINT_LENGTH:]
    fingerprint = bytes(
        max(0, min(10, _round(s))) if isinstance(s, (int, float)) and math.isfinite(s) else MISSING_SCORE
        for s in scores
    )
    return {
        "point_id": base + int(tmdb_id),
        "genres": list(genres or []),
        "release_day": None if day is None else int(day) // DAY_MS,
        "votes": votes or 0,
        "popularity": popularity or 0.0,
        "fingerprint": fingerprint,
        "score": score,
        "origin": (countries[0] if countries and countries[0] else None) or language or None,
        "poster": bool(poster),
        "backdrop": bool(backdrop),
        "adult": bool(adult),
        "anime": bool(anime),
    }


def read_rows(select: Callable[[str, list], list], media_type: str) -> list[dict]:
    """Every title of one media type with scores, paged by tmdb_id."""
    table, day_column, base = TABLES[media_type]
    sql = (
        f"SELECT {_select_columns(day_column)} FROM {table}"
        f" WHERE dna_updated_at IS NOT NULL AND tmdb_id > ? ORDER BY tmdb_id LIMIT {PAGE_SIZE}"
    )
    rows: list[dict] = []
    last = -1
    while True:
        records = _with_retries(lambda: select(sql, [last]))
        for record in records:
            row = to_row(base, record)
            if row:
                rows.append(row)
        if len(records) < PAGE_SIZE:
            return rows
        last = records[-1][0]


def _with_retries(read: Callable[[], list]) -> list:
    for attempt in range(PAGE_ATTEMPTS):
        try:
            return read()
        except Exception as error:
            if attempt == PAGE_ATTEMPTS - 1:
                raise
            print(f"Page read failed ({error}); retrying", flush=True)
            time.sleep(5 * (attempt + 1))
    raise AssertionError("unreachable")


def source_mark(select: Callable[[str, list], list]) -> dict:
    """Per table, the count and sum of dna_updated_at: moves when an analysis is added, changed
    or removed. Two aggregates over a timestamp column, well under a second."""
    mark = {}
    for media_type, (table, _, _) in TABLES.items():
        count, total = select(f"SELECT count(dna_updated_at), sum(dna_updated_at) FROM {table}", [])[0]
        mark[media_type] = [int(count or 0), int(total or 0)]
    return mark


# ---- Encoding --------------------------------------------------------------


def encode_snapshot(rows: Iterable[dict], version: str, built_at: datetime, extra: Optional[dict] = None
                    ) -> tuple[dict, list[bytes]]:
    """The manifest and the chunks of format 1, as the webapp's encodeSnapshot writes them."""
    if sys.byteorder != "little":
        raise RuntimeError("The title snapshot needs a little-endian machine")
    rows = sorted(rows, key=lambda r: r["point_id"])
    for previous, row in zip(rows, rows[1:]):
        if previous["point_id"] == row["point_id"]:
            raise ValueError(f"Point id {row['point_id']} appears twice")
    genres = sorted({g for r in rows for g in r["genres"]})
    if len(genres) > MAX_GENRES:
        raise ValueError(f"{len(genres)} genres; format {FORMAT} holds {MAX_GENRES}")
    # The most common origins get the table's places; rarer ones are stored as unknown. Ties
    # sort as JavaScript's localeCompare does for these codes: letters first, lowercase first.
    counts = Counter(r["origin"] for r in rows if r["origin"])
    origins = [o for o, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0].casefold(), item[0].swapcase()))]
    origins = origins[:MAX_ORIGINS]
    genre_bit = {g: 1 << i for i, g in enumerate(genres)}
    origin_index = {o: i for i, o in enumerate(origins)}

    point_ids = array("d")
    genre_bits = array("I")
    release_days = array("i")
    votes = array("I")
    popularity = array("f")
    fingerprints = bytearray()
    scores = bytearray()
    origin_column = bytearray()
    flags = bytearray()
    for r in rows:
        point_ids.append(float(r["point_id"]))
        bits = 0
        for g in r["genres"]:
            bits |= genre_bit[g]
        genre_bits.append(bits)
        release_days.append(UNKNOWN_DAY if r["release_day"] is None else r["release_day"])
        votes.append(max(0, min(UINT32_MAX, _round(r["votes"]))))
        popularity.append(float(r["popularity"]))
        if len(r["fingerprint"]) != FINGERPRINT_LENGTH:
            raise ValueError(f"Point id {r['point_id']} has {len(r['fingerprint'])} scores")
        fingerprints += r["fingerprint"]
        score = r["score"]
        scores.append(UNKNOWN_SCORE if score is None else max(0, min(100, math.floor(score))))
        origin = r["origin"]
        origin_column.append(UNKNOWN_ORIGIN if origin is None else origin_index.get(origin, UNKNOWN_ORIGIN))
        flags.append((FLAG_POSTER if r["poster"] else 0) | (FLAG_BACKDROP if r["backdrop"] else 0)
                     | (FLAG_ADULT if r["adult"] else 0) | (FLAG_ANIME if r["anime"] else 0))

    data = b"".join([
        point_ids.tobytes(), genre_bits.tobytes(), release_days.tobytes(), votes.tobytes(),
        popularity.tobytes(), bytes(fingerprints), bytes(scores), bytes(origin_column), bytes(flags),
    ])
    assert len(data) == len(rows) * BYTES_PER_TITLE
    chunks = [data[at:at + CHUNK_BYTES] for at in range(0, len(data), CHUNK_BYTES)] or [b""]
    manifest = {
        "version": version,
        "format": FORMAT,
        "count": len(rows),
        "chunks": len(chunks),
        "sha256": sha256(data).hexdigest(),
        "keyOrder": KEY_ORDER,
        "genres": genres,
        "origins": origins,
        "builtAt": built_at.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        **(extra or {}),
    }
    return manifest, chunks


def chunk_key(version: str, n: int) -> str:
    return f"title-snapshot:{version}:{n}"


def version_of(built_at: datetime) -> str:
    return built_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


# ---- Redis -----------------------------------------------------------------


def current_manifest(redis) -> Optional[dict]:
    raw = redis.get(CURRENT_KEY)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return None


def _scan(redis, match: str) -> Iterable[bytes]:
    """Every key matching the pattern, on every primary of a cluster or on a single Redis."""
    if hasattr(redis, "get_primaries"):
        for node in redis.get_primaries():
            yield from redis.scan_iter(match=match, count=5000, target_nodes=node)
    else:
        yield from redis.scan_iter(match=match, count=5000)


def publish(redis, manifest: dict, chunks: list[bytes], previous: Optional[dict]) -> int:
    """Writes the chunks, swaps the manifest, then deletes the chunks of every other version but
    the previous one. Returns the number of chunks deleted."""
    version = manifest["version"]
    for n, chunk in enumerate(chunks):
        redis.set(chunk_key(version, n), chunk)
    redis.set(CURRENT_KEY, json.dumps(manifest, separators=(",", ":")))
    keep = {version, previous.get("version") if previous else None}
    pruned = 0
    for key in list(_scan(redis, "title-snapshot:*:*")):
        name = key.decode() if isinstance(key, bytes) else key
        if name.split(":")[1] not in keep:
            pruned += redis.delete(key)
    return pruned


class _Lock:
    """One publish at a time: the pruning of one run must not delete the chunks another is writing."""

    def __init__(self, redis) -> None:
        self.redis = redis
        self.token = uuid.uuid4().hex

    def __enter__(self) -> bool:
        self.held = bool(self.redis.set(LOCK_KEY, self.token, nx=True, ex=LOCK_SECONDS))
        return self.held

    def __exit__(self, *exc) -> None:
        if self.held:
            value = self.redis.get(LOCK_KEY)
            if value in (self.token, self.token.encode()):
                self.redis.delete(LOCK_KEY)


# ---- Entrypoint for Windmill ------------------------------------------------


def run(redis, select: Callable[[str, list], list], *, force: bool = False, dry_run: bool = False,
        now: Optional[Callable[[], datetime]] = None) -> dict[str, Any]:
    now = now or (lambda: datetime.now(timezone.utc))
    started = time.monotonic()
    previous = current_manifest(redis)
    mark = source_mark(select)
    if not force and previous and previous.get("sourceMark") == mark:
        return {"published": False, "reason": "no title analysis changed since the current version",
                "version": previous.get("version"), "source_mark": mark}
    # A dry run writes nothing, not even the lock.
    with (nullcontext(True) if dry_run else _Lock(redis)) as held:
        if not held:
            return {"published": False, "reason": "another publish is running", "source_mark": mark}
        timings = {}
        rows = []
        for media_type in TABLES:
            at = time.monotonic()
            found = read_rows(select, media_type)
            timings[f"read_{media_type}s_seconds"] = round(time.monotonic() - at, 1)
            print(f"Read {len(found)} {media_type}s in {timings[f'read_{media_type}s_seconds']} s", flush=True)
            rows += found
        built_at = now()
        version = version_of(built_at)
        if previous and previous.get("version") == version:
            raise RuntimeError(f"Version {version} is already current")
        at = time.monotonic()
        manifest, chunks = encode_snapshot(rows, version, built_at, {"sourceMark": mark})
        timings["encode_seconds"] = round(time.monotonic() - at, 1)
        summary = {
            "published": False, "version": version, "count": manifest["count"], "chunks": manifest["chunks"],
            "bytes": manifest["count"] * BYTES_PER_TITLE, "genres": len(manifest["genres"]),
            "origins": len(manifest["origins"]), "sha256": manifest["sha256"], "source": "crate",
            "source_mark": mark, "previous_version": previous.get("version") if previous else None,
        }
        if not dry_run:
            at = time.monotonic()
            summary["pruned_chunks"] = publish(redis, manifest, chunks, previous)
            timings["write_seconds"] = round(time.monotonic() - at, 1)
            summary["published"] = True
        timings["total_seconds"] = round(time.monotonic() - started, 1)
        return {**summary, **timings}


def main(force: bool = False, dry_run: bool = False):
    """Publish the title snapshot when a title analysis changed since the current version."""
    crate = CrateConnector()
    redis = RedisConnector(decode_responses=False).get_redis()
    try:
        def select(sql: str, params: list) -> list:
            crate.cur.execute(sql, params)
            return crate.cur.fetchall()

        result = run(redis, select, force=force, dry_run=dry_run)
        print(json.dumps(result), flush=True)
        return result
    finally:
        crate.disconnect()
        redis.close()
