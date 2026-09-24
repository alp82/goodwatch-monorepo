"""Copy TMDB's `created_by` into CrateDB for every show already fetched into Mongo.

The TMDB details copy (f/sync/copy/tmdb_details) writes creators since it learned about
`created_by`, but only for shows fetched in its recent window. This script reads the stored
`created_by` of every show from Mongo, so it makes no TMDB API calls, and writes the same
person and person_worked_on rows through the copy's own `creator_credits`. Rows are upserts
keyed by credit id, so the script can run again safely.

It needs the workspace's Mongo and Crate variables, so run it as a Windmill preview job
(path under `f/`, see the windmill-api-access notes) after tmdb_details is deployed.
`dry_run` only counts.
"""
import sys
from pathlib import Path

# Local runs import the Windmill modules from the repo; a Windmill job already has them.
_WINDMILL_DIR = Path(__file__).resolve().parents[1] / "windmill"
if _WINDMILL_DIR.is_dir():
    sys.path.insert(0, str(_WINDMILL_DIR))

from mongoengine import get_db

from f.db.cratedb import CrateConnector
from f.db.mongodb import close_mongodb, init_mongodb
from f.sync.copy.deleted_titles import NOT_DELETED_FILTER
from f.sync.copy.tmdb_details import creator_credits, upsert_in_batches

BATCH_SIZE = 5000
PROJECTION = {
    "_id": 0,
    "tmdb_id": 1,
    "title": 1,
    "original_title": 1,
    "created_by": 1,
    # Only the crew's credit ids, for creator_credits' collision check.
    "credits.crew.credit_id": 1,
    "aggregate_credits.crew.credit_id": 1,
    "aggregate_credits.crew.jobs.credit_id": 1,
}


def write(connector, people: dict, worked_on: list, dry_run: bool) -> None:
    if dry_run or not worked_on:
        return
    upsert_in_batches(connector, "person", list(people.values()))
    upsert_in_batches(connector, "person_worked_on", worked_on)


def main(dry_run: bool = True):
    init_mongodb()
    connector = None if dry_run else CrateConnector()
    collection = get_db().tmdb_tv_details
    selector = {"created_by.0": {"$exists": True}} | NOT_DELETED_FILTER

    totals = {"shows": 0, "shows_with_creators": 0, "creator_credits": 0, "person_rows": 0}
    people, worked_on, shows_in_batch = {}, [], set()
    for document in collection.find(selector, PROJECTION).sort("tmdb_id", 1).batch_size(BATCH_SIZE):
        # The copy skips titles without a name, so no show row exists for them.
        if not (document.get("title") or document.get("original_title")):
            continue
        tmdb_id = document["tmdb_id"]
        if tmdb_id in shows_in_batch:
            continue
        shows_in_batch.add(tmdb_id)
        totals["shows"] += 1
        credits = creator_credits(document, str(tmdb_id))
        if credits:
            totals["shows_with_creators"] += 1
        for person, credit in credits:
            people.setdefault(person.tmdb_id, person)
            worked_on.append(credit)
        if len(shows_in_batch) >= BATCH_SIZE:
            totals["creator_credits"] += len(worked_on)
            totals["person_rows"] += len(people)
            write(connector, people, worked_on, dry_run)
            print(f"through tmdb_id {tmdb_id}: {totals}", flush=True)
            people, worked_on, shows_in_batch = {}, [], set()
    totals["creator_credits"] += len(worked_on)
    totals["person_rows"] += len(people)
    write(connector, people, worked_on, dry_run)

    if connector:
        connector.disconnect()
    close_mongodb()
    print(totals, flush=True)
    return totals | {"dry_run": dry_run}
