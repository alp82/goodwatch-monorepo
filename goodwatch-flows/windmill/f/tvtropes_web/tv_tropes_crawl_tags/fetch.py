# extra_requirements:
# requests
# pymongo
# mongoengine
# pydantic
# beautifulsoup4
# html5lib

"""Crawl one title's TV Tropes page, for `f/priority/crawl_all` (only with crawl_tvtropes on).

Plain HTTP from the title's stored URL, with the shared pace and block handling of
`f/critic_sites/polite_http` (site `tvtropes`). Nothing is guessed: a title without
a stored URL is skipped. A block, a crawl error or a missing page is recorded and
reported, never raised, so the flow does not retry through it; after a block every
title is skipped without a request until the site's deadline. Existing tropes are
only replaced by a newly identified page's tropes. See docs/tvtropes.md.
"""

from datetime import datetime, timedelta
from typing import Optional, Union

from f.critic_sites import polite_http
from f.data_source.common import get_document_for_id
from f.db.mongodb import close_mongodb, init_mongodb
from f.tvtropes_web import crawl
from f.tvtropes_web.models import TropeData, TvTropesMovieTags, TvTropesTvTags

SITE = "tvtropes"
REQUEST_INTERVAL_SECONDS = 6
RECENTLY_CRAWLED = timedelta(days=1)


def release(entry, now: datetime, error: Optional[str] = None) -> None:
    if error:
        entry.error_message = error
        entry.failed_at = now
    entry.is_selected = False
    entry.save()


def fetch_entry(entry: Union[TvTropesMovieTags, TvTropesTvTags], client, now: Optional[datetime] = None) -> dict:
    now = now or datetime.utcnow()
    media_type = "movie" if isinstance(entry, TvTropesMovieTags) else "tv"
    report = {"tmdb_id": entry.tmdb_id, "original_title": entry.original_title}
    last = max((at for at in (entry.updated_at, entry.failed_at) if at), default=None)
    if last and now - last < RECENTLY_CRAWLED:
        release(entry, now)
        return {**report, "status": "recently_crawled"}
    candidates = crawl.candidate_urls(media_type, stored=entry.tvtropes_url)
    try:
        outcome = crawl.crawl_title(client.get, media_type, entry.original_title, entry.release_year,
                                    list(entry.title_variations or []), candidates)
    except polite_http.SiteBlocked as blocked:
        release(entry, now, f"blocked: {blocked}")
        return {**report, "blocked": str(blocked)}
    except (crawl.CrawlError, polite_http.FetchError) as error:
        release(entry, now, str(error))
        return {**report, "error": str(error)}
    report.update(status=outcome.status, url=outcome.url, trope_count=len(outcome.tropes))
    if outcome.status in crawl.FOUND:
        entry.tvtropes_url = outcome.url
        if outcome.tropes:
            entry.tropes = [TropeData(**trope) for trope in outcome.tropes]
        entry.error_message = None
        entry.failed_at = None
        entry.updated_at = now
        release(entry, now)
    elif outcome.status in ("not_found", "rejected"):
        # Keep the stored URL and tropes; the local recovery and its review decide replacements.
        release(entry, now, f"{outcome.status}: {entry.tvtropes_url}")
    else:
        release(entry, now)
    return report


def main(next_id: dict):
    from mongoengine import get_db

    init_mongodb()
    try:
        entry = get_document_for_id(next_id=next_id, movie_model=TvTropesMovieTags, tv_model=TvTropesTvTags)
        client = polite_http.PoliteClient(get_db(), SITE, interval=REQUEST_INTERVAL_SECONDS,
                                          user_agent=crawl.USER_AGENT)
        report = fetch_entry(entry, client)
        print(report, flush=True)
        return report
    finally:
        close_mongodb()
