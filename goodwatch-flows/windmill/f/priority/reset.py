from f.db.cratedb import CrateConnector
from f.priority.queue import acknowledge


def main(claims: list[dict]):
    if not claims:
        return {"acknowledged": 0}
    db = CrateConnector()
    try:
        for lease in claims:
            acknowledge(db, lease)
        return {"acknowledged": len(claims)}
    finally:
        db.disconnect()
