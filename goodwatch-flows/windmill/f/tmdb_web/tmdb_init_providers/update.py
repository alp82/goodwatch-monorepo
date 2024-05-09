from typing import Union
from mongoengine import get_db

from f.data_source.common import get_documents_for_ids
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_web.tmdb_init_providers.main import build_operation, store_copies


def initialize_documents(next_entries: list[Union[TmdbMovieDetails, TmdbTvDetails]]):
    print("Initializing documents for TMDB streaming data")
    mongo_db = get_db()

    count_new_movies = 0
    count_new_tv = 0

    for next_entry in next_entries:
        print(f"copying {next_entry.title} ({next_entry.tmdb_id}) streaming data")
        tmdb_watch_results = next_entry.watch_providers.results
        tmdb_watch_urls = [v["link"] for v in tmdb_watch_results.values() if "link" in v]
        for tmdb_watch_url in tmdb_watch_urls:
            operation = build_operation(
                {
                    "tmdb_id": next_entry.tmdb_id,
                    "original_title": next_entry.original_title,
                    "popularity": next_entry.popularity,
                    "tmdb_watch_url": tmdb_watch_url,
                }
            )
            if isinstance(next_entry, TmdbMovieDetails):
                count_new_movies += store_copies(
                    [operation], mongo_db.tmdb_movie_providers
                )
            elif isinstance(next_entry, TmdbTvDetails):
                count_new_tv += store_copies([operation], mongo_db.tmdb_tv_providers)
            else:
                raise Exception(
                    f"next_entry has an unexpected type: {type(next_entry)}"
                )

    return {
        "count_new_movies": count_new_movies,
        "count_new_tv": count_new_tv,
    }


def main(next_ids: dict):
    print("Prepare fetching streaming data from TMDB")
    init_mongodb()
    next_entries = get_documents_for_ids(
        next_ids=next_ids,
        movie_model=TmdbMovieDetails,
        tv_model=TmdbTvDetails,
    )
    docs = initialize_documents(next_entries)
    close_mongodb()
    return docs
