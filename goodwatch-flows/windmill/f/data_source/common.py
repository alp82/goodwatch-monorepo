from datetime import datetime, timedelta
from typing import Union, Literal

from mongoengine import Document, Q, QuerySet
from pydantic import BaseModel


class IdParameter(BaseModel):
    id: str
    tmdb_id: int
    type: Union[Literal["movie"], Literal["tv"]]


class IdsParameter(BaseModel):
    movie_ids: list[str]
    tv_ids: list[str]


def retrieve_next_entry_ids(
    count: int,
    buffer_minutes: int,
    movie_model: Document,
    tv_model: Document,
    stale_after_days: int = None,
) -> IdsParameter:
    next_entries = prepare_next_entries(
        movie_model=movie_model,
        tv_model=tv_model,
        count=count,
        buffer_minutes=buffer_minutes,
        stale_after_days=stale_after_days,
    )
    ids = get_ids_for_documents(
        next_entries=next_entries,
        movie_model=movie_model,
        tv_model=tv_model,
    )
    return ids


def retrieve_next_entry_ids_full(
    count: int,
    buffer_minutes: int,
    movie_model: Document,
    tv_model: Document,
    stale_after_days: int = None,
) -> dict[str, dict]:
    next_entries = prepare_next_entries(
        movie_model=movie_model,
        tv_model=tv_model,
        count=count,
        buffer_minutes=buffer_minutes,
        stale_after_days=stale_after_days,
    )
    ids = get_ids_for_documents(
        next_entries=next_entries,
        movie_model=movie_model,
        tv_model=tv_model,
    )
    tmdb_ids = get_tmdb_ids_for_documents(
        next_entries=next_entries,
        movie_model=movie_model,
        tv_model=tv_model,
    )
    result = {
        "ids": ids.model_dump(),
        "tmdb_ids": tmdb_ids.model_dump(),
    }
    return result


# helper methods for param conversions


def get_ids_for_documents(
    next_entries: list[Document], movie_model: Document, tv_model: Document
) -> IdsParameter:
    movie_entries = [
        next_entry for next_entry in next_entries if isinstance(next_entry, movie_model)
    ]
    tv_entries = [
        next_entry for next_entry in next_entries if isinstance(next_entry, tv_model)
    ]
    movie_ids = list({str(movie.id) for movie in movie_entries})
    tv_ids = list({str(tv.id) for tv in tv_entries})
    return IdsParameter(
        movie_ids=movie_ids,
        tv_ids=tv_ids,
    )


def get_tmdb_ids_for_documents(
    next_entries: list[Document], movie_model: Document, tv_model: Document
) -> IdsParameter:
    movie_entries = [
        next_entry for next_entry in next_entries if isinstance(next_entry, movie_model)
    ]
    tv_entries = [
        next_entry for next_entry in next_entries if isinstance(next_entry, tv_model)
    ]
    movie_ids = list({str(movie.tmdb_id) for movie in movie_entries})
    tv_ids = list({str(tv.tmdb_id) for tv in tv_entries})
    return IdsParameter(
        movie_ids=movie_ids,
        tv_ids=tv_ids,
    )


def get_documents_for_ids(
    next_ids: dict, movie_model: Document, tv_model: Document
) -> list[Document]:
    ids = IdsParameter(
        movie_ids=next_ids.get("movie_ids", []),
        tv_ids=next_ids.get("tv_ids", []),
    )
    movie_results = list(
        movie_model.objects(id__in=ids.movie_ids).order_by("selected_at", "-popularity")
    )
    tv_results = list(
        tv_model.objects(id__in=ids.tv_ids).order_by("selected_at", "-popularity")
    )
    return movie_results + tv_results


def get_documents_for_tmdb_ids(
    next_ids: dict, movie_model: Document, tv_model: Document
) -> list[Document]:
    ids = IdsParameter(
        movie_ids=next_ids.get("movie_ids", []),
        tv_ids=next_ids.get("tv_ids", []),
    )
    movie_results = list(
        movie_model.objects(tmdb_id__in=ids.movie_ids).order_by("selected_at", "-popularity")
    )
    tv_results = list(
        tv_model.objects(tmdb_id__in=ids.tv_ids).order_by("selected_at", "-popularity")
    )
    return movie_results + tv_results


def get_document_for_id(
    next_id: dict, movie_model: Document, tv_model: Document
) -> list[Document]:
    id_param = IdParameter(
        id=next_id.get("id"),
        tmdb_id=next_id.get("tmdb_id"),
        type=next_id.get("type"),
    )
    model = movie_model if id_param.type == "movie" else tv_model
    return model.objects.get(id=id_param.id)


# helper methods to fetch next entries in queue


def not_deleted_filter(model: Document) -> Q:
    # Details models and the source models keyed by a TMDB title carry "tmdb_deleted"; a missing value counts as not deleted.
    if "tmdb_deleted" in model._fields:
        return Q(tmdb_deleted__ne=True)
    return Q()


# By default a fetched title is due for a refresh once this long has passed since
# its last selection. A source with a different refresh interval passes its own
# stale_after_days (DNA: f/dna/models.DNA_STALE_AFTER_DAYS).
STALE_AFTER_DAYS = 30


def never_selected_titles(model: Document) -> QuerySet:
    # Walks the (selected_at, -popularity) index, so it reads only the titles it returns.
    # One $or with the stuck titles below cannot walk an index in popularity order:
    # MongoDB fetched and sorted every never-selected title on each run.
    return model.objects(Q(selected_at=None) & not_deleted_filter(model)).order_by(
        "-popularity"
    )


def stuck_titles(model: Document, selected_before: datetime) -> QuerySet:
    # Selected by a run that never released them, e.g. one that timed out.
    # Few titles match, found through the is_selected index.
    return model.objects(
        Q(is_selected=True)
        & Q(selected_at__lt=selected_before)
        & not_deleted_filter(model)
    ).order_by("-popularity")


def stale_titles(model: Document, stale_before: datetime) -> QuerySet:
    # Walks the (-popularity, selected_at) index and checks selected_at on the index
    # key, so only the returned titles are fetched. The popularity condition is what
    # makes MongoDB bound selected_at on the index; without it the scan fetches every
    # recently selected title that is more popular than the stale ones.
    return model.objects(
        Q(popularity__gte=0)
        & Q(selected_at__lt=stale_before)
        & not_deleted_filter(model)
    ).order_by("-popularity")


# The queue only needs these. Loading whole fetched TMDB documents (about 34 KB,
# deeply embedded) took mongoengine several seconds per batch.
QUEUE_FIELDS = ("id", "tmdb_id", "popularity")


def no_fetch_entries_for(
    model: Document, count: int, buffer_time_for_selected_entries: datetime
) -> list[Document]:
    never_selected = list(never_selected_titles(model).only(*QUEUE_FIELDS).limit(count))
    stuck = list(
        stuck_titles(model, buffer_time_for_selected_entries)
        .only(*QUEUE_FIELDS)
        .limit(count)
    )
    return by_popularity(never_selected + stuck)[:count]


def stale_entries_for(
    model: Document, count: int, stale_before: datetime
) -> list[Document]:
    return list(stale_titles(model, stale_before).only(*QUEUE_FIELDS).limit(count))


def by_popularity(entries: list[Document]) -> list[Document]:
    return sorted(entries, key=lambda x: x.popularity or 0, reverse=True)


def mix_batch(
    no_fetch_entries: list[Document], stale_entries: list[Document], count: int
) -> list[Document]:
    """Half the batch for never-fetched titles, half for stale ones.

    A group that cannot fill its half leaves the free slots to the other group.
    """
    queued = {(type(entry), entry.id) for entry in no_fetch_entries}
    stale_entries = [
        entry for entry in stale_entries if (type(entry), entry.id) not in queued
    ]
    no_fetch_share = min(
        len(no_fetch_entries), max((count + 1) // 2, count - len(stale_entries))
    )
    return no_fetch_entries[:no_fetch_share] + stale_entries[: count - no_fetch_share]


def completeness_queue(
    movie_model: Document,
    tv_model: Document,
    count: int,
    buffer_minutes: int,
    stale_after_days: int = None,
) -> list[Document]:
    if stale_after_days is None:
        stale_after_days = STALE_AFTER_DAYS
    now = datetime.utcnow()
    buffer_time_for_selected_entries = now - timedelta(minutes=buffer_minutes)
    stale_before = now - timedelta(days=stale_after_days)

    # The most popular titles never fetched, or reserved by a run that never finished
    no_fetch_entries = by_popularity(
        no_fetch_entries_for(movie_model, count, buffer_time_for_selected_entries)
        + no_fetch_entries_for(tv_model, count, buffer_time_for_selected_entries)
    )[:count]
    # The most popular titles not fetched for stale_after_days
    stale_entries = by_popularity(
        stale_entries_for(movie_model, count, stale_before)
        + stale_entries_for(tv_model, count, stale_before)
    )[:count]

    next_entries = mix_batch(no_fetch_entries, stale_entries, count)
    update_selected_for_next_entries(movie_model, tv_model, next_entries)
    return next_entries


def priority_queue(
    movie_model: Document, tv_model: Document, count: int, buffer_minutes: int
) -> list[Document]:
    # Get the top n entries with the oldest "selected_at" and a higher popularity
    popular_movies_old_fetch = list(
        movie_model.objects(Q(popularity__gte=10) & not_deleted_filter(movie_model))
        .order_by("selected_at").limit(count)
    )
    popular_tvs_old_fetch = list(
        tv_model.objects(Q(popularity__gte=10) & not_deleted_filter(tv_model))
        .order_by("selected_at").limit(count)
    )

    # Compare and return
    next_entries = sorted(
        popular_movies_old_fetch + popular_tvs_old_fetch,
        key=lambda x: x.popularity,
        reverse=True,
    )[:count]
    update_selected_for_next_entries(movie_model, tv_model, next_entries)
    return next_entries


def update_selected_for_next_entries(
    movie_model: Document, tv_model: Document, next_entries: list[Document]
):
    # Update "selected_at" and "is_selected" fields to reserve these for this worker
    movie_ids_to_update = [
        entry.id for entry in next_entries if isinstance(entry, movie_model)
    ]
    tv_ids_to_update = [
        entry.id for entry in next_entries if isinstance(entry, tv_model)
    ]

    if movie_ids_to_update:
        movie_model.objects(id__in=movie_ids_to_update).update(
            selected_at=datetime.utcnow(),
            is_selected=True,
        )
    if tv_ids_to_update:
        tv_model.objects(id__in=tv_ids_to_update).update(
            selected_at=datetime.utcnow(),
            is_selected=True,
        )


def prepare_next_entries(
    movie_model: Document,
    tv_model: Document,
    count: int,
    buffer_minutes: int,
    stale_after_days: int = None,
) -> list[Document]:
    return completeness_queue(
        movie_model, tv_model, count, buffer_minutes, stale_after_days
    )


def main():
    pass
