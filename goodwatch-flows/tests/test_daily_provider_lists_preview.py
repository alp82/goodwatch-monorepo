"""Opt-in Windmill previews. All data adapters and HTTP are in-memory fixtures."""
import json
import os
from pathlib import Path
import sys
import time
import types
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen


def preview_source():
    root = Path(__file__).parents[1] / 'windmill/f'
    sources = {name: (root / path).read_text() for name, path in {
        'f.tmdb_api.provider_evidence': 'tmdb_api/provider_evidence.py',
        'f.sync.availability_history': 'sync/availability_history.py',
        'daily_job': 'tmdb_api/daily_provider_lists.py',
    }.items()}
    return '''# extra_requirements:
# pydantic==2.12.3
import sys, types
from datetime import datetime
from copy import deepcopy
from contextlib import contextmanager
SOURCES = ''' + repr(sources) + '''
for name, source in SOURCES.items():
    module = types.ModuleType(name)
    sys.modules[name] = module
    exec(compile(source, name, 'exec'), module.__dict__)
publish_history = sys.modules['f.sync.availability_history'].publish_history
PRIMARY_KEY = sys.modules['f.sync.availability_history'].PRIMARY_KEY
run_daily_lists = sys.modules['daily_job'].run_daily_lists

def main():
    class API:
        ids = []
        results = {}
        def get(self, path, **params):
            if path.startswith('/discover/'):
                return dict(page=1, total_pages=1 if self.ids else 0, total_results=len(self.ids),
                            results=[dict(id=i) for i in self.ids])
            return dict(id=int(path.split('/')[2]), results=deepcopy(self.results))
    class Storage:
        def __init__(self): self.state, self.history = {}, {}
        @contextmanager
        def lease(self, *args): yield lambda: None
        def load(self, identity): return deepcopy(self.state.get(identity))
        def pending(self, identity): return set()
        def stage(self, identity, ids, dry): pass
        def details(self, media, ids): return {}
        def save(self, identity, value): self.state[identity] = deepcopy(value)
        def run(self, sql): assert sql == 'REFRESH TABLE availability_history'
        def select(self, sql, params): return list(deepcopy(self.history).values())
        def upsert_many(self, table, records, **kwargs):
            assert table == 'availability_history'
            for record in records:
                row = record.model_dump()
                self.history[tuple(row[k] for k in PRIMARY_KEY)] = row
        def publish(self, media, title, owned, dry):
            if not dry:
                result = publish_history(self, media, [title], owned)
                assert not result.errors
        def flush(self, dry): pass
    api, store = API(), Storage()
    for day, present in [(13, False), (14, True), (15, False), (16, True)]:
        api.ids = [42] if present else []
        api.results = {'US': {'flatrate': [{'provider_id': 8}]}} if present else {}
        report = run_daily_lists(api, store, countries=['US'], provider_ids=[8], media_types=['show'],
                                 dry_run=False, now=datetime(2026, 10, day, 20))
        assert report['lists_failed'] == 0
    rows = list(store.history.values())
    assert len(rows) == 2
    assert rows[0]['appeared_precision'] == rows[0]['dropped_precision'] == 'exact'
    assert rows[1]['appeared_precision'] == 'exact'
    before = deepcopy(store.state), deepcopy(store.history)
    run_daily_lists(api, store, countries=['US'], provider_ids=[8], media_types=['show'],
                    dry_run=True, now=datetime(2026, 10, 17, 20))
    assert before == (store.state, store.history)
    return {'ok': True, 'production_data_writes': 0, 'stays': 2}
'''


class LocalPreviewTests(unittest.TestCase):
    def test_preview_fixture_executes_the_checkout_entrypoint_and_writer(self):
        module = types.ModuleType('inert_preview')
        with patch.dict(sys.modules):
            exec(compile(preview_source(), 'inert_preview', 'exec'), module.__dict__)
            self.assertEqual(module.main(), {'ok': True, 'production_data_writes': 0, 'stays': 2})


@unittest.skipUnless(os.environ.get('TEST_WINDMILL_PREVIEW') == '1', 'Opt in to inert Windmill previews')
class WindmillPreviewTests(unittest.TestCase):
    def api(self, path, body=None):
        base = os.environ['BASE_INTERNAL_URL'].rstrip('/') + '/api/w/' + os.environ['WM_WORKSPACE']
        request = Request(base + path, data=json.dumps(body).encode() if body is not None else None,
                          headers={'Authorization': 'Bearer ' + os.environ['WM_TOKEN'], 'Content-Type': 'application/json'})
        with urlopen(request, timeout=30) as response:
            content = response.read().decode()
            try:
                return json.loads(content)
            except ValueError:
                return content.strip('"')

    def completed(self, job, success=True):
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            status = self.api('/jobs_u/get/' + job)
            if status.get('type') == 'CompletedJob':
                self.assertEqual(status.get('success'), success, status.get('logs'))
                return status['result']
            time.sleep(1)
        self.fail('Inert preview timed out: ' + job)

    def test_checkout_code_runs_with_only_in_memory_adapters(self):
        job = self.api('/jobs/run/preview', dict(content=preview_source(), language='python3',
            path='f/tmdb_api/daily_provider_lists_inert_preview', args={}))
        self.assertEqual(self.completed(job), {'ok': True, 'production_data_writes': 0, 'stays': 2})

    def preview_flow(self, failed):
        from windmill_preview import load_flow
        flow = load_flow('f/tmdb_api/read_daily_provider_lists')
        module = flow['value']['modules'][0]
        module['value'] = dict(type='rawscript', language='python3', lock='',
            input_transforms=module['value']['input_transforms'],
            content='def main(countries=None, provider_ids=None, dry_run=True, requests_per_second=15, max_requests=350000):\n'
                    '    assert dry_run is True and countries == ["US"] and provider_ids == [8]\n'
                    f'    return dict(lists_completed=1, lists_failed={failed}, lists=[])\n')
        job = self.api('/jobs/run/preview_flow', dict(value=flow['value'], schema=flow['schema'],
            args=dict(countries=['US'], provider_ids=[8], dry_run=True, requests_per_second=15, max_requests=350000),
            path='f/tmdb_api/daily_provider_lists_flow_inert_preview'))
        return self.completed(job, success=not failed)

    def test_flow_passes_arguments_and_returns_success(self):
        self.assertEqual(self.preview_flow(0)['lists_completed'], 1)

    def test_flow_marks_an_incomplete_list_run_failed(self):
        self.assertIn('1 daily lists failed', str(self.preview_flow(1)))

    def test_flow_omitted_inputs_keep_read_only_defaults(self):
        from windmill_preview import load_flow
        flow = load_flow('f/tmdb_api/read_daily_provider_lists')
        module = flow['value']['modules'][0]
        module['value'] = dict(type='rawscript', language='python3', lock='',
            input_transforms=module['value']['input_transforms'],
            content='def main(countries=None, provider_ids=None, dry_run=True, requests_per_second=15, max_requests=350000):\n'
                    '    assert countries is None and provider_ids is None\n'
                    '    assert dry_run is True and requests_per_second == 15 and max_requests == 350000\n'
                    '    return dict(lists_completed=0, lists_failed=0, lists=[])\n')
        job = self.api('/jobs/run/preview_flow', dict(value=flow['value'], schema=flow['schema'],
            args={}, path='f/tmdb_api/daily_provider_lists_defaults_inert_preview'))
        self.assertEqual(self.completed(job)['lists_failed'], 0)


if __name__ == '__main__':
    unittest.main()
