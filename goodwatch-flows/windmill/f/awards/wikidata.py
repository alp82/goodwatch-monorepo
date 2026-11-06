# extra_requirements:
# requests
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Bounded award-category imports covering work, recipient and category-owned statements."""

import json
import re
import time
from collections import defaultdict
from datetime import timedelta

from f.awards.client import Client, Deferred
from f.awards.identities import Identities, item_ids, label, values
from f.awards.models import QID, Observation, nomination_year
from f.awards.registry import PROGRAMS, Registry
from f.awards.store import (
    canonical_id,
    indexes,
    load_raw,
    record_run,
    save_raw,
    save_scope,
)
from f.sync.copy.sync_state import utc_now
from f.tvdb.store import Busy, claim, exclusive, finish

PAGE_SIZE = 1000


def value(row, key):
    return row.get(key, {}).get("value")


def qid(value):
    tail = (value or "").rsplit("/", 1)[-1]
    return tail if QID.fullmatch(tail) else None


def discover(db, client):
    report = {"programs": 0, "categories": 0}
    for program, (name, roots) in PROGRAMS.items():
        state_key = "discovery:" + program
        state = db.award_state.find_one({"_id": state_key}) or {}
        if state.get("due_at", utc_now()) > utc_now():
            continue
        roots_sql = " ".join("wd:" + r for r in roots)
        rows = client.query(
            """SELECT DISTINCT ?award WHERE {
 VALUES ?root { """
            + roots_sql
            + """ }
 ?award (wdt:P31|wdt:P361|wdt:P279) ?root .
} LIMIT 2000"""
        )
        if len(rows) >= 2000:
            raise ValueError("Wikidata category discovery reached its bound")
        for candidate in {qid(value(r, "award")) for r in rows} | set(roots):
            if not candidate:
                continue
            # A category may be shared across historical program roots. Keep each
            # program identity explicit rather than silently overwriting its owner.
            key = program + ":" + candidate
            db.award_wikidata_queue.update_one(
                {"_id": key},
                {
                    "$set": {
                        "kind": "category",
                        "qid": candidate,
                        "program_key": program,
                    },
                    "$setOnInsert": {
                        "due_at": utc_now() - timedelta(days=1),
                        "priority": 100 if program == "oscars" else 0,
                    },
                },
                upsert=True,
            )
        db.award_state.update_one(
            {"_id": state_key},
            {
                "$set": {
                    "due_at": utc_now() + timedelta(days=7),
                    "categories": len(rows),
                }
            },
            upsert=True,
        )
        report["programs"] += 1
        report["categories"] += len(rows)
    return report


def fetch_category(client, category, max_pages=50, db=None):
    if not QID.fullmatch(category):
        raise ValueError("Invalid award category identity")
    checkpoint = (
        (db.award_fetch_checkpoints.find_one({"_id": category}) or {})
        if db is not None
        else {}
    )
    rows = [row for ref in checkpoint.get("pages", []) for row in load_raw(db, ref)]
    if checkpoint.get("complete"):
        return rows
    after = checkpoint.get("after", "")
    refs = checkpoint.get("pages", [])
    for _ in range(max_pages):
        cursor = "FILTER(STR(?statement) > " + json.dumps(after) + ")" if after else ""
        # Page statement identities first. Qualifier/reference multiplicity must
        # not split a single statement at a row LIMIT boundary.
        ids = client.query(
            """SELECT DISTINCT ?statement WHERE {
 { ?statement ps:P166 wd:"""
            + category
            + """ . }
 UNION { ?statement ps:P1411 wd:"""
            + category
            + """ . }
 UNION { wd:"""
            + category
            + """ p:P1346 ?statement . }
 UNION { wd:"""
            + category
            + """ p:P2453 ?statement . }
 """
            + cursor
            + """ } ORDER BY STR(?statement) LIMIT """
            + str(PAGE_SIZE)
        )
        statements = checkpoint.get("pending") or [value(r, "statement") for r in ids]
        if not statements:
            if db is not None:
                db.award_fetch_checkpoints.update_one(
                    {"_id": category},
                    {"$set": {"pages": refs, "complete": True, "at": utc_now()}},
                    upsert=True,
                )
            return rows
        if any(
            not s or not s.startswith("http://www.wikidata.org/entity/statement/")
            for s in statements
        ):
            raise ValueError("Invalid statement identity")
        final_page = checkpoint.get("final_page", len(statements) < PAGE_SIZE)
        for offset in range(0, len(statements), 100):
            iris = " ".join("<" + s + ">" for s in statements[offset : offset + 100])
            batch = client.query(
                """SELECT ?statement ?subject ?property ?object ?work ?date ?ceremony ?winner ?nominee ?character ?rank ?reference WHERE {
 VALUES ?statement { """
                + iris
                + """ }
 ?subject ?property ?statement .
 VALUES (?property ?ps) { (p:P166 ps:P166) (p:P1411 ps:P1411) (p:P1346 ps:P1346) (p:P2453 ps:P2453) }
 ?statement ?ps ?object . ?statement wikibase:rank ?rank .
 OPTIONAL { ?statement pq:P1686 ?work }
 OPTIONAL { ?statement pq:P585 ?date }
 OPTIONAL { ?statement pq:P805 ?ceremony }
 OPTIONAL { ?statement pq:P1346 ?winner }
 OPTIONAL { ?statement pq:P2453 ?nominee }
 OPTIONAL { ?statement pq:P453 ?character }
 OPTIONAL { ?statement prov:wasDerivedFrom ?ref . ?ref pr:P854 ?reference }
}"""
            )
            seen = {value(r, "statement") for r in batch}
            if not set(statements[offset : offset + 100]) <= seen:
                raise ValueError("Incomplete Wikidata statement page")
            rows.extend(batch)
            if db is not None:
                refs.append(save_raw(db, "wikidata", batch))
                db.award_fetch_checkpoints.update_one(
                    {"_id": category},
                    {
                        "$set": {
                            "pages": refs,
                            "pending": statements[offset + 100 :],
                            "after": statements[-1]
                            if offset + 100 >= len(statements)
                            else after,
                            "final_page": final_page,
                            "complete": final_page and offset + 100 >= len(statements),
                            "at": utc_now(),
                        }
                    },
                    upsert=True,
                )
        if final_page:
            return rows
        after = statements[-1]
        checkpoint = {}
    raise ValueError(
        "Wikidata category is larger than the import bound; previous scope retained"
    )


def display_category(program, name):
    prefixes = [
        "Academy Award for ",
        "Golden Globe Award for ",
        "Primetime Emmy Award for ",
        "Daytime Emmy Award for ",
        "BAFTA Award for ",
        "British Academy Television Award for ",
        "Critics' Choice Movie Award for ",
        "Critics' Choice Television Award for ",
        "Broadcast Film Critics Association Award for ",
        "Screen Actors Guild Award for ",
        "Writers Guild of America Award for ",
        "César Award for ",
    ]
    for prefix in prefixes:
        if name.startswith(prefix):
            name = name[len(prefix) :]
            break
    if program == "bafta.film":
        name = {
            "Best Actor in a Leading Role": "Best Leading Actor",
            "Best Actress in a Leading Role": "Best Leading Actress",
            "Best Actor in a Supporting Role": "Best Supporting Actor",
            "Best Actress in a Supporting Role": "Best Supporting Actress",
            "Best Direction": "Best Director",
        }.get(name, name)
    return name


def ceremony(db, program, q, entity):
    dates = [v.get("time", "") for v in values(entity, "P585") if isinstance(v, dict)]
    years = {nomination_year(d.lstrip("+")[:4]) for d in dates} - {None}
    date = next((d.lstrip("+")[:10] for d in dates if "-00" not in d[:11]), None)
    name = label(entity, q)
    edition_values = values(entity, "P393")
    edition_match = re.match(r"^(\d+)(?:st|nd|rd|th)\b", name)
    edition = (
        str(edition_values[0])
        if len(edition_values) == 1
        else edition_match.group(1)
        if edition_match
        else None
    )
    year = next(iter(years)) if len(years) == 1 else None
    # The postponed 75th Primetime Emmys recognized 2023, despite presentation in 2024.
    award_year = 2023 if program == "emmys" and edition == "75" else year
    if not dates or not edition:
        return {}
    external_key = program + ":wikidata:" + q
    key = canonical_id(db, "ceremony", external_key)
    legacy = db.award_ceremonies.find_one({"_id": external_key})
    if legacy:
        db.award_ceremonies.update_one(
            {"_id": external_key}, {"$set": {"active": False, "canonical_id": key}}
        )
    db.award_ceremonies.update_one(
        {"_id": key},
        {
            "$set": {
                "key": key,
                "program_key": program,
                "wikidata_id": q,
                "label": name,
                "edition": edition,
                "award_year": award_year,
                "presentation_year": year,
                "date": date,
                "sources": ["wikidata"],
                "active": True,
            }
        },
        upsert=True,
    )
    return {"key": key, "label": name, "year": award_year, "date": date}


def normalize(db, client, connector, doc, rows):
    program, category = doc["program_key"], doc["qid"]
    groups = defaultdict(list)
    for row in rows:
        groups[value(row, "statement")].append(row)
    ids = {category}
    for row in rows:
        ids.update(
            q
            for k in [
                "subject",
                "object",
                "work",
                "ceremony",
                "winner",
                "nominee",
                "character",
            ]
            if (q := qid(value(row, k)))
        )
    entities = client.entities(ids)
    category_entity = entities.get(category, {})
    roots = set(PROGRAMS[program][1])
    parents = {
        p for prop in ["P31", "P361", "P279"] for p in item_ids(category_entity, prop)
    }
    if category not in roots and not parents & roots:
        # Never accept a hand-added or redirected unrelated item as an award category.
        raise ValueError("Category does not belong to the declared award program")

    # Resolve explicit parents for songs, seasons and episodes without casting them into titles.
    for _ in range(3):
        parents = {
            p
            for e in entities.values()
            for prop in ["P179", "P361"]
            for p in item_ids(e, prop)
        } - set(entities)
        if not parents:
            break
        entities.update(client.entities(parents))
    identity = Identities(db, connector, entities)
    registry = Registry(db)
    category_name = display_category(
        program, label(entities.get(category, {}), category)
    )
    mapped = registry.category("wikidata", category, program, category_name)
    result = []
    ceremony_cache = {}
    for statement, data in groups.items():
        first = data[0]
        if any(
            value(r, "rank") == "http://wikiba.se/ontology#DeprecatedRank" for r in data
        ):
            continue
        subject, obj = qid(value(first, "subject")), qid(value(first, "object"))
        prop = (value(first, "property") or "").rsplit("/", 1)[-1]
        if not subject or not obj:
            continue
        refs = {
            value(r, "reference")
            for r in data
            if value(r, "reference")
            and value(r, "reference").startswith(("https://", "http://"))
        }
        refs.add("https://www.wikidata.org/wiki/" + subject)
        work_ids = {qid(value(r, "work")) for r in data} - {None}
        ceremony_ids = {qid(value(r, "ceremony")) for r in data} - {None}
        date_years = {nomination_year((value(r, "date") or "")[:4]) for r in data} - {
            None
        }
        flags = []
        recipients = []
        works = []
        if prop in {"P166", "P1411"}:
            if identity.is_work(subject):
                work_ids.add(subject)
                people = {
                    qid(value(r, "winner" if prop == "P166" else "nominee"))
                    for r in data
                } - {None}
            else:
                people = {subject}
            outcome = "won" if prop == "P166" else "unknown"
        else:
            # Category-owned winner/nominee statements put the recipient/work in the main value.
            if identity.is_work(obj):
                work_ids.add(obj)
                people = set()
            else:
                people = {obj}
            outcome = "won" if prop == "P1346" else "unknown"
        for person in people:
            recipient = identity.recipient(person)
            if recipient["kind"] != "work":
                recipients.append(recipient)
        for work in work_ids:
            works.extend(identity.works(work))
        if len(work_ids) > 1:
            flags.append("multiple_work_qualifiers")
        c = {}
        if len(ceremony_ids) == 1:
            cq = next(iter(ceremony_ids))
            if cq not in ceremony_cache:
                ceremony_cache[cq] = ceremony(db, program, cq, entities.get(cq, {}))
            c = ceremony_cache[cq]
        elif len(ceremony_ids) > 1:
            flags.append("identity_conflict")
        year = c.get("year") or (
            next(iter(date_years)) if len(date_years) == 1 else None
        )
        if not c:
            # A year is not an edition identity. Work/person awards remain supported
            # observations, but cannot be merged into an exact cross-source entry.
            flags.append("unresolved_ceremony")
        entry_basis = mapped["entry_basis"]
        if entry_basis == "work" and not works and recipients:
            entry_basis = (
                "career"
                if any(
                    w in category_name.lower()
                    for w in ["honor", "career", "lifetime", "fellowship"]
                )
                else "person"
            )
        portrayals = []
        characters = {qid(value(r, "character")) for r in data} - {None}
        if characters:
            record = {
                "character_wikidata_ids": sorted(characters),
                "character_name": ", ".join(
                    label(entities.get(q, {}), q) for q in sorted(characters)
                ),
                "link_status": "unverified",
            }
            if (
                len(characters) == 1
                and len(people) == 1
                and len(work_ids) == 1
                and recipients
            ):
                person = recipients[0]
                work = identity.work(next(iter(work_ids)))
                character = next(iter(characters))
                if person.get("person_tmdb_id") and work.get("media_tmdb_id"):
                    from f.tvdb.publish import exact_credit

                    credits = connector.select(
                        "SELECT person_tmdb_id, character, credit_id FROM person_appeared_in WHERE media_type = ? AND media_tmdb_id = ? AND person_tmdb_id = ?",
                        (
                            work["media_type"],
                            work["media_tmdb_id"],
                            person["person_tmdb_id"],
                        ),
                    )
                    credit = exact_credit(
                        credits,
                        person["person_tmdb_id"],
                        label(entities.get(character, {})),
                    )
                    record.update(
                        person_tmdb_id=person["person_tmdb_id"],
                        media_type=work["media_type"],
                        media_tmdb_id=work["media_tmdb_id"],
                        credit_id=credit,
                        link_status="verified" if credit else "unverified",
                    )
                    if credit:
                        roles = connector.select(
                            "SELECT tvdb_character_id FROM tvdb_character WHERE media_type = ? AND media_tmdb_id = ? AND person_tmdb_id = ? AND credit_id = ?",
                            (
                                work["media_type"],
                                work["media_tmdb_id"],
                                person["person_tmdb_id"],
                                credit,
                            ),
                        )
                        if len(roles) == 1:
                            record["tvdb_character_id"] = roles[0]["tvdb_character_id"]
            portrayals.append(record)
        result.append(
            Observation(
                source="wikidata",
                record_id=statement.rsplit("/", 1)[-1],
                program_key=program,
                category_key=mapped["key"],
                category_name=mapped["name"],
                year=year,
                outcome=outcome,
                ceremony_key=c.get("key"),
                ceremony_label=c.get("label"),
                ceremony_date=c.get("date"),
                portrayals=portrayals,
                recipients=recipients,
                works=works,
                references=sorted(refs),
                flags=flags,
                recipient_set_status="partial" if recipients else "unknown",
                entry_basis=entry_basis,
                source_category_id=category,
                nomination_status="not_applicable"
                if entry_basis == "career"
                else "confirmed",
            )
        )
    return result


def run(db, connector, max_seconds=600, max_categories=100, client=None):
    client = client or Client(db)
    report = {"categories": 0, "observations": 0, "errors": 0}
    start = time.monotonic()
    client.deadline = start + max_seconds
    while (
        time.monotonic() - start < max_seconds and report["categories"] < max_categories
    ):
        doc = claim(db.award_wikidata_queue, utc_now(), lease_minutes=30)
        if not doc:
            break
        try:
            rows = fetch_category(client, doc["qid"], db=db)
            observations = normalize(db, client, connector, doc, rows)
            saved = save_scope(db, "wikidata", doc["_id"], observations, raw=rows)
            db.award_fetch_checkpoints.delete_one({"_id": doc["qid"]})
            finish(
                db.award_wikidata_queue,
                doc,
                {
                    "due_at": utc_now() + timedelta(days=7),
                    "fetched_at": utc_now(),
                    "error": None,
                    "fetch_failures": 0,
                },
            )
            report["categories"] += 1
            report["observations"] += saved["observations"]
        except (Deferred, Busy):
            finish(
                db.award_wikidata_queue,
                doc,
                {"due_at": utc_now() + timedelta(minutes=5)},
            )
            report["deferred"] = True
            break
        except Exception as error:
            if str(error) == "Incomplete Wikidata statement page":
                # A statement may have been removed between identity and detail reads.
                # Restart this staged fetch; the committed source scope stays intact.
                db.award_fetch_checkpoints.delete_one({"_id": doc["qid"]})
            finish(
                db.award_wikidata_queue,
                doc,
                {
                    "due_at": utc_now() + timedelta(hours=6),
                    "error": type(error).__name__,
                    "fetch_failures": doc.get("fetch_failures", 0) + 1,
                },
            )
            report["errors"] += 1
            # Never replace a prior successful snapshot after a failed/partial response.
            if report["errors"] >= 3:
                raise
    report["elapsed_seconds"] = round(time.monotonic() - start, 2)
    return report


def main(max_minutes: int = 10, max_categories: int = 100, discovery: bool = False):
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb, init_mongodb
    from mongoengine import get_db

    init_mongodb()
    connector = None
    try:
        db = get_db()
        indexes(db)
        with exclusive(db, "awards-discovery" if discovery else "awards-wikidata", 30):
            connector = CrateConnector()
            if discovery:
                return record_run(db, "wikidata-discovery", discover(db, Client(db)))
            return record_run(
                db, "wikidata", run(db, connector, max_minutes * 60, max_categories)
            )
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()
