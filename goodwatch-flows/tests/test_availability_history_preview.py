"""Opt-in Windmill runtime check; preview code uses only in-memory fixtures.

Set TEST_WINDMILL_PREVIEW=1, BASE_INTERNAL_URL, WM_WORKSPACE and WM_TOKEN.
Submits a temporary job, never deploys a script or connects to a database.
"""
import json
import os
from pathlib import Path
import time
import unittest
from urllib.request import Request, urlopen

ROOT = Path(__file__).parents[1] / 'windmill/f'


@unittest.skipUnless(os.environ.get('TEST_WINDMILL_PREVIEW') == '1', 'Opt in to the Windmill preview job')
class HistoryPreviewTests(unittest.TestCase):
    def test_preview_executes_checkout_history_with_in_memory_connector(self):
        sources = {name: (ROOT / path).read_text() for name, path in {
            'f.tmdb_api.provider_evidence': 'tmdb_api/provider_evidence.py',
            'history_under_test': 'sync/availability_history.py',
        }.items()}
        content = '''# extra_requirements:
# pydantic==2.12.3
import sys, types
from datetime import datetime
SOURCES = ''' + repr(sources) + '''
for name, source in SOURCES.items():
    module = types.ModuleType(name)
    sys.modules[name] = module
    exec(compile(source, name, 'exec'), module.__dict__)
from history_under_test import publish_history, KEY
from f.tmdb_api.provider_evidence import capture_provider_check

def main():
    class Memory:
        def __init__(self): self.rows = []
        def run(self, sql): assert sql == 'REFRESH TABLE availability_history'
        def select(self, sql, params): return self.rows
        def upsert_many(self, **kwargs): self.rows = [r.model_dump() for r in kwargs['records']]
    db = Memory()
    before = capture_provider_check({'id': 42, 'watch/providers': {'results': {}}},
        42, datetime(2026, 10, 14), bypass_cache=True)
    payload = {'results': {'US': {'flatrate': [{'provider_id': 8}]}}}
    proof = capture_provider_check({'id': 42, 'watch/providers': payload},
        42, datetime(2026, 10, 15), bypass_cache=True, previous=before)
    row = dict(zip(KEY, [42, 'show', 'US', 8, 'flatrate']))
    publish_history(db, 'show', [(42, {'watch_providers': payload, 'watch_providers_check': proof},
        {tuple(row[k] for k in KEY): row}, {}, [], [])], lambda: None)
    assert len(db.rows) == 1 and db.rows[0]['appeared_precision'] == 'exact'
    return {'ok': True, 'production_data_writes': 0}
'''
        base = os.environ['BASE_INTERNAL_URL'].rstrip('/') + '/api/w/' + os.environ['WM_WORKSPACE']
        def api(path, body=None):
            request = Request(base + path, data=json.dumps(body).encode() if body else None,
                              headers={'Authorization': 'Bearer ' + os.environ['WM_TOKEN'],
                                       'Content-Type': 'application/json'})
            with urlopen(request, timeout=30) as response:
                data = response.read().decode()
                try:
                    return json.loads(data)
                except ValueError:
                    return data.strip('"')
        job = api('/jobs/run/preview', {'content': content, 'language': 'python3',
                                       'path': 'f/sync/availability_history_preview', 'args': {}})
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            status = api('/jobs_u/get/' + job)
            if status.get('type') == 'CompletedJob':
                self.assertTrue(status.get('success'), status.get('logs'))
                self.assertEqual(status.get('result'), {'ok': True, 'production_data_writes': 0})
                return
            time.sleep(1)
        self.fail('Windmill preview did not complete within 180 seconds: ' + job)
