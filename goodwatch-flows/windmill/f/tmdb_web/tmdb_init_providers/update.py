from typing import Union
from typing import cast
from typing import Any

from mongoengine import get_db

from f.data_source.common import get_documents_for_ids
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_web.country_state import ensure_indexes, initialize_countries


def initialize_documents(
    next_entries: list[Union[TmdbMovieDetails, TmdbTvDetails]],
) -> dict:
    db = get_db()
    result = {
        "movie_ids": [],
        "tv_ids": [],
        "count_new_movies": 0,
        "count_new_tv": 0,
    }
    initialized = set()
    for entry in next_entries:
        if isinstance(entry, TmdbMovieDetails):
            media_type, count_key = "movie", "count_new_movies"
        elif isinstance(entry, TmdbTvDetails):
            media_type, count_key = "tv", "count_new_tv"
        else:
            raise ValueError(f"Unexpected details type: {type(entry)}")
        collection = db[f"tmdb_{media_type}_providers"]
        if media_type not in initialized:
            ensure_indexes(collection)
            initialized.add(media_type)
        data = entry.to_mongo().to_dict()
        countries = initialize_countries(
            collection,
            data["tmdb_id"],
            (data.get("watch_providers") or {}).get("results") or {},
            media_type,
            original_title=data.get("original_title"),
            popularity=data.get("popularity"),
        )
        result[count_key] += countries["count_new_documents"]
        result[f"{media_type}_ids"].extend(
            identity
            for identity in countries["ids"]
            if identity not in result[f"{media_type}_ids"]
        )
    return result


def main(next_ids: dict) -> dict:
    init_mongodb()
    try:
        # The shared legacy helper annotates model classes as Document instances.
        entries = get_documents_for_ids(
            next_ids=next_ids,
            movie_model=cast(Any, TmdbMovieDetails),
            tv_model=cast(Any, TmdbTvDetails),
        )
        if any(
            not isinstance(entry, (TmdbMovieDetails, TmdbTvDetails))
            for entry in entries
        ):
            raise ValueError("Expected movie/tv details documents")
        # Titles deleted on TMDB must not seed new work.
        entries = [entry for entry in entries if not entry.tmdb_deleted]
        return initialize_documents(
            cast(list[Union[TmdbMovieDetails, TmdbTvDetails]], entries)
        )
    finally:
        close_mongodb()
