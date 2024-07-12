from f.data_source.common import retrieve_next_entry_ids
from f.db.mongodb import init_mongodb, close_mongodb
from f.genome.models import GenomeMovie, GenomeTv


BATCH_SIZE = 10
BUFFER_SELECTED_AT_MINUTES = 10


def main():
    init_mongodb()
    ids = retrieve_next_entry_ids(
        count=BATCH_SIZE,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
        movie_model=GenomeMovie,
        tv_model=GenomeTv,
    )
    close_mongodb()
    return ids.model_dump()


if __name__ == "__main__":
    main()
