from datetime import datetime, timedelta
from typing import Union

import requests
from bs4 import BeautifulSoup
from mongoengine import Q
from prefect import flow, get_run_logger, serve, task
from prefect_dask.task_runners import DaskTaskRunner
from pydantic import BaseModel

from src.data_source.imdb_web.models import ImdbMovieRating, ImdbTvRating
from src.utils.db import init_db

BATCH_SIZE = 5
BUFFER_SELECTED_AT_MINUTES = 10
# TODO dotenv
TMDB_API_KEY = "df95f1bae98baaf28e1c06d7a2762e27"


class ImdbCrawlResult(BaseModel):
    url: str
    user_score_original: float
    user_score_normalized_percent: float
    user_score_vote_count: int


@task
def retrieve_next_entries(count: int):
    init_db()

    # Get the top n entries without "selected_at" sorted by popularity
    buffer_time_for_selected_entries = datetime.utcnow() - timedelta(minutes=BUFFER_SELECTED_AT_MINUTES)
    movies_no_fetch = list(ImdbMovieRating.objects(
        Q(selected_at=None) |
        Q(__raw__={
            "$and": [
                {"$expr": {"$gt": ["$selected_at", "$updated_at"]}},
                {"selected_at": {"$lt": buffer_time_for_selected_entries}}
            ]
        })
    ).order_by("-popularity").limit(count))
    tvs_no_fetch = list(ImdbTvRating.objects(
        Q(selected_at=None) |
        Q(__raw__={
            "$and": [
                {"$expr": {"$gt": ["$selected_at", "$updated_at"]}},
                {"selected_at": {"$lt": buffer_time_for_selected_entries}}
            ]
        })
    ).order_by("-popularity").limit(count))

    # Get the top n entries with the oldest "selected_at"
    movies_old_fetch = list(ImdbMovieRating.objects(selected_at__ne=None).order_by("selected_at").limit(count))
    tvs_old_fetch = list(ImdbTvRating.objects(selected_at__ne=None).order_by("selected_at").limit(count))

    # Compare and return
    no_fetch_entries = sorted(movies_no_fetch + tvs_no_fetch, key=lambda x: x.popularity, reverse=True)[:count]
    old_fetch_entries = sorted(movies_old_fetch + tvs_old_fetch, key=lambda x: x.selected_at)[:count]

    next_entries = (no_fetch_entries + old_fetch_entries)[:count]

    # Update "selected_at" field to reserve these for this worker
    movie_ids_to_update = [entry.id for entry in next_entries if isinstance(entry, ImdbMovieRating)]
    tv_ids_to_update = [entry.id for entry in next_entries if isinstance(entry, ImdbTvRating)]

    if movie_ids_to_update:
        ImdbMovieRating.objects(id__in=movie_ids_to_update).update(selected_at=datetime.utcnow())
    if tv_ids_to_update:
        ImdbTvRating.objects(id__in=tv_ids_to_update).update(selected_at=datetime.utcnow())

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537'}
    response = requests.get(url, headers=headers)
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
        user_score_normalized_percent=score*10,
        user_score_vote_count=vote_count,
    )


def store_result(next_entry: Union[ImdbMovieRating, ImdbTvRating], result: ImdbCrawlResult):
    logger = get_run_logger()
    logger.info(f"saving rating for {next_entry.original_title}: {result.user_score_original} ({result.user_score_vote_count})")

    next_entry.user_score_original = result.user_score_original
    next_entry.user_score_normalized_percent = result.user_score_normalized_percent
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
