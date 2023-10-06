from datetime import datetime, timedelta
from ssl import SSLError
from typing import Union, Optional

import requests
from bs4 import BeautifulSoup
from prefect import flow, get_run_logger, serve, task
from prefect_dask.task_runners import DaskTaskRunner
from pydantic import BaseModel

from src.data_source.imdb_web.models import ImdbMovieRating, ImdbTvRating
from src.data_source.common import prepare_next_entries
from src.utils.db import init_db

BATCH_SIZE = 30
BUFFER_SELECTED_AT_MINUTES = 10
# TODO dotenv
TMDB_API_KEY = "df95f1bae98baaf28e1c06d7a2762e27"


class ImdbCrawlResult(BaseModel):
    url: str
    user_score_original: Optional[float]
    user_score_normalized_percent: Optional[float]
    user_score_vote_count: Optional[int]


@task
def retrieve_next_entries(count: int) -> Union[ImdbMovieRating, ImdbTvRating]:
    init_db()
    next_entries = prepare_next_entries(
        movie_model=ImdbMovieRating,
        tv_model=ImdbTvRating,
        count=count,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
    )
    return next_entries


@task
def crawl_data(next_entry: Union[ImdbMovieRating, ImdbTvRating]):
    init_db()

    if isinstance(next_entry, ImdbMovieRating):
        return crawl_movie_rating(next_entry)
    elif isinstance(next_entry, ImdbTvRating):
        return crawl_tv_rating(next_entry)
    else:
        raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")


def crawl_movie_rating(next_entry: ImdbMovieRating):
    result = crawl_imdb_page(imdb_id=next_entry.imdb_id)
    store_result(next_entry=next_entry, result=result)


def crawl_tv_rating(next_entry: ImdbTvRating):
    result = crawl_imdb_page(imdb_id=next_entry.imdb_id)
    store_result(next_entry=next_entry, result=result)


def crawl_imdb_page(imdb_id: str) -> ImdbCrawlResult:
    main_url = 'https://www.imdb.com/title'
    url = f"{main_url}/{imdb_id}/"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537'
    }
    try:
        response = requests.get(url, headers=headers)
    except SSLError error:
        pass

    html = response.text
    soup = BeautifulSoup(html, 'html.parser')

    # Locate the score element
    score_element = soup.select_one('[data-testid="hero-rating-bar__aggregate-rating__score"] span:nth-child(1)')
    vote_count_element = soup.select_one('[data-testid="hero-rating-bar__aggregate-rating__score"] ~ div:nth-of-type(3)')

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
                vote_count_text
                .replace('.', '')
                .replace('K', '000')
                .replace('M', '000000')
                .replace('B', '000000000')
            )
        except ValueError:
            vote_count = None
    else:
        vote_count = None

    return ImdbCrawlResult(
        url=url,
        user_score_original=score,
        user_score_normalized_percent=score*10 if score else None,
        user_score_vote_count=vote_count,
    )


def store_result(next_entry: Union[ImdbMovieRating, ImdbTvRating], result: ImdbCrawlResult):
    logger = get_run_logger()
    logger.info(f"saving rating for {next_entry.original_title}: {result.user_score_original} ({result.user_score_vote_count})")

    if type(result.user_score_original) in [int, float]:
        next_entry.user_score_original = result.user_score_original
    if type(result.user_score_normalized_percent) in [int, float]:
        next_entry.user_score_normalized_percent = result.user_score_normalized_percent
    if type(result.user_score_vote_count) == int:
        next_entry.user_score_vote_count = result.user_score_vote_count
    next_entry.updated_at = datetime.utcnow()
    next_entry.save()


@flow(task_runner=DaskTaskRunner())
def imdb_crawl_ratings():
    logger = get_run_logger()
    logger.info("Fetch ratings from IMDB pages")
    init_db()

    next_entries = retrieve_next_entries.submit(count=BATCH_SIZE).result()
    if not next_entries:
        logger.warning(f"no entries to fetch in imdb ratings")
        return

    for next_entry in next_entries:
        logger.info(f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity})")

    crawl_data.map(next_entries)


if __name__ == "__main__":
    imdb_crawl_ratings()

    deployment = imdb_crawl_ratings.to_deployment(
        name="local",
        interval=60,
    )
    serve(deployment)
