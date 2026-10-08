#requirements:
#mongoengine==0.29.1
#pydantic==2.12.5
#wmill==1.589.1
from datetime import datetime

from pydantic import ValidationError

from f.db.mongodb import init_mongodb, close_mongodb
from f.dna.models import DnaMovie, DnaTv, create_fingerprint


# One retry: scores that change under this step were saved together with their
# own fingerprint (f/dna/generate/fetch), so the second read normally finds
# nothing left to write.
STORE_ATTEMPTS = 2


def store_fingerprint_of_stored_scores(collection, result_id: str) -> None:
    """Make the title's stored fingerprint the one its stored scores give.

    The fingerprint comes from the scores in the document, not from this flow
    run's results: another run may have saved newer DNA for the title since.
    The write applies only while the document still holds the scores that were
    read, so a save in between cannot end up with this fingerprint.
    """
    for _ in range(STORE_ATTEMPTS):
        stored = (collection.objects(id=result_id)
                  .only("dna.fingerprint.scores", "vector_fingerprint", "is_selected")
                  .as_pymongo().first())
        if stored is None:
            raise ValueError(f"DNA title {result_id} no longer exists")
        scores = ((stored.get("dna") or {}).get("fingerprint") or {}).get("scores")
        try:
            fingerprint = create_fingerprint(scores)
        except (TypeError, ValidationError) as error:
            raise ValueError(f"DNA title {result_id} has no valid stored scores") from error

        changes = {}
        if stored.get("vector_fingerprint") != fingerprint:
            # updated_at tells the copies (f/sync/copy/vector_data, dna_data) to publish it.
            changes |= {"set__vector_fingerprint": fingerprint, "set__updated_at": datetime.utcnow()}
        if stored.get("is_selected"):
            changes["set__is_selected"] = False
        if not changes:
            return
        # The scores go back exactly as read: MongoDB compares embedded documents
        # field by field in stored order.
        if collection.objects(id=result_id, __raw__={"dna.fingerprint.scores": scores}).update_one(**changes):
            return
    raise ValueError(f"DNA title {result_id} kept changing; its fingerprint was not stored")


def main(ids: dict[str, list], results: list[dict]):
    """Persist fingerprints locally; no embedding model or inference call."""
    if not isinstance(results, list):
        raise ValueError("results must be a list")
    if not results:
        return {"fingerprints_count": 0}

    # Validate the full batch before writing any title.
    prepared = []
    for index, result in enumerate(results):
        if not isinstance(result, dict) or not isinstance(result.get("dna"), dict):
            raise ValueError(f"results[{index}].dna must be an object")
        result_id = result["id"]
        if result_id in ids["movie_ids"]:
            collection = DnaMovie
        elif result_id in ids["tv_ids"]:
            collection = DnaTv
        else:
            raise ValueError(f"results[{index}].id was not selected")
        # Raises on scores that give no fingerprint, as before.
        create_fingerprint(result["dna"]["fingerprint"]["scores"])
        prepared.append((collection, result_id))

    init_mongodb()
    try:
        for collection, result_id in prepared:
            store_fingerprint_of_stored_scores(collection, result_id)
    finally:
        close_mongodb()
    return {"fingerprints_count": len(prepared)}
