from f.data_source.common import retrieve_next_entry_ids
from f.db.mongodb import init_mongodb
from f.tvtropes_web.models import TvTropesMovieTags, TvTropesTvTags


BATCH_SIZE = 10
BUFFER_SELECTED_AT_MINUTES = 30


def main():
    init_mongodb()
    ids = retrieve_next_entry_ids(
        count=BATCH_SIZE,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
        movie_model=TvTropesMovieTags,
        tv_model=TvTropesTvTags,
    )
    return ids.model_dump()


if __name__ == "__main__":
    main()
