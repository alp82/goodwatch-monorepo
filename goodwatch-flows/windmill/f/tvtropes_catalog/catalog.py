"""General trope metadata, independent of the per-title `trope` table.

This module imports reviewed data only. It never fetches TV Tropes pages. The source hash identifies captured page
bytes; the description hash identifies the exact imported plain text. Unknown source hashes/dates stay null.
"""
from datetime import datetime, timezone
import hashlib
import re
from urllib.parse import urlsplit

TABLE = "trope_catalog"
FIELDS = ("name", "url", "description", "description_hash", "source", "source_hash", "fetched_at")
SOURCE = "tvtropes"
_HASH = re.compile(r"^[0-9a-f]{64}$")


def canonical_url(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Trope URL must be a string")
    parts = urlsplit(value)
    if (parts.scheme not in ("http", "https") or parts.netloc.lower() not in ("tvtropes.org", "www.tvtropes.org")
            or not re.fullmatch(r"/pmwiki/pmwiki\.php/Main/[A-Za-z0-9]+", parts.path)
            or parts.query or parts.fragment):
        raise ValueError("Trope URL must identify a TV Tropes Main page without query or fragment")
    return "https://tvtropes.org" + parts.path


def timestamp(value):
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return int(value)
    if not isinstance(value, str):
        raise ValueError("fetched_at must be an ISO timestamp with a timezone")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("fetched_at must be an ISO timestamp with a timezone") from error
    if parsed.tzinfo is None:
        raise ValueError("fetched_at must include a timezone")
    return int(parsed.timestamp() * 1000)


def normalize_record(row, *, evidence=None):
    if not isinstance(row, dict):
        raise ValueError("Each catalog entry must be an object")
    name = row.get("name")
    if not isinstance(name, str) or not name.strip() or name != name.strip() or len(name) > 300 or any(ord(c) < 32 for c in name):
        raise ValueError("Trope name must be nonempty, exact, and at most 300 characters")
    url = canonical_url(row.get("url"))
    text = row.get("description", row.get("text"))
    if text is not None:
        if not isinstance(text, str) or not text.strip() or len(text) > 100_000:
            raise ValueError(f"{name}: description must be nonempty plain text")
        if re.search(r"</?[A-Za-z][^>]*>", text):
            raise ValueError(f"{name}: description must be plain text, not HTML")
        if not url:
            raise ValueError(f"{name}: a description requires its canonical source URL")
    source = row.get("source") or (SOURCE if text is not None else None)
    if source not in (None, SOURCE):
        raise ValueError(f"{name}: unsupported source; imported descriptions must be attributed to TV Tropes")
    evidence_row = (evidence or {}).get(url, {})
    source_hash = row.get("source_hash", evidence_row.get("sha256"))
    if source_hash is not None and (not isinstance(source_hash, str) or not _HASH.fullmatch(source_hash)):
        raise ValueError(f"{name}: source_hash must be a lowercase SHA256")
    fetched_at = timestamp(row.get("fetched_at", evidence_row.get("started_at")))
    return {
        "name": name, "url": url, "description": text,
        "description_hash": hashlib.sha256(text.encode("utf-8")).hexdigest() if text is not None else None,
        "source": source if text is not None else None,
        "source_hash": source_hash if text is not None else None,
        "fetched_at": fetched_at if text is not None else None,
    }


def evidence_by_url(document):
    """Prototype/recovery run log. A failed response cannot certify a description's source."""
    if not isinstance(document, dict) or not isinstance(document.get("log"), list):
        raise ValueError("Evidence log must contain a log array")
    result = {}
    for row in document["log"]:
        if row.get("status") != 200:
            continue
        url = canonical_url(row.get("url") or row.get("requested_url"))
        if not url or not row.get("sha256") or not row.get("started_at"):
            continue
        result[url] = row
        if row.get("requested_url"):
            result[canonical_url(row["requested_url"])] = row
    return result


def records_from_document(document, *, evidence=None):
    if isinstance(document, dict) and "records" in document:
        values = document["records"]
    elif isinstance(document, dict):
        if any(not isinstance(entry, dict) for entry in document.values()):
            raise ValueError("Name-map entries must be objects")
        values = [{"name": name, **entry} for name, entry in document.items()]
    else:
        values = document
    if not isinstance(values, list):
        raise ValueError("Input must be a name map, a list, or an object containing records")
    result = [normalize_record(row, evidence=evidence) for row in values]
    names = [row["name"] for row in result]
    if len(set(names)) != len(names):
        raise ValueError("Duplicate trope names in input; provide one reviewed record per exact name")
    return result


def merged_record(existing, incoming, *, replace_descriptions=False):
    if existing is None:
        return {key: incoming.get(key) for key in FIELDS}
    desired = {key: existing.get(key) for key in FIELDS}
    if incoming["description"] is not None and (existing.get("description") is None or replace_descriptions):
        desired.update(incoming)
    elif desired["url"] is None:
        desired["url"] = incoming["url"]
    return desired


def schema_sql():
    # Keep imports lazy: validation and planning need no database client or Windmill installation.
    from f.sync.models.crate_schemas import SCHEMAS
    spec = SCHEMAS[TABLE]
    columns = [f"{name} {kind}" for name, kind in spec["columns"].items()]
    return (f"CREATE TABLE IF NOT EXISTS {TABLE} (" + ", ".join(columns + ["PRIMARY KEY (name)"])
            + f") CLUSTERED INTO {spec['shards']} SHARDS")


def ensure_schema(db, *, apply=False):
    """Prepare only this table, without running the project-wide schema initializer."""
    rows = db.select("SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = ?", ("doc", TABLE))
    if rows:
        return False
    if apply:
        db.run(schema_sql())
    return True


def import_records(db, records, *, apply=False, replace_descriptions=False, batch_size=200):
    """Import an already validated batch. Repeated imports preserve timestamps and unchanged rows."""
    if not 1 <= batch_size <= 1000:
        raise ValueError("batch_size must be between 1 and 1000")
    schema_missing = ensure_schema(db, apply=apply)
    existing = {}
    if not schema_missing or apply:
        for start in range(0, len(records), batch_size):
            names = [row["name"] for row in records[start:start + batch_size]]
            marks = ",".join("?" for _ in names)
            rows = db.select(f"SELECT {','.join(FIELDS)} FROM {TABLE} WHERE name IN ({marks})", tuple(names))
            for row in rows:
                # The HTTP API returns epoch milliseconds; the Python driver can return a UTC datetime.
                if isinstance(row.get("fetched_at"), datetime):
                    value = row["fetched_at"]
                    row["fetched_at"] = int((value if value.tzinfo else value.replace(tzinfo=timezone.utc)).timestamp() * 1000)
                existing[row["name"]] = row
    plans = []
    report = {"apply": apply, "schema_missing": schema_missing, "input": len(records), "insert": 0, "update": 0, "unchanged": 0, "descriptions": sum(row["description"] is not None for row in records)}
    for incoming in records:
        old = existing.get(incoming["name"])
        desired = merged_record(old, incoming, replace_descriptions=replace_descriptions)
        if old is not None and desired == {key: old.get(key) for key in FIELDS}:
            report["unchanged"] += 1
        else:
            report["insert" if old is None else "update"] += 1
            plans.append(incoming)
    if apply:
        # The conditional update also protects reviewed text when another importer writes between SELECT and INSERT.
        allow = "TRUE" if replace_descriptions else "description IS NULL"
        text_update = f"excluded.description IS NOT NULL AND ({allow})"
        columns = ",".join(FIELDS) + ",imported_at,updated_at"
        updates = [f"{key} = CASE WHEN {text_update} THEN excluded.{key} ELSE {key} END" for key in FIELDS[2:]]
        updates.insert(0, f"url = CASE WHEN {text_update} THEN excluded.url ELSE coalesce(url, excluded.url) END")
        updates.append(f"updated_at = CASE WHEN ({text_update}) OR (url IS NULL AND excluded.url IS NOT NULL) THEN current_timestamp ELSE updated_at END")
        sql = (f"INSERT INTO {TABLE} ({columns}) VALUES (" + ",".join("?" for _ in FIELDS)
               + ",current_timestamp,current_timestamp) ON CONFLICT (name) DO UPDATE SET " + ",".join(updates))
        for start in range(0, len(plans), batch_size):
            values = [tuple(row.get(key) for key in FIELDS) for row in plans[start:start + batch_size]]
            if hasattr(db, "run_many"):
                db.run_many(sql, values)
            else:
                for value in values:
                    db.run(sql, value)
        if plans:
            db.run(f"REFRESH TABLE {TABLE}")
    return report


def main(records: list[dict], dry_run: bool = True, replace_descriptions: bool = False):
    """Windmill entry point for a reviewed batch; fetching source pages is a separate supervised step."""
    from f.db.cratedb import CrateConnector
    rows = records_from_document(records)
    connector = CrateConnector()
    try:
        return import_records(connector, rows, apply=not dry_run, replace_descriptions=replace_descriptions)
    finally:
        connector.disconnect()
