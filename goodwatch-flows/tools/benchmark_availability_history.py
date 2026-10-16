"""Measure the full writer before/after on disposable local Crate, never production.

TEST_CRATE_URL=http://127.0.0.1:16881 python tools/benchmark_availability_history.py --baseline-ref <commit>
Uses the fake Mongo seam by default; TEST_MONGO_URL enables disposable local Mongo.
Always uses the real SQL adapter. Seed 200 titles x 50
countries. Timed runs compare identical fresh daily reads and 1% offer changes.
"""
import argparse
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'tests'), str(ROOT / 'windmill')]
import mongomock
from pymongo import MongoClient
from urllib.parse import urlparse
from test_availability_history_integration import LocalCrate
from f.sync.copy import tmdb_streaming as after
from f.sync.init.cratedb import create_table_sql
from f.sync.models.crate_schemas import SCHEMAS
from f.tmdb_api.provider_evidence import capture_provider_check


def measure(writer, name, rounds):
    crate = LocalCrate(os.environ['TEST_CRATE_URL'], f'bench681_{name}_{uuid4().hex[:8]}_')
    mongo_url = os.environ.get('TEST_MONGO_URL')
    if mongo_url and urlparse(mongo_url).hostname not in ('localhost', '127.0.0.1'):
        raise ValueError('Benchmark requires disposable localhost Mongo')
    mongo = MongoClient(mongo_url) if mongo_url else mongomock.MongoClient()
    db = mongo['history_benchmark_' + uuid4().hex]
    for collection in (db.tmdb_tv_details, db.tmdb_tv_providers):
        collection.create_index([('updated_at', 1), ('tmdb_id', 1)])
        collection.create_index([('tmdb_id', 1)])
    for table in crate.tables:
        crate.run(create_table_sql(table, SCHEMAS[table] | {'shards': 1, 'replicas': '0'}))
    crate.run("INSERT INTO streaming_service (tmdb_id, media_type, name) VALUES (8, 'show', 'Netflix'), (9, 'show', 'Amazon')")
    crate.run('REFRESH TABLE streaming_service')
    countries = [chr(65 + i // 26) + chr(65 + i % 26) for i in range(50)]
    base = datetime.utcnow()
    try:
        for i in range(rounds * 2 + 1):
            at = base + timedelta(days=i)
            changed = i > rounds
            for tmdb_id in range(1, 201):
                # Replace the service on all 50 offers for two titles: 100/10,000 (1%).
                service = 8 if not changed or tmdb_id > 2 or i % 2 else 9
                payload = {'results': {country: {'link': 'https://tmdb', 'flatrate': [
                    {'provider_id': service, 'display_priority': 1}]} for country in countries}}
                old = db.tmdb_tv_details.find_one({'tmdb_id': tmdb_id}) or {}
                proof = capture_provider_check({'id': tmdb_id, 'watch/providers': payload}, tmdb_id, at,
                    previous=old.get('watch_providers_check'), bypass_cache=True)
                db.tmdb_tv_details.replace_one({'tmdb_id': tmdb_id}, {'tmdb_id': tmdb_id,
                    'updated_at': at, 'watch_providers': payload, 'watch_providers_check': proof}, upsert=True)
            start = time.perf_counter()
            with patch.object(writer, 'get_db', return_value=db):
                result = writer.copy_media(crate, {}, 'show', recent_only=True)
                assert result['shows']['rows_upserted'] == 200
            elapsed = time.perf_counter() - start
            yield ('seed' if i == 0 else 'one_percent_change' if changed else 'unchanged_fresh_read'), elapsed
    finally:
        for table in reversed(crate.tables):
            crate.run('DROP TABLE ' + table)
        crate.disconnect()
        mongo.drop_database(db.name)
        mongo.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline-ref', required=True)
    parser.add_argument('--rounds', type=int, default=5)
    args = parser.parse_args()
    source = subprocess.check_output(['git', 'show', args.baseline_ref + ':goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py'])
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'before.py'
        path.write_bytes(source)
        spec = importlib.util.spec_from_file_location('history_writer_before', path)
        before = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(before)
        with contextlib.redirect_stdout(io.StringIO()):
            generators = {'before': measure(before, 'before', args.rounds), 'after': measure(after, 'after', args.rounds)}
            samples = {name: {'unchanged_fresh_read': [], 'one_percent_change': []} for name in generators}
            try:
                for i in range(args.rounds * 2 + 1):
                    # Pair identical rounds and alternate execution order to avoid
                    # attributing machine load/GC drift to one implementation.
                    for name in (('before', 'after') if i % 2 else ('after', 'before')):
                        case, elapsed = next(generators[name])
                        if case != 'seed':
                            samples[name][case].append(elapsed)
            finally:
                for generator in generators.values():
                    generator.close()
            result = {name: {case: {'seconds': values, 'median_seconds': statistics.median(values)}
                             for case, values in cases.items()} for name, cases in samples.items()}
            result['paired_median_overhead_percent'] = {
                case: statistics.median([(a / b - 1) * 100 for a, b in zip(samples['after'][case], samples['before'][case])])
                for case in samples['before']}

    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
