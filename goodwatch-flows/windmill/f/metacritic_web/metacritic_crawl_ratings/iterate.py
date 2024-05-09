from f.data_source.common import get_documents_for_ids, IdParameter
from f.db.mongodb import init_mongodb, close_mongodb
from f.metacritic_web.models import (
    MetacriticMovieRating,
    MetacriticTvRating,
)


def main(next_ids: dict):
    init_mongodb()
    next_entries = get_documents_for_ids(
        next_ids=next_ids,
        movie_model=MetacriticMovieRating,
        tv_model=MetacriticTvRating,
    )

    entries_to_fetch = []
    for next_entry in next_entries:
        if isinstance(next_entry, MetacriticMovieRating):
            id_type = "movie"
        elif isinstance(next_entry, MetacriticTvRating):
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

    close_mongodb()
    return entries_to_fetch
