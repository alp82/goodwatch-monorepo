# extra_requirements:
# beautifulsoup4
# html5lib
# requests
# pymongo

"""Crawl one title's TV Tropes page from a known URL, over plain HTTP.

The design copies the Rotten Tomatoes and Metacritic crawlers (docs/critic-scores.md):
only known URLs, never a guessed slug; one shared pace for the whole site; a 403, a
429 or a challenge stops everything (`polite_http.SiteBlocked` propagates to the
caller) and nothing is retried through it. Used by the local recovery runner
(`scripts/recover_tvtropes.py`) and by the production per-title fetch
(`f/tvtropes_web/tv_tropes_crawl_tags/fetch`).

`get(url)` is any callable that returns a `polite_http.Page` (status, final url,
text) and raises `SiteBlocked` on a block.
"""

from dataclasses import dataclass, field
from typing import Callable, Optional

from f.critic_sites.polite_http import Page
from f.tvtropes_web.pages import (
    MAX_PAGES,
    WorkPage,
    allowed_namespaces,
    identifies_work,
    matches_known_url,
    normalize_url,
    owner_names,
    page_identity,
    subpage_urls,
    trope_items,
    unique_tropes,
)
from f.tvtropes_web.title_variations import title_variations

USER_AGENT = "GoodWatchBot/0.1 (+https://goodwatch.app; hello@goodwatch.app) tvtropes"
# Where a candidate URL came from, in the order they are tried.
SOURCES = ("stored", "wikidata", "tvtropes2imdb")
# Title statuses that end a title for a run; a later run can still refresh it.
FOUND = ("recovered", "identified_no_tropes")


class CrawlError(Exception):
    """An unexpected page (5xx, a failed or empty subpage, too many subpages). Not a block."""


@dataclass
class Outcome:
    status: str  # recovered | identified_no_tropes | not_found | rejected | no_known_url | no_release_year
    url: Optional[str] = None
    source: Optional[str] = None
    tropes: list = field(default_factory=list)
    # One entry per candidate URL: url, source, outcome (not_found | rejected | identified | skipped), reason.
    candidates: list = field(default_factory=list)
    # The start of the identified page's introduction, for the review.
    intro: Optional[str] = None


def candidate_urls(media_type: str, stored: Optional[str] = None, wikidata: Optional[str] = None,
                   tvtropes2imdb: Optional[str] = None) -> list[tuple[str, str]]:
    """Known URLs in order, normalized and without duplicates. A Wikidata id such as
    `Film/PulpFiction` and a tvtropes2imdb page name such as `PulpFiction` (always Film/)
    become full URLs."""
    raw = [
        ("stored", stored),
        ("wikidata", wikidata if not wikidata or "://" in wikidata else "https://tvtropes.org/pmwiki/pmwiki.php/" + wikidata),
        ("tvtropes2imdb", "https://tvtropes.org/pmwiki/pmwiki.php/Film/" + tvtropes2imdb
         if tvtropes2imdb and media_type == "movie" else None),
    ]
    seen, out = set(), []
    for source, url in raw:
        url = normalize_url(url)
        if url and url not in seen:
            seen.add(url)
            out.append((source, url))
    return out


def crawl_tree(get: Callable[[str], Page], page: WorkPage, visited: set, owner: set, is_subpage=False) -> list[dict]:
    """The page's tropes plus those of its own `Tropes…` subpages, depth first."""
    if page.url in visited:
        return []
    if len(visited) >= MAX_PAGES:
        raise CrawlError("TV Tropes subpage limit reached; refusing a partial result")
    visited.add(page.url)
    tropes = trope_items(page, is_subpage=is_subpage)
    for url in subpage_urls(page, owner, visited):
        if url in visited:
            continue
        response = get(url)
        if response.status != 200 or response.url != url:
            raise CrawlError(f"TV Tropes subpage failed (HTTP {response.status}): {url}")
        sub_tropes = crawl_tree(get, WorkPage(response.url, response.text), visited, owner, is_subpage=True)
        if not sub_tropes:
            raise CrawlError(f"TV Tropes subpage has no tropes: {url}")
        tropes.extend(sub_tropes)
    return unique_tropes(tropes)


def crawl_title(get: Callable[[str], Page], media_type: str, original_title: Optional[str],
                release_year: Optional[int], variations: list[str], candidates: list[tuple[str, str]],
                is_negative: Callable[[str], bool] = lambda url: False, known_url_rule: bool = False) -> Outcome:
    """Try the known URLs in order until one is this title's page.

    Raises `SiteBlocked` on a block (stop everything) and `CrawlError` on an
    unexpected page. `is_negative(url)` skips URLs in the caller's negative cache.
    A page passes the strict `identifies_work` rule or, with `known_url_rule`, the
    looser `matches_known_url`; each candidate records which rule passed.
    """
    # The identity check needs a release year; don't spend a request that can't pass.
    if not release_year:
        return Outcome("no_release_year")
    variations = title_variations([original_title or "", *(variations or [])])
    tried = []
    for source, url in candidates:
        if is_negative(url):
            tried.append({"url": url, "source": source, "outcome": "skipped", "reason": "negative cache"})
            continue
        # Main/, Franchise/ and the other medium's namespace are never one title's page.
        if page_identity(url)[0] not in allowed_namespaces(media_type):
            tried.append({"url": url, "source": source, "outcome": "rejected", "reason": "namespace"})
            continue
        response = get(url)
        if response.status in (404, 410):
            tried.append({"url": url, "source": source, "outcome": "not_found", "reason": f"HTTP {response.status}"})
            continue
        if response.status != 200:
            raise CrawlError(f"TV Tropes HTTP {response.status}: {url}")
        # Redirects to a renamed page carry `?from=Old.Name`; keep the page URL only.
        page = WorkPage(normalize_url(response.url) or response.url, response.text)
        if identifies_work(page, original_title, release_year, media_type, variations):
            rule = "strict"
        elif known_url_rule and matches_known_url(page, original_title, release_year, media_type, variations):
            rule = "known_url"
        else:
            reason = "identity" if page.url == url else f"identity after redirect to {page.url}"
            tried.append({"url": url, "source": source, "outcome": "rejected", "reason": reason})
            continue
        tropes = crawl_tree(get, page, set(), owner_names(page.url))
        tried.append({"url": url, "source": source, "outcome": "identified", "reason": None, "rule": rule})
        return Outcome("recovered" if tropes else "identified_no_tropes", url=page.url, source=source,
                       tropes=tropes, candidates=tried, intro=page.introduction[:400])
    if not tried:
        return Outcome("no_known_url")
    if all(c["outcome"] in ("not_found", "skipped") for c in tried) and any(c["outcome"] == "not_found" for c in tried):
        return Outcome("not_found", candidates=tried)
    if all(c["outcome"] == "skipped" for c in tried):
        return Outcome("no_known_url", candidates=tried)
    return Outcome("rejected", candidates=tried)


def main():
    pass
