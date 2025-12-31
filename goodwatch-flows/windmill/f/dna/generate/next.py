from f.data_source.common import retrieve_next_entry_ids_full
from f.db.mongodb import init_mongodb, close_mongodb
from f.dna.models import DnaMovie, DnaTv


BATCH_SIZE = 100
BUFFER_SELECTED_AT_MINUTES = 60


def main():
    init_mongodb()
    result = retrieve_next_entry_ids_full(
        count=BATCH_SIZE,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
        movie_model=DnaMovie,
        tv_model=DnaTv,
    )
    close_mongodb()
    return result


if __name__ == "__main__":
    main()
