#!/usr/bin/env python3
"""Bounded, local-only TV Tropes recovery. Never initializes or writes a database.

Input is a reviewed JSON list with media_type, tmdb_id, title/original_title,
release_year, title_variations, votes, and optional before_url/before_tropes.
Results and raw source responses are saved for review and a separate publication.
"""

import argparse
import asyncio
import gzip
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))
from playwright.async_api import async_playwright
from f.tvtropes_web.models import TvTropesMovieTags, TvTropesTvTags
from f.tvtropes_web.tv_tropes_crawl_tags.fetch import crawl_rotten_tomatoes_page


def blocked_status(requests):
    """A forbidden response is not evidence that the source rate-limited us."""
    statuses = {request.get("status") for request in requests}
    return "source_access_blocked" if 403 in statuses else "rate_limited"


class EvidenceContext:
    def __init__(self, context, directory, delay, limit):
        self.context, self.directory, self.delay, self.limit = (
            context,
            directory,
            delay,
            limit,
        )
        self.requests = []
        self.last_request = 0

    async def new_page(self):
        page = await self.context.new_page()
        original_goto = page.goto

        async def goto(url):
            if len(self.requests) >= self.limit:
                raise RuntimeError("Run request budget exhausted")
            await asyncio.sleep(
                max(0, self.delay - (time.monotonic() - self.last_request))
            )
            self.last_request = time.monotonic()
            record = {
                "requested_url": url,
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
            self.requests.append(record)
            try:
                response = await original_goto(
                    url, wait_until="domcontentloaded", timeout=45000
                )
                record.update(
                    url=page.url, status=response.status if response else None
                )
                if response:
                    body = await response.body()
                    digest = hashlib.sha256(body).hexdigest()
                    filename = digest + ".html.gz"
                    (self.directory / filename).write_bytes(gzip.compress(body))
                    record.update(sha256=digest, source_file="sources/" + filename)
                return response
            except Exception as error:
                record["error"] = str(error)
                raise
            finally:
                record["elapsed_seconds"] = round(
                    time.monotonic() - self.last_request, 3
                )

        page.goto = goto
        return page


async def run(args):
    manifest_bytes = args.manifest.read_bytes()
    manifest = json.loads(manifest_bytes)
    if isinstance(manifest, dict):
        manifest = manifest["entries"]
    if len(manifest) > 250:
        raise ValueError("Initial recovery is bounded to at most 250 reviewed titles")
    keys = [(row["media_type"], row["tmdb_id"]) for row in manifest]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate media-type/TMDB identities in manifest")
    for row in manifest:
        if row["media_type"] not in ("movie", "show") or row.get("votes", 0) < 200000:
            raise ValueError(
                "Every entry must belong to the approved >=200,000-vote cohort"
            )
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "sources").mkdir(exist_ok=True)
    digest = hashlib.sha256(manifest_bytes).hexdigest()
    flow_root = Path(__file__).resolve().parents[1]
    code_hashes = {
        str(path.relative_to(flow_root)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in (
            Path(__file__).resolve(),
            flow_root / "windmill/f/tvtropes_web/tv_tropes_crawl_tags/fetch.py",
            flow_root / "windmill/f/tvtropes_web/title_variations.py",
        )
    }
    provenance = args.output / "manifest.sha256"
    if provenance.exists() and provenance.read_text().strip() != digest:
        raise ValueError("Output directory belongs to a different manifest")
    provenance.write_text(digest + "\n")
    summary_path = args.output / "summary.json"
    legacy_summary = args.output / "summary-before-attempt-history.json"
    if summary_path.exists() and not legacy_summary.exists():
        legacy_summary.write_bytes(summary_path.read_bytes())
    result_path = args.output / "results.jsonl"
    records = (
        [json.loads(line) for line in result_path.read_text().splitlines()]
        if result_path.exists()
        else []
    )
    completed = {
        (r["media_type"], r["tmdb_id"])
        for r in records
        if r["status"] in ("recovered", "unresolved")
    }
    started = time.monotonic()
    started_at = datetime.now(timezone.utc).isoformat()
    stop_reason = None
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        # Only document requests are needed for the article's server-rendered HTML.
        await context.route(
            "**/*",
            lambda route: (
                route.continue_()
                if route.request.resource_type == "document"
                else route.abort()
            ),
        )
        evidence = EvidenceContext(
            context, args.output / "sources", args.delay, args.max_requests
        )
        try:
            for row in manifest:
                if (row["media_type"], row["tmdb_id"]) in completed:
                    continue
                first_request = len(evidence.requests)
                cls = (
                    TvTropesMovieTags
                    if row["media_type"] == "movie"
                    else TvTropesTvTags
                )
                entry = cls(
                    tmdb_id=row["tmdb_id"],
                    original_title=row.get("title") or row["original_title"],
                    release_year=row.get("release_year"),
                    title_variations=row.get("title_variations", []),
                )
                record = dict(
                    row,
                    started_at=datetime.now(timezone.utc).isoformat(),
                    code_sha256=code_hashes,
                )
                try:
                    result = await crawl_rotten_tomatoes_page(
                        entry,
                        "Film" if row["media_type"] == "movie" else "Series",
                        evidence,
                    )
                    record.update(
                        result=result.model_dump(),
                        status=(
                            blocked_status(evidence.requests[first_request:])
                            if result.rate_limit_reached
                            else "recovered" if result.tropes else "unresolved"
                        ),
                    )
                    if result.rate_limit_reached:
                        stop_reason = (
                            "HTTP 403: source access denied; rate limiting not established"
                            if record["status"] == "source_access_blocked"
                            else "HTTP 429: source rate limit"
                        ) + "; stopped without retrying or bypassing the block"
                except Exception as error:
                    record.update(status="failed", error=str(error))
                    # Stop on a transport failure too; no blind repeated requests.
                    stop_reason = str(error)
                record["requests"] = evidence.requests[first_request:]
                with result_path.open("a") as output:
                    output.write(json.dumps(record, ensure_ascii=False) + "\n")
                records.append(record)
                print(
                    json.dumps(
                        {
                            k: record.get(k)
                            for k in ("media_type", "tmdb_id", "title", "status")
                        },
                        ensure_ascii=False,
                    ),
                    flush=True,
                )
                if stop_reason:
                    break
        finally:
            await context.close()
            await browser.close()
    latest = {(r["media_type"], r["tmdb_id"]): r for r in records}
    summary = {
        "started_at": started_at,
        "manifest_sha256": digest,
        "code_sha256": code_hashes,
        "cohort": len(manifest),
        "attempted": len(latest),
        "recovered": sum(r["status"] == "recovered" for r in latest.values()),
        "unresolved": sum(r["status"] == "unresolved" for r in latest.values()),
        "failed": sum(
            r["status"] in ("failed", "rate_limited", "source_access_blocked")
            for r in latest.values()
        ),
        "unattempted": len(manifest) - len(latest),
        "requests_this_run": len(evidence.requests),
        "request_budget": args.max_requests,
        "minimum_request_spacing_seconds": args.delay,
        "elapsed_seconds_this_run": round(time.monotonic() - started, 3),
        "stop_reason": stop_reason,
        "production_writes": 0,
        "demonstrated_search_improvement": None,
    }
    with (args.output / "attempts.jsonl").open("a") as output:
        output.write(json.dumps(summary) + "\n")
    summary_path.write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--delay", type=float, default=4)
    parser.add_argument("--max-requests", type=int, default=1500)
    args = parser.parse_args()
    if args.delay < 4 or not 1 <= args.max_requests <= 1500:
        parser.error(
            "Use at least 4 seconds between requests and a request budget of 1..1500"
        )
    asyncio.run(run(args))
