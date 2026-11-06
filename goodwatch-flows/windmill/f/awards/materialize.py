# extra_requirements:
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""One scheduled owner for canonical reconciliation and atomic serving publication."""

from f.awards import publish, reconcile
from f.awards.store import indexes, record_run
from f.tvdb.store import exclusive


def main(force: bool = False):
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb, init_mongodb
    from mongoengine import get_db

    init_mongodb()
    c = None
    try:
        db = get_db()
        indexes(db)
        with exclusive(db, "awards-canonical", 30):
            report = {"reconciliation": reconcile.run(db, force)}
            c = CrateConnector()
            report["publication"] = publish.run(db, c)
            return record_run(db, "materialize", report)
    finally:
        if c:
            c.disconnect()
        close_mongodb()
