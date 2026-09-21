"""Copy the TMDB details "tmdb_deleted" flag onto the source documents of a title."""
from mongoengine import get_db

# Every source collection stores tmdb_id as an int (IntField).
SOURCE_COLLECTIONS = {
    "movie": [
        "imdb_movie_rating",
        "metacritic_movie_rating",
        "rotten_tomatoes_movie_rating",
        "tv_tropes_movie_tags",
        "tmdb_movie_providers",
        "dna_movie",
    ],
    "tv": [
        "imdb_tv_rating",
        "metacritic_tv_rating",
        "rotten_tomatoes_tv_rating",
        "tv_tropes_tv_tags",
        "tmdb_tv_providers",
        "dna_tv",
    ],
}


def propagate_tmdb_deleted(media_type: str, tmdb_ids: list, deleted: bool) -> dict:
    # Never raises: a missed propagation is fixed by the next flag/unflag or a repair run,
    # and the guards in the init and generate flows still skip flagged titles.
    ids = [int(tmdb_id) for tmdb_id in tmdb_ids]
    if not ids:
        return {}
    counts = {}
    for name in SOURCE_COLLECTIONS[media_type]:
        try:
            result = get_db()[name].update_many(
                {"tmdb_id": {"$in": ids}}, {"$set": {"tmdb_deleted": deleted}}
            )
            counts[name] = result.modified_count
        except Exception as e:
            print(f"failed to propagate tmdb_deleted={deleted} to {name} for {ids}: {e}")
    return counts


def main():
    pass
