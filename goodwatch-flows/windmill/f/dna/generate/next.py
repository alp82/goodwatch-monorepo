from f.data_source.common import retrieve_next_entry_ids_full
from f.db.mongodb import init_mongodb, close_mongodb
from f.dna.models import DNA_STALE_AFTER_DAYS, DnaMovie, DnaTv
from f.dna.generate.spend_pause import SpendPause


BATCH_SIZE = 100
BUFFER_SELECTED_AT_MINUTES = 60


def main():
    if SpendPause().is_active():
        return {
            "ids": {"movie_ids": [], "tv_ids": []},
            "tmdb_ids": {"movie_ids": [], "tv_ids": []},
        }
    init_mongodb()
    result = retrieve_next_entry_ids_full(
        count=BATCH_SIZE,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
        movie_model=DnaMovie,
        tv_model=DnaTv,
        stale_after_days=DNA_STALE_AFTER_DAYS,
    )
    close_mongodb()
    return result


if __name__ == "__main__":
    main()
