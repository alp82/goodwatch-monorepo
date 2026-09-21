# extra_requirements:
# playwright==1.62.0

import asyncio
import re
import time
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
# Minimum spacing between consecutive TV Tropes navigations within one process.
REQUEST_DELAY_SECONDS = 4
_last_navigation = None


async def paced_goto(page, url):
    global _last_navigation
    if _last_navigation is not None:
        await asyncio.sleep(
            max(0, REQUEST_DELAY_SECONDS - (time.monotonic() - _last_navigation))
        )
    _last_navigation = time.monotonic()
    return await page.goto(url)


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
    identified_url = None
    while urls:
        if len(visited) >= 60:
            raise RuntimeError("TV Tropes candidate limit reached")
        url = urls.pop(0)
        if url in visited:
            continue
        visited.add(url)
        page = await browser.new_page()
        try:
            response = await paced_goto(page, url)
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
                # Keep looking, but report the identified page if nothing better
                # turns up so that "identified, no tropes" is visible.
                identified_url = identified_url or result.url
            # A disambiguation page describes no dated work of its own. Only
            # there may a closed set of country suffixes (TheOfficeUS) be
            # followed; the target must still pass identifies_work in full.
            is_disambiguation = (
                response.status == 200
                and page_identity(page.url)[1].casefold()
                in {v.casefold() for v in variations}
                and not re.search(YEAR, await introduction_of(page))
            )
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
                qualified = is_disambiguation and any(
                    name[: len(v)].casefold() == v.casefold()
                    and name[len(v) :] in DISAMBIGUATION_SUFFIXES
                    for v in variations
                )
                if (
                    (same_title or contextual_match or qualified)
                    and candidate not in visited
                    and candidate not in urls
                ):
                    urls.insert(0, candidate)
        finally:
            await page.close()
    return TvTropesCrawlResult(
        url=identified_url, tropes=[], rate_limit_reached=False
    )


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


YEAR = r"\b(?:18|19|20)\d{2}\b"
KIND = r"\b(film|movie|series|sitcom|television show|TV show|miniseries)\b"
# A year directly qualifying one of these dates the source, not this release.
SOURCE_WORK = r"(?:novel|novella|book|memoir|comic|graphic novel|short story|play|manga|musical|video game)"
SHARED_FILM_PAGE = r"\b(?:film series|film duology|two films|both films|two[- ]part film|two parts|two volumes)\b"
# Country qualifiers TV Tropes appends to remakes; deliberately a closed set.
DISAMBIGUATION_SUFFIXES = {"US", "UK", "USA", "AU", "CA"}
# On a country-suffixed page a dated sentence in these terms is about the
# sibling production (HouseOfCardsUK: "In 2013, Netflix released an
# American-set original series"), not the work the page defines.
OTHER_PRODUCTION = r"\b(?:remake|remade|reboot|rebooted|[A-Z][a-z]+-set|(?:adaptation|version) of this|not to be confused)\b"


def split_sentences(text):
    # "Vol. 1" and similar abbreviations do not end a sentence.
    return re.split(
        r"(?<!\bVol\.)(?<!\bNo\.)(?<!\bPt\.)(?<!\bvs\.)(?<=[.!?])\s+", text
    )


async def introduction_of(page):
    # Use the opening work description, not a year mentioned in a trope/example.
    paragraphs = await page.locator("#main-article > p").all_text_contents()
    # Live pages open with empty spacer paragraphs; skip them.
    paragraphs = [text for text in paragraphs if text.strip()]
    return " ".join(paragraphs[:3])[:2500]


def year_suffixed_name(name, entry, variations):
    """TV Tropes appends a release year only to tell same-titled works apart,
    so an exact `<title variation><catalog year>` page name dates the work."""
    stem = re.sub(r"(?:19|20)\d{2}$", "", name)
    return (
        bool(entry.release_year)
        and name == stem + str(entry.release_year)
        and any(stem.casefold() == v.casefold() for v in variations)
    )


async def identifies_work(page, entry, media_type, variations):
    # Always judged on the final URL, after redirects.
    namespace, name = page_identity(page.url)
    if namespace not in allowed_namespaces(media_type):
        return False
    introduction = await introduction_of(page)
    year_in_name = year_suffixed_name(name, entry, variations)
    # The same title under another year is, by the wiki's own naming, another
    # work, even when its intro opens with "not to be confused with the 2006 film".
    stem = re.sub(r"(?:19|20)\d{2}$", "", name)
    if (
        stem != name
        and not year_in_name
        and any(stem.casefold() == v.casefold() for v in variations)
    ):
        return False
    compact = slug(introduction).casefold()
    matches_title = any(len(v) >= 3 and v.casefold() in compact for v in variations)
    # Numeric titles cannot be fuzzy matched inside another number.
    matches_title = matches_title or any(
        v.isdigit() and re.search(r"(?<!\w)" + re.escape(v) + r"(?!\w)", introduction)
        for v in variations
    )
    if not entry.release_year:
        return False
    # A year-suffixed page name states the title itself (It, 21 Jump Street).
    if not matches_title and not year_in_name:
        return False
    text = introduction
    # A title such as "2001: A Space Odyssey" or "1917" is not a release year.
    if re.search(YEAR, entry.original_title or ""):
        text = text.replace(entry.original_title, " ")
    # "the 1853 memoir ... and its 2013 film adaptation": skip the source's year.
    text = re.sub(
        YEAR + r"(?=(?:\s+[\w'’-]+){0,3}\s+" + SOURCE_WORK + r"\b)", " ", text
    )
    sentences = split_sentences(text)
    dated = next((s for s in sentences if re.search(YEAR, s)), "")
    # A shared film-series/volume page does not prove individual-title traits.
    # Such pages say so in their definition or dated sentence; a later aside
    # ("the two films are otherwise unrelated") is incidental.
    if media_type == "Film" and any(
        re.search(SHARED_FILM_PAGE, sentence, re.I)
        for sentence in (sentences[0], dated)
    ):
        return False
    if year_in_name:
        # The page name supplies title and year; the introduction must still
        # describe the right medium.
        kind = re.search(KIND, introduction, re.I)
    else:
        # The first dated description must identify this release. A guessed near
        # year, or a later sentence about a remake, is insufficient.
        years = re.findall(YEAR, text)
        if not years or years[0] != str(entry.release_year):
            return False
        # In shared animation namespaces, the first dated work description
        # determines media type; a later sentence about a film adaptation must
        # not identify a show. Prefer the kind word after the year; fall back to
        # the same sentence before it only when nothing follows ("the first
        # movie in the trilogy, released in 2002.").
        # A country-suffixed page (HouseOfCardsUK) has a same-titled sibling,
        # which its intro usually mentions. The year only counts in the
        # sentence that defines this page's work: it names the title and does
        # not speak of another production.
        country_suffixed = any(
            name[: len(v)].casefold() == v.casefold()
            and name[len(v) :] in DISAMBIGUATION_SUFFIXES
            for v in variations
        )
        if country_suffixed and (
            not any(
                len(v) >= 3 and v.casefold() in slug(dated).casefold()
                for v in variations
            )
            or re.search(OTHER_PRODUCTION, dated)
        ):
            return False
        position = re.search(YEAR, dated).start()
        kind = re.search(KIND, dated[position:], re.I) or re.search(
            KIND, dated[:position], re.I
        )
    if not kind:
        return False
    return (kind[1].lower() in ("film", "movie")) == (media_type == "Film")


ITEMS_SCRIPT = """nodes => nodes.map(li => {
    const a = li.querySelector('a');
    return a && {href: a.getAttribute('href') || '', name: a.textContent || '', html: li.innerHTML};
}).filter(Boolean)"""


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
    items = await page.locator(selector).evaluate_all(ITEMS_SCRIPT)
    # Heading-less work pages (Band of Brothers) list tropes at the top level.
    # Identity is already established and items stay filtered to Main/ links;
    # this applies only when the primary selectors find no trope at all.
    if not is_subpage and not any(
        page_identity(urljoin(page.url, item["href"]))[0] == "Main"
        and item["name"].strip()
        for item in items
    ):
        items = await page.locator("#main-article > ul > li").evaluate_all(
            ITEMS_SCRIPT
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
            response = await paced_goto(sub_page, url)
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
