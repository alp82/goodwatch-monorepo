from f.data_source.common import retrieve_next_entry_ids
from f.db.mongodb import init_mongodb
from f.imdb_web.models import ImdbMovieRating, ImdbTvRating


BATCH_SIZE = 15
BUFFER_SELECTED_AT_MINUTES = 10


def main():
    init_mongodb()
    ids = retrieve_next_entry_ids(
        count=BATCH_SIZE,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
        movie_model=ImdbMovieRating,
        tv_model=ImdbTvRating,
    )
    return ids.model_dump()


if __name__ == "__main__":
    main()
