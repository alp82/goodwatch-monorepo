from typing import Union
from mongoengine import get_db

from f.data_source.common import get_documents_for_ids
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_daily.models import DumpType
from f.tvtropes_web.tvtropes_init_tags.main import build_operation, store_copies


def initialize_documents(next_entries: list[Union[TmdbMovieDetails, TmdbTvDetails]]):
    print("Initializing documents for TV Tropes semantic tags")
    mongo_db = get_db()

    count_new_movies = 0
    count_new_tv = 0
    upserted_movie_ids = []
    upserted_tv_ids = []

    for next_entry in next_entries:
        print(f"copying {next_entry.title} ({next_entry.tmdb_id}) tv tropes tags")
        if isinstance(next_entry, TmdbMovieDetails):
            operation = build_operation(
                tmdb_entry=next_entry.to_mongo().to_dict(),
                type=DumpType.MOVIES,
            )
            movie_upserts = store_copies(
                operations=[operation],
                collection=mongo_db.tv_tropes_movie_tags,
                label_plural="movies",
            )
            count_new_movies += movie_upserts.get("count_new_documents")
            upserted_movie_ids += movie_upserts.get("upserted_ids")

        elif isinstance(next_entry, TmdbTvDetails):
            operation = build_operation(
                tmdb_entry=next_entry.to_mongo().to_dict(),
                type=DumpType.TV_SERIES,
            )
            tv_upserts = store_copies(
                operations=[operation],
                collection=mongo_db.tv_tropes_tv_tags,
                label_plural="tv series",
            )
            count_new_tv += tv_upserts.get("count_new_documents")
            upserted_tv_ids += tv_upserts.get("upserted_ids")

        else:
            raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")

    return {
        "count_new_movies": count_new_movies,
        "count_new_tv": count_new_tv,
        "upserted_movie_ids": upserted_movie_ids,
        "upserted_tv_ids": upserted_tv_ids,
    }


def main(next_ids: dict):
    print("Prepare fetching semantic tags from TV Tropes")
    init_mongodb()
    next_entries = get_documents_for_ids(
        next_ids=next_ids,
        movie_model=TmdbMovieDetails,
        tv_model=TmdbTvDetails,
    )
    docs = initialize_documents(next_entries)
    close_mongodb()

    print(docs)
    return {
        "movie_ids": docs["upserted_movie_ids"],
        "tv_ids": docs["upserted_tv_ids"],
    }
