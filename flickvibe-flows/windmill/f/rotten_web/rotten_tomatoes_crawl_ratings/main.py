import asyncio
from bs4 import BeautifulSoup
from datetime import datetime
from pydantic import BaseModel
import re
import requests
from ssl import SSLError
from typing import Union, Optional

from f.data_source.common import prepare_next_entries
from f.db.mongodb import init_mongodb
from f.rotten_web.models import RottenTomatoesMovieRating, RottenTomatoesTvRating

BATCH_SIZE = 3
BUFFER_SELECTED_AT_MINUTES = 30
# TODO dotenv
TMDB_API_KEY = "df95f1bae98baaf28e1c06d7a2762e27"


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
    next_entry: Union[RottenTomatoesMovieRating, RottenTomatoesTvRating]
) -> tuple[
    RottenTomatoesCrawlResult, Union[RottenTomatoesMovieRating, RottenTomatoesTvRating]
]:
    if isinstance(next_entry, RottenTomatoesMovieRating):
        return crawl_movie_rating(next_entry), next_entry
    elif isinstance(next_entry, RottenTomatoesTvRating):
        return crawl_tv_rating(next_entry), next_entry
    else:
        raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")


def crawl_movie_rating(
    next_entry: RottenTomatoesMovieRating,
) -> RottenTomatoesCrawlResult:
    result = crawl_rotten_tomatoes_page(next_entry=next_entry, type="m")
    store_result(next_entry=next_entry, result=result)
    return result


def crawl_tv_rating(next_entry: RottenTomatoesTvRating) -> RottenTomatoesCrawlResult:
    result = crawl_rotten_tomatoes_page(next_entry=next_entry, type="tv")
    store_result(next_entry=next_entry, result=result)
    return result


def crawl_rotten_tomatoes_page(
    next_entry: Union[RottenTomatoesMovieRating, RottenTomatoesTvRating], type: str
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
        else next_entry.title_variations
    )
    all_urls = [f"{base_url}/{title}" for title in all_variations]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
    }
    response = None
    for url in all_urls:
        try:
            print(url)
            response = requests.get(url, headers=headers)
        except SSLError as error:
            # TODO error handling
            print(error)
            raise error
        if response.status_code == 403:
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
        elif response.status_code == 200:
            break

    if not response:
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

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    # Locate the score elements
    score_element = soup.select_one("#topSection score-board")
    tomato_score_vote_count_element = soup.select_one('[slot="critics-count"]')
    audience_score_vote_count_element = soup.select_one('[slot="audience-count"]')

    # Extract and format the scores
    tomato_score = None
    audience_score = None
    if score_element:
        try:
            tomato_score = float(score_element.get("tomatometerscore"))
            audience_score = float(score_element.get("audiencescore"))
        except ValueError:
            pass

    # Extract and format the vote counts
    tomato_score_vote_count = None
    if tomato_score_vote_count_element:
        tomato_score_vote_count_text = tomato_score_vote_count_element.string
        try:
            match = re.search(r"[\d,]+", tomato_score_vote_count_text)
            if match:
                tomato_score_vote_count = int(match.group().replace(",", ""))
        except ValueError:
            pass

    audience_score_vote_count = None
    if audience_score_vote_count_element:
        audience_score_vote_count_text = audience_score_vote_count_element.string
        try:
            match = re.search(r"[\d,]+", audience_score_vote_count_text)
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


async def rotten_tomatoes_crawl_ratings():
    print("Fetch ratings from Rotten Tomatoes pages")
    init_mongodb()

    next_entries = retrieve_next_entries(count=BATCH_SIZE)
    if not next_entries:
        print(f"warning: no entries to fetch in Rotten Tomatoes ratings")
        return

    for next_entry in next_entries:
        print(
            f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity})"
        )

    list_of_crawl_results = await asyncio.gather(
        *[crawl_data(next_entry) for next_entry in next_entries]
    )

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


def main():
    return asyncio.run(rotten_tomatoes_crawl_ratings())


if __name__ == "__main__":
    main()
