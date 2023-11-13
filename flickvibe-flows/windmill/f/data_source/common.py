from datetime import datetime, timedelta

from mongoengine import Document, Q


def prepare_next_entries(movie_model: Document, tv_model: Document, count: int, buffer_minutes: int) -> Document:
    # Get the top n entries without "selected_at" sorted by popularity
    buffer_time_for_selected_entries = datetime.utcnow() - timedelta(minutes=buffer_minutes)
    movies_no_fetch = list(movie_model.objects(
        Q(selected_at=None) |
        Q(__raw__={
            "$and": [
                {"$expr": {"$gt": ["$selected_at", "$updated_at"]}},
                {"selected_at": {"$lt": buffer_time_for_selected_entries}}
            ]
        })
    ).order_by("-popularity").limit(count))
    tvs_no_fetch = list(tv_model.objects(
        Q(selected_at=None) |
        Q(__raw__={
            "$and": [
                {"$expr": {"$gt": ["$selected_at", "$updated_at"]}},
                {"selected_at": {"$lt": buffer_time_for_selected_entries}}
            ]
        })
    ).order_by("-popularity").limit(count))

    # Get the top n entries with the oldest "selected_at"
    movies_old_fetch = list(movie_model.objects(selected_at__ne=None).order_by("selected_at").limit(count))
    tvs_old_fetch = list(tv_model.objects(selected_at__ne=None).order_by("selected_at").limit(count))

    # Compare and return
    no_fetch_entries = sorted(movies_no_fetch + tvs_no_fetch, key=lambda x: x.popularity, reverse=True)[:count]
    old_fetch_entries = sorted(movies_old_fetch + tvs_old_fetch, key=lambda x: x.selected_at)[:count]

    next_entries = (no_fetch_entries + old_fetch_entries)[:count]

    # Update "selected_at" field to reserve these for this worker
    movie_ids_to_update = [entry.id for entry in next_entries if isinstance(entry, movie_model)]
    tv_ids_to_update = [entry.id for entry in next_entries if isinstance(entry, tv_model)]

    if movie_ids_to_update:
        movie_model.objects(id__in=movie_ids_to_update).update(selected_at=datetime.utcnow())
    if tv_ids_to_update:
        tv_model.objects(id__in=tv_ids_to_update).update(selected_at=datetime.utcnow())

    return next_entries
