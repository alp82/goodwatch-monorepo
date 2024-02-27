from datetime import datetime, timedelta
from typing import Union, Literal

from mongoengine import Document, Q
from pydantic import BaseModel


class IdParameter(BaseModel):
    id: str
    tmdb_id: int
    type: Union[Literal["movie"], Literal["tv"]]


class IdsParameter(BaseModel):
    movie_ids: list[int]
    tv_ids: list[int]


def retrieve_next_entry_ids(
    count: int,
    buffer_minutes: int,
    movie_model: Document,
    tv_model: Document,
) -> IdsParameter:
    next_entries = prepare_next_entries(
        movie_model=movie_model,
        tv_model=tv_model,
        count=count,
        buffer_minutes=buffer_minutes,
    )
    ids = get_ids_for_documents(
        next_entries=next_entries,
        movie_model=movie_model,
        tv_model=tv_model,
    )
    return ids


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
    movie_ids = list({movie.id for movie in movie_entries})
    tv_ids = list({tv.id for tv in tv_entries})
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
        movie_model.objects(id__in=ids.movie_ids).order_by(
            "selected_at", "-popularity"
        )
    )
    tv_results = list(
        tv_model.objects(id__in=ids.tv_ids).order_by("selected_at", "-popularity")
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


def completeness_queue(
    movie_model: Document, tv_model: Document, count: int, buffer_minutes: int
) -> list[Document]:
    # Get the top n entries without "selected_at" sorted by popularity
    buffer_time_for_selected_entries = datetime.utcnow() - timedelta(
        minutes=buffer_minutes
    )
    movies_no_fetch = list(
        movie_model.objects(
            Q(selected_at=None)
            | (
                Q(is_selected=True)
                & Q(selected_at__lt=buffer_time_for_selected_entries)
            )
        )
        .order_by("-popularity")
        .limit(count)
    )
    tvs_no_fetch = list(
        tv_model.objects(
            Q(selected_at=None)
            | (
                Q(is_selected=True)
                & Q(selected_at__lt=buffer_time_for_selected_entries)
            )
        )
        .order_by("-popularity")
        .limit(count)
    )

    # Get the top n entries with the oldest "selected_at"
    movies_old_fetch = list(
        movie_model.objects(selected_at__ne=None).order_by("selected_at").limit(count)
    )
    tvs_old_fetch = list(
        tv_model.objects(selected_at__ne=None).order_by("selected_at").limit(count)
    )

    # Compare and return
    no_fetch_entries = sorted(
        movies_no_fetch + tvs_no_fetch, key=lambda x: x.popularity, reverse=True
    )[:count]
    old_fetch_entries = sorted(
        movies_old_fetch + tvs_old_fetch, key=lambda x: x.selected_at
    )[:count]

    next_entries = (no_fetch_entries + old_fetch_entries)[:count]
    update_selected_for_next_entries(movie_model, tv_model, next_entries)
    return next_entries


def priority_queue(
    movie_model: Document, tv_model: Document, count: int, buffer_minutes: int
) -> list[Document]:
    # Get the top n entries with the oldest "selected_at" and a higher popularity
    popular_movies_old_fetch = list(
        movie_model.objects(popularity__gte=10).order_by("selected_at").limit(count)
    )
    popular_tvs_old_fetch = list(
        tv_model.objects(popularity__gte=10).order_by("selected_at").limit(count)
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
    movie_model: Document, tv_model: Document, count: int, buffer_minutes: int
) -> list[Document]:
    return completeness_queue(movie_model, tv_model, count, buffer_minutes)


def main():
    pass
