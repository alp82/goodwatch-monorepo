# extra_requirements:
# playwright==1.45.1

import asyncio
from datetime import datetime
import json
import re
from typing import Optional, Union

from playwright.async_api import async_playwright, BrowserContext

from f.data_source.common import get_document_for_id
from f.db.mongodb import init_mongodb, close_mongodb
from f.rotten_web.models import (
    RottenTomatoesCrawlResult,
    RottenTomatoesMovieRating,
    RottenTomatoesTvRating,
)

BROWSER_TIMEOUT = 180000


def extract_numeric_value(banded_rating_count) -> Optional[int]:
    match = re.search(r"(\d+)", banded_rating_count)
    if match:
        return int(match.group(1))


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
    print(result)
    store_result(next_entry=next_entry, result=result)
    return result


async def crawl_tv_rating(
    next_entry: RottenTomatoesTvRating,
    browser: BrowserContext,
) -> RottenTomatoesCrawlResult:
    result = await crawl_rotten_tomatoes_page(
        next_entry=next_entry, type="tv", browser=browser
    )
    print(result)
    store_result(next_entry=next_entry, result=result)
    return result


async def crawl_rotten_tomatoes_page(
    next_entry: Union[RottenTomatoesMovieRating, RottenTomatoesTvRating],
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
        # TODO oppenheimer has 2023 without ambigiouty
        #      maybe because from some point on, all movies get the year suffix?
        # and is_ambiguous_title(next_entry.original_title, type)
        else next_entry.title_variations
    )
    all_urls = [f"{base_url}/{title}" for title in all_variations]

    if len(all_urls) == 0:
        print(f"no title for {type} with id {next_entry.tmdb_id}")
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
            print("403: Rate limit reached")
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
            print(f"valid url: {url}")
            break

    # Locate the score elements
    print("locating score elements...")

    json_data = await page.evaluate("""() => {
        const scriptTag = document.querySelector('script[id="media-scorecard-json"]');
        return scriptTag ? scriptTag.textContent : null;
    }""")

    if not response or response.status != 200 or not json_data:
        print(f"no result for url: {url}")
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

    data = json.loads(json_data)

    # Extract critic score details
    tomato_score = None
    tomato_score_vote_count = None
    audience_score = None
    audience_score_vote_count = None

    tomato_data = data.get("criticsScore")
    if tomato_data:
        tomato_score = tomato_data.get("score")
        tomato_score_vote_count = tomato_data.get("ratingCount")
    print("Tomatometer rating:", tomato_score)
    print("Number of critic reviews:", tomato_score_vote_count)

    # Extract audience score details
    audience_all_data = data.get("overlay", {}).get("audienceAll")
    audience_data = data.get("audienceScore")
    if audience_all_data:
        audience_score = audience_all_data.get("score")
        if "likedCount" in audience_data and "notLikedCount" in audience_data:
            audience_score_vote_count = (
                audience_all_data["likedCount"] + audience_all_data["notLikedCount"]
            )
    if audience_data:
        if not audience_score:
            audience_score = audience_data.get("score")
        if not audience_score_vote_count:
            banded_rating_count = audience_data.get("bandedRatingCount", "")
            audience_score_vote_count = extract_numeric_value(banded_rating_count)
    print("Audience score:", audience_score)
    print("Number of audience ratings:", audience_score_vote_count)

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

    next_entry.is_selected = False
    next_entry.save()


async def rotten_tomatoes_crawl_ratings(
    next_entry: Union[RottenTomatoesMovieRating, RottenTomatoesTvRating],
):
    print("Fetch rating from Rotten Tomatoes page")

    if not next_entry:
        print(f"warning: no entries to fetch in Rotten Tomatoes ratings")
        return

    print(
        f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity})"
    )

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        context.set_default_timeout(BROWSER_TIMEOUT)
        try:
            (crawl_result, _) = await crawl_data(next_entry, context)
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
        "ratings": crawl_result.model_dump() if crawl_result else None,
    }


def main(next_id: dict):
    init_mongodb()
    next_entry = get_document_for_id(
        next_id=next_id,
        movie_model=RottenTomatoesMovieRating,
        tv_model=RottenTomatoesTvRating,
    )
    result = asyncio.run(rotten_tomatoes_crawl_ratings(next_entry))
    close_mongodb()
    return result
