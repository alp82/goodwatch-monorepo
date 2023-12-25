# extra_requirements:
# playwright==1.40.0

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright, BrowserContext
from pydantic import BaseModel
import re
from typing import Union, Optional
import wmill

from f.data_source.common import prepare_next_entries
from f.db.mongodb import init_mongodb
from f.rotten_web.models import RottenTomatoesMovieRating, RottenTomatoesTvRating

BATCH_SIZE = 1
BUFFER_SELECTED_AT_MINUTES = 30
BROWSER_TIMEOUT = 180000


class RottenTomatoesCrawlResult(BaseModel):
    url: Optional[str]
    tomato_score_original: Optional[float]
    tomato_score_normalized_percent: Optional[float]
    tomato_score_vote_count: Optional[int]
    audience_score_original: Optional[float]
    audience_score_normalized_percent: Optional[float]
    audience_score_vote_count: Optional[int]
    rate_limit_reached: bool


def retrieve_next_entries(
    count: int,
) -> Union[RottenTomatoesMovieRating, RottenTomatoesTvRating]:
    next_entries = prepare_next_entries(
        movie_model=RottenTomatoesMovieRating,
        tv_model=RottenTomatoesTvRating,
        count=count,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
    )
    return next_entries


async def crawl_data(
    next_entry: Union[RottenTomatoesMovieRating, RottenTomatoesTvRating],
    browser: BrowserContext,
) -> tuple[
    RottenTomatoesCrawlResult, Union[RottenTomatoesMovieRating, RottenTomatoesTvRating]
]:
    if isinstance(next_entry, RottenTomatoesMovieRating):
        return await crawl_movie_rating(next_entry, browser), next_entry
    elif isinstance(next_entry, RottenTomatoesTvRating):
        return await crawl_tv_rating(next_entry, browser), next_entry
    else:
        raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")


async def crawl_movie_rating(
    next_entry: RottenTomatoesMovieRating,
    browser: BrowserContext,
) -> RottenTomatoesCrawlResult:
    result = await crawl_rotten_tomatoes_page(
        next_entry=next_entry, type="m", browser=browser
    )
    store_result(next_entry=next_entry, result=result)
    return result


async def crawl_tv_rating(
    next_entry: RottenTomatoesTvRating,
    browser: BrowserContext,
) -> RottenTomatoesCrawlResult:
    result = await crawl_rotten_tomatoes_page(
        next_entry=next_entry, type="tv", browser=browser
    )
    store_result(next_entry=next_entry, result=result)
    return result


async def crawl_rotten_tomatoes_page(
    next_entry: list[Union[RottenTomatoesMovieRating, RottenTomatoesTvRating]],
    type: str,
    browser: BrowserContext,
) -> RottenTomatoesCrawlResult:
    main_url = "https://www.rottentomatoes.com"
    base_url = f"{main_url}/{type}"

    all_variations = (
        [
            f"{title}_{next_entry.release_year}" if i % 2 == 0 else title
            for title in next_entry.title_variations
            for i in range(2)
        ]
        if next_entry.release_year
        and is_ambiguous_title(next_entry.original_title, type)
        else next_entry.title_variations
    )
    all_urls = [f"{base_url}/{title}" for title in all_variations]

    # headers = {
    #     #        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    #     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36",
    #     "Accept-Language": "en-US,en;q=0.9",
    #     "Referer": "https://www.google.com/",
    # }
    response = None
    for url in all_urls:
        print(f"trying url: {url}")
        page = await browser.new_page()
        response = await page.goto(url)
        if response.status == 403:
            return RottenTomatoesCrawlResult(
                url=None,
                tomato_score_original=None,
                tomato_score_normalized_percent=None,
                tomato_score_vote_count=None,
                audience_score_original=None,
                audience_score_normalized_percent=None,
                audience_score_vote_count=None,
                rate_limit_reached=True,
            )
        elif response.status == 200:
            break

    if not response or response.status != 200:
        return RottenTomatoesCrawlResult(
            url=None,
            tomato_score_original=None,
            tomato_score_normalized_percent=None,
            tomato_score_vote_count=None,
            audience_score_original=None,
            audience_score_normalized_percent=None,
            audience_score_vote_count=None,
            rate_limit_reached=False,
        )

    # Locate the score elements
    tomato_score_element = page.locator("score-details-critics-deprecated")
    audience_score_element = page.locator("score-details-audience-deprecated")

    tomato_score_raw = await tomato_score_element.get_attribute("value")
    audience_score_raw = await audience_score_element.get_attribute("value")
    tomato_score_vote_count_raw = await tomato_score_element.get_attribute(
        "reviewcount"
    )
    audience_score_vote_count_raw = await audience_score_element.get_attribute(
        "ratingcount"
    )

    # Extract and format the scores
    tomato_score = None
    if tomato_score_raw:
        try:
            tomato_score = float(tomato_score_raw)
        except ValueError:
            pass

    audience_score = None
    if audience_score_raw:
        try:
            audience_score = float(audience_score_raw)
        except ValueError:
            pass

    # Extract and format the vote counts
    tomato_score_vote_count = None
    if tomato_score_vote_count_raw:
        try:
            match = re.search(r"[\d,]+", tomato_score_vote_count_raw)
            if match:
                tomato_score_vote_count = int(match.group().replace(",", ""))
        except ValueError:
            pass

    audience_score_vote_count = None
    if audience_score_vote_count_raw:
        try:
            match = re.search(r"[\d,]+", audience_score_vote_count_raw)
            if match:
                audience_score_vote_count = int(match.group().replace(",", ""))
        except ValueError:
            pass

    return RottenTomatoesCrawlResult(
        url=url,
        tomato_score_original=tomato_score,
        tomato_score_normalized_percent=tomato_score,
        tomato_score_vote_count=tomato_score_vote_count,
        audience_score_original=audience_score,
        audience_score_normalized_percent=audience_score,
        audience_score_vote_count=audience_score_vote_count,
        rate_limit_reached=False,
    )


def is_ambiguous_title(original_title: str, type: str) -> bool:
    if type == "m":
        count_with_same_title = RottenTomatoesMovieRating.objects(
            original_title=original_title
        ).count()
    else:
        count_with_same_title = RottenTomatoesTvRating.objects(
            original_title=original_title
        ).count()

    return count_with_same_title > 1


def store_result(
    next_entry: Union[RottenTomatoesMovieRating, RottenTomatoesTvRating],
    result: RottenTomatoesCrawlResult,
):
    if type(result.url) in [str]:
        next_entry.rotten_tomatoes_url = result.url

    if type(result.tomato_score_original) in [int, float]:
        next_entry.tomato_score_original = result.tomato_score_original
    if type(result.tomato_score_normalized_percent) in [int, float]:
        next_entry.tomato_score_normalized_percent = (
            result.tomato_score_normalized_percent
        )
    if type(result.tomato_score_vote_count) == int:
        next_entry.tomato_score_vote_count = result.tomato_score_vote_count

    if type(result.audience_score_original) in [int, float]:
        next_entry.audience_score_original = result.audience_score_original
    if type(result.audience_score_normalized_percent) in [int, float]:
        next_entry.audience_score_normalized_percent = (
            result.audience_score_normalized_percent
        )
    if type(result.audience_score_vote_count) == int:
        next_entry.audience_score_vote_count = result.audience_score_vote_count

    if result.rate_limit_reached:
        next_entry.error_message = "Rate Limit reached"
        next_entry.failed_at = datetime.utcnow()
        print(
            f"could not fetch rating for {next_entry.original_title}: {next_entry.error_message}"
        )

    else:
        next_entry.error_message = None
        next_entry.updated_at = datetime.utcnow()
        print(
            f"saving rating for {next_entry.original_title}: {result.tomato_score_original} ({result.tomato_score_vote_count}) / {result.audience_score_original} ({result.audience_score_vote_count})"
        )

    next_entry.save()


async def rotten_tomatoes_crawl_ratings(
    next_entries: list[Union[RottenTomatoesMovieRating, RottenTomatoesTvRating]]
):
    print("Fetch ratings from Rotten Tomatoes pages")
    init_mongodb()

    if not next_entries:
        print(f"warning: no entries to fetch in Rotten Tomatoes ratings")
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
        await browser.close()

    return {
        "count_new_ratings": len(next_entries),
        "entries": [
            {
                "tmdb_id": next_entry.tmdb_id,
                "original_title": next_entry.original_title,
                "popularity": next_entry.popularity,
                "ratings": crawl_result.model_dump() if crawl_result else None,
            }
            for crawl_result, next_entry in list_of_crawl_results
        ],
    }


def main(next_entries: list[Union[RottenTomatoesMovieRating, RottenTomatoesTvRating]]):
    return asyncio.run(rotten_tomatoes_crawl_ratings(next_entries))


async def debug():
    init_mongodb()
    next_entry = RottenTomatoesMovieRating.objects.get(tmdb_id=680)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        context.set_default_timeout(BROWSER_TIMEOUT)
        result = await crawl_data(next_entry, context)
        await browser.close()


if __name__ == "__main__":
    # main()
    asyncio.run(debug())
