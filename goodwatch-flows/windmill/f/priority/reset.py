from f.db.cratedb import CrateConnector
from f.priority.queue import acknowledge


def main(claims: list[dict], publication_result: dict | None = None) -> dict:
    if not claims:
        return {"acknowledged": 0}
    db = CrateConnector()
    try:
        for lease in claims:
            acknowledge(db, lease)
        result: dict = {"acknowledged": len(claims)}
        if publication_result is not None:
            result["publication"] = publication_result
            partial = any(
                media.get("streaming", {}).get("publication", {}).get("status") == "partial_success"
                for media in publication_result.values()
            )
            result["status"] = "partial_success" if partial else "success"
        return result
    finally:
        db.disconnect()
