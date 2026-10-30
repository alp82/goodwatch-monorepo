"""General trope metadata, independent of the per-title `trope` table.

This module imports reviewed data only. It never fetches TV Tropes pages. The source hash identifies a directly
captured HTTP response; the description hash identifies exact imported plain text. Archive-only evidence lives in
source_archive: original HTTP hashes and capture dates stay null when the corpus does not preserve them.
"""
from datetime import datetime, timezone
import hashlib
import re
from urllib.parse import unquote, urlsplit
from f.sync.models.crate_schemas import ARCHIVE_COLUMN_TYPES
from f.tvtropes_catalog.description_docs import serialize_description_doc

TABLE = "trope_catalog"
FIELDS = ("name", "url", "description", "description_doc", "description_hash", "source", "source_hash", "fetched_at", "source_archive")
SOURCE = "tvtropes"
_HASH = re.compile(r"^[0-9a-f]{64}$")
_HTML_TAG = re.compile(
    r"</?(?:a|abbr|address|area|article|aside|audio|b|base|bdi|bdo|blockquote|body|br|button|"
    r"canvas|caption|cite|code|col|colgroup|data|datalist|dd|del|details|dfn|dialog|div|dl|dt|"
    r"em|embed|fieldset|figcaption|figure|font|footer|form|h[1-6]|head|header|hgroup|hr|html|i|"
    r"iframe|img|input|ins|kbd|label|legend|li|link|main|map|mark|math|menu|meta|meter|nav|"
    r"noscript|object|ol|optgroup|option|output|p|picture|pre|progress|q|rp|rt|ruby|s|samp|"
    r"script|search|section|select|slot|small|source|span|strike|strong|style|sub|summary|sup|"
    r"svg|table|tbody|td|template|textarea|tfoot|th|thead|time|title|tr|track|tt|u|ul|var|"
    r"video|wbr)(?=[\s/>])[^>]*>", re.IGNORECASE,
)


_LITERAL_SPAN = re.compile(
    r'(?<!\\)"(?:\\[^\r\n]|[^"\\\r\n])*"'
    r'|“[^”\r\n]*”'
    r'|(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)'
)


def _has_unquoted_html(text):
    """Literal tag spellings are prose inside paired double quotes or backticks; never rewrite the text."""
    tags = list(_HTML_TAG.finditer(text))
    if not tags:
        return False
    literals = []
    for match in _LITERAL_SPAN.finditer(text):
        opening = text.rfind("<", 0, match.start())
        # Attribute quotes inside an unquoted tag are not quoted prose, including custom tag names.
        prefix = text[opening:match.start()] if opening >= 0 else ""
        if prefix and ">" not in prefix and re.match(r"<[/!?]?[A-Za-z]", prefix):
            continue
        literals.append(match.span())
    position = 0
    for tag in tags:
        while position < len(literals) and literals[position][1] <= tag.start():
            position += 1
        if (position == len(literals) or literals[position][0] > tag.start()
                or literals[position][1] < tag.end()):
            return True
    return False


def canonical_url(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Trope URL must be a string")
    parts = urlsplit(value)
    if (parts.scheme not in ("http", "https") or parts.netloc.lower() not in ("tvtropes.org", "www.tvtropes.org")
            or not re.fullmatch(r"/pmwiki/pmwiki\.php/Main/[A-Za-z0-9_]+", parts.path)
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


_ARCHIVE_REQUIRED = {
    "provider", "dataset", "revision", "provider_url", "file_sha256", "record_sha256", "article_sha256", "payload_kind", "retrieved_at",
}
_ARCHIVE_OPTIONAL = {"byte_offset", "byte_length"}
_DATASET = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*$")
_REVISION = re.compile(r"^[0-9a-f]{40}$")


def normalize_archive(value):
    """Only immutable public archive references and digests, never raw HTML or a fabricated capture date."""
    if value is None:
        return None
    if not isinstance(value, dict) or set(value) - (_ARCHIVE_REQUIRED | _ARCHIVE_OPTIONAL) or _ARCHIVE_REQUIRED - set(value):
        raise ValueError("source_archive must contain exactly the required archive metadata and optional byte locator")
    if value["provider"] != "huggingface" or value["payload_kind"] not in ("article_html_fragment", "html_document"):
        raise ValueError("source_archive provider/payload_kind must identify a Hugging Face article HTML fragment or HTML document")
    dataset, revision = value["dataset"], value["revision"]
    if not isinstance(dataset, str) or len(dataset) > 300 or not _DATASET.fullmatch(dataset):
        raise ValueError("source_archive.dataset must be an owner/repository name")
    if not isinstance(revision, str) or not _REVISION.fullmatch(revision):
        raise ValueError("source_archive.revision must be a full lowercase 40-character commit hash")
    url = value["provider_url"]
    if not isinstance(url, str) or len(url) > 2000 or any(c.isspace() or c in '<>"`\\' for c in url):
        raise ValueError("source_archive.provider_url must be an immutable public archive URL")
    parsed = urlsplit(url)
    prefix = f"/datasets/{dataset}/resolve/{revision}/"
    file_path = unquote(parsed.path[len(prefix):]) if parsed.path.startswith(prefix) else ""
    if (parsed.scheme != "https" or parsed.netloc != "huggingface.co" or parsed.query or parsed.fragment
            or not file_path or "\\" in file_path or any(ord(c) < 32 for c in file_path)
            or any(part in ("", ".", "..") for part in file_path.split("/"))):
        raise ValueError("source_archive.provider_url must pin the same dataset and revision to one file, without credentials or query")
    normalized = {key: value[key] for key in ("provider", "dataset", "revision", "provider_url", "payload_kind")}
    for key in ("file_sha256", "record_sha256", "article_sha256"):
        digest = value[key]
        if not isinstance(digest, str) or not _HASH.fullmatch(digest):
            raise ValueError(f"source_archive.{key} must be a lowercase SHA256")
        normalized[key] = digest
    retrieved = value["retrieved_at"]
    if isinstance(retrieved, bool) or not isinstance(retrieved, (str, int)):
        raise ValueError("source_archive.retrieved_at must be a timezone-aware ISO timestamp or integer milliseconds")
    try:
        retrieved = timestamp(retrieved)
    except (TypeError, ValueError, OverflowError):
        raise ValueError("source_archive.retrieved_at must be a timezone-aware ISO timestamp or integer milliseconds") from None
    if retrieved is None or retrieved < 0:
        raise ValueError("source_archive.retrieved_at must identify the actual archive retrieval time")
    normalized["retrieved_at"] = retrieved
    locator = _ARCHIVE_OPTIONAL & set(value)
    if locator and locator != _ARCHIVE_OPTIONAL:
        raise ValueError("source_archive byte_offset and byte_length must be supplied together")
    if locator:
        offset, length = value["byte_offset"], value["byte_length"]
        if (type(offset) is not int or type(length) is not int or not 0 <= offset < 2**63 or not 1 <= length < 2**63
                or offset + length >= 2**63):
            raise ValueError("source_archive byte locator must contain nonnegative offset and positive length within signed 64-bit range")
        normalized.update(byte_offset=offset, byte_length=length)
    return normalized


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
        # Source prose can contain literal placeholders such as <Proper Noun>.
        # Quoted/code literals can also discuss real tag spellings without being markup.
        if _has_unquoted_html(text):
            raise ValueError(f"{name}: description must be plain text, not HTML")
        if not url:
            raise ValueError(f"{name}: a description requires its canonical source URL")
    source = row.get("source") or (SOURCE if text is not None else None)
    if source not in (None, SOURCE):
        raise ValueError(f"{name}: unsupported source; imported descriptions must be attributed to TV Tropes")
    archive = normalize_archive(row.get("source_archive"))
    if archive is not None and text is None:
        raise ValueError(f"{name}: archive provenance requires a description")
    if archive is not None and (row.get("source_hash") is not None or row.get("fetched_at") is not None):
        raise ValueError(f"{name}: archive-only records cannot claim an original HTTP source_hash or fetched_at")
    # A matching HTTP evidence log must not manufacture capture information for an archived fragment.
    evidence_row = {} if archive is not None else (evidence or {}).get(url, {})
    source_hash = None if archive is not None else row.get("source_hash", evidence_row.get("sha256"))
    if source_hash is not None and (not isinstance(source_hash, str) or not _HASH.fullmatch(source_hash)):
        raise ValueError(f"{name}: source_hash must be a lowercase SHA256")
    fetched_at = None if archive is not None else timestamp(row.get("fetched_at", evidence_row.get("started_at")))
    return {
        "name": name, "url": url, "description": text,
        "description_doc": serialize_description_doc(row.get("description_doc"), text),
        "description_hash": hashlib.sha256(text.encode("utf-8")).hexdigest() if text is not None else None,
        "source": source if text is not None else None,
        "source_hash": source_hash if text is not None else None,
        "fetched_at": fetched_at if text is not None else None,
        "source_archive": archive if text is not None else None,
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


def ensure_archive_mapping(db):
    """Crate can drop dynamically discovered object values during a bulk conflict update. Fail before writes."""
    rows = db.select("SELECT column_name,data_type FROM information_schema.columns "
                     "WHERE table_schema = ? AND table_name = ? AND column_name LIKE ?",
                     ("doc", TABLE, "source_archive[%"))
    actual = {row["column_name"]: row["data_type"] for row in rows}
    invalid = [f"source_archive['{key}']" for key, kind in ARCHIVE_COLUMN_TYPES.items()
               if actual.get(f"source_archive['{key}']") != kind.lower()]
    if invalid:
        raise RuntimeError("Archive import requires explicitly declared nested column types before bulk UPSERT: "
                           + ", ".join(invalid) + ". Apply the reviewed schema migration first.")


def verify_archive_writes(db, records, *, batch_size=200, replace_descriptions=False):
    """Read stored source documents: projections alone can conceal lost object provenance."""
    for start in range(0, len(records), batch_size):
        batch = records[start:start + batch_size]
        marks = ",".join("?" for _ in batch)
        stored = db.select(f"SELECT name,_doc AS actual_doc FROM {TABLE} WHERE name IN ({marks})",
                           tuple(row["name"] for row in batch))
        documents = {row["name"]: row["actual_doc"] for row in stored}
        failed = []
        for row in batch:
            actual = documents.get(row["name"], {})
            if not replace_descriptions and actual.get("description") is not None:
                # A concurrently published description can win the guarded missing-only update.
                if actual.get("description_hash") != row["description_hash"]:
                    continue
                if actual.get("source_hash") is not None or actual.get("fetched_at") is not None:
                    continue
            if (actual.get("description_hash") != row["description_hash"]
                    or actual.get("source_archive") != row["source_archive"]
                    or actual.get("description_doc") != row.get("description_doc")):
                failed.append(row["name"])
        if failed:
            raise RuntimeError("Archive import stored-document verification failed for " + str(len(failed))
                               + " rows: " + ", ".join(failed[:10])
                               + ". Writes may have succeeded partially; stop and inspect exact staged evidence before repair.")


def import_records(db, records, *, apply=False, replace_descriptions=False, batch_size=200, expected_hashes=None):
    """Import an already validated batch. Repeated imports preserve timestamps and unchanged rows."""
    if not 1 <= batch_size <= 1000:
        raise ValueError("batch_size must be between 1 and 1000")
    # Validate even callers that bypass records_from_document, before any DB access.
    records = [{**row, "description_doc": serialize_description_doc(row.get("description_doc"), row.get("description"))}
               for row in records]
    if expected_hashes is not None:
        if not replace_descriptions or any(row['name'] not in expected_hashes for row in records):
            raise ValueError('Guarded replacements require an expected hash for every row')
        # UPDATE cannot recreate a deleted row, and checks the reviewed hash atomically.
        # Keep the reviewed content and its provenance together; names and URLs never change.
        report = {'apply': apply, 'input': len(records), 'guarded': len(records)}
        if apply:
            sql = (f'UPDATE {TABLE} SET description=?,description_doc=?,description_hash=?,'
                   'source=?,source_hash=?,fetched_at=?,source_archive=?,updated_at=current_timestamp '
                   'WHERE name=? AND url=? AND description_hash IS NOT DISTINCT FROM ?')
            values = [(r['description'], r['description_doc'], r['description_hash'], r['source'],
                       r['source_hash'], r['fetched_at'], r['source_archive'], r['name'], r['url'],
                       expected_hashes[r['name']]) for r in records]
            # One statement per row: on production Crate (6.4.6), this guarded UPDATE sent as bulk_args hung for
            # minutes per batch, while single statements take about 0.15 s.
            for value in values:
                db.run(sql, value)
            if records:
                db.run(f'REFRESH TABLE {TABLE}')
                marks = ','.join('?' for _ in records)
                stored = {r['name']: r['actual_doc'] for r in db.select(
                    f'SELECT name,_doc AS actual_doc FROM {TABLE} WHERE name IN ({marks})',
                    tuple(r['name'] for r in records))}
                report['written'] = report['stale'] = 0
                report['stale_names'] = []
                for row in records:
                    actual = stored.get(row['name'], {})
                    if all(actual.get(k) == row.get(k) for k in ('url', 'description', 'description_doc', 'description_hash',
                                                               'source', 'source_hash', 'fetched_at', 'source_archive')):
                        report['written'] += 1
                    elif (actual.get('description_hash') not in (expected_hashes[row['name']], row['description_hash'])
                          or actual.get('url') != row['url']):
                        report['stale'] += 1
                        report['stale_names'].append(row['name'])
                    else:
                        raise RuntimeError('Guarded catalog write verification failed; inspect staging and rerun')
        return report
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
        if any(row.get("source_archive") is not None for row in plans):
            ensure_archive_mapping(db)
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
            archived = [row for row in plans if row.get("source_archive") is not None]
            if archived:
                verify_archive_writes(db, archived, batch_size=batch_size, replace_descriptions=replace_descriptions)
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
