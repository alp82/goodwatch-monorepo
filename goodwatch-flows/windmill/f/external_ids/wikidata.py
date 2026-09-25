"""Wikidata Query Service exports of IMDb, Rotten Tomatoes and Metacritic ids.

Policy (https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual):
60 s per query, 60 s of processing per minute per client, an honest User-Agent
with contact information, and a 429 with `Retry-After` must be honoured.

Two exports per run, one per TMDB property, run one after the other:
- shows: P4983 (TMDB TV series id), about 64k rows, about 35 s;
- movies: P4947 (TMDB movie id), about 285k rows, about 30 s.
A single query over both hit the 60 s deadline. Each export is followed by a
pause at least as long as the query, and a 429 stops the run: no retry, no
second query.
"""
import csv
import io
import re
import time
from dataclasses import dataclass, field

import requests

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "GoodWatchBot/0.1 (https://goodwatch.app; hello@goodwatch.app) wikidata-id-backfill"
TIMEOUT_SECONDS = 90
PAUSE_BETWEEN_EXPORTS_SECONDS = 60

# The optimizer hint keeps Blazegraph on the written order: start from the small
# TMDB property and look up the others per item. Without it the movie export
# started from P345 (millions of IMDb ids, people included) and timed out.
_QUERY = """SELECT ?item ?tmdb ?imdb ?rt ?mc WHERE {{
  hint:Query hint:optimizer "None" .
  ?item wdt:{tmdb_property} ?tmdb .
  OPTIONAL {{ ?item wdt:P345 ?imdb }}
  OPTIONAL {{ ?item wdt:P1258 ?rt }}
  OPTIONAL {{ ?item wdt:P1712 ?mc }}
}}"""
QUERIES = {
    "tv": _QUERY.format(tmdb_property="P4983"),
    "movie": _QUERY.format(tmdb_property="P4947"),
}
COLUMNS = ["item", "tmdb", "imdb", "rt", "mc"]
# A normal export has 64k (tv) and 285k (movie) rows. Far fewer means Wikidata
# returned something partial, and nothing should be written from it.
MIN_ROWS = {"tv": 40_000, "movie": 200_000}

ENTITY_PREFIX = "http://www.wikidata.org/entity/"
ROTTEN_TOMATOES_BASE = "https://www.rottentomatoes.com/"
METACRITIC_BASE = "https://www.metacritic.com/"
# Series or film level ids only. Season and episode ids (tv/x/s01, tv/x/season-1/...)
# are left out: season URLs follow from the show URL.
ROTTEN_TOMATOES_ID = {"tv": re.compile(r"tv/[^/\s]+"), "movie": re.compile(r"m/[^/\s]+")}
METACRITIC_ID = {"tv": re.compile(r"tv/[^/\s]+"), "movie": re.compile(r"movie/[^/\s]+")}
IMDB_ID = re.compile(r"tt\d+")
TMDB_ID = re.compile(r"\d+")


class WikidataExportError(RuntimeError):
    pass


class WikidataRateLimited(WikidataExportError):
    def __init__(self, retry_after):
        super().__init__(f"Wikidata answered 429; Retry-After: {retry_after}. Stopping this run.")
        self.retry_after = retry_after


@dataclass
class WikidataIds:
    imdb: set = field(default_factory=set)
    rotten_tomatoes: set = field(default_factory=set)
    metacritic: set = field(default_factory=set)
    items: set = field(default_factory=set)


def run_export(kind: str, http=requests, min_rows: int | None = None) -> list[dict]:
    response = http.post(
        ENDPOINT,
        data={"query": QUERIES[kind]},
        headers={"User-Agent": USER_AGENT, "Accept": "text/csv"},
        timeout=TIMEOUT_SECONDS,
    )
    if response.status_code == 429:
        raise WikidataRateLimited(response.headers.get("Retry-After"))
    if response.status_code != 200:
        raise WikidataExportError(f"Wikidata {kind} export failed: HTTP {response.status_code}")
    rows = parse_export(response.text, kind)
    minimum = MIN_ROWS[kind] if min_rows is None else min_rows
    if len(rows) < minimum:
        raise WikidataExportError(f"Wikidata {kind} export returned {len(rows)} rows, expected at least {minimum}")
    return rows


def parse_export(text: str, kind: str) -> list[dict]:
    """Rows of a CSV export. A query that hits the deadline still answers 200 and
    appends a Java stack trace, so every row must start with an entity IRI."""
    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    if header != COLUMNS:
        raise WikidataExportError(f"Wikidata {kind} export has unexpected columns: {header}")
    rows = []
    for number, values in enumerate(reader, start=2):
        if not values:
            continue
        if len(values) != len(COLUMNS) or not values[0].startswith(ENTITY_PREFIX):
            raise WikidataExportError(f"Wikidata {kind} export is truncated or malformed at line {number}")
        record = dict(zip(COLUMNS, values))
        record["item"] = record["item"][len(ENTITY_PREFIX):]
        rows.append(record)
    return rows


def fetch_exports(http=requests, sleep=time.sleep, min_rows: int | None = None) -> dict[str, list[dict]]:
    exports = {}
    for index, kind in enumerate(("tv", "movie")):
        if index:
            sleep(max(PAUSE_BETWEEN_EXPORTS_SECONDS, last_duration))
        started = time.monotonic()
        exports[kind] = run_export(kind, http=http, min_rows=min_rows)
        last_duration = time.monotonic() - started
        print(f"Wikidata {kind} export: {len(exports[kind])} rows in {last_duration:.1f} s", flush=True)
    return exports


def collect_ids(rows: list[dict], kind: str, stats: dict) -> dict[int, WikidataIds]:
    """Wikidata's ids per TMDB id. Values of the wrong shape or level are dropped."""
    by_tmdb: dict[int, WikidataIds] = {}
    for record in rows:
        tmdb = record["tmdb"].strip()
        if not TMDB_ID.fullmatch(tmdb):
            stats["invalid_tmdb_id"] = stats.get("invalid_tmdb_id", 0) + 1
            continue
        ids = by_tmdb.setdefault(int(tmdb), WikidataIds())
        ids.items.add(record["item"])
        imdb = record["imdb"].strip()
        if IMDB_ID.fullmatch(imdb):
            ids.imdb.add(imdb)
        rotten_tomatoes = record["rt"].strip()
        if ROTTEN_TOMATOES_ID[kind].fullmatch(rotten_tomatoes):
            ids.rotten_tomatoes.add(ROTTEN_TOMATOES_BASE + rotten_tomatoes)
        metacritic = record["mc"].strip()
        if METACRITIC_ID[kind].fullmatch(metacritic):
            ids.metacritic.add(METACRITIC_BASE + metacritic)
    return by_tmdb


def main():
    pass
