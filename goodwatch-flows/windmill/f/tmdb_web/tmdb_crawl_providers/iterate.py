from bson import ObjectId
from mongoengine import get_db

from f.db.mongodb import init_mongodb, close_mongodb


def main(next_ids: dict) -> list[dict]:
    # Reject the former initializer count-only handoff rather than silently doing
    # no work. Selection happens atomically in fetch for both entry paths.
    if not isinstance(next_ids, dict) or not all(key in next_ids for key in ("movie_ids", "tv_ids")):
        raise ValueError("Expected movie_ids and tv_ids containing provider document IDs")
    validated = {}
    for media_type in ("movie", "tv"):
        ids = next_ids[f"{media_type}_ids"]
        if not isinstance(ids, list) or any(not isinstance(value, str) or not ObjectId.is_valid(value) for value in ids):
            raise ValueError("Provider IDs must be lists of ObjectId strings")
        validated[media_type] = list(dict.fromkeys(ids))
    init_mongodb()
    try:
        db = get_db()
        entries = []
        for media_type, ids in validated.items():
            for identity in ids:
                document = db[f"tmdb_{media_type}_providers"].find_one({"_id": ObjectId(identity)}, {"tmdb_id": 1})
                if document is None:
                    raise ValueError(f"Missing {media_type} provider document {identity}")
                entries.append({"id": identity, "type": media_type, "tmdb_id": document["tmdb_id"]})
        return entries
    finally:
        close_mongodb()
