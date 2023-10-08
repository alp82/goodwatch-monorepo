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
from f.metacritic_web.models import MetacriticMovieRating, MetacriticTvRating

BATCH_SIZE = 30
BUFFER_SELECTED_AT_MINUTES = 10
# TODO dotenv
TMDB_API_KEY = "df95f1bae98baaf28e1c06d7a2762e27"


class MetacriticCrawlResult(BaseModel):
    url: str
    meta_score_original: Optional[float]
    meta_score_normalized_percent: Optional[float]
    meta_score_vote_count: Optional[int]
    user_score_original: Optional[float]
    user_score_normalized_percent: Optional[float]
    user_score_vote_count: Optional[int]


def retrieve_next_entries(
    count: int,
) -> Union[MetacriticMovieRating, MetacriticTvRating]:
    next_entries = prepare_next_entries(
        movie_model=MetacriticMovieRating,
        tv_model=MetacriticTvRating,
        count=count,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
    )
    return next_entries


async def crawl_data(
    next_entry: Union[MetacriticMovieRating, MetacriticTvRating]
) -> tuple[MetacriticCrawlResult, Union[MetacriticMovieRating, MetacriticTvRating]]:
    if isinstance(next_entry, MetacriticMovieRating):
        return crawl_movie_rating(next_entry), next_entry
    elif isinstance(next_entry, MetacriticTvRating):
        return crawl_tv_rating(next_entry), next_entry
    else:
        raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")


def crawl_movie_rating(next_entry: MetacriticMovieRating) -> MetacriticCrawlResult:
    result = crawl_metacritic_page(next_entry=next_entry, type="movie")
    if result:
        store_result(next_entry=next_entry, result=result)
    return result


def crawl_tv_rating(next_entry: MetacriticTvRating) -> MetacriticCrawlResult:
    result = crawl_metacritic_page(next_entry=next_entry, type="tv")
    if result:
        store_result(next_entry=next_entry, result=result)
    return result


def crawl_metacritic_page(
    next_entry: Union[MetacriticMovieRating, MetacriticTvRating], type: str
) -> Optional[MetacriticCrawlResult]:
    main_url = "https://www.metacritic.com"
    base_url = f"{main_url}/{type}"

    all_variations = (
        [
            f"{title}-{next_entry.release_year}" if i % 2 == 0 else title
            for title in next_entry.title_variations
            for i in range(2)
        ]
        if next_entry.release_year
        else next_entry.title_variations
    )
    all_urls = [f"{base_url}/{title}" for title in all_variations]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537"
    }
    response = None
    for url in all_urls:
        try:
            response = requests.get(url, headers=headers)
        except SSLError as error:
            # TODO error handling
            raise error
        if response.status_code == 200:
            break

    if not response:
        return

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    # Locate the score elements
    meta_score_element = soup.select_one('.c-siteReviewScore[title^="Metascore"] span')
    user_score_element = soup.select_one('.c-siteReviewScore[title^="User score"] span')
    meta_score_vote_count_element = soup.select_one(
        '.c-ScoreCard a[href$="critic-reviews/"] span'
    )
    user_score_vote_count_element = soup.select_one(
        '.c-ScoreCard a[href$="user-reviews/"] span'
    )

    # Extract and format the scores
    meta_score = None
    if meta_score_element:
        meta_score_text = meta_score_element.string
        try:
            meta_score = float(meta_score_text)
        except ValueError:
            pass

    user_score = None
    if user_score_element:
        user_score_text = user_score_element.string
        try:
            user_score = float(user_score_text)
        except ValueError:
            pass

    # Extract and format the vote counts
    meta_score_vote_count = None
    if meta_score_vote_count_element:
        meta_score_vote_count_text = meta_score_vote_count_element.string
        try:
            match = re.search(r"[\d,]+", meta_score_vote_count_text)
            if match:
                meta_score_vote_count = int(match.group().replace(",", ""))
        except ValueError:
            pass

    user_score_vote_count = None
    if user_score_vote_count_element:
        user_score_vote_count_text = user_score_vote_count_element.string
        try:
            match = re.search(r"[\d,]+", user_score_vote_count_text)
            if match:
                user_score_vote_count = int(match.group().replace(",", ""))
        except ValueError:
            pass

    return MetacriticCrawlResult(
        url=url,
        meta_score_original=meta_score,
        meta_score_normalized_percent=meta_score,
        meta_score_vote_count=meta_score_vote_count,
        user_score_original=user_score,
        user_score_normalized_percent=user_score * 10 if user_score else None,
        user_score_vote_count=user_score_vote_count,
    )


def store_result(
    next_entry: Union[MetacriticMovieRating, MetacriticTvRating],
    result: MetacriticCrawlResult,
):
    print(
        f"saving rating for {next_entry.original_title}: {result.meta_score_original} ({result.meta_score_vote_count}) / {result.user_score_original} ({result.user_score_vote_count})"
    )

    if type(result.url) in [str]:
        next_entry.metacritic_url = result.url

    if type(result.meta_score_original) in [int, float]:
        next_entry.meta_score_original = result.meta_score_original
    if type(result.meta_score_normalized_percent) in [int, float]:
        next_entry.meta_score_normalized_percent = result.meta_score_normalized_percent
    if type(result.meta_score_vote_count) == int:
        next_entry.meta_score_vote_count = result.meta_score_vote_count

    if type(result.user_score_original) in [int, float]:
        next_entry.user_score_original = result.user_score_original
    if type(result.user_score_normalized_percent) in [int, float]:
        next_entry.user_score_normalized_percent = result.user_score_normalized_percent
    if type(result.user_score_vote_count) == int:
        next_entry.user_score_vote_count = result.user_score_vote_count

    next_entry.updated_at = datetime.utcnow()
    next_entry.save()


async def metacritic_crawl_ratings():
    print("Fetch ratings from IMDB pages")
    init_mongodb()

    next_entries = retrieve_next_entries(count=BATCH_SIZE)
    if not next_entries:
        print(f"warning: no entries to fetch in imdb ratings")
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
    return asyncio.run(metacritic_crawl_ratings())


if __name__ == "__main__":
    main()
