#requirements:
#mongoengine==0.29.1
#pydantic==2.12.5
#wmill==1.589.1
from datetime import datetime

from f.db.mongodb import init_mongodb, close_mongodb
from f.dna.models import CoreScores, DnaMovie, DnaTv


def create_fingerprint(scores: dict) -> list[float]:
    validated = CoreScores(**scores)
    return [float(getattr(validated, name)) for name in CoreScores.model_fields]


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
        prepared.append((collection, result_id,
                         create_fingerprint(result["dna"]["fingerprint"]["scores"])))

    init_mongodb()
    try:
        for collection, result_id, fingerprint in prepared:
            # An atomic update also works while older documents await cleanup.
            updated = collection.objects(id=result_id).update_one(
                set__vector_fingerprint=fingerprint,
                set__updated_at=datetime.utcnow(),
                set__is_selected=False,
            )
            if updated != 1:
                raise ValueError(f"DNA title {result_id} no longer exists")
    finally:
        close_mongodb()
    return {"fingerprints_count": len(prepared)}
