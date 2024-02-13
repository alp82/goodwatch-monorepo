import asyncio
from bs4 import BeautifulSoup
from datetime import datetime
import requests
from ssl import SSLError
from typing import Union

from f.imdb_web.models import ImdbCrawlResult, ImdbMovieRating, ImdbTvRating
from f.data_source.common import get_document_for_id
from f.db.mongodb import init_mongodb


def crawl_data(
    next_entry: Union[ImdbMovieRating, ImdbTvRating],
) -> tuple[ImdbCrawlResult, Union[ImdbMovieRating, ImdbTvRating]]:
    if isinstance(next_entry, ImdbMovieRating):
        return crawl_movie_rating(next_entry), next_entry
    elif isinstance(next_entry, ImdbTvRating):
        return crawl_tv_rating(next_entry), next_entry
    else:
        raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")


def crawl_movie_rating(next_entry: ImdbMovieRating) -> ImdbCrawlResult:
    result = crawl_imdb_page(imdb_id=next_entry.imdb_id)
    store_result(next_entry=next_entry, result=result)
    return result


def crawl_tv_rating(next_entry: ImdbTvRating) -> ImdbCrawlResult:
    result = crawl_imdb_page(imdb_id=next_entry.imdb_id)
    store_result(next_entry=next_entry, result=result)
    return result


def crawl_imdb_page(imdb_id: str) -> ImdbCrawlResult:
    main_url = "https://www.imdb.com/title"
    url = f"{main_url}/{imdb_id}/"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537"
    }
    try:
        response = requests.get(url, headers=headers)
    except SSLError as error:
        # TODO error handling
        raise error

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    # Locate the score element
    score_element = soup.select_one(
        '[data-testid="hero-rating-bar__aggregate-rating__score"] span:nth-child(1)'
    )
    vote_count_element = soup.select_one(
        '[data-testid="hero-rating-bar__aggregate-rating__score"] ~ div:nth-of-type(3)'
    )

    # Extract and format the score
    if score_element:
        score_text = score_element.string
        try:
            score = float(score_text)
        except ValueError:
            score = None
    else:
        score = None

    # Extract and format the vote count
    if vote_count_element:
        vote_count_text = vote_count_element.string
        try:
            vote_count = int(
                vote_count_text.replace(".", "")
                .replace("K", "000")
                .replace("M", "000000")
                .replace("B", "000000000")
            )
        except ValueError:
            vote_count = None
    else:
        vote_count = None

    return ImdbCrawlResult(
        url=url,
        user_score_original=score,
        user_score_normalized_percent=score * 10 if score else None,
        user_score_vote_count=vote_count,
        rate_limit_reached=False,
    )


def store_result(
    next_entry: Union[ImdbMovieRating, ImdbTvRating], result: ImdbCrawlResult
):
    print(
        f"saving rating for {next_entry.original_title}: {result.user_score_original} ({result.user_score_vote_count})"
    )

    if type(result.user_score_original) in [int, float]:
        next_entry.user_score_original = result.user_score_original
    if type(result.user_score_normalized_percent) in [int, float]:
        next_entry.user_score_normalized_percent = result.user_score_normalized_percent
    if type(result.user_score_vote_count) == int:
        next_entry.user_score_vote_count = result.user_score_vote_count
    next_entry.updated_at = datetime.utcnow()
    next_entry.is_selected = False
    next_entry.save()


async def imdb_crawl_ratings(next_entry: Union[ImdbMovieRating, ImdbTvRating]):
    print("Fetch ratings from IMDB pages")

    if not next_entry:
        print(f"warning: no entries to fetch in imdb ratings")
        return

    print(
        f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity})"
    )

    (crawl_result, _) = crawl_data(next_entry)

    if crawl_result.rate_limit_reached:
        raise Exception(
            f"Rate limit reached for {next_entry.original_title}, retrying."
        )

    return {
        "tmdb_id": next_entry.tmdb_id,
        "original_title": next_entry.original_title,
        "popularity": next_entry.popularity,
        "ratings": crawl_result.dict(),
    }


def main(next_id: dict):
    init_mongodb()
    next_entry = get_document_for_id(
        next_id=next_id,
        movie_model=ImdbMovieRating,
        tv_model=ImdbTvRating,
    )
    return asyncio.run(imdb_crawl_ratings(next_entry))
