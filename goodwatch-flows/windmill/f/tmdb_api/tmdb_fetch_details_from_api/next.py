from datetime import datetime

from mongoengine import Q, get_db

from f.data_source.common import (
    QUEUE_FIELDS,
    get_ids_for_documents,
    not_deleted_filter,
    retrieve_next_entry_ids,
    update_selected_for_next_entries,
)
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.awaited_titles import reserve_due
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_api.refetch_cycle import titles_due


BATCH_SIZE = 50
BUFFER_SELECTED_AT_MINUTES = 10
# Slots of a batch for the titles members wait for (docs/awaited-title-rechecks.md).
AWAITED_PER_BATCH = 10
DETAILS_MODELS = {"movie": TmdbMovieDetails, "show": TmdbTvDetails}


def reserve_awaited_entries(db, now: datetime) -> list:
    """The details of the awaited titles whose offer recheck is due, reserved like any queued title.

    The short cycle must never cost the crawl a batch: when the list can't be read,
    the batch is the regular one.
    """
    try:
        titles = reserve_due(db, AWAITED_PER_BATCH, now)
        entries = []
        for media_type, model in DETAILS_MODELS.items():
            tmdb_ids = [tmdb_id for kind, tmdb_id in titles if kind == media_type]
            if tmdb_ids:
                entries += list(
                    model.objects(Q(tmdb_id__in=tmdb_ids) & not_deleted_filter(model)).only(*QUEUE_FIELDS)
                )
        update_selected_for_next_entries(TmdbMovieDetails, TmdbTvDetails, entries)
        return entries
    except Exception as error:
        print(f"warning: awaited titles left out of this batch: {type(error).__name__}: {error}")
        return []


def next_ids(db, now: datetime) -> dict:
    awaited = get_ids_for_documents(reserve_awaited_entries(db, now), TmdbMovieDetails, TmdbTvDetails)
    ids = retrieve_next_entry_ids(
        count=BATCH_SIZE - len(awaited.movie_ids) - len(awaited.tv_ids),
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
        movie_model=TmdbMovieDetails,
        tv_model=TmdbTvDetails,
        # Fetched titles come back at their place in the 30-day cycle (docs/details-refetch-cycle.md).
        refetch=lambda room: titles_due(db, [TmdbMovieDetails, TmdbTvDetails], room, now),
    )
    return {
        "movie_ids": awaited.movie_ids + ids.movie_ids,
        "tv_ids": awaited.tv_ids + ids.tv_ids,
        "bypass_cache_ids": awaited.movie_ids + awaited.tv_ids,
    }


def main():
    init_mongodb()
    ids = next_ids(get_db(), datetime.utcnow())
    close_mongodb()
    return ids


if __name__ == "__main__":
    main()
