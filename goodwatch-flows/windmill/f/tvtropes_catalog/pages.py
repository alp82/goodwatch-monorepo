"""URI-keyed reviewed Main pages and independently evidenced original-route references.

No source requests. Legacy exact-name records are independent. Writers never retry uncertain writes.
"""
from datetime import datetime, timezone
import hashlib
import json
import re
from f.sync.models.crate_schemas import SCHEMAS, ARCHIVE_COLUMN_TYPES
from f.tvtropes_catalog.catalog import canonical_url, normalize_archive, timestamp, _has_unquoted_html

PAGE_TABLE = 'trope_catalog_page'
REFERENCE_TABLE = 'trope_catalog_reference'
PAGE_FIELDS = ('url', 'title', 'description', 'description_hash', 'source', 'source_hash', 'fetched_at', 'source_archive')
REFERENCE_FIELDS = ('reference_url', 'canonical_url', 'source_hash', 'fetched_at', 'source_archive')
TABLES = ((PAGE_TABLE, 'url', PAGE_FIELDS, 'pages'), (REFERENCE_TABLE, 'reference_url', REFERENCE_FIELDS, 'references'))
_HASH = re.compile(r'[0-9a-f]{64}\Z')


class PageImportWriteError(RuntimeError):
    """The write may have reached Crate: inspect receipts and read back; do not automatically replay."""
    retryable = False


def _url(value):
    value = canonical_url(value)
    if not value:
        raise ValueError('A bare known Main URL is required')
    return value


def _provenance(row):
    archive = normalize_archive(row.get('source_archive'))
    digest, fetched = row.get('source_hash'), row.get('fetched_at')
    if archive is not None:
        if digest is not None or fetched is not None:
            raise ValueError('Archive evidence cannot claim original HTTP source_hash/fetched_at')
        return {'source_hash': None, 'fetched_at': None, 'source_archive': archive}
    if not isinstance(digest, str) or not _HASH.fullmatch(digest):
        raise ValueError('Direct HTTP evidence requires the complete response SHA256')
    fetched = timestamp(fetched)
    if fetched is None or fetched < 0:
        raise ValueError('Direct HTTP evidence requires its actual fetch timestamp')
    return {'source_hash': digest, 'fetched_at': fetched, 'source_archive': None}


def _corrupt_controls(text, *, whitespace=False):
    return any((ord(c) < 32 and (not whitespace or c not in "\t\n\r")) or 127 <= ord(c) <= 159 for c in text)


def normalize_page(row):
    if not isinstance(row, dict):
        raise ValueError('Page must be an object')
    title = row.get('title')
    if (not isinstance(title, str) or not title or title != title.strip() or len(title) > 500
            or _corrupt_controls(title) or _has_unquoted_html(title)):
        raise ValueError('Page title must be the actual nonempty plain-text heading')
    description = row.get('description')
    if description is not None and (not isinstance(description, str) or not description.strip()
                                    or len(description.encode('utf-8')) > 100_000 or _corrupt_controls(description, whitespace=True)
                                    or _has_unquoted_html(description)):
        raise ValueError('Page description must be nonempty plain text')
    if row.get('source', 'tvtropes') != 'tvtropes':
        raise ValueError('Page source must be tvtropes')
    return {'url': _url(row.get('url')), 'title': title, 'description': description,
            'description_hash': hashlib.sha256(description.encode()).hexdigest() if description is not None else None,
            'source': 'tvtropes', **_provenance(row)}


def normalize_reference(row):
    if not isinstance(row, dict):
        raise ValueError('Reference must be an object')
    return {'reference_url': _url(row.get('reference_url')), 'canonical_url': _url(row.get('canonical_url')),
            **_provenance(row)}


def normalize_document(document):
    if not isinstance(document, dict) or set(document) - {'pages', 'references'}:
        raise ValueError('Expected {pages: [...], references: [...]}')
    result = {}
    for field, key, normalize in (('pages', 'url', normalize_page), ('references', 'reference_url', normalize_reference)):
        rows = document.get(field, [])
        if not isinstance(rows, list):
            raise ValueError(field + ' must be an array')
        unique = {}
        for value in rows:
            row = normalize(value)
            if row[key] in unique and unique[row[key]] != row:
                raise ValueError('Conflicting reviewed input for ' + row[key])
            unique[row[key]] = row
        result[field] = [unique[value] for value in sorted(unique)]
    return result


def source_priority(row):
    if row.get('source_hash') and row.get('fetched_at') is not None:
        return 3
    archive = row.get('source_archive') or {}
    identity = (archive.get('dataset'), archive.get('revision'))
    if identity == ('KaraKaraWitch/TvTroper-2025', '4d0928d851db919985081118b1f7f85abf0a90fd'):
        return 2
    if identity == ('RyokoExtra/TvTroper', '65ca60f908e536ce4ec1ac123415596379f363cd'):
        return 1
    return 0


def _same_capture(old, incoming):
    if old.get('source_hash'):
        return old.get('source_hash') == incoming.get('source_hash')
    a, b = old.get('source_archive') or {}, incoming.get('source_archive') or {}
    return bool(a and b and all(a.get(k) == b.get(k) for k in ('provider_url', 'file_sha256', 'article_sha256')))


def choose_record(old, incoming, fields):
    """Prefer verified definitions over metadata-only captures, then compare definition source precedence.

    Filling a metadata-only page replaces its title and provenance with the complete incoming capture;
    an archive body must never inherit an unrelated HTTP hash. Metadata cannot erase an existing definition.
    """
    if old is None:
        return incoming, 'insert'
    if all(old.get(key) == incoming.get(key) for key in fields):
        return None, 'unchanged'
    if 'description' in fields:
        if old.get('description') is not None and incoming.get('description') is None:
            return None, 'definition_preserved'
        if old.get('description') is None and incoming.get('description') is not None:
            return incoming, 'fill_description'
    if _same_capture(old, incoming):
        return None, 'same_capture_preserved'
    old_rank, rank = source_priority(old), source_priority(incoming)
    if rank > old_rank:
        return incoming, 'higher_priority'
    if rank == old_rank == 3 and incoming['fetched_at'] > old.get('fetched_at', 0):
        return incoming, 'newer_http'
    if rank < old_rank or (rank == old_rank == 3 and incoming['fetched_at'] < old.get('fetched_at', 0)):
        return None, 'older_source_preserved'
    return None, 'equal_priority_conflict'


def _epoch(value):
    if isinstance(value, datetime):
        return int((value if value.tzinfo else value.replace(tzinfo=timezone.utc)).timestamp() * 1000)
    if isinstance(value, dict):
        return {k: _epoch(v) for k, v in value.items()}
    return value


def _read(db, table, key, values, batch_size):
    found = {}
    for start in range(0, len(values), batch_size):
        batch = values[start:start + batch_size]
        marks = ','.join('?' for _ in batch)
        for row in db.select(f'SELECT {key},_doc AS actual_doc FROM {table} WHERE {key} IN ({marks})', tuple(batch)):
            found[row[key]] = _epoch(row['actual_doc'])
    return found


def _create_sql(table):
    spec = SCHEMAS[table]
    definitions = [f'{key} {kind}' for key, kind in spec['columns'].items()]
    return f"CREATE TABLE IF NOT EXISTS {table} (" + ', '.join(definitions + [f"PRIMARY KEY ({','.join(spec['primary_key'])})"]) + f") CLUSTERED INTO {spec['shards']} SHARDS"


def _archive_mapping(db, table):
    actual = {row['column_name']: row['data_type'] for row in db.select(
        'SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=? AND table_name=?', ('doc', table))}
    missing = [k for k, kind in ARCHIVE_COLUMN_TYPES.items() if actual.get(f"source_archive['{k}']") != kind.lower()]
    if missing:
        raise ValueError(f'{table} needs explicitly typed archive children before writes: ' + ', '.join(missing))


def _write_sql(table, key, fields, incoming, old):
    if old is None:
        sql = f"INSERT INTO {table} ({','.join(fields)},imported_at,updated_at) VALUES (" + ','.join('?' for _ in fields) + ',current_timestamp,current_timestamp) ON CONFLICT DO NOTHING'
        return sql, tuple(incoming.get(f) for f in fields)
    update_fields = [f for f in fields if f != key]
    sql = f"UPDATE {table} SET " + ','.join(f'{f}=?' for f in update_fields) + ',updated_at=current_timestamp WHERE ' + key + '=?'
    params = [incoming.get(f) for f in update_fields] + [incoming[key]]
    guards = {f: old.get(f) for f in fields if f not in (key, 'source_archive')}
    guards.update({f: old.get(f) for f in ('imported_at', 'updated_at')})
    if old.get('source_archive') is None:
        guards['source_archive'] = None
    else:
        guards.update({f"source_archive['{k}']": old['source_archive'].get(k) for k in ARCHIVE_COLUMN_TYPES})
    for f, value in sorted(guards.items()):
        sql += ' AND ' + f + (' IS NULL' if value is None else '=?')
        if value is not None:
            params.append(value)
    return sql, tuple(params)


def _verify(actual, incoming, old, fields):
    if actual is None or any(actual.get(f) != incoming.get(f) for f in fields):
        return False
    if actual.get('updated_at') is None:
        return False
    if old is None:
        return actual.get('imported_at') is not None
    extra = set(old) | set(actual)
    return (all(old.get(k) == actual.get(k) for k in extra - set(fields) - {'updated_at'})
            and (old.get('updated_at') is None or actual['updated_at'] >= old['updated_at']))


def import_document(db, document, *, apply=False, batch_size=25, bulk_inserts=False, on_event=lambda event: None):
    """Import reviewed pages/routes. Bulk mode groups fresh inserts only; guarded updates stay single-row.

    Receipt callbacks run for every row before the request; uncertain writes are never retried.
    """
    if not 1 <= batch_size <= 200:
        raise ValueError('batch_size must be 1–200')
    if bulk_inserts and not callable(getattr(db, 'run_many', None)):
        raise ValueError('Explicit bulk insert mode requires a run_many adapter returning per-row results')
    document = normalize_document(document)
    exists = {r['table_name'] for r in db.select('SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_name IN (?,?)', ('doc', PAGE_TABLE, REFERENCE_TABLE))}
    snapshots = {}
    for table, key, fields, part in TABLES:
        snapshots[table] = _read(db, table, key, [r[key] for r in document[part]], batch_size) if table in exists else {}
    # References can only point to a reviewed page supplied now or already stored.
    targets = {r['canonical_url'] for r in document['references']} - {r['url'] for r in document['pages']}
    known_targets = _read(db, PAGE_TABLE, 'url', sorted(targets), batch_size) if PAGE_TABLE in exists else {}
    if targets - set(known_targets):
        raise ValueError('Reference target has no reviewed page: ' + ', '.join(sorted(targets - set(known_targets))[:5]))
    plans = []; report = {'apply': apply, 'pages': len(document['pages']), 'references': len(document['references']), 'writes': 0, 'unchanged': 0, 'preserved': 0, 'conflicts': [], 'verified': False, 'bulk_inserts': bulk_inserts}
    for table, key, fields, part in TABLES:
        for incoming in document[part]:
            old = snapshots[table].get(incoming[key]); desired, reason = choose_record(old, incoming, fields)
            if desired is not None:
                plans.append({'table': table, 'key': key, 'fields': fields, 'incoming': desired, 'before': old, 'reason': reason})
            elif reason == 'unchanged': report['unchanged'] += 1
            else:
                report['preserved'] += 1
                if reason in ('equal_priority_conflict', 'same_capture_preserved'):
                    report['conflicts'].append({'table': table, 'key': incoming[key], 'reason': reason})
    report['writes'] = len(plans)
    report['plan_sha256'] = hashlib.sha256(json.dumps(plans, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    on_event({'phase': 'planned', 'report': report.copy(), 'plans': plans})
    if not apply:
        return report
    attempted_write = False
    try:
        for table, key, fields, part in TABLES:
            if table not in exists:
                on_event({'phase': 'before_schema', 'table': table}); attempted_write = True; db.run(_create_sql(table))
            if any(p['table'] == table and p['incoming'].get('source_archive') is not None for p in plans):
                _archive_mapping(db, table)
        for start in range(0, len(plans), batch_size):
            batch = plans[start:start + batch_size]
            position = 0
            while position < len(batch):
                plan = batch[position]
                sql, params = _write_sql(plan['table'], plan['key'], plan['fields'], plan['incoming'], plan['before'])
                group = [(start + position, plan, params)]
                if bulk_inserts and plan['before'] is None:
                    while position + len(group) < len(batch):
                        following = batch[position + len(group)]
                        if following['before'] is not None or following['table'] != plan['table']:
                            break
                        next_sql, next_params = _write_sql(following['table'], following['key'], following['fields'], following['incoming'], None)
                        if next_sql != sql:
                            break
                        group.append((start + position + len(group), following, next_params))
                use_bulk = bulk_inserts and plan['before'] is None
                indexes = [index for index, _, _ in group]
                for index, item, _ in group:
                    on_event({'phase': 'before_write', 'index': index, 'table': item['table'], 'key': item['incoming'][item['key']],
                              'bulk_insert': use_bulk, 'group_indexes': indexes})
                try:
                    attempted_write = True
                    if use_bulk:
                        response = db.run_many(sql, [values for _, _, values in group])
                        results = response.get('results') if isinstance(response, dict) else None
                        if (not isinstance(results, list) or len(results) != len(group)
                                or any(not isinstance(r, dict) or r.get('error') or type(r.get('rowcount')) is not int or r['rowcount'] != 1 for r in results)):
                            raise PageImportWriteError('Bulk insert did not acknowledge exactly one row for every fresh key')
                    else:
                        response = db.run(sql, params)
                        if response.get('rowcount') != 1:
                            raise PageImportWriteError('Guard did not acknowledge exactly one row')
                except BaseException as error:
                    on_event({'phase': 'uncertain_write', 'index': indexes[0], 'group_indexes': indexes, 'error_type': type(error).__name__})
                    raise PageImportWriteError('Page/reference write result is uncertain; inspect receipts and stored documents before any retry') from None
                for index in indexes:
                    on_event({'phase': 'acknowledged', 'index': index, 'rowcount': 1})
                position += len(group)
            for table, key, fields, part in TABLES:
                selected = [p for p in batch if p['table'] == table]
                if not selected: continue
                db.run(f'REFRESH TABLE {table}')
                actual = _read(db, table, key, [p['incoming'][key] for p in selected], batch_size)
                for p in selected:
                    if not _verify(actual.get(p['incoming'][key]), p['incoming'], p['before'], fields):
                        raise PageImportWriteError('Stored full-document verification failed; inspect receipts before retrying')
                on_event({'phase': 'verified_batch', 'table': table, 'documents': actual})
        report['verified'] = True
        on_event({'phase': 'complete', 'report': report.copy()})
        return report
    except PageImportWriteError:
        raise
    except BaseException:
        if attempted_write:
            raise PageImportWriteError('Page/reference mutation or readback result is uncertain; inspect durable receipts before retrying') from None
        raise


def main():
    """Importable Windmill library; reviewed writes use import_document with durable caller receipts."""
    pass
