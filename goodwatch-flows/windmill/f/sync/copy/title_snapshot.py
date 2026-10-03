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

Next to it sits the optional ratings sidecar, format 1, which the webapp's age and content
filter reads. A webapp that predates it ignores it, and the snapshot above is the same bytes
with or without it:

- `title-snapshot:<version>:ratings:<n>` holds its bytes, again in chunks of at most 1 MB.
- The manifest's `ratings` field holds its format, chunk count and SHA-256, the `countries`
  with an age column (sorted, at most 64) and each one's `ladders` entry: the steps of that
  country's rating ladder, ascending by age.

Joined, its chunks are uint8 columns in the snapshot's row order: content bits (`CONTENT_*`),
the estimate (the lower median age across the countries that rated the title), then one age
column per country in `countries` order, each the strictest of the title's ratings there.
255 is no rating. That is 2 + countries bytes per title.

One run:

1. Reads a mark of the analyses in Crate: per table, the count and the sum of
   `dna_updated_at`. A new, changed or removed analysis moves it. When it equals the mark in
   the current manifest, the run exits without a new version, unless `force` is set.
2. Reads the titles from Crate in pages of `PAGE_SIZE` by tmdb_id, filtered on
   `dna_updated_at` (a timestamp with doc values). The 74 scores come from the typed
   `fingerprint_scores[...]` subcolumns; reading the whole object column is about five
   times slower and has pages near the 10 s timeout.
3. Builds the ratings sidecar from a second, narrow read of the same titles and the
   `age_certification` lookup table. Whatever fails there is logged and the snapshot is
   published without the `ratings` field: the sidecar never stops a publish.
4. Writes the chunks of the new version, swaps `title-snapshot:current`, and deletes the
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
import re
import sys
import time
import traceback
import uuid
from array import array
from collections import Counter
from contextlib import nullcontext
from datetime import datetime, timezone
from functools import lru_cache
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

RATINGS_FORMAT = 1
NO_AGE = 255
MAX_AGE = 18
MAX_RATING_COUNTRIES = 64
MIN_LADDER_STEPS = 2
CONTENT_VIOLENCE = 1
CONTENT_SEX = 2
CONTENT_DISTURBING = 4
CONTENT_LANGUAGE = 8
CONTENT_DRUGS = 16

# The `ContentAdvisory` tags of a title analysis (f/dna/models.py) as the filter's content kinds.
# A tag that is not listed sets no bit.
ADVISORY_CONTENT = {
    "Violence": CONTENT_VIOLENCE,
    "Nudity": CONTENT_SEX,
    "Sexual Content": CONTENT_SEX,
    "Strong Language": CONTENT_LANGUAGE,
    "Drug Use": CONTENT_DRUGS,
    "Suicide Themes": CONTENT_DISTURBING,
    "Disturbing Imagery": CONTENT_DISTURBING,
}

# Ages for the rating codes that are words, per country. A code that is not listed falls back
# to the first number in it, then to `ALL_AGES`. Codes are matched without case and spaces.
_PARENTAL_GUIDANCE = 8
_US_AGES = {
    "G": 0, "PG": _PARENTAL_GUIDANCE, "PG-13": 13, "R": 17, "NC-17": 18,
    "TV-Y": 0, "TV-Y7": 7, "TV-G": 0, "TV-PG": _PARENTAL_GUIDANCE, "TV-14": 14, "TV-MA": 17,
}
WORD_AGES = {
    "US": _US_AGES,
    "PR": _US_AGES,
    "GB": {"U": 0, "PG": _PARENTAL_GUIDANCE, "12A": 12, "12": 12, "15": 15, "18": 18, "R18": 18},
    "IE": {"G": 0, "PG": _PARENTAL_GUIDANCE},
    "AU": {"G": 0, "PG": _PARENTAL_GUIDANCE, "M": 15, "MA 15+": 15, "R 18+": 18, "X 18+": 18,
           "P": 0, "C": 0, "AV 15+": 15},
    "NZ": {"G": 0, "PG": _PARENTAL_GUIDANCE, "M": 16, "R": 18},
    "CA": {"G": 0, "PG": _PARENTAL_GUIDANCE, "14A": 14, "18A": 18, "R": 18, "A": 18,
           "C": 0, "C8": 8, "14+": 14, "18+": 18},
    "IN": {"U": 0, "UA": 12, "U/A": 12, "A": 18, "S": 18},
    "SG": {"G": 0, "PG": _PARENTAL_GUIDANCE},
    "PH": {"G": 0, "PG": _PARENTAL_GUIDANCE, "X": 18},
    "ZA": {"A": 0, "PG": _PARENTAL_GUIDANCE, "XX": 18},
    "HK": {"I": 0, "II": 12, "IIA": 12, "IIB": 16, "III": 18},
    "MX": {"AA": 0, "A": 0, "B": 12, "B-15": 15, "B15": 15, "C": 18, "D": 18},
    "BG": {"A": 0, "B": 0, "C": 12, "D": 16, "X": 18},
    "VN": {"P": 0, "K": _PARENTAL_GUIDANCE, "C": 18},
    "AR": {"ATP": 0, "C": 18},
    "ES": {"A": 0, "Ai": 0, "APTA": 0, "X": 18},
    "HU": {"KN": 0, "X": 18},
    "LT": {"V": 0, "S": 18},
    "FI": {"S": 0},
    "SE": {"Btl": 0},
    "GR": {"K": 0},
    "PT": {"Públicos": 0},
    "KR": {"All": 0, "Restricted Screening": 18},
}
ALL_AGES = {"AL", "ALL", "TP", "U", "T", "A", "AA", "L", "G", "ATP", "SU", "EA", "TE"}

# The US rates films and shows on two ladders that do not share ages, so its steps are fixed.
US_LADDER = [
    {"age": 0, "label": "G", "show": "TV-G"},
    {"age": 8, "label": "PG", "show": "TV-PG"},
    {"age": 14, "label": "PG-13", "show": "TV-14"},
    {"age": 17, "label": "R", "show": "TV-MA"},
]
LABEL_PREFIX = {"DE": "FSK "}


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
    or removed. Two aggregates over a timestamp column, well under a second. `ratings` is the
    sidecar's format, so that the first run of a publisher that writes a new one publishes."""
    mark = {}
    for media_type, (table, _, _) in TABLES.items():
        count, total = select(f"SELECT count(dna_updated_at), sum(dna_updated_at) FROM {table}", [])[0]
        mark[media_type] = [int(count or 0), int(total or 0)]
    mark["ratings"] = RATINGS_FORMAT
    return mark


# ---- Ratings ---------------------------------------------------------------


def _code_key(code: str) -> str:
    return "".join(code.split()).upper()


_WORD_AGES = {country: {_code_key(code): age for code, age in ages.items()} for country, ages in WORD_AGES.items()}
_COUNTRY = re.compile(r"[A-Z]{2}")
_NUMBER = re.compile(r"\d+")


def code_age(country: str, code: str) -> Optional[int]:
    """The age a rating code stands for, 0 to 18; None when it is not an age rating (NR,
    Unrated, free text)."""
    key = _code_key(code)
    age = _WORD_AGES.get(country, {}).get(key)
    if age is not None:
        return age
    number = _NUMBER.search(key)
    if number:
        return min(MAX_AGE, int(number.group()))
    return 0 if key in ALL_AGES else None


@lru_cache(maxsize=65536)
def parse_certification(text: str) -> Optional[tuple[str, int]]:
    """Country and age of one `age_certifications` entry such as `DE_12` or `AU_MA 15+`: the
    country, an underscore, then the code, which may hold spaces and more underscores. Cached:
    the titles share a few thousand distinct entries."""
    country, separator, code = text.partition("_")
    country = country.strip().upper()
    if not separator or not _COUNTRY.fullmatch(country):
        return None
    age = code_age(country, code)
    return None if age is None else (country, age)


def strictest_ages(ratings: Iterable[tuple[str, int]]) -> dict[str, int]:
    """Per country, the highest age among a title's ratings there."""
    ages: dict[str, int] = {}
    for country, age in ratings:
        if age > ages.get(country, -1):
            ages[country] = age
    return ages


def estimate_age(ages: Iterable[int]) -> int:
    """The median age across the countries that rated a title, the lower one of an even count;
    `NO_AGE` when none did."""
    ordered = sorted(ages)
    return ordered[(len(ordered) - 1) // 2] if ordered else NO_AGE


def content_bits(advisories: Optional[Iterable]) -> int:
    bits = 0
    for tag in advisories or []:
        bits |= ADVISORY_CONTENT.get(tag, 0) if isinstance(tag, str) else 0
    return bits


def build_ladders(certifications: Iterable[list]) -> dict[str, list[dict]]:
    """Each country's rating ladder from the `age_certification` rows (code, country, media
    type, order): the distinct ages of its movie codes, each labelled by the code with the
    lowest order; show codes add steps only for the ages the movie codes lack. A step carries
    `show` where the country's show codes have that age but none of them is the step's own
    code. Countries with fewer than two steps are left out."""
    codes: dict[str, dict[str, list]] = {}
    for code, country, media_type, order in certifications:
        if not isinstance(code, str) or not isinstance(country, str) or not _COUNTRY.fullmatch(country):
            continue
        if media_type not in TABLES:
            continue
        age = code_age(country, code)
        if age is not None:
            rank = order if isinstance(order, (int, float)) else math.inf
            codes.setdefault(country, {m: [] for m in TABLES})[media_type].append((rank, code.strip(), age))
    ladders = {}
    for country, by_type in codes.items():
        prefix = LABEL_PREFIX.get(country, "")
        movie: dict[int, str] = {}
        show: dict[int, list[str]] = {}
        for _, code, age in sorted(by_type["movie"]):
            movie.setdefault(age, code)
        for _, code, age in sorted(by_type["show"]):
            show.setdefault(age, []).append(code)
        steps = []
        for age in sorted(movie.keys() | show.keys()):
            if age not in movie:
                steps.append({"age": age, "label": prefix + show[age][0]})
            elif age in show and _code_key(movie[age]) not in {_code_key(code) for code in show[age]}:
                steps.append({"age": age, "label": prefix + movie[age], "show": prefix + show[age][0]})
            else:
                steps.append({"age": age, "label": prefix + movie[age]})
        ladders[country] = steps
    ladders["US"] = [dict(step) for step in US_LADDER]
    return {country: steps for country, steps in ladders.items() if len(steps) >= MIN_LADDER_STEPS}


def read_ladders(select: Callable[[str, list], list]) -> dict[str, list[dict]]:
    return build_ladders(_with_retries(lambda: select(
        "SELECT certification_code, country_code, media_type, order_default FROM age_certification", [])))


def read_ratings(select: Callable[[str, list], list], media_type: str) -> dict[int, tuple[int, tuple]]:
    """Per point id, the content bits and the (country, age) ratings of every title of one media
    type that has any. Its own pages rather than two more columns on the snapshot's, so that a
    page that fails or times out here cannot fail the snapshot."""
    table, _, base = TABLES[media_type]
    sql = (
        f"SELECT tmdb_id, age_certifications, content_advisories FROM {table}"
        f" WHERE dna_updated_at IS NOT NULL AND tmdb_id > ? ORDER BY tmdb_id LIMIT {PAGE_SIZE}"
    )
    titles: dict[int, tuple[int, tuple]] = {}
    last = -1
    while True:
        records = _with_retries(lambda: select(sql, [last]))
        for tmdb_id, certifications, advisories in records:
            parsed = (parse_certification(c) for c in certifications or [] if isinstance(c, str))
            ratings = tuple(rating for rating in parsed if rating)
            bits = content_bits(advisories)
            if ratings or bits:
                titles[base + int(tmdb_id)] = (bits, ratings)
        if len(records) < PAGE_SIZE:
            return titles
        last = records[-1][0]


def encode_ratings(point_ids: list[int], titles: dict[int, tuple[int, tuple]], ladders: dict[str, list[dict]]
                   ) -> tuple[dict, list[bytes]]:
    """The manifest's `ratings` field and the sidecar's chunks, for the snapshot's titles in its
    row order. Of more countries than the format holds, those that rated the most titles stay."""
    count = len(point_ids)
    content = bytearray(count)
    estimate = bytearray([NO_AGE]) * count
    columns = {country: bytearray([NO_AGE]) * count for country in ladders}
    rated: Counter = Counter()
    for row, point_id in enumerate(point_ids):
        bits, ratings = titles.get(point_id, (0, ()))
        content[row] = bits
        ages = strictest_ages(ratings)
        estimate[row] = estimate_age(ages.values())
        for country, age in ages.items():
            if country in columns:
                columns[country][row] = age
                rated[country] += 1
    countries = sorted(sorted(columns, key=lambda c: (-rated[c], c))[:MAX_RATING_COUNTRIES])
    data = b"".join([bytes(content), bytes(estimate), *(bytes(columns[c]) for c in countries)])
    assert len(data) == count * (2 + len(countries))
    chunks = [data[at:at + CHUNK_BYTES] for at in range(0, len(data), CHUNK_BYTES)] or [b""]
    field = {
        "format": RATINGS_FORMAT,
        "chunks": len(chunks),
        "sha256": sha256(data).hexdigest(),
        "countries": countries,
        "ladders": {country: ladders[country] for country in countries},
    }
    return field, chunks


def build_ratings(select: Callable[[str, list], list], point_ids: list[int]) -> tuple[dict, list[bytes]]:
    ladders = read_ladders(select)
    titles: dict[int, tuple[int, tuple]] = {}
    for media_type in TABLES:
        titles.update(read_ratings(select, media_type))
    return encode_ratings(point_ids, titles, ladders)


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


def ratings_chunk_key(version: str, n: int) -> str:
    return f"title-snapshot:{version}:ratings:{n}"


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


def write_ratings(redis, version: str, chunks: list[bytes]) -> None:
    """Writes the sidecar's chunks; when a write fails, deletes the ones written and raises."""
    try:
        for n, chunk in enumerate(chunks):
            redis.set(ratings_chunk_key(version, n), chunk)
    except Exception:
        for n in range(len(chunks)):
            try:
                redis.delete(ratings_chunk_key(version, n))
            except Exception:
                pass
        raise


def publish(redis, manifest: dict, chunks: list[bytes], previous: Optional[dict]) -> int:
    """Writes the chunks, swaps the manifest, then deletes the chunks of every other version but
    the previous one, ratings chunks included. Returns the number of chunks deleted."""
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


def _without_ratings(step: str, error: Exception) -> str:
    print(f"RATINGS SIDECAR FAILED while {step}: {error!r}. Publishing the snapshot without it; the age and"
          f" content filter stays unavailable until a later run publishes one.\n{traceback.format_exc()}", flush=True)
    return f"{step}: {error!r}"


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
        # The sidecar is built and written apart from the snapshot, so that nothing in it can
        # stop the publish: a failure leaves the manifest without `ratings`.
        ratings = None
        at = time.monotonic()
        try:
            ratings = build_ratings(select, sorted(row["point_id"] for row in rows))
            summary["ratings"] = {"countries": len(ratings[0]["countries"]), "chunks": ratings[0]["chunks"],
                                  "bytes": manifest["count"] * (2 + len(ratings[0]["countries"]))}
        except Exception as error:
            summary["ratings_error"] = _without_ratings("building it", error)
        timings["ratings_seconds"] = round(time.monotonic() - at, 1)
        if not dry_run:
            at = time.monotonic()
            if ratings:
                try:
                    write_ratings(redis, version, ratings[1])
                    manifest["ratings"] = ratings[0]
                except Exception as error:
                    summary.pop("ratings", None)
                    summary["ratings_error"] = _without_ratings("writing it", error)
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
