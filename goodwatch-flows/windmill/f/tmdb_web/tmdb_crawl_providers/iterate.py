from f.data_source.common import get_documents_for_ids, IdParameter
from f.db.mongodb import init_mongodb
from f.tmdb_web.models import (
    TmdbMovieProviders,
    TmdbTvProviders,
)


def main(next_ids: dict):
    init_mongodb()
    next_entries = get_documents_for_ids(
        next_ids=next_ids,
        movie_model=TmdbMovieProviders,
        tv_model=TmdbTvProviders,
    )

    entries_to_fetch = []
    for next_entry in next_entries:
        if isinstance(next_entry, TmdbMovieProviders):
            id_type = "movie"
        elif isinstance(next_entry, TmdbTvProviders):
            id_type = "tv"
        else:
            raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")

        entries_to_fetch.append(
            IdParameter(
                id=str(next_entry.id),
                tmdb_id=next_entry.tmdb_id,
                type=id_type,
            ).model_dump()
        )

    return entries_to_fetch
