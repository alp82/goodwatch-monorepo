from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from mongoengine import get_db
from pydantic import BaseModel

from f.db.cratedb import CrateConnector
from f.db.mongodb import (
    init_mongodb,
    close_mongodb,
    build_query_selector_for_object_ids,
)
from f.sync.copy.deleted_titles import flagged_among
from f.sync.copy.tmdb_details import imdb_title
from f.sync.models.crate_models import (
    Movie,
    Show,
)
from f.sync.models.crate_schemas import SCHEMAS

BATCH_SIZE = 5000
SUB_BATCH_SIZE = 50000
HOURS_TO_FETCH = 24 * 2

tmdb_details_projection = {
    "tmdb_id": 1,
    "imdb_id": 1,
    "external_ids": 1,
    "vote_count": 1,
    "vote_average": 1,
}


# ===== Helper Functions =====


def to_timestamp(dt_input: str) -> Optional[float]:
    """Convert datetime to Unix timestamp."""
    if isinstance(dt_input, datetime):
        return dt_input.timestamp()
    if isinstance(dt_input, str):
        try:
            dt = datetime.strptime(dt_input, "%Y-%m-%dT%H:%M:%S.%fZ")
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, "%Y-%m-%d %H:%M:%S.%f")
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, "%Y-%m-%d %H:%M:%S UTC")
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, "%Y-%m-%d")
            return dt.timestamp()
        except Exception:
            pass

        raise Exception(f"cannot convert datetime to timestamp: {dt_input}")


def changed_tmdb_ids(collections, selector: dict) -> list[int]:
    """The sorted tmdb ids of the documents matching the selector in any collection."""
    tmdb_ids = set()
    for collection in collections:
        for doc in collection.find(selector, {"_id": 0, "tmdb_id": 1}).batch_size(20000):
            if doc.get("tmdb_id") is not None:
                tmdb_ids.add(doc["tmdb_id"])
    return sorted(tmdb_ids)


def fetch_map_by_ids(collection, tmdb_ids) -> dict:
    return {doc["tmdb_id"]: doc for doc in collection.find({"tmdb_id": {"$in": tmdb_ids}})}


def upsert_in_batches(connector: CrateConnector, table: str, records: list[BaseModel]):
    """Process and insert entities and return upsert results."""
    total_result = {"records_received": 0, "rows_upserted": 0}

    if records:
        print(f"    Upserting {len(records)} of type {table}")
        for i in range(0, len(records), SUB_BATCH_SIZE):
            batch = records[i : i + SUB_BATCH_SIZE]
            if batch:
                result = connector.upsert_many(
                    table=table,
                    records=batch,
                    conflict_columns=SCHEMAS[table]["primary_key"],
                    silent=True,
                )
                total_result["records_received"] += result["records_received"]
                total_result["rows_upserted"] += result["rows_upserted"]

    return total_result


def copy_media(
    connector: CrateConnector, query_selector: dict = {}, media_type: str = "movie",
    *, recent_only: bool = True
):
    is_movie = media_type == "movie"

    mongo_db = get_db()
    mongo_details = (
        mongo_db.tmdb_movie_details if is_movie else mongo_db.tmdb_tv_details
    )
    mongo_imdb = mongo_db.imdb_movie_rating if is_movie else mongo_db.imdb_tv_rating
    mongo_meta = (
        mongo_db.metacritic_movie_rating if is_movie else mongo_db.metacritic_tv_rating
    )
    mongo_rotten = (
        mongo_db.rotten_tomatoes_movie_rating
        if is_movie
        else mongo_db.rotten_tomatoes_tv_rating
    )
    media_table_name = "movie" if is_movie else "show"
    MediaClass = Movie if is_movie else Show

    updated_at_filter = {
        "updated_at": {"$gte": datetime.utcnow() - timedelta(hours=HOURS_TO_FETCH)}
    }
    if not recent_only:
        updated_at_filter = {}
    # Collect the changed titles of every source once, then read them in batches by id.
    # Paging each collection with skip rescanned it for every page and timed out on
    # large windows, such as the IMDb dataset ingest's first run.
    all_tmdb_ids = changed_tmdb_ids(
        [mongo_details, mongo_imdb, mongo_meta, mongo_rotten], query_selector | updated_at_filter
    )
    print(f"Total {media_type} titles to copy: {len(all_tmdb_ids)}", flush=True)

    entity_counts = defaultdict(lambda: {"records_received": 0, "rows_upserted": 0})

    for start in range(0, len(all_tmdb_ids), BATCH_SIZE):
        media_documents = []
        entity_batches = defaultdict(list)
        tmdb_ids = all_tmdb_ids[start:start + BATCH_SIZE]

        # Insert batch of media
        print(
            f"\nBatch from {start} to {start + len(tmdb_ids)} {media_type} score entries", flush=True
        )

        tmdb_details_for_tmdb_ids = list(
            mongo_details.find(
                {"tmdb_id": {"$in": tmdb_ids}},
                tmdb_details_projection,
            )
        )
        tmdb_details_map = {doc["tmdb_id"]: doc for doc in tmdb_details_for_tmdb_ids}
        # Do not re-insert rating rows for titles deleted on TMDB.
        flagged_ids = flagged_among(mongo_details, tmdb_ids)
        # The batches only say which titles changed. The aggregates need every source of
        # each title, including the ones that did not change in this window.
        imdb_map = fetch_map_by_ids(mongo_imdb, tmdb_ids)
        meta_map = fetch_map_by_ids(mongo_meta, tmdb_ids)
        rotten_map = fetch_map_by_ids(mongo_rotten, tmdb_ids)

        for tmdb_id in tmdb_ids:
            if tmdb_id in flagged_ids:
                continue
            tmdb_details = tmdb_details_map.get(tmdb_id, {})
            imdb_rating = imdb_map.get(tmdb_id, {})
            meta_rating = meta_map.get(tmdb_id, {})
            rotten_rating = rotten_map.get(tmdb_id, {})

            if (
                not tmdb_details
                and not imdb_rating
                and not meta_rating
                and not rotten_rating
            ):
                continue
            
            tmdb_url = f"https://www.themoviedb.org/{media_type}/{tmdb_id}"
            _, imdb_url = imdb_title(tmdb_details, is_movie)

            # Calculate normalized scores
            tmdb_vote_count = tmdb_details.get("vote_count")
            tmdb_user_score_rating_count = tmdb_vote_count if tmdb_vote_count else None
            tmdb_user_score = tmdb_details.get("vote_average")
            tmdb_user_score_original = tmdb_user_score if tmdb_user_score else None
            tmdb_user_score_normalized_percent = (
                tmdb_user_score * 10 if tmdb_user_score else None
            )

            # Calculate goodwatch scores
            def calculate_average(scores):
                valid_scores = [score for score in scores if score is not None]
                return sum(valid_scores) / len(valid_scores) if valid_scores else None

            def calculate_sum(counts):
                valid_counts = [count for count in counts if count is not None]
                return sum(valid_counts)

            # User score percents and counts
            user_score_percents = [
                tmdb_user_score_normalized_percent,
                imdb_rating.get("user_score_normalized_percent"),
                meta_rating.get("user_score_normalized_percent"),
                rotten_rating.get("audience_score_normalized_percent"),
            ]
            goodwatch_user_score_normalized_percent = calculate_average(
                user_score_percents
            )

            user_score_counts = [
                tmdb_details.get("vote_count"),
                imdb_rating.get("user_score_vote_count"),
                meta_rating.get("user_score_vote_count"),
                rotten_rating.get("audience_score_vote_count"),
            ]
            goodwatch_user_score_rating_count = calculate_sum(user_score_counts)

            # Official score percents and counts
            official_score_percents = [
                meta_rating.get("meta_score_normalized_percent"),
                rotten_rating.get("tomato_score_normalized_percent"),
            ]
            goodwatch_official_score_normalized_percent = calculate_average(
                official_score_percents
            )

            official_score_counts = [
                meta_rating.get("meta_score_vote_count"),
                rotten_rating.get("tomato_score_vote_count"),
            ]
            goodwatch_official_score_review_count = calculate_sum(official_score_counts)

            # Overall scores
            goodwatch_overall_score_normalized_percent = calculate_average(
                [
                    goodwatch_user_score_normalized_percent,
                    goodwatch_official_score_normalized_percent,
                ]
            )

            goodwatch_overall_score_voting_count = calculate_sum(
                [
                    goodwatch_user_score_rating_count,
                    goodwatch_official_score_review_count,
                ]
            )

            # Create Media document
            media = MediaClass(
                tmdb_id=tmdb_id,
                # Scores
                tmdb_url=tmdb_url,
                tmdb_user_score_original=tmdb_user_score_original,
                tmdb_user_score_normalized_percent=tmdb_user_score_normalized_percent,
                tmdb_user_score_rating_count=tmdb_user_score_rating_count,
                imdb_url=imdb_url,
                imdb_user_score_original=imdb_rating.get("user_score_original"),
                imdb_user_score_normalized_percent=imdb_rating.get(
                    "user_score_normalized_percent"
                ),
                imdb_user_score_rating_count=imdb_rating.get("user_score_vote_count"),
                metacritic_url=meta_rating.get("metacritic_url"),
                metacritic_user_score_original=meta_rating.get("user_score_original"),
                metacritic_user_score_normalized_percent=meta_rating.get(
                    "user_score_normalized_percent"
                ),
                metacritic_user_score_rating_count=meta_rating.get(
                    "user_score_vote_count"
                ),
                metacritic_meta_score_original=meta_rating.get("meta_score_original"),
                metacritic_meta_score_normalized_percent=meta_rating.get(
                    "meta_score_normalized_percent"
                ),
                metacritic_meta_score_review_count=meta_rating.get(
                    "meta_score_vote_count"
                ),
                rotten_tomatoes_url=rotten_rating.get("rotten_tomatoes_url"),
                rotten_tomatoes_audience_score_original=rotten_rating.get(
                    "audience_score_original"
                ),
                rotten_tomatoes_audience_score_normalized_percent=rotten_rating.get(
                    "audience_score_normalized_percent"
                ),
                rotten_tomatoes_audience_score_rating_count=rotten_rating.get(
                    "audience_score_vote_count"
                ),
                rotten_tomatoes_tomato_score_original=rotten_rating.get(
                    "tomato_score_original"
                ),
                rotten_tomatoes_tomato_score_normalized_percent=rotten_rating.get(
                    "tomato_score_normalized_percent"
                ),
                rotten_tomatoes_tomato_score_review_count=rotten_rating.get(
                    "tomato_score_vote_count"
                ),
                goodwatch_user_score_normalized_percent=goodwatch_user_score_normalized_percent,
                goodwatch_user_score_rating_count=goodwatch_user_score_rating_count,
                goodwatch_official_score_normalized_percent=goodwatch_official_score_normalized_percent,
                goodwatch_official_score_review_count=goodwatch_official_score_review_count,
                goodwatch_overall_score_normalized_percent=goodwatch_overall_score_normalized_percent,
                goodwatch_overall_score_voting_count=goodwatch_overall_score_voting_count,
                # Source records can exist before their first completed crawl.
                imdb_ratings_created_at=to_timestamp(imdb_rating.get("created_at")),
                imdb_ratings_updated_at=to_timestamp(imdb_rating.get("updated_at")),
                metacritic_ratings_created_at=to_timestamp(meta_rating.get("created_at")),
                metacritic_ratings_updated_at=to_timestamp(meta_rating.get("updated_at")),
                rotten_tomatoes_ratings_created_at=to_timestamp(
                    rotten_rating.get("created_at")
                ),
                rotten_tomatoes_ratings_updated_at=to_timestamp(
                    rotten_rating.get("updated_at")
                ),
            )

            media_documents.append(media)

        upsert_result = upsert_in_batches(
            connector=connector,
            table=media_table_name,
            records=media_documents,
        )

        media_type_key = "movies" if is_movie else "shows"
        entity_counts[media_type_key]["records_received"] += upsert_result[
            "records_received"
        ]
        entity_counts[media_type_key]["rows_upserted"] += upsert_result["rows_upserted"]

        # Insert all row for batch and track counts
        for table_name, batch in entity_batches.items():
            entity_upsert_result = upsert_in_batches(
                connector=connector,
                table=table_name,
                records=batch,
            )
            entity_counts[table_name]["records_received"] += entity_upsert_result[
                "records_received"
            ]
            entity_counts[table_name]["rows_upserted"] += entity_upsert_result[
                "rows_upserted"
            ]


    return entity_counts


def main(movie_ids: list[str] = [], show_ids: list[str] = [], skip_movies=False, full: bool = False):
    """full: copy every title instead of the ones changed in the last 48 h."""
    init_mongodb()
    connector = CrateConnector()

    results = {}

    if skip_movies:
        results["movies"] = None
    else:
        # Process movies
        if movie_ids is None or len(movie_ids) == 0:
            print("Processing all movies...")
            movie_query_selector = {}
        else:
            movie_query_selector = build_query_selector_for_object_ids(ids=movie_ids)

        results["movies"] = copy_media(
            connector=connector, query_selector=movie_query_selector, media_type="movie",
            recent_only=not full,
        )

    # Process shows
    if show_ids is None or len(show_ids) == 0:
        print("\nProcessing all shows...")
        show_query_selector = {}
    else:
        show_query_selector = build_query_selector_for_object_ids(ids=show_ids)

    results["shows"] = copy_media(
        connector=connector, query_selector=show_query_selector, media_type="show",
        recent_only=not full,
    )

    connector.disconnect()
    close_mongodb()

    return results


if __name__ == "__main__":
    main()
