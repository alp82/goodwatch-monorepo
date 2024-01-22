from typing import Union
from mongoengine import get_db

from f.data_source.common import get_documents_for_ids
from f.db.mongodb import init_mongodb
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_daily.models import DumpType
from f.rotten_web.rotten_tomatoes_init_ratings.main import build_operation, store_copies


def initialize_documents(next_entries: list[Union[TmdbMovieDetails, TmdbTvDetails]]):
    print("Initializing documents for Rotten Tomatoes ratings")
    mongo_db = get_db()

    count_new_movies = 0
    count_new_tv = 0

    for next_entry in next_entries:
        print(f"copying {next_entry.title} ({next_entry.tmdb_id}) rating")
        if isinstance(next_entry, TmdbMovieDetails):
            operation = build_operation(
                tmdb_entry=next_entry.to_mongo().to_dict(),
                type=DumpType.MOVIES,
            )
            count_new_movies += store_copies(
                operations=[operation],
                collection=mongo_db.rotten_tomatoes_movie_rating,
                label_plural="movies",
            )
        elif isinstance(next_entry, TmdbTvDetails):
            operation = build_operation(
                tmdb_entry=next_entry.to_mongo().to_dict(),
                type=DumpType.TV_SERIES,
            )
            count_new_tv += store_copies(
                operations=[operation],
                collection=mongo_db.rotten_tomatoes_tv_rating,
                label_plural="tv series",
            )
        else:
            raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")

    return {
        "count_new_movies": count_new_movies,
        "count_new_tv": count_new_tv,
    }


def main(next_ids: dict):
    print("Prepare fetching ratings from Rotten Tomatoes")
    init_mongodb()
    next_entries = get_documents_for_ids(
        next_ids=next_ids,
        movie_model=TmdbMovieDetails,
        tv_model=TmdbTvDetails,
    )
    return initialize_documents(next_entries)




