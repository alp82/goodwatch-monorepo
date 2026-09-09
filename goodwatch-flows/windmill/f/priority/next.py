from mongoengine import get_db

from f.db.mongodb import init_mongodb, close_mongodb
from f.db.cratedb import CrateConnector
from f.priority.queue import CANDIDATE_PAGE_SIZE, candidate_ids, claim, release


def mongo_id(mongo_db, media_type, tmdb_id):
    collection = "tmdb_movie_details" if media_type == "movie" else "tmdb_tv_details"
    document = mongo_db[collection].find_one({"tmdb_id": int(tmdb_id)}, {"_id": 1})
    return str(document["_id"]) if document else None


def ranked_ids(db, media_type):
    offset = 0
    while True:
        page = candidate_ids(db, media_type, offset=offset)
        yield from page
        if len(page) < CANDIDATE_PAGE_SIZE:
            return
        offset += len(page)


def select_batch(db, mongo_db, movie_tmdb_id=None, tv_tmdb_id=None):
    result = {
        "ids": {"movie_ids": [], "tv_ids": []},
        "tmdb_ids": {"movie_ids": [], "tv_ids": []},
        "claims": [],
    }
    explicit = bool(movie_tmdb_id or tv_tmdb_id)
    requested = [("movie", "movie_ids", movie_tmdb_id), ("show", "tv_ids", tv_tmdb_id)]
    # Validate every explicit mapping before reserving any work.
    mappings = {}
    for media_type, _, requested_id in requested:
        if requested_id:
            mapped = mongo_id(mongo_db, media_type, requested_id)
            if mapped is None:
                raise ValueError(
                    f"No MongoDB details record for {media_type} {requested_id}"
                )
            mappings[media_type] = mapped
    try:
        for media_type, output_key, requested_id in requested:
            candidates = (
                ([int(requested_id)] if requested_id else [])
                if explicit
                else ranked_ids(db, media_type)
            )
            for tmdb_id in candidates:
                mapped = mappings.get(media_type) or mongo_id(
                    mongo_db, media_type, tmdb_id
                )
                if mapped is None:
                    continue
                lease = claim(db, media_type, tmdb_id, explicit=explicit)
                if lease is None:
                    if explicit:
                        raise RuntimeError(
                            f"Could not claim {media_type} {tmdb_id}; another crawl may own it"
                        )
                    continue
                result["ids"][output_key].append(mapped)
                result["tmdb_ids"][output_key].append(str(tmdb_id))
                result["claims"].append(lease)
                break  # Preserve one movie and one show per scheduled run.
    except Exception:
        for lease in result["claims"]:
            release(db, lease)
        raise
    return result


def main(movie_tmdb_id: str = None, tv_tmdb_id: str = None):
    init_mongodb()
    db = None
    try:
        db = CrateConnector()
        return select_batch(db, get_db(), movie_tmdb_id, tv_tmdb_id)
    finally:
        if db:
            db.disconnect()
        close_mongodb()
