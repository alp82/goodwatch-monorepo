from datetime import datetime, timedelta
from typing import Union
from mongoengine import get_db
from pymongo.collection import Collection

from f.data_source.common import get_documents_for_ids
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_daily.models import DumpType
from f.dna.init.main import build_operation, store_copies

# Keep in sync with BUFFER_SELECTED_AT_MINUTES in f/dna/generate/next.
BUFFER_SELECTED_AT_MINUTES = 60
# Every priority crawl of a title would otherwise retry a failed generation.
FAILED_COOLDOWN_DAYS = 7


def claim_without_fingerprint(collection: Collection, tmdb_id: int):
    """Atomically reserve a DNA document that still needs a fingerprint.

    Mirrors the f/dna/generate/next selector: a claim inside the buffer belongs
    to another run, an older one is stale and may be taken over. A recent
    failed generation is left alone until the cooldown passes.
    """
    now = datetime.utcnow()
    stale_before = now - timedelta(minutes=BUFFER_SELECTED_AT_MINUTES)
    failed_before = now - timedelta(days=FAILED_COOLDOWN_DAYS)
    doc = collection.find_one_and_update(
        {
            "tmdb_id": tmdb_id,
            # No first element: matches an absent field, None and an empty list.
            "vector_fingerprint.0": {"$exists": False},
            "$and": [
                {"$or": [
                    {"is_selected": {"$ne": True}},
                    {"selected_at": None},
                    {"selected_at": {"$lt": stale_before}},
                ]},
                {"$or": [
                    {"failed_at": None},
                    {"failed_at": {"$lt": failed_before}},
                ]},
            ],
        },
        {"$set": {"is_selected": True, "selected_at": now}},
        projection={"_id": 1},
    )
    return str(doc["_id"]) if doc else None


def initialize_documents(next_entries: list[Union[TmdbMovieDetails, TmdbTvDetails]]):
    print("Initializing documents for DNA")
    mongo_db = get_db()

    count_new_movies = 0
    count_new_tv = 0
    movie_ids = []
    tv_ids = []

    for next_entry in next_entries:
        print(f"copying {next_entry.original_title} ({next_entry.tmdb_id}) DNA")
        if isinstance(next_entry, TmdbMovieDetails):
            operation = build_operation(
                details_entry=next_entry.to_mongo().to_dict(),
                type=DumpType.MOVIES,
            )
            movie_upserts = store_copies(
                operations=[operation],
                collection=mongo_db.dna_movie,
                label_plural="movies",
            )
            count_new_movies += movie_upserts.get("count_new_documents")
            claimed_id = claim_without_fingerprint(mongo_db.dna_movie, next_entry.tmdb_id)
            if claimed_id:
                movie_ids.append(claimed_id)

        elif isinstance(next_entry, TmdbTvDetails):
            operation = build_operation(
                details_entry=next_entry.to_mongo().to_dict(),
                type=DumpType.TV_SERIES,
            )
            tv_upserts = store_copies(
                operations=[operation],
                collection=mongo_db.dna_tv,
                label_plural="tv series",
            )
            count_new_tv += tv_upserts.get("count_new_documents")
            claimed_id = claim_without_fingerprint(mongo_db.dna_tv, next_entry.tmdb_id)
            if claimed_id:
                tv_ids.append(claimed_id)

        else:
            raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")

    return {
        "count_new_movies": count_new_movies,
        "count_new_tv": count_new_tv,
        "movie_ids": movie_ids,
        "tv_ids": tv_ids,
    }


def main(next_ids: dict):
    print("Prepare generating DNA via AI")
    init_mongodb()
    next_entries = get_documents_for_ids(
        next_ids=next_ids,
        movie_model=TmdbMovieDetails,
        tv_model=TmdbTvDetails,
    )
    # Titles deleted on TMDB must not seed new work.
    next_entries = [entry for entry in next_entries if not entry.tmdb_deleted]
    docs = initialize_documents(next_entries)
    close_mongodb()

    print(docs)
    return {
        "movie_ids": docs["movie_ids"],
        "tv_ids": docs["tv_ids"],
    }
