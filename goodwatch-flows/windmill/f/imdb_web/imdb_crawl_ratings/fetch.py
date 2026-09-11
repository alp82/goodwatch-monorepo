import asyncio
from bs4 import BeautifulSoup
from datetime import datetime
import requests
from typing import Union, Any
from urllib.parse import urlparse
import math

HTTP_TIMEOUT_SECONDS = 15

from f.data_source.common import get_document_for_id
from f.db.mongodb import init_mongodb, close_mongodb
from f.imdb_web.models import ImdbCrawlResult, ImdbMovieRating, ImdbTvRating


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
        response = requests.get(url, headers=headers, timeout=HTTP_TIMEOUT_SECONDS)
    except requests.RequestException:
        raise RuntimeError("IMDb request failed") from None
    if response.status_code != 200:
        raise RuntimeError(f"IMDb HTTP {response.status_code}")
    soup = BeautifulSoup(response.text, "html.parser")
    canonical = soup.select_one('link[rel="canonical"]')
    canonical_url = urlparse(str(canonical.get("href", ""))) if canonical else None
    if canonical_url is None or canonical_url.hostname not in {"imdb.com", "www.imdb.com"} or canonical_url.path.rstrip("/") != f"/title/{imdb_id}":
        raise RuntimeError("IMDb page identity was not verified")

    # Locate the score element
    score_element = soup.select_one(
        '[data-testid="hero-rating-bar__aggregate-rating__score"] span:nth-child(1)'
    )
    vote_count_element = soup.select_one(
        '[data-testid="hero-rating-bar__aggregate-rating__score"] ~ div:nth-of-type(3)'
    )

    try:
        score = float(score_element.get_text(strip=True)) if score_element else None
    except (ValueError, TypeError):
        score = None
    if score is None or not math.isfinite(score) or not 0 <= score <= 10:
        raise RuntimeError("IMDb page has no verified numeric rating")

    vote_count = None
    if vote_count_element:
        text = vote_count_element.get_text(strip=True).replace(",", "")
        multiplier = {"K": 1000, "M": 1000000, "B": 1000000000}.get(text[-1:], 1)
        number = text[:-1] if multiplier != 1 else text
        try:
            numeric_count = float(number) * multiplier
            if math.isfinite(numeric_count) and numeric_count >= 0:
                vote_count = int(numeric_count)
        except ValueError:
            pass

    return ImdbCrawlResult(
        url=url,
        user_score_original=score,
        user_score_normalized_percent=score * 10,
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
    next_entry.failed_at = None
    next_entry.error_message = None
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
        "ratings": crawl_result.model_dump(),
    }


def main(next_id: dict):
    init_mongodb()
    next_entry: Any = None
    try:
        next_entry = get_document_for_id(
            next_id=next_id,
            movie_model=ImdbMovieRating,
            tv_model=ImdbTvRating,
        )
        return asyncio.run(imdb_crawl_ratings(next_entry))
    except Exception as error:
        message = str(error) if isinstance(error, RuntimeError) and str(error).startswith("IMDb ") else "IMDb fetch failed"
        if next_entry is not None:
            next_entry.failed_at = datetime.utcnow()
            next_entry.error_message = message
            next_entry.is_selected = False
            next_entry.save()
        raise RuntimeError(message) from None
    finally:
        close_mongodb()
