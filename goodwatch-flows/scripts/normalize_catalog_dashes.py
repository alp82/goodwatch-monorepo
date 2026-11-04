#!/usr/bin/env python3
"""Normalize published prose in Crate and generated DNA in Mongo. Preview by default.

--apply requires --output for durable preimages and a per-batch journal. Compare-and-set
updates preserve concurrent crawler writes. Re-run after conflicts or transport failures.
Raw TMDB/TV Tropes captures, names, URLs, vectors and provenance are never rewritten.
"""
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import sys
from urllib.request import Request, urlopen

FLOWS = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(FLOWS / 'windmill'), str(FLOWS / 'scripts')]
from import_trope_catalog import Crate, settings
from f.sync.catalog_text import PROSE_FIELDS, normalize_row, normalize_text
from f.sync.models.crate_schemas import SCHEMAS
from f.tvtropes_catalog.description_docs import validate_description_doc

MAX_ROWS = 1_000_000
BATCH_SIZE = 200
READ_BATCH_SIZE = 1000


class LongReadCrate(Crate):
    def _sql(self, sql, params=(), *, bulk=False):
        # Use one coordinator; never replay ambiguous writes.
        request = Request(self.urls[0], data=json.dumps({
            'stmt': sql, 'bulk_args' if bulk else 'args': list(params),
        }).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Basic ' + self.auth})
        try:
            with urlopen(request, timeout=240) as response:
                return json.load(response)
        except Exception as error:
            raise RuntimeError(f'Crate request failed ({type(error).__name__}); inspect the journal and rerun') from None


    def run_many(self, sql, params):
        response = self._sql(sql, params, bulk=True)
        results = response.get('results', [])
        if len(results) != len(params):
            raise RuntimeError('Incomplete bulk response; inspect state before rerunning')
        for item in results:
            error = item.get('error') or item.get('error_message')
            message = str(error or '')
            # Crate can return a per-item exception rather than zero for a stale CAS/deleted row.
            if any(name in message for name in ('VersionConflictEngineException', 'DocumentMissingException')):
                item['rowcount'] = 0
            elif error or item.get('rowcount') not in (0, 1):
                raise RuntimeError(f'Bulk update failed: {message[:600]} (rowcount={item.get("rowcount")})')
        return response


def predicate(fields):
    terms = [f'strpos("{c}", ?) > 0' for c in fields]
    args = ['\u2014'] * len(fields)
    if 'description_doc' in fields:
        terms.append('strpos("description_doc", ?) > 0')
        args.append('\\u2014')
    return ' OR '.join(terms), args


def correction(table, row):
    normalized = normalize_row(table, row)
    changes = {c: normalized[c] for c in PROSE_FIELDS[table] if normalized[c] != row[c]}
    if 'description_doc' in changes and changes['description_doc'] is not None:
        validate_description_doc(json.loads(changes['description_doc']))
    if 'description' in changes:
        changes['description_hash'] = hashlib.sha256(changes['description'].encode()).hexdigest()
    return changes


def update_statement(table, row, changes):
    keys = SCHEMAS[table]['primary_key']
    columns = sorted(changes)
    sql = (f'UPDATE "{table}" SET ' + ','.join(f'"{c}"=?' for c in columns)
           + ' WHERE ' + ' AND '.join(f'"{c}"=?' for c in keys)
           + ' AND _seq_no=? AND _primary_term=?')
    return sql, [changes[c] for c in columns] + [row[k] for k in keys] + [row['_seq_no'], row['_primary_term']]


def durable_json(path, value):
    with path.open('x') as handle:
        json.dump(value, handle, indent=2)
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())


def preimages(path, rows, *, mongo=False):
    from bson import json_util
    # BSON's encoder preserves ObjectIds; catalog values use ordinary JSON.
    with path.open('xb') as raw:
        with gzip.GzipFile(fileobj=raw, mode='wb') as compressed:
            for row in rows:
                text = json_util.dumps(row) if mongo else json.dumps(row, ensure_ascii=False)
                compressed.write((text + '\n').encode())
        raw.flush()
        os.fsync(raw.fileno())


def journal(output, value):
    if output:
        with (output / 'journal.jsonl').open('a') as handle:
            handle.write(json.dumps(value) + '\n')
            handle.flush()
            os.fsync(handle.fileno())
    print(json.dumps(value), flush=True)


def candidate_rows(db, table, fields, where, args, output=None):
    keys = SCHEMAS[table]['primary_key']
    key_object = '{' + ','.join(f'"{k}"="{k}"' for k in keys) + '}'
    candidates = db.select(
        f'SELECT array_agg({key_object}) FILTER (WHERE {where}) AS candidates FROM "{table}"', args,
    )[0]['candidates'] or []
    if len(candidates) >= MAX_ROWS:
        raise RuntimeError('Candidate read reached its limit')
    columns = list(dict.fromkeys([*keys, *fields, *(['description_hash'] if 'description' in fields else [])]))
    projection = ','.join(f'"{c}"' for c in columns) + ',_seq_no,_primary_term'
    rows = []
    # Aggregation filters source prose on the shards. Numeric-ID lookups avoid the
    # expensive compound-key OR plans; the full requested keys still scope the result.
    lookup_key = next((k for k in ('tmdb_id', 'media_tmdb_id') if k in keys), keys[0])
    for offset in range(0, len(candidates), READ_BATCH_SIZE):
        batch = candidates[offset:offset+READ_BATCH_SIZE]
        requested = {tuple(r[k] for k in keys) for r in batch}
        values = list(dict.fromkeys(r[lookup_key] for r in batch))
        fetched = db.select(f'SELECT {projection} FROM "{table}" WHERE "{lookup_key}"=ANY(?) LIMIT {MAX_ROWS}', [values])
        if len(fetched) >= MAX_ROWS:
            raise RuntimeError('Keyed source read reached its limit')
        rows.extend(r for r in fetched if tuple(r[k] for k in keys) in requested)
        if offset % 10_000 == 0 or offset+READ_BATCH_SIZE >= len(candidates):
            journal(output, {'table': table, 'read': len(rows), 'candidate_keys': len(candidates)})
    return rows


def run_crate(db, tables, output=None, *, apply=False):
    report = {}
    for table in tables:
        fields = PROSE_FIELDS[table]
        where, args = predicate(fields)
        count = db.select(f'SELECT count(*) AS n FROM "{table}" WHERE {where}', args)[0]['n']
        journal(output, {'table': table, 'before': count})
        report[table] = {'before': count}
        if not apply or not count:
            continue
        if count >= MAX_ROWS:
            raise RuntimeError('Too many candidates; raise the reviewed bound before proceeding')
        rows = candidate_rows(db, table, fields, where, args, output)
        # Validate every document before any update to this table.
        plans = [(row, correction(table, row)) for row in rows]
        preimages(output / (table + '.before.jsonl.gz'), rows)
        applied = conflicts = 0
        for offset in range(0, len(plans), BATCH_SIZE):
            groups = {}
            for row, changes in plans[offset:offset+BATCH_SIZE]:
                if changes:
                    sql, values = update_statement(table, row, changes)
                    groups.setdefault(sql, []).append(values)
            for sql, values in groups.items():
                result = db.run_many(sql, values)
                for item in result['results']:
                    n = item.get('rowcount')
                    if n not in (0, 1):
                        raise RuntimeError('Unexpected update count')
                    applied += n
                    conflicts += 1 - n
            journal(output, {'table': table, 'processed': min(offset+BATCH_SIZE, len(plans)),
                             'applied': applied, 'conflicts': conflicts})
        db.run(f'REFRESH TABLE "{table}"')
        remaining = db.select(f'SELECT count(*) AS n FROM "{table}" WHERE {where}', args)[0]['n']
        report[table].update(applied=applied, conflicts=conflicts, remaining=remaining)
        journal(output, {'table': table, **report[table]})
    return report


def variable(name):
    if name in os.environ:
        return os.environ[name]
    profiles = Path.home() / '.config/windmill/remotes.ndjson'
    profile = next(json.loads(line) for line in profiles.read_text().splitlines()
                   if json.loads(line).get('name') == 'goodwatch')
    req = Request(f"{profile['remote'].rstrip('/')}/api/w/{profile['workspaceId']}/variables/get_value/u/Alp/{name}",
                  headers={'Authorization': 'Bearer ' + profile['token']})
    with urlopen(req, timeout=20) as response:
        return json.load(response)


def run_mongo(output=None, *, apply=False):
    from pymongo import MongoClient
    from urllib.parse import quote_plus
    user, password, hosts, database, replica = [variable('MONGODB_'+n) for n in ('USER','PASS','HOSTS','DB','RS')]
    uri = f'mongodb://{quote_plus(user)}:{quote_plus(password)}@{hosts}/{database}'
    report = {}
    with MongoClient(uri, replicaSet=replica, serverSelectionTimeoutMS=15000, socketTimeoutMS=240000) as client:
        for name in ('dna_movie', 'dna_tv'):
            coll = client[database][name]
            match = {'dna.essence_text': {'$regex': '\u2014'}}
            count = coll.count_documents(match)
            report[name] = {'before': count}
            journal(output, {'collection': name, 'before': count})
            if not apply or not count:
                continue
            rows = list(coll.find(match, {'dna.essence_text': 1}))
            preimages(output / (name + '.before.jsonl.gz'), rows, mongo=True)
            applied = 0
            for row in rows:
                old = row['dna']['essence_text']
                result = coll.update_one({'_id': row['_id'], 'dna.essence_text': old},
                                         {'$set': {'dna.essence_text': normalize_text(old)}})
                applied += result.modified_count
            report[name].update(applied=applied, remaining=coll.count_documents(match))
            journal(output, {'collection': name, **report[name]})
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--mongo', action='store_true', help='Include generated Mongo DNA essence text')
    parser.add_argument('--tables', nargs='+', choices=list(PROSE_FIELDS), default=list(PROSE_FIELDS))
    args = parser.parse_args()
    if args.apply and not args.output:
        parser.error('--apply requires --output')
    if args.output:
        args.output.mkdir(parents=True, exist_ok=False)
    report = {'started_at': datetime.now(timezone.utc).isoformat(), 'apply': args.apply}
    report['crate'] = run_crate(LongReadCrate(settings()), args.tables, args.output, apply=args.apply)
    if args.mongo:
        report['mongo'] = run_mongo(args.output, apply=args.apply)
    if args.output:
        durable_json(args.output / 'report.json', report)
    if args.apply and any(x.get('remaining', 0) for backend in ('crate', 'mongo') for x in report.get(backend, {}).values()):
        raise SystemExit('Concurrent changes remain; inspect the report and rerun')


if __name__ == '__main__':
    main()
