from f.data_source.common import retrieve_next_entry_ids
from f.db.mongodb import init_mongodb
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails


BATCH_SIZE = 50
BUFFER_SELECTED_AT_MINUTES = 10


def main():
    init_mongodb()
    ids = retrieve_next_entry_ids(
        count=BATCH_SIZE,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
        movie_model=TmdbMovieDetails,
        tv_model=TmdbTvDetails,
    )
    return ids.model_dump()


if __name__ == "__main__":
    main()
