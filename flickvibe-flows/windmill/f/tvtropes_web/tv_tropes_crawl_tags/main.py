import asyncio
import re
from datetime import datetime
from playwright.async_api import async_playwright, BrowserContext
from pydantic import BaseModel
from typing import Union, Optional
import wmill

from f.data_source.common import prepare_next_entries
from f.db.mongodb import init_mongodb
from f.tvtropes_web.models import TvTropesMovieTags, TvTropesTvTags, TropeData
from f.utils.string import remove_prefix

BATCH_SIZE = 20
BUFFER_SELECTED_AT_MINUTES = 30
BROWSER_TIMEOUT = 180000


class Trope(BaseModel):
    name: str
    url: str
    html: str


class TvTropesCrawlResult(BaseModel):
    url: Optional[str]
    tropes: list[Trope]
    rate_limit_reached: bool


def retrieve_next_entries(
    count: int,
) -> Union[TvTropesMovieTags, TvTropesTvTags]:
    next_entries = prepare_next_entries(
        movie_model=TvTropesMovieTags,
        tv_model=TvTropesTvTags,
        count=count,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
    )
    return next_entries


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
    main_url = "https://tvtropes.org/pmwiki/pmwiki.php"
    base_url = f"{main_url}/{type}"

    all_variations = (
        [
            f"{title}{next_entry.release_year}" if i % 2 == 0 else title
            for title in next_entry.title_variations
            for i in range(2)
        ]
        if next_entry.release_year
        and is_ambiguous_title(next_entry.original_title, type)
        else next_entry.title_variations
    )
    all_urls = [f"{base_url}/{title}" for title in all_variations]

    for url in all_urls:
        # url = "https://tvtropes.org/pmwiki/pmwiki.php/Series/KitchenNightmares"
        print(f"trying url: {url}")
        page = await browser.new_page()
        response = await page.goto(url)
        if response.status == 403:
            return TvTropesCrawlResult(
                url=None,
                tropes=[],
                rate_limit_reached=True,
            )
        elif response.status == 404:
            # follow links in inexact title pages
            # e.g. https://tvtropes.org/pmwiki/pmwiki.php/Film/FindingNemo
            # do not follow language specific links (like "EsAnime/Bleach")
            # e.g. https://tvtropes.org/pmwiki/pmwiki.php/Series/Bleach
            try:
                western_animation_link = page.locator(
                    "#main-article a:text-matches('^WesternAnimation/', 'i')"
                )
                is_western_animation = await western_animation_link.is_visible()
            except TimeoutError:
                print(
                    f"Timeout for {all_variations[0]} at {url} trying to locate ^WesternAnimation/"
                )
            try:
                animation_link = page.locator(
                    "#main-article a:text-matches('^Animation/', 'i')"
                )
                is_animation = await animation_link.is_visible()
            except TimeoutError:
                print(
                    f"Timeout for {all_variations[0]} at {url} trying to locate ^Animation/"
                )
            try:
                anime_link = page.locator(
                    "#main-article a:text-matches('^Anime/', 'i')"
                )
                is_anime = await anime_link.is_visible()
            except TimeoutError:
                print(
                    f"Timeout for {all_variations[0]} at {url} trying to locate ^Anime/"
                )

            if is_western_animation:
                print(f"is animation: {url}")
                correct_url = await western_animation_link.get_attribute("href")
                full_correct_url = f"https://tvtropes.org{correct_url}"
                response = await page.goto(full_correct_url)
            elif is_anime:
                print(f"is anime: {url}")
                correct_url = await anime_link.get_attribute("href")
                full_correct_url = f"https://tvtropes.org{correct_url}"
                response = await page.goto(full_correct_url)
            elif is_animation:
                print(f"is animation: {url}")
                correct_url = await animation_link.get_attribute("href")
                full_correct_url = f"https://tvtropes.org{correct_url}"
                response = await page.goto(full_correct_url)

        elif response.status == 200:
            # returns empty tropes list from summary pages
            # e.g. https://tvtropes.org/pmwiki/pmwiki.php/Film/StarWars

            # returns empty tropes list from inexact titles without Films
            # e.g. https://tvtropes.org/pmwiki/pmwiki.php/Film/GranTurismo

            # returns empty tropes list in multiple title pages
            # e.g. https://tvtropes.org/pmwiki/pmwiki.php/Film/TheDark
            break

    if response.status != 200:
        return TvTropesCrawlResult(
            url=None,
            tropes=[],
            rate_limit_reached=False,
        )

    return await crawl_page(browser, page)


async def crawl_page(browser, page) -> TvTropesCrawlResult:
    # Locate the score elements
    # normal movie page: https://tvtropes.org/pmwiki/pmwiki.php/Film/AmericanBeauty
    # normal tv page: https://tvtropes.org/pmwiki/pmwiki.php/Series/Jericho2006
    # with spoilers: https://tvtropes.org/pmwiki/pmwiki.php/Film/DancerInTheDark
    # with folders: https://tvtropes.org/pmwiki/pmwiki.php/Series/Loki2021
    # movie with subpages: https://tvtropes.org/pmwiki/pmwiki.php/Film/TheAvengers2012
    # tv with subpages: https://tvtropes.org/pmwiki/pmwiki.php/Series/BreakingBad
    # subpages with unrelated links: https://tvtropes.org/pmwiki/pmwiki.php/WesternAnimation/FamilyGuy
    # long article (with a few false positives): https://tvtropes.org/pmwiki/pmwiki.php/Film/JamesBond

    tropes_list_elements = page.locator(
        "h2 ~ ul > li, " "h3 ~ ul > li, " ".folder > ul > li"
    )

    # Extract and format the scores
    tropes = []
    subpages_with_tropes = []
    for trope_item in await tropes_list_elements.all():
        trope_name_element = trope_item.locator("a")
        if not await trope_name_element.count():
            continue

        trope_name_item = trope_name_element.first
        trope_name = (await trope_name_item.text_content()).strip()
        trope_url = await trope_name_item.get_attribute("href")
        trope_html = (await trope_item.inner_html()).strip()

        full_trope_url = f"https://tvtropes.org{trope_url}"
        is_subpage_link = bool(re.search(r"Tropes [A-Z] to [A-Z]", trope_name))
        if is_subpage_link:
            if not subpages_with_tropes:
                # reset tropes as links above the first
                # subpage link are probably not tags
                tropes = []
            subpages_with_tropes.append(full_trope_url)
        else:
            tropes.append(
                Trope(
                    name=trope_name,
                    url=full_trope_url,
                    html=remove_prefix(text=trope_html, prefix=trope_name),
                )
            )

    for subpage_url in subpages_with_tropes:
        sub_page = await browser.new_page()
        await sub_page.goto(subpage_url)
        sub_result = await crawl_page(browser, sub_page)
        tropes += sub_result.tropes

    return TvTropesCrawlResult(
        url=page.url,
        tropes=tropes,
        rate_limit_reached=False,
    )


def is_ambiguous_title(original_title: str, type: str) -> bool:
    if type == "m":
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
        next_entry.updated_at = datetime.utcnow()
        print(f"saving {len(result.tropes or [])} tags for {next_entry.original_title}")

    next_entry.save()


async def tvtropes_crawl_tags():
    print("Fetch semantic tags from TV Tropes pages")
    init_mongodb()

    next_entries = retrieve_next_entries(count=BATCH_SIZE)
    if not next_entries:
        print(f"warning: no entries to fetch in TV Tropes tags")
        return

    for next_entry in next_entries:
        print(
            f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity})"
        )

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        context.set_default_timeout(BROWSER_TIMEOUT)
        list_of_crawl_results = await asyncio.gather(
            *[crawl_data(next_entry, context) for next_entry in next_entries]
        )
        await context.close()

    return {
        "count_new_tropes": len(next_entries),
        "entries": [
            {
                "tmdb_id": next_entry.tmdb_id,
                "original_title": next_entry.original_title,
                "popularity": next_entry.popularity,
                "trope_count": len(crawl_result.tropes) if crawl_result else None,
            }
            for crawl_result, next_entry in list_of_crawl_results
        ],
    }


def main():
    return asyncio.run(tvtropes_crawl_tags())


async def debug():
    init_mongodb()
    next_entry = TvTropesMovieTags.objects.get(tmdb_id=680)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        context.set_default_timeout(BROWSER_TIMEOUT)
        result = await crawl_data(next_entry, context)
        await browser.close()


if __name__ == "__main__":
    r = main()
    # asyncio.run(debug())
