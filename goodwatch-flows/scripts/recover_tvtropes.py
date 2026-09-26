#!/usr/bin/env python3
"""Bounded, supervised TV Tropes recovery from the dev machine. See docs/tvtropes.md.

Three steps; none of them writes to a database:

  queue   read-only: the most popular titles without tropes and their known URLs
          (stored URL, Wikidata P6839, the CC0 tvtropes2imdb mapping), in popularity order
  run     crawl a queue over plain HTTP at one pace, stop on any 403, 429 or challenge,
          and resume where the last run stopped
  review  write the review table that `import_tvtropes_recovered.py build-manifest` reads

Nothing is guessed: a title without a known URL is never requested. Not-found pages and
rejected matches go to a negative cache for 90 days. A block stops the run, is logged
in the state file, and keeps every later run from starting until its deadline.
"""

import argparse
import csv
import gzip
import hashlib
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Optional

import requests

FLOWS = Path(__file__).resolve().parents[1]
REPO = FLOWS.parent
sys.path.insert(0, str(FLOWS / "windmill"))
from f.critic_sites.polite_http import FetchError, Page, SiteBlocked, block_deadline, block_reason
from f.tvtropes_web import crawl
from f.tvtropes_web.pages import BASE_URL
from f.tvtropes_web.title_variations import title_variations

USER_AGENT = crawl.USER_AGENT + "-recovery"
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
}
TIMEOUT_SECONDS = 20
DEFAULT_STATE = REPO / "docs/research/tvtropes-repair/runner-state.json"
MAPPING = FLOWS / "scripts/data/tvtropes2imdb.csv"
NEGATIVE_DAYS = 90
# Bump when the identity rules change: identity rejections made under other rules expire.
IDENTITY_RULES = "2026-09-26 strict+known_url"
MIN_DELAY, DEFAULT_DELAY = 2.0, 6.0
MAX_REQUESTS = 5000
# Three failures in a row (5xx, timeouts, broken subpages) look like trouble: stop.
MAX_FAILURES_IN_A_ROW = 3
# A resumed run skips titles with these statuses.
TERMINAL = ("recovered", "identified_no_tropes", "not_found", "rejected", "no_known_url", "no_release_year")
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
WIKIDATA_QUERY = """SELECT ?tt ?movie ?show WHERE {
  ?item wdt:P6839 ?tt .
  OPTIONAL { ?item wdt:P4947 ?movie }
  OPTIONAL { ?item wdt:P4983 ?show }
  FILTER(BOUND(?movie) || BOUND(?show))
}"""


def utcnow():
    return datetime.now(timezone.utc)


# ===== State: negative cache and blocks =====


class State:
    """The runner's memory between runs, a JSON file: the negative cache and the block log."""

    def __init__(self, path: Path):
        self.path = path
        data = json.loads(path.read_text()) if path.exists() else {}
        self.negative = data.get("negative", {})
        self.blocked_until = data.get("blocked_until")
        self.blocks = data.get("blocks", [])

    def is_negative(self, url: str, now: datetime) -> bool:
        entry = self.negative.get(url)
        if not entry or datetime.fromisoformat(entry["until"]) <= now:
            return False
        rejected_by_rules = entry["outcome"] == "rejected" and (entry.get("reason") or "").startswith("identity")
        return not rejected_by_rules or entry.get("rules") == IDENTITY_RULES

    def add_negative(self, url: str, outcome: str, reason: str, key: str, now: datetime):
        self.negative[url] = {"outcome": outcome, "reason": reason, "title": key, "rules": IDENTITY_RULES,
                              "at": now.isoformat(),
                              "until": (now + timedelta(days=NEGATIVE_DAYS)).isoformat()}

    def blocked(self, now: datetime) -> Optional[datetime]:
        until = datetime.fromisoformat(self.blocked_until) if self.blocked_until else None
        return until if until and until > now else None

    def add_block(self, until: datetime, reason: str, url: Optional[str], now: datetime):
        current = self.blocked(now)
        self.blocked_until = max(until, current).isoformat() if current else until.isoformat()
        self.blocks.append({"at": now.isoformat(), "until": until.isoformat(), "reason": reason, "url": url})

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {"negative": dict(sorted(self.negative.items())), "blocked_until": self.blocked_until,
                "blocks": self.blocks}
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
        tmp.replace(self.path)


# ===== HTTP =====


class BudgetExhausted(Exception):
    pass


class LocalClient:
    """Plain HTTP at one pace for the whole site, with a request budget. Saves every
    response under `sources/` and raises SiteBlocked on a 403, 429 or challenge."""

    def __init__(self, sources: Path, delay: float, max_requests: int, http=None,
                 sleep: Callable[[float], None] = time.sleep, clock: Callable[[], float] = time.monotonic,
                 now: Callable[[], datetime] = utcnow):
        self.sources, self.delay, self.max_requests = sources, delay, max_requests
        self.http = http or requests.Session()
        self.sleep, self.clock, self.now = sleep, clock, now
        self.log: list[dict] = []
        self.last: Optional[float] = None

    def get(self, url: str) -> Page:
        if len(self.log) >= self.max_requests:
            raise BudgetExhausted(f"request budget of {self.max_requests} used")
        if self.last is not None:
            self.sleep(max(0.0, self.delay - (self.clock() - self.last)))
        self.last = self.clock()
        record = {"requested_url": url, "started_at": self.now().isoformat()}
        self.log.append(record)
        try:
            response = self.http.get(url, headers=HEADERS, timeout=TIMEOUT_SECONDS, allow_redirects=True)
        except requests.exceptions.RequestException as error:
            record["error"] = f"{type(error).__name__}"
            raise FetchError(f"{type(error).__name__} for {url}") from error
        finally:
            record["elapsed_seconds"] = round(self.clock() - self.last, 3)
        body = response.content or b""
        digest = hashlib.sha256(body).hexdigest()
        self.sources.mkdir(parents=True, exist_ok=True)
        (self.sources / f"{digest}.html.gz").write_bytes(gzip.compress(body))
        record.update(url=response.url or url, status=response.status_code, sha256=digest,
                      source_file=f"sources/{digest}.html.gz")
        text = response.text
        reason = block_reason(response.status_code, response.headers, text)
        if reason:
            now = self.now().replace(tzinfo=None)
            until = block_deadline(response.status_code, response.headers, now).replace(tzinfo=timezone.utc)
            record["blocked"] = reason
            raise SiteBlocked("tvtropes", until, reason)
        return Page(status=response.status_code, url=response.url or url, text=text, requested_url=url)


# ===== Run =====


def code_hashes():
    paths = [Path(__file__).resolve()] + [FLOWS / "windmill/f/tvtropes_web" / name
                                          for name in ("crawl.py", "pages.py", "title_variations.py")]
    return {str(path.relative_to(FLOWS)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}


def load_queue(path: Path) -> list[dict]:
    data = json.loads(path.read_text())
    entries = data["entries"] if isinstance(data, dict) else data
    keys = [(e["media_type"], e["tmdb_id"]) for e in entries]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate media-type/TMDB identities in the queue")
    for entry in entries:
        if entry["media_type"] not in ("movie", "show"):
            raise ValueError(f"Unknown media type {entry['media_type']!r}")
    # Most popular first, whatever order the file has.
    return sorted(entries, key=lambda e: (-(e.get("popularity") or 0), e["media_type"], e["tmdb_id"]))


def record_outcome(entry: dict, outcome: crawl.Outcome, state: State, now: datetime) -> dict:
    key = f"{entry['media_type']}:{entry['tmdb_id']}"
    for candidate in outcome.candidates:
        if candidate["outcome"] in ("not_found", "rejected"):
            state.add_negative(candidate["url"], candidate["outcome"], candidate["reason"], key, now)
    # `result` has the shape import_tvtropes_recovered.py reads.
    rule = next((c.get("rule") for c in outcome.candidates if c["outcome"] == "identified"), None)
    return {"status": outcome.status, "source": outcome.source, "rule": rule, "candidates": outcome.candidates,
            "intro": outcome.intro,
            "result": {"url": outcome.url, "tropes": outcome.tropes, "rate_limit_reached": False}}


def run(queue_path: Path, output: Path, state_path: Path, delay: float, max_requests: int,
        http=None, sleep=time.sleep, clock=time.monotonic, now=utcnow, out=print) -> dict:
    queue_bytes = queue_path.read_bytes()
    queue = load_queue(queue_path)
    state = State(state_path)
    started_at = now()
    blocked = state.blocked(started_at)
    if blocked:
        raise SystemExit(f"TV Tropes blocked this crawler; not starting before {blocked.isoformat()} "
                         f"(see {state_path})")
    output.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(queue_bytes).hexdigest()
    provenance = output / "manifest.sha256"
    if provenance.exists() and provenance.read_text().strip() != digest:
        raise ValueError("Output directory belongs to a different queue")
    provenance.write_text(digest + "\n")
    result_path = output / "results.jsonl"
    records = [json.loads(line) for line in result_path.read_text().splitlines()] if result_path.exists() else []
    done = {(r["media_type"], r["tmdb_id"]) for r in records if r["status"] in TERMINAL}
    client = LocalClient(output / "sources", delay, max_requests, http=http, sleep=sleep, clock=clock, now=now)
    hashes = code_hashes()
    stop_reason, failures, attempted = None, 0, 0
    monotonic_start = clock()
    for entry in queue:
        if (entry["media_type"], entry["tmdb_id"]) in done:
            continue
        first_request = len(client.log)
        record = dict(entry, started_at=now().isoformat(), code_sha256=hashes)
        try:
            outcome = crawl.crawl_title(
                client.get, entry["media_type"], entry.get("title") or entry.get("original_title"),
                entry.get("release_year"), entry.get("title_variations", []),
                [(c["source"], c["url"]) for c in entry.get("candidates", [])],
                lambda url: state.is_negative(url, now()), known_url_rule=True)
            record.update(record_outcome(entry, outcome, state, now()))
            failures = 0
        except BudgetExhausted as error:
            # The title is left unfinished; the next run starts it again.
            stop_reason = str(error)
            break
        except SiteBlocked as block:
            status = client.log[-1].get("status") if client.log else None
            record.update(status="rate_limited" if status == 429 else "source_access_blocked", error=block.reason)
            state.add_block(block.until, block.reason, client.log[-1]["requested_url"] if client.log else None, now())
            stop_reason = f"{block.reason}; stopped without retrying or working around the block"
        except (crawl.CrawlError, FetchError) as error:
            record.update(status="failed", error=str(error))
            failures += 1
            if failures >= MAX_FAILURES_IN_A_ROW:
                stop_reason = f"{failures} failures in a row; last: {error}"
        record["requests"] = client.log[first_request:]
        with result_path.open("a") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
        records.append(record)
        attempted += 1
        state.save()
        out(json.dumps({k: record.get(k) for k in ("media_type", "tmdb_id", "title", "status", "source")}
                       | {"requests": len(record["requests"]), "tropes": len((record.get("result") or {}).get("tropes") or [])},
                       ensure_ascii=False))
        if stop_reason:
            break
    state.save()
    latest = {(r["media_type"], r["tmdb_id"]): r for r in records}
    statuses = {}
    for r in latest.values():
        statuses[r["status"]] = statuses.get(r["status"], 0) + 1
    summary = {
        "started_at": started_at.isoformat(),
        "queue_sha256": digest,
        "code_sha256": hashes,
        "user_agent": USER_AGENT,
        "queue": len(queue),
        "attempted_this_run": attempted,
        "statuses": dict(sorted(statuses.items())),
        "unattempted": len(queue) - len(latest),
        "requests_this_run": len(client.log),
        "request_budget": max_requests,
        "request_spacing_seconds": delay,
        "elapsed_seconds_this_run": round(clock() - monotonic_start, 3),
        "http_statuses_this_run": {str(k): sum(1 for q in client.log if q.get("status") == k)
                                   for k in sorted({q.get("status") for q in client.log}, key=str)},
        "stop_reason": stop_reason,
        "production_writes": 0,
    }
    with (output / "attempts.jsonl").open("a") as handle:
        handle.write(json.dumps(summary) + "\n")
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    out(json.dumps(summary, indent=2))
    return summary


# ===== Review =====


def cell(text) -> str:
    return " ".join(str(text or "").replace("|", "/").split())


def review(output: Path) -> Path:
    """The review table for build-manifest: a reviewer checks each recovered row against its
    page and changes `review` to `ok`, or to anything else to keep it out."""
    latest = {}
    for line in (output / "results.jsonl").read_text().splitlines():
        record = json.loads(line)
        latest[(record["media_type"], record["tmdb_id"])] = record
    found = [r for r in latest.values() if r["status"] == "recovered"]
    other = [r for r in latest.values() if r["status"] != "recovered"]
    lines = [f"# TV Tropes recovery review: {output.name}", "",
             "Mark a recovered row `ok` only after checking that the page is this title (same work, year and medium).",
             "Rows passed by the `known_url` rule (title and a near year, medium from the namespace) need the closest look.",
             "Then run `import_tvtropes_recovered.py build-manifest` (docs/tvtropes.md).", "",
             f"## Recovered titles ({len(found)})", "",
             "| media | tmdb_id | title | year | page | tropes | source | introduction | verdict |",
             "|---|---|---|---|---|---|---|---|---|"]
    for r in sorted(found, key=lambda r: (-(r.get("popularity") or 0), r["media_type"], r["tmdb_id"])):
        page = r["result"]["url"].removeprefix(BASE_URL)
        lines.append(f"| {r['media_type']} | {r['tmdb_id']} | {cell(r.get('title'))} | {r.get('release_year')} | "
                     f"{page} | {len(r['result']['tropes'])} | {r.get('source')} ({r.get('rule') or 'strict'}) | {cell(r.get('intro'))[:300]} | review |")
    lines += ["", f"## Other outcomes ({len(other)})", "", "| media | tmdb_id | title | status | detail |",
              "|---|---|---|---|---|"]
    for r in sorted(other, key=lambda r: (r["status"], r["media_type"], r["tmdb_id"])):
        detail = r.get("error") or "; ".join(f"{c['url'].removeprefix(BASE_URL)} {c['outcome']} ({c['reason']})"
                                             for c in r.get("candidates") or [])
        lines.append(f"| {r['media_type']} | {r['tmdb_id']} | {cell(r.get('title'))} | {r['status']} | {cell(detail)} |")
    path = output / "review.md"
    path.write_text("\n".join(lines) + "\n")
    return path


# ===== Queue =====


def load_mapping(path: Path = MAPPING) -> dict:
    """IMDb id → TV Tropes Film/ page name (adorkin/tvtropes2imdb, CC0, 2023-02)."""
    with path.open(newline="") as handle:
        return {row["imdb_id"]: row["tvtropes"] for row in csv.DictReader(handle)}


def fetch_wikidata(http=None) -> dict:
    """(media_type, tmdb_id) → TV Tropes id such as `Film/PulpFiction`, from one SPARQL query."""
    http = http or requests
    response = http.get(WIKIDATA_SPARQL, params={"query": WIKIDATA_QUERY, "format": "json"},
                        headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"}, timeout=120)
    response.raise_for_status()
    ids = {}
    for row in response.json()["results"]["bindings"]:
        tt = row["tt"]["value"]
        for media_type, field in (("movie", "movie"), ("show", "show")):
            value = row.get(field, {}).get("value", "")
            if value.isdigit():
                # Several items can claim one TMDB id; keep the first, like the critic crawls.
                ids.setdefault((media_type, int(value)), tt)
    return ids


def build_queue(titles: list[dict], wikidata: dict, mapping: dict) -> tuple[list[dict], dict]:
    """Queue entries for titles without tropes that have at least one known URL, most popular first.

    `titles`: media_type, tmdb_id, title, original_title, release_year, popularity, title_variations,
    tvtropes_url, trope_count, imdb_id."""
    counts = {"titles": 0, "with_tropes": 0, "no_known_url": 0, "queued": 0,
              "sources": {source: 0 for source in crawl.SOURCES}}
    entries = []
    for title in sorted(titles, key=lambda t: (-(t.get("popularity") or 0), t["media_type"], t["tmdb_id"])):
        counts["titles"] += 1
        if title.get("trope_count"):
            counts["with_tropes"] += 1
            continue
        candidates = crawl.candidate_urls(
            title["media_type"], stored=title.get("tvtropes_url"),
            wikidata=wikidata.get((title["media_type"], title["tmdb_id"])),
            tvtropes2imdb=mapping.get(title.get("imdb_id") or ""))
        if not candidates:
            counts["no_known_url"] += 1
            continue
        for source, _ in candidates:
            counts["sources"][source] += 1
        counts["queued"] += 1
        entries.append({
            "media_type": title["media_type"], "tmdb_id": title["tmdb_id"],
            "title": title.get("title") or title.get("original_title"),
            "original_title": title.get("original_title"), "release_year": title.get("release_year"),
            "popularity": title.get("popularity"),
            "title_variations": title_variations([title.get("title") or "", title.get("original_title") or "",
                                                  *(title.get("title_variations") or [])]),
            "imdb_id": title.get("imdb_id"), "before_url": title.get("tvtropes_url"),
            "candidates": [{"source": source, "url": url} for source, url in candidates],
        })
    return entries, counts


def read_titles(db, media_type: str, top: int) -> list[dict]:
    """The `top` most popular non-deleted TMDB titles with their TV Tropes document. Read only."""
    from f.external_ids.imdb_ids import effective_imdb_id

    details = db["tmdb_movie_details" if media_type == "movie" else "tmdb_tv_details"]
    tags = db["tv_tropes_movie_tags" if media_type == "movie" else "tv_tropes_tv_tags"]
    rows = list(details.find(
        {"tmdb_deleted": {"$ne": True}},
        {"tmdb_id": 1, "title": 1, "original_title": 1, "popularity": 1, "imdb_id": 1, "external_ids.imdb_id": 1,
         "imdb_id_override": 1}).sort("popularity", -1).limit(top))
    by_id = {doc["tmdb_id"]: doc for doc in tags.aggregate([
        {"$match": {"tmdb_id": {"$in": [row["tmdb_id"] for row in rows]}}},
        {"$project": {"_id": 0, "tmdb_id": 1, "release_year": 1, "title_variations": 1, "tvtropes_url": 1,
                      "trope_count": {"$size": {"$ifNull": ["$tropes", []]}}}}])}
    titles = []
    for row in rows:
        doc = by_id.get(row["tmdb_id"])
        if doc is None:
            continue  # no TV Tropes document: the importer would skip it anyway
        titles.append({**doc, "media_type": media_type, "title": row.get("title"),
                       "original_title": row.get("original_title"), "popularity": row.get("popularity"),
                       "imdb_id": effective_imdb_id(row, media_type == "movie")[0]})
    return titles


def export_queue(path: Path, top: int, kinds: list[str], use_wikidata: bool) -> dict:
    sys.path.insert(0, str(FLOWS / "scripts"))
    from import_tvtropes_recovered import connect

    client, db = connect()
    try:
        titles = [t for kind in kinds for t in read_titles(db, kind, top)]
    finally:
        client.close()
    wikidata = fetch_wikidata() if use_wikidata else {}
    entries, counts = build_queue(titles, wikidata, load_mapping())
    counts.update(generated_at=utcnow().isoformat(), top=top, kinds=kinds, wikidata_ids=len(wikidata))
    path.write_text(json.dumps({"summary": counts, "entries": entries}, indent=1, ensure_ascii=False) + "\n")
    print(json.dumps(counts, indent=2))
    return counts


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    queue = commands.add_parser("queue", help="export a queue (read-only Mongo, Wikidata, tvtropes2imdb)")
    queue.add_argument("output", type=Path)
    queue.add_argument("--top", type=int, default=10000, help="most popular titles per kind")
    queue.add_argument("--kinds", default="movie,show")
    queue.add_argument("--no-wikidata", action="store_true")
    runner = commands.add_parser("run", help="crawl a queue; resumes in the same output directory")
    runner.add_argument("queue", type=Path)
    runner.add_argument("output", type=Path)
    runner.add_argument("--max-requests", type=int, required=True)
    runner.add_argument("--delay", type=float, default=DEFAULT_DELAY, help="seconds between requests")
    runner.add_argument("--state", type=Path, default=DEFAULT_STATE)
    reviewer = commands.add_parser("review", help="write review.md for a run directory")
    reviewer.add_argument("output", type=Path)
    args = parser.parse_args(argv)
    if args.command == "queue":
        export_queue(args.output, args.top, args.kinds.split(","), not args.no_wikidata)
    elif args.command == "run":
        if args.delay < MIN_DELAY or not 1 <= args.max_requests <= MAX_REQUESTS:
            parser.error(f"Use at least {MIN_DELAY} s between requests and a budget of 1..{MAX_REQUESTS}")
        run(args.queue, args.output, args.state, args.delay, args.max_requests)
    else:
        print(review(args.output))


if __name__ == "__main__":
    main()
