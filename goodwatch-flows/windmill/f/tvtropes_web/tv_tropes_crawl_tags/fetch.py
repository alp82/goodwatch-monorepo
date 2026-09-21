# extra_requirements:
# playwright==1.62.0

import asyncio
import re
from datetime import datetime
from playwright.async_api import async_playwright, BrowserContext
from typing import Union
from urllib.parse import urljoin, urlparse

from f.tvtropes_web.title_variations import title_variations, slug

from f.data_source.common import get_document_for_id
from f.db.mongodb import init_mongodb, close_mongodb
from f.tvtropes_web.models import (
    TvTropesCrawlResult,
    TvTropesMovieTags,
    TvTropesTvTags,
    TropeData,
    Trope,
)
from f.utils.string import remove_prefix

BROWSER_TIMEOUT = 180000
# TV Tropes' Cloudflare rules challenge the default "HeadlessChrome" user agent.
# Identify the crawler honestly so the site operator can contact or throttle us.
CRAWLER_USER_AGENT = "GoodWatchBot/0.1 (+https://goodwatch.app; contact alportac@gmail.com)"


async def crawl_data(
    next_entry: Union[TvTropesMovieTags, TvTropesTvTags],
    browser: BrowserContext,
) -> tuple[TvTropesCrawlResult, Union[TvTropesMovieTags, TvTropesTvTags]]:
    if isinstance(next_entry, TvTropesMovieTags):
        return await crawl_movie_rating(next_entry, browser), next_entry
    elif isinstance(next_entry, TvTropesTvTags):
        return await crawl_tv_rating(next_entry, browser), next_entry
    else:
        raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")


async def crawl_movie_rating(
    next_entry: TvTropesMovieTags,
    browser: BrowserContext,
) -> TvTropesCrawlResult:
    result = await crawl_rotten_tomatoes_page(
        next_entry=next_entry, type="Film", browser=browser
    )
    store_result(next_entry=next_entry, result=result)
    return result


async def crawl_tv_rating(
    next_entry: TvTropesTvTags,
    browser: BrowserContext,
) -> TvTropesCrawlResult:
    result = await crawl_rotten_tomatoes_page(
        next_entry=next_entry, type="Series", browser=browser
    )
    store_result(next_entry=next_entry, result=result)
    return result


async def crawl_rotten_tomatoes_page(
    next_entry: Union[TvTropesMovieTags, TvTropesTvTags],
    type: str,
    browser: BrowserContext,
) -> TvTropesCrawlResult:
    # A release year is required by the identity check. Do not spend requests on
    # catalog records that cannot possibly be verified by this resolver.
    if not next_entry.release_year:
        return TvTropesCrawlResult(url=None, tropes=[], rate_limit_reached=False)
    # Regenerate from the raw title too: old Mongo records contain lossy slugs.
    variations = title_variations(
        [next_entry.original_title, *next_entry.title_variations]
    )
    base = "https://tvtropes.org/pmwiki/pmwiki.php"
    urls = []
    for title in variations:
        if next_entry.release_year:
            urls.append(f"{base}/{type}/{title}{next_entry.release_year}")
        urls.append(f"{base}/{type}/{title}")
    visited = set()
    while urls:
        if len(visited) >= 60:
            raise RuntimeError("TV Tropes candidate limit reached")
        url = urls.pop(0)
        if url in visited:
            continue
        visited.add(url)
        page = await browser.new_page()
        try:
            response = await page.goto(url)
            if response is None:
                raise RuntimeError(f"No response from {url}")
            if is_blocked(response):
                return TvTropesCrawlResult(url=None, tropes=[], rate_limit_reached=True)
            if response.status not in (200, 404):
                raise RuntimeError(f"TV Tropes HTTP {response.status}: {url}")
            if response.status == 200 and await identifies_work(
                page, next_entry, type, variations
            ):
                result = await crawl_page(browser, page)
                if result.tropes or result.rate_limit_reached:
                    return result
            # Disambiguation and inexact-title pages are navigation, never evidence.
            # A year-adjacent link is only a candidate: the target must identify the work.
            links = await page.locator("#main-article a[href]").evaluate_all(
                "nodes => nodes.map(a => ({href:a.href, text:a.textContent, context:a.parentElement.textContent}))"
            )
            for link in links:
                candidate = urljoin(page.url, link["href"])
                namespace, name = page_identity(candidate)
                if namespace not in allowed_namespaces(type):
                    continue
                stem = re.sub(r"(?:19|20)\d{2}$", "", name)
                same_title = any(stem.casefold() == v.casefold() for v in variations)
                year = str(next_entry.release_year or "")
                # Non-year suffixes (TheOfficeUS, SpiderMan1) need a matching
                # title stem and the expected year in the disambiguation entry.
                contextual_match = (
                    year
                    and year in link["context"]
                    and any(
                        name.casefold().startswith(v.casefold()) for v in variations
                    )
                )
                if (
                    (same_title or contextual_match)
                    and candidate not in visited
                    and candidate not in urls
                ):
                    urls.insert(0, candidate)
        finally:
            await page.close()
    return TvTropesCrawlResult(url=None, tropes=[], rate_limit_reached=False)


def is_blocked(response):
    # Cloudflare challenges are not always served as 403/429.
    return (
        response.status in (403, 429)
        or response.headers.get("cf-mitigated") == "challenge"
    )


def page_identity(url):
    parsed = urlparse(url)
    prefix = "/pmwiki/pmwiki.php/"
    if parsed.hostname not in (
        "tvtropes.org",
        "www.tvtropes.org",
    ) or not parsed.path.startswith(prefix):
        return "", ""
    parts = parsed.path[len(prefix) :].split("/")
    return tuple(parts) if len(parts) == 2 else ("", "")


def allowed_namespaces(media_type):
    return {media_type, "WesternAnimation", "Animation", "Anime"}


async def identifies_work(page, entry, media_type, variations):
    namespace, name = page_identity(page.url)
    if namespace not in allowed_namespaces(media_type):
        return False
    # Use the opening work description, not a year mentioned in a trope/example.
    paragraphs = await page.locator("#main-article > p").all_text_contents()
    # Live pages open with empty spacer paragraphs; skip them.
    paragraphs = [text for text in paragraphs if text.strip()]
    introduction = " ".join(paragraphs[:3])[:2500]
    compact = slug(introduction).casefold()
    matches_title = any(len(v) >= 3 and v.casefold() in compact for v in variations)
    # Numeric titles cannot be fuzzy matched inside another number.
    matches_title = matches_title or any(
        v.isdigit() and re.search(r"(?<!\w)" + re.escape(v) + r"(?!\w)", introduction)
        for v in variations
    )
    if not matches_title or not entry.release_year:
        return False
    # The first dated description must identify this release. A guessed near
    # year, or a later sentence about a remake, is insufficient.
    years = re.findall(r"\b(?:18|19|20)\d{2}\b", introduction)
    if not years or years[0] != str(entry.release_year):
        return False
    # A shared film-series/volume page does not prove individual-title traits.
    if media_type == "Film" and re.search(
        r"\b(?:film series|film duology|two films|both films|two[- ]part film)\b",
        introduction,
        re.I,
    ):
        return False
    # In shared animation namespaces, the first dated work description determines
    # media type; a later sentence about a film adaptation must not identify a show.
    dated_description = introduction[
        re.search(r"\b(?:18|19|20)\d{2}\b", introduction).start() :
    ]
    dated_description = re.split(r"[.!?](?:\s|$)", dated_description, maxsplit=1)[0]
    kind = re.search(
        r"\b(film|movie|series|sitcom|television show|TV show|miniseries)\b",
        dated_description,
        re.I,
    )
    if not kind:
        return False
    return (kind[1].lower() in ("film", "movie")) == (media_type == "Film")


async def crawl_page(
    browser, page, *, is_subpage=False, visited=None, owner=None
) -> TvTropesCrawlResult:
    visited = set() if visited is None else visited
    if owner is None:
        _, name = page_identity(page.url)
        stem = re.sub(r"(?:19|20)\d{2}$", "", name)
        owner = {
            (base + suffix).casefold()
            for base in (name, stem)
            for suffix in ("", "Film", "Series", "Anime", "TV")
        }
    if page.url in visited:
        return TvTropesCrawlResult(url=page.url, tropes=[], rate_limit_reached=False)
    if len(visited) >= 20:
        raise RuntimeError("TV Tropes subpage limit reached; refusing a partial result")
    visited.add(page.url)
    selector = "#main-article h2 ~ ul > li, #main-article h3 ~ ul > li, #main-article .folder > ul > li"
    if is_subpage:
        selector += ", #main-article > ul > li"
    tropes = []
    # Read every item in one call: live page scripts mutate the DOM, which
    # invalidates per-item locators between awaits.
    items = await page.locator(selector).evaluate_all(
        """nodes => nodes.map(li => {
            const a = li.querySelector('a');
            return a && {href: a.getAttribute('href') || '', name: a.textContent || '', html: li.innerHTML};
        }).filter(Boolean)"""
    )
    for item in items:
        url = urljoin(page.url, item["href"])
        namespace, _ = page_identity(url)
        if namespace != "Main":
            continue
        name = item["name"].strip()
        if name:
            tropes.append(
                Trope(
                    name=name,
                    url=url,
                    html=remove_prefix(text=item["html"].strip(), prefix=name),
                )
            )
    # Subpage links may sit outside a heading/folder list (Citizen Kane).
    links = await page.locator("#main-article a[href]").evaluate_all(
        "nodes => nodes.map(a => ({href:a.href, text:a.textContent}))"
    )
    for link in links:
        url = urljoin(page.url, link["href"])
        namespace, name = page_identity(url)
        if not re.search(r"^Tropes[A-Za-z0-9]+$", name) or not re.search(
            r"Tropes", link["text"], re.I
        ):
            continue
        # Explicitly exclude franchise/work links and off-site links.
        if (
            namespace.casefold() not in owner
            or namespace
            in {
                "Main",
                "Franchise",
                "Film",
                "Series",
                "Anime",
                "Animation",
                "WesternAnimation",
            }
            or url in visited
        ):
            continue
        sub_page = await browser.new_page()
        try:
            response = await sub_page.goto(url)
            if response and is_blocked(response):
                return TvTropesCrawlResult(url=None, tropes=[], rate_limit_reached=True)
            if not response or response.status != 200 or sub_page.url != url:
                raise RuntimeError(f"TV Tropes subpage failed: {url}")
            sub_result = await crawl_page(
                browser, sub_page, is_subpage=True, visited=visited, owner=owner
            )
            if sub_result.rate_limit_reached:
                return sub_result
            if not sub_result.tropes:
                raise RuntimeError(f"TV Tropes subpage has no tropes: {url}")
            tropes.extend(sub_result.tropes)
        finally:
            await sub_page.close()
    # Duplicate names can occur across folders; keep all distinct passages.
    unique = {(t.name, t.url, t.html): t for t in tropes}
    return TvTropesCrawlResult(
        url=page.url, tropes=list(unique.values()), rate_limit_reached=False
    )


def is_ambiguous_title(original_title: str, type: str) -> bool:
    if type in ("m", "Film"):
        count_with_same_title = TvTropesMovieTags.objects(
            original_title=original_title
        ).count()
    else:
        count_with_same_title = TvTropesTvTags.objects(
            original_title=original_title
        ).count()

    return count_with_same_title > 1


def store_result(
    next_entry: Union[TvTropesMovieTags, TvTropesTvTags],
    result: TvTropesCrawlResult,
):
    if type(result.url) in [str]:
        next_entry.tvtropes_url = result.url

    if result.tropes:
        next_entry.tropes = [
            TropeData(
                name=trope.name,
                url=trope.url,
                html=trope.html,
            )
            for trope in result.tropes
        ]

    if result.rate_limit_reached:
        next_entry.error_message = "Rate Limit reached"
        next_entry.failed_at = datetime.utcnow()
        print(
            f"could not fetch tags for {next_entry.original_title}: {next_entry.error_message}"
        )

    else:
        next_entry.error_message = None
        next_entry.failed_at = None
        next_entry.updated_at = datetime.utcnow()
        print(f"saving {len(result.tropes or [])} tags for {next_entry.original_title}")

    next_entry.is_selected = False
    next_entry.save()


async def tvtropes_crawl_tags(next_entry: Union[TvTropesMovieTags, TvTropesTvTags]):
    print("Fetch semantic tags from TV Tropes pages")

    if not next_entry:
        print(f"warning: no entries to fetch in TV Tropes tags")
        return

    print(
        f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity})"
    )

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(user_agent=CRAWLER_USER_AGENT)
        context.set_default_timeout(BROWSER_TIMEOUT)
        try:
            crawl_result, _ = await crawl_data(next_entry, context)
        except Exception as error:
            next_entry.failed_at = datetime.utcnow()
            next_entry.error_message = str(error)
            next_entry.is_selected = False
            next_entry.save()
            raise
        finally:
            await context.close()
            await browser.close()

    if crawl_result.rate_limit_reached:
        raise Exception(
            f"Rate limit reached for {next_entry.original_title}, retrying."
        )

    return {
        "tmdb_id": next_entry.tmdb_id,
        "original_title": next_entry.original_title,
        "popularity": next_entry.popularity,
        "rate_limit_reached": crawl_result.rate_limit_reached if crawl_result else None,
        "trope_url": crawl_result.url if crawl_result else None,
        "trope_count": len(crawl_result.tropes) if crawl_result else None,
    }


def main(next_id: dict):
    init_mongodb()
    next_entry = get_document_for_id(
        next_id=next_id,
        movie_model=TvTropesMovieTags,
        tv_model=TvTropesTvTags,
    )
    try:
        return asyncio.run(tvtropes_crawl_tags(next_entry))
    finally:
        close_mongodb()
