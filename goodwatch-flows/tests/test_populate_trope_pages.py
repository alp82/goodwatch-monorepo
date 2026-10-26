"""URI population uses the same durable source-policy loop as label population."""
import gzip
import hashlib
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest

FLOWS = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(FLOWS / 'windmill'), str(FLOWS / 'scripts')]
from populate_trope_pages import PageCatalog, inventory_urls
from populate_trope_catalog import atomic_json, run
from recover_tvtropes import LocalClient

BASE = 'https://tvtropes.org/pmwiki/pmwiki.php/Main/'


class Database:
    def __init__(self):
        self.references = set()

    def select(self, sql, params=()):
        if 'JOIN trope_catalog_page' not in sql:
            raise AssertionError(sql)
        return [{'reference_url': url} for url in params if url in self.references]


class Catalog(PageCatalog):
    @staticmethod
    def restore(document):
        return document

    @staticmethod
    def write(db, documents):
        for document in documents:
            for reference in document['references']:
                db.references.add(reference['reference_url'])


class PagePopulationTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.inventory = self.root / 'inventory.json'
        self.inventory.write_text(json.dumps([
            {'name': 'Contextual text', 'url': BASE + 'MultipleEndings'},
            {'name': 'Another label', 'url': BASE + 'MultipleEndings'},
            {'name': 'No known URL', 'url': None},
            {'name': 'A work', 'url': 'https://tvtropes.org/pmwiki/pmwiki.php/Film/AWork'},
        ]))
        self.db = Database()
        self.catalog = Catalog([self.inventory])

    def tearDown(self):
        self.temp.cleanup()

    def test_queue_deduplicates_by_known_uri_not_contextual_label(self):
        self.assertEqual(inventory_urls([self.inventory]), [BASE + 'MultipleEndings'])
        rows = self.catalog.prepare(self.db, self.root / 'run')
        self.assertEqual(rows, [{'name': BASE + 'MultipleEndings', 'url': BASE + 'MultipleEndings'}])
        self.assertEqual(rows, self.catalog.prepare(self.db, self.root / 'run'))

    def test_changed_inventory_or_saved_queue_fails_closed(self):
        output = self.root / 'run'
        self.catalog.prepare(self.db, output)
        self.inventory.write_text('[]')
        with self.assertRaises(ValueError):
            self.catalog.prepare(self.db, output)
        self.inventory.write_text(json.dumps([{'url': BASE + 'MultipleEndings'}]))
        with self.assertRaises(ValueError):
            self.catalog.prepare(self.db, output, refresh=True)

    def test_reconcile_requeues_missing_page_and_marks_external_fill(self):
        entries = [{'name': BASE + 'One', 'url': BASE + 'One'}, {'name': BASE + 'Two', 'url': BASE + 'Two'}]
        self.db.references.add(BASE + 'Two')
        events = []
        self.catalog.reconcile(self.db, entries, {BASE + 'One': {'status': 'stored'}},
                               lambda row, status, **kw: events.append((row['url'], status)))
        self.assertEqual(events, [(BASE + 'One', 'queued'), (BASE + 'Two', 'already_present')])

    def test_record_preserves_real_heading_and_separate_reference(self):
        result = {'canonical_url': BASE + 'Canonical', 'heading': 'Actual title', 'description': 'Actual source introduction.'}
        record = self.catalog.record({'url': BASE + 'Old'}, result,
                                      {'sha256': 'a' * 64, 'started_at': '2026-10-25T00:00:00+00:00'}, None)
        self.assertEqual(record['pages'][0]['title'], 'Actual title')
        self.assertEqual({r['reference_url'] for r in record['references']}, {BASE + 'Old', BASE + 'Canonical'})
        self.assertEqual({r['canonical_url'] for r in record['references']}, {BASE + 'Canonical'})
        with self.assertRaises(ValueError):
            self.catalog.record({'url': BASE + 'Old'}, result, {}, None)

    def test_cached_source_replay_and_restart_make_no_http_requests(self):
        output = self.root / 'run'
        output.mkdir()
        body = b'Actual complete source introduction for the linked page.'
        digest = hashlib.sha256(body).hexdigest()
        source = output / 'sources' / (digest + '.html.gz')
        source.parent.mkdir()
        source.write_bytes(gzip.compress(body))
        event = {'requested_url': BASE + 'MultipleEndings', 'url': BASE + 'MultipleEndings',
                 'status': 200, 'sha256': digest, 'source_file': 'sources/' + source.name,
                 'started_at': '2026-10-25T00:00:00+00:00'}
        (output / 'requests.jsonl').write_text(json.dumps(event) + '\n')
        class NoHTTP:
            def get(self, *args, **kwargs):
                raise AssertionError('Cached source must never be refetched')
        def extractor(html, name, final_url, **kwargs):
            return {'canonical_url': final_url, 'heading': 'Multiple Endings', 'description': html, 'error': None}
        options = dict(catalog=self.catalog, extractor=extractor,
                       state_path=self.root / 'state.json', lock_path=self.root / 'lock',
                       pace_path=self.root / 'pace', emit=lambda value: None)
        report = run(self.db, output, client=LocalClient(source.parent, 6, 1, http=NoHTTP()), **options)
        self.assertEqual(report['phase'], 'complete')
        self.assertEqual(report['stored'], 1)
        self.assertEqual(report['requests_this_run'], 0)
        again = run(self.db, output, client=LocalClient(source.parent, 6, 1, http=NoHTTP()), **options)
        self.assertEqual(again['phase'], 'complete')
        self.assertEqual(again['requests_this_run'], 0)
        ready = [json.loads(line) for line in (output / 'outcomes.jsonl').read_text().splitlines()
                 if json.loads(line)['status'] == 'ready'][0]
        self.assertEqual(ready['record']['pages'][0]['title'], 'Multiple Endings')
        self.assertEqual(ready['record']['pages'][0]['fetched_at'], event['started_at'])

    def test_shared_block_prevents_even_cached_import(self):
        output = self.root / 'run'
        state = self.root / 'state.json'
        atomic_json(state, {'blocked_until': '2099-01-01T00:00:00+00:00'})
        def extractor(*args, **kwargs):
            raise AssertionError('Blocked source must not reach extraction')
        report = run(self.db, output, catalog=self.catalog, extractor=extractor,
                     state_path=state, lock_path=self.root / 'lock', pace_path=self.root / 'pace',
                     emit=lambda value: None)
        self.assertEqual(report['stop'], 'source_blocked_until_recorded_deadline')
        self.assertEqual(report['requests_this_run'], 0)


if __name__ == '__main__':
    unittest.main()
