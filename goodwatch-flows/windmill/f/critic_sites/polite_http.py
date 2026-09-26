# extra_requirements:
# requests
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Polite HTTP for the Rotten Tomatoes and Metacritic crawlers (#152).

Owner rules (issue #152, 2026-09-25): plain HTTP with an honest, identifying
User-Agent; about one request every 2 s per site; a 403, a 429 or any bot
challenge stops the whole site's crawl until a recorded deadline. A challenge is
never solved or worked around, and nothing is retried through a block.

The pace and the deadline live in Mongo (`critic_site_state`, one document per
site), so every worker that crawls a site shares them: the batch crawl, the
per-title crawl in `f/priority/crawl_all` and the sitemap job. Every block is
also logged to `critic_site_blocks`.
"""
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Optional

import requests
from pymongo.errors import DuplicateKeyError

USER_AGENT = "GoodWatchBot/0.1 (+https://goodwatch.app; hello@goodwatch.app) critic-scores"
REQUEST_INTERVAL_SECONDS = 2.0
TIMEOUT_SECONDS = 15
STATE = "critic_site_state"
BLOCK_LOG = "critic_site_blocks"
# A 403 or a challenge means the site does not want us right now: wait a day.
BLOCK_HOURS = 24
# A 429 waits for Retry-After, but never less than an hour and never more than a week.
RATE_LIMIT_MIN = timedelta(hours=1)
RATE_LIMIT_MAX = timedelta(days=7)
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
}
# Interstitial pages. Metacritic's normal pages load Cloudflare's
# `/cdn-cgi/challenge-platform/` detection script, so that path alone is not a challenge.
CHALLENGE_TITLE = re.compile(
    r"<title>\s*(just a moment|attention required|access denied|verify you are human|pardon our interruption)",
    re.IGNORECASE)


class SiteBlocked(Exception):
    def __init__(self, site: str, until: datetime, reason: str):
        super().__init__(f"{site} blocked until {until:%Y-%m-%d %H:%M} UTC: {reason}")
        self.site = site
        self.until = until
        self.reason = reason


class FetchError(Exception):
    """A network error or timeout. Not a block: the title is tried again later."""


@dataclass
class Page:
    status: int
    url: str  # after redirects
    text: str
    requested_url: str
    elapsed: float = 0.0

    @property
    def redirected(self) -> bool:
        return self.url.rstrip("/") != self.requested_url.rstrip("/")


def block_reason(status: int, headers, text: str) -> Optional[str]:
    headers = {key.lower(): value for key, value in (headers or {}).items()}
    if headers.get("cf-mitigated", "").lower() == "challenge":
        return f"HTTP {status} with cf-mitigated: challenge"
    if status in (403, 429):
        return f"HTTP {status}"
    if status == 202 and not (text or "").strip():
        return "HTTP 202 with an empty body (bot check)"
    if CHALLENGE_TITLE.search((text or "")[:5000]):
        return f"HTTP {status} challenge page"
    return None


def retry_after(headers, now: datetime) -> Optional[datetime]:
    value = {key.lower(): value for key, value in (headers or {}).items()}.get("retry-after")
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        return now + timedelta(seconds=int(value))
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is not None:
        # Naive UTC, like every other datetime in these collections.
        parsed = (parsed - parsed.utcoffset()).replace(tzinfo=None)
    return parsed


def block_deadline(status: int, headers, now: datetime) -> datetime:
    if status == 429:
        wanted = retry_after(headers, now) or now
        return min(max(wanted, now + RATE_LIMIT_MIN), now + RATE_LIMIT_MAX)
    return now + timedelta(hours=BLOCK_HOURS)


def blocked_until(db, site: str, now: datetime) -> Optional[datetime]:
    state = db[STATE].find_one({"_id": site}) or {}
    until = state.get("blocked_until")
    return until if until and until > now else None


def record_block(db, site: str, until: datetime, reason: str, url: Optional[str], status: Optional[int],
                 now: datetime) -> None:
    db[STATE].update_one({"_id": site}, {"$max": {"blocked_until": until},
                                         "$set": {"blocked_reason": reason, "blocked_at": now}}, upsert=True)
    db[BLOCK_LOG].insert_one({"site": site, "at": now, "until": until, "reason": reason, "url": url,
                              "status": status})
    print(f"BLOCKED: {site} until {until:%Y-%m-%d %H:%M} UTC ({reason}) at {url}", flush=True)


def claim_slot(db, site: str, clock, interval: float) -> datetime:
    """The time this worker may send its next request to the site. Claims are atomic
    across workers: each moves the site's `next_request_at` one interval forward."""
    state = db[STATE]
    for _ in range(50):
        now = clock()
        current = (state.find_one({"_id": site}) or {}).get("next_request_at")
        slot = max(now, current) if current else now
        following = slot + timedelta(seconds=interval)
        if current is None:
            try:
                result = state.update_one({"_id": site, "next_request_at": {"$exists": False}},
                                          {"$set": {"next_request_at": following}}, upsert=True)
            except DuplicateKeyError:
                continue
            if result.modified_count or result.upserted_id is not None:
                return slot
        elif state.update_one({"_id": site, "next_request_at": current},
                              {"$set": {"next_request_at": following}}).modified_count:
            return slot
    raise RuntimeError(f"could not claim a request slot for {site}")


class PoliteClient:
    def __init__(self, db, site: str, http=None, sleep=time.sleep, clock=datetime.utcnow,
                 interval: float = REQUEST_INTERVAL_SECONDS, user_agent: str = USER_AGENT):
        self.db = db
        self.headers = {**HEADERS, "User-Agent": user_agent}
        self.site = site
        self.http = http or requests.Session()
        self.sleep = sleep
        self.clock = clock
        self.interval = interval
        self.requests = 0
        self.seconds = 0.0

    def get(self, url: str) -> Page:
        until = blocked_until(self.db, self.site, self.clock())
        if until:
            raise SiteBlocked(self.site, until, "blocked earlier")
        slot = claim_slot(self.db, self.site, self.clock, self.interval)
        wait = (slot - self.clock()).total_seconds()
        if wait > 0:
            self.sleep(wait)
        started = time.monotonic()
        try:
            response = self.http.get(url, headers=self.headers, timeout=TIMEOUT_SECONDS, allow_redirects=True)
        except requests.exceptions.RequestException as error:
            raise FetchError(f"{type(error).__name__} for {url}") from error
        finally:
            self.requests += 1
        elapsed = time.monotonic() - started
        self.seconds += elapsed
        reason = block_reason(response.status_code, response.headers, response.text)
        if reason:
            now = self.clock()
            until = block_deadline(response.status_code, response.headers, now)
            record_block(self.db, self.site, until, reason, url, response.status_code, now)
            raise SiteBlocked(self.site, until, reason)
        return Page(status=response.status_code, url=response.url or url, text=response.text,
                    requested_url=url, elapsed=elapsed)


def main():
    pass
