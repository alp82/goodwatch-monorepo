"""Backfill tests use only fake Crate and HTTP; fixtures are hand-written."""
from copy import deepcopy
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from urllib.error import HTTPError
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'windmill')]
import backfill_trope_description_docs as b
from f.tvtropes_catalog.catalog import normalize_record
URL = 'https://tvtropes.org/pmwiki/pmwiki.php/Main/Signal'
OTHER = 'https://tvtropes.org/pmwiki/pmwiki.php/Main/Beacon'

def row(name='Signal', url=URL, text='A small signal fixture.', **extra):
    return normalize_record({'name': name, 'url': url, 'description': text, **extra})

def archive(raw, article='fixture'):
    revision = 'a' * 40
    return {'provider': 'huggingface', 'dataset': 'Example/Archive', 'revision': revision,
            'provider_url': f'https://huggingface.co/datasets/Example/Archive/resolve/{revision}/part.jsonl',
            'payload_kind': 'article_html_fragment', 'file_sha256': 'b' * 64,
            'record_sha256': b.sha(raw), 'article_sha256': b.sha(article.encode()),
            'retrieved_at': '2026-10-25T20:00:00Z', 'byte_offset': 0, 'byte_length': len(raw)}

class MemoryCrate:
    def __init__(self, rows):
        self.rows = {r['name']: deepcopy(r) for r in rows}
        self.writes, self.reads, self.race = [], [], None
        self.columns = {'name': 'text'}
    def select(self, sql, params=()):
        self.reads.append(sql)
        if 'information_schema.columns' in sql:
            return [{'column_name': n, 'data_type': t} for n, t in self.columns.items()]
        if 'ORDER BY name' in sql:
            after = params[0] if len(params) == 2 else ''
            return [deepcopy(r) for n, r in sorted(self.rows.items()) if n > after][:params[-1]]
        if '_doc AS actual_doc' in sql:
            return [{'name': n, 'actual_doc': deepcopy(self.rows[n])} for n in params if n in self.rows]
        return [deepcopy(self.rows[n]) for n in params if n in self.rows]
    def run(self, sql, params=()):
        self.writes.append((sql, params))
        if sql.startswith('ALTER TABLE'):
            self.columns['description_doc'] = 'text'
        if sql.startswith('UPDATE'):
            if self.race:
                self.race(self)
                self.race = None
            text, doc, digest, source, source_hash, fetched_at, source_archive, name, url, expected = params
            current = self.rows.get(name)
            if current and current['url'] == url and current['description_hash'] == expected:
                current.update(description=text, description_doc=doc, description_hash=digest, source=source,
                               source_hash=source_hash, fetched_at=fetched_at, source_archive=source_archive)
    def run_many(self, sql, values):
        for value in values:
            self.run(sql, value)

class FakeCache:
    def __init__(self, error=None):
        self.error = error
    def prepare(self, archives):
        self.prepared = archives
    def record(self, archive):
        if self.error:
            raise ValueError(self.error)
        return {}

class PlainTests(unittest.TestCase):
    def doc(self, text, names=None):
        return b.plain_document(text, b.NameLinks(names or {'Beacon': OTHER, 'Bright Signal': URL}), URL)
    def test_paragraphs(self):
        self.assertEqual([x['text'] for x in self.doc(' One  line\nnext.\n\nTwo.')['blocks']], ['One line next.', 'Two.'])
    def test_boilerplate(self):
        for text in ('Warning: some spoiler ahead', 'Examples of this trope may contain spoilers', 'This trope is inherently a spoiler', 'Due to the nature of this trope, beware'):
            self.assertEqual(len(self.doc(text + '\n\nKept.')['blocks']), 1)
    def test_list_intro_raw_items_and_stop(self):
        blocks = self.doc('Compare:\n\nBeacon — a light.\n\nSignal, when visible.\n\nSee also Beacon.')['blocks']
        self.assertEqual([x['kind'] for x in blocks], ['p', 'list', 'p'])
        self.assertEqual(blocks[1]['items'][0]['text'], 'Beacon — a light.')
        self.assertEqual(blocks[1]['items'][1]['depth'], 0)
    def test_heading(self):
        self.assertEqual(self.doc('Heading:\n\nOnly one.')['blocks'][0], {'kind': 'heading', 'text': 'Heading'})
    def test_list_colon_and_length_boundaries(self):
        blocks = self.doc('Start:\n\nOne.\n\nTwo.\n\nOther:\n\n' + 'x' * 321)['blocks']
        self.assertEqual([x['kind'] for x in blocks], ['p', 'list', 'heading', 'p'])
    def test_long_intro_list(self):
        self.assertEqual(self.doc('x' * 70 + ':\n\nOne.\n\nTwo.')['blocks'][1]['kind'], 'list')
    def test_utf16_plural(self):
        self.assertEqual(self.doc('😀 with Beacons.')['blocks'][0]['links'], [[8, 15, OTHER]])
    def test_possessive(self):
        self.assertEqual(self.doc("with Beacon's glow.")['blocks'][0]['links'], [[5, 11, OTHER]])
    def test_first_mention_and_self(self):
        doc = self.doc('with Beacon and Bright Signal.\n\nwith Beacon.')
        self.assertEqual(sum(len(x.get('links', [])) for x in doc['blocks']), 1)
    def test_sentence_start_and_short_word(self):
        text = 'Beacon begins. Beacon again. with Cat and Beacon.'
        self.assertEqual(self.doc(text, {'Beacon': OTHER, 'Cat': URL})['blocks'][0]['links'], [[text.rindex('Beacon'), text.rindex('Beacon') + 6, OTHER]])
    def test_multiword_case_and_longest(self):
        self.assertEqual(self.doc('Bright beacon shines.', {'Bright Beacon': OTHER, 'Bright': URL})['blocks'][0]['links'], [[0, 13, OTHER]])
    def test_no_sentence_crossing(self):
        self.assertNotIn('links', self.doc('Bright. Beacon shines.', {'Bright. Beacon': OTHER})['blocks'][0])
    def test_unicode_capital_and_digit(self):
        links = self.doc('with Éclair and 7 Wonders.', {'Éclair': OTHER.replace('Beacon', 'Eclair'), '7 Wonders': URL})['blocks'][0]['links']
        self.assertEqual(len(links), 1)
    def test_sentence_fragments_stay_paragraphs_and_can_introduce_lists(self):
        for intro in ('Or', 'Well, usually one of two things',
                      'However, they all sport a few common ground rules',
                      'One two three four five six seven', 'lowercase heading',
                      'And', 'But', 'So', 'Also', 'Here', 'These', 'This', 'Some', 'Examples'):
            with self.subTest(intro=intro):
                self.assertEqual(self.doc(intro + ':')['blocks'][0], {'kind': 'p', 'text': intro + ':'})
                self.assertEqual([b['kind'] for b in self.doc(intro + ':\n\nOne.\n\nTwo.')['blocks']], ['p', 'list'])
        self.assertEqual(self.doc('One two three four five six:')['blocks'][0]['kind'], 'heading')

    def test_one_word_links_require_slug_identity(self):
        for name, slug in [('Western', 'TheWestern'), ('Japanese', 'JapaneseMedia'),
                           ('Video', 'VideogameCrueltyPotential'), ('French', 'FrancoBelgianComics'),
                           ('Hollywood', 'HollywoodTactics'), ('Space', 'SpaceX')]:
            with self.subTest(name=name):
                self.assertNotIn('links', self.doc('with ' + name + ' countries.', {name: OTHER.replace('Beacon', slug)})['blocks'][0])
        self.assertIn('links', self.doc('with Beacons.', {'Beacon': OTHER})['blocks'][0])
        self.assertIn('links', self.doc('with Bright Beacon.', {'Bright Beacon': OTHER})['blocks'][0])

    def test_boilerplate_only_rejected(self):
        with self.assertRaises(ValueError):
            self.doc('Warning: spoiler')

class GroupTests(unittest.TestCase):
    def test_longest_plain_shared_all_names(self):
        changes, skipped = b.build_changes([row(), row('Alias', text='with Beacon in a longer fixture.'), row('Beacon', OTHER, text=None)], FakeCache())
        self.assertEqual(skipped, [])
        self.assertEqual(len(changes), 2)
        self.assertEqual(changes[0]['new_document'], changes[1]['new_document'])
        self.assertIn('url_group_differing_texts', changes[0]['notes'])
        self.assertEqual(changes[0]['new_document']['blocks'][0]['links'][0][2], OTHER)
    def archive_rows(self):
        raw = b'{"ns":"Main","id":"Signal","article":"fixture"}\n'
        return [row(source_archive=archive(raw)), row('Alias', text='A much longer stored fixture description.')]
    def test_archive_wins_and_linked_retry(self):
        calls = []
        doc = {'v': 1, 'source': 'archive', 'blocks': [{'kind': 'p', 'text': 'Archive fixture that is longer than all stored text.'}]}
        def extract(*args, **kw):
            calls.append(kw)
            if not kw:
                return {'error': 'name rejected'}
            return {'description': 'Archive fixture that is longer than all stored text.', 'description_doc': doc, 'canonical_url': URL}
        changes, _ = b.build_changes(self.archive_rows(), FakeCache(), extract)
        self.assertEqual(calls, [{}, {'linked': True}])
        self.assertTrue(all(r['source'] == 'archive' and r['selected_archive'] for r in changes))
        self.assertTrue(all('description_text_changed' in r['notes'] for r in changes))
    def test_longest_stored_beats_short_archive_without_shortening(self):
        changes, _ = b.build_changes(self.archive_rows(), FakeCache(), lambda *a, **k: {
            'description': 'Short archive.', 'description_doc': {'v': 1, 'source': 'archive',
            'blocks': [{'kind': 'p', 'text': 'Short archive.'}]}, 'canonical_url': URL})
        originals = {r['name']: r for r in self.archive_rows()}
        self.assertTrue(all(c['source'] == 'plain' and c['selected_name'] == 'Alias' for c in changes))
        self.assertTrue(all(len(c['new_description']) >= len(originals[c['name']]['description']) for c in changes))

    def test_all_archives_tried_longest_and_name_ties(self):
        rows = [row('Alpha', text='Stored.', source_archive=archive(b'a')),
                row('Beta', text='Stored.', source_archive=archive(b'b')),
                row('Gamma', text='Stored.', source_archive=archive(b'c'))]
        calls = []
        def extract(record, name, url, **kw):
            calls.append(name)
            text = 'Short.' if name == 'Alpha' else 'Long archive candidate.'
            return {'description': text, 'description_doc': {'v': 1, 'source': 'archive',
                    'blocks': [{'kind': 'p', 'text': text}]}, 'canonical_url': url}
        changes, _ = b.build_changes(list(reversed(rows)), FakeCache(), extract)
        self.assertEqual(calls, ['Alpha', 'Beta', 'Gamma'])
        self.assertTrue(all(c['selected_name'] == 'Beta' for c in changes))
        self.assertTrue(all(c['selected_archive'] == rows[1]['source_archive'] for c in changes))

    def test_archive_wins_length_tie_and_self_links_removed(self):
        text = 'Stored fixture.'
        r = row(text=text, source_archive=archive(b'a'))
        doc = {'v': 1, 'source': 'archive', 'blocks': [{'kind': 'p', 'text': text, 'links': [[0, 6, URL]]},
               {'kind': 'list', 'items': [{'depth': 0, 'text': 'Signal', 'links': [[0, 6, URL]]}]}]}
        changes, _ = b.build_changes([r], FakeCache(), lambda *a, **k: {
            'description': text, 'description_doc': doc, 'canonical_url': URL})
        self.assertEqual(changes[0]['source'], 'archive')
        self.assertTrue(all('links' not in block for block in b.text_blocks(changes[0]['new_document'])))
        self.assertEqual(changes[0]['new_description'], text)
        self.assertEqual(changes[0]['new_provenance'], {})

    def test_stored_name_tie_is_deterministic(self):
        changes, _ = b.build_changes([row('Zulu', text='BBBB'), row('Alpha', text='AAAA')], FakeCache())
        self.assertTrue(all(c['new_description'] == 'AAAA' and c['selected_name'] == 'Alpha' for c in changes))

    def test_hash_mismatch_fallback(self):
        changes, _ = b.build_changes(self.archive_rows(), FakeCache('Raw record SHA256 mismatch'))
        self.assertTrue(all(r['source'] == 'plain' for r in changes))
        self.assertIn('mismatch', ' '.join(changes[0]['notes']))
    def test_fetch_failure_fallback(self):
        changes, _ = b.build_changes(self.archive_rows(), FakeCache('Archive retry limit reached'))
        self.assertTrue(all(r['source'] == 'plain' for r in changes))
        self.assertIn('retry limit', ' '.join(changes[0]['notes']))
    def test_extraction_failure_fallback(self):
        changes, _ = b.build_changes(self.archive_rows(), FakeCache(), lambda *a, **kw: {'error': 'rejected'})
        self.assertEqual(changes[0]['source'], 'plain')
    def test_stored_hash_mismatch(self):
        r = row()
        r['description_hash'] = '0' * 64
        changes, _ = b.build_changes([r], FakeCache())
        self.assertIn('stored_description_hash_mismatch', changes[0]['notes'])
    def test_empty_filtered_plain_skipped(self):
        changes, skipped = b.build_changes([row(text='Warning: spoiler')], FakeCache())
        self.assertEqual(changes, [])
        self.assertEqual(len(skipped), 1)

class Response(io.BytesIO):
    def __init__(self, data, start, end, status=206):
        super().__init__(data)
        self.status = status
        self.headers = {'Content-Range': f'bytes {start}-{end - 1}/{end}'}

class CacheTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.raw = b'{"ns":"Main","id":"Signal","article":"fixture"}\n'
        self.a = archive(self.raw)
    def test_range_sort_merge_cap_and_file(self):
        a = self.a
        self.assertEqual(b.merge_ranges([{**a, 'byte_offset': 200}, a, {**a, 'byte_offset': 100}], gap=1000), [(a['provider_url'], 0, 200 + len(self.raw))])
        self.assertEqual(len(b.merge_ranges([a, {**a, 'byte_offset': 200}], gap=1)), 2)
        self.assertEqual(len(b.merge_ranges([a, {**a, 'byte_offset': 200}], gap=1000, max_bytes=100)), 2)
        self.assertEqual(len(b.merge_ranges([a, {**a, 'provider_url': 'other'}])), 2)
    def test_cache_resume_no_http(self):
        requests = []
        def open_(req, **kw):
            requests.append(req.get_header('Range'))
            return Response(self.raw, 0, len(self.raw))
        cache = b.ArchiveCache(self.tmp.name, opener=open_, sleep=lambda _: None)
        cache.prepare([self.a, self.a])
        self.assertEqual(cache.record(self.a)['article'], 'fixture')
        resumed = b.ArchiveCache(self.tmp.name, opener=lambda *a, **k: self.fail('HTTP on resume'))
        resumed.prepare([self.a])
        self.assertEqual(resumed.record(self.a)['id'], 'Signal')
        self.assertEqual(requests, [f'bytes=0-{len(self.raw) - 1}'])
        self.assertTrue((Path(self.tmp.name) / 'progress.json').exists())
    def test_merged_slice_records(self):
        payload = self.raw + b'gap\n' + self.raw
        second = {**self.a, 'byte_offset': len(self.raw) + 4}
        opened = []
        def open_(*args, **kwargs):
            opened.append(True)
            return Response(payload, 0, len(payload))
        cache = b.ArchiveCache(self.tmp.name, opener=open_, sleep=lambda _: None)
        cache.prepare([second, self.a])
        self.assertEqual(cache.record(second), cache.record(self.a))
        self.assertEqual(len(opened), 1)
    def test_record_and_article_hashes(self):
        cache = b.ArchiveCache(self.tmp.name, opener=lambda *a, **k: Response(self.raw, 0, len(self.raw)), sleep=lambda _: None)
        cache.prepare([self.a])
        for field in ('record_sha256', 'article_sha256'):
            with self.assertRaisesRegex(ValueError, 'mismatch'):
                cache.record({**self.a, field: '0' * 64})
    def test_corrupt_cache_refetched(self):
        opened = []
        def open_(*args, **kw):
            opened.append(True)
            return Response(self.raw, 0, len(self.raw))
        cache = b.ArchiveCache(self.tmp.name, opener=open_, sleep=lambda _: None)
        cache.prepare([self.a])
        cache.paths(cache.ranges[0])[0].write_bytes(b'corrupt')
        cache.prepare([self.a])
        self.assertEqual(len(opened), 2)
    def test_retry_after(self):
        delays, calls = [], []
        def open_(*args, **kw):
            calls.append(True)
            if len(calls) == 1:
                raise HTTPError('https://huggingface.co/x', 429, 'slow', {'Retry-After': '3'}, None)
            return Response(self.raw, 0, len(self.raw))
        b.ArchiveCache(self.tmp.name, opener=open_, sleep=delays.append).prepare([self.a])
        self.assertIn(3, delays)
        self.assertEqual(len(calls), 2)
    def test_fatal_status(self):
        for status in (401, 403, 404):
            def open_(*args, **kw):
                raise HTTPError('https://huggingface.co/x', status, 'blocked', {}, None)
            with self.assertRaisesRegex(b.FatalArchiveError, str(status)):
                b.ArchiveCache(self.tmp.name, opener=open_, sleep=lambda _: None).prepare([self.a])
    def test_server_errors_retry_then_fallback(self):
        calls, delays = [], []
        def open_(*args, **kw):
            calls.append(True)
            raise HTTPError('https://huggingface.co/x', 503, 'unavailable', {}, None)
        cache = b.ArchiveCache(self.tmp.name, opener=open_, sleep=delays.append, retries=2, pace=0)
        cache.prepare([self.a])
        self.assertEqual(len(calls), 3)
        self.assertIn(2, delays)
        with self.assertRaisesRegex(ValueError, 'retry limit'):
            cache.record(self.a)
    def test_ignored_range(self):
        cache = b.ArchiveCache(self.tmp.name, opener=lambda *a, **k: Response(self.raw, 0, len(self.raw), 200), sleep=lambda _: None)
        cache.prepare([self.a])
        with self.assertRaisesRegex(ValueError, 'honor'):
            cache.record(self.a)
    def test_redirect_to_tvtropes_refused(self):
        with self.assertRaises(b.FatalArchiveError):
            b.ArchiveRedirects().redirect_request(None, None, 302, '', {}, URL)

class PlanApplyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'stage'
        self.db = MemoryCrate([row(), row('Alias', text='A longer hand-written fixture description.')])
        b.plan(self.db, FakeCache(), self.path)
    def test_plan_shape_manifest_read_only(self):
        changes, manifest = b.load_staging(self.path)
        self.assertEqual(len(changes), 2)
        self.assertEqual(len(manifest), 64)
        self.assertEqual(self.db.writes, [])
        self.assertEqual(changes[0]['old_description_hash'], self.db.rows['Alias']['description_hash'])
        self.assertIn('Opening:', (self.path / 'samples.md').read_text())
    def test_provenance_and_idempotence(self):
        before = deepcopy(self.db.rows)
        report = b.apply(self.db, self.path, batch_size=1)
        self.assertEqual(report['written'], 2)
        for name, r in self.db.rows.items():
            for field in ('name', 'url', 'source', 'source_hash', 'fetched_at', 'source_archive'):
                self.assertEqual(r[field], before[name][field])
        count = len(self.db.writes)
        again = b.apply(self.db, self.path)
        self.assertEqual((again['written'], again['unchanged']), (0, 2))
        self.assertEqual(len(self.db.writes), count)
        self.assertEqual(len(report['schema_changes']), 1)
    def test_plan_rejects_shortening_except_removed_boilerplate(self):
        changes, _ = b.load_staging(self.path)
        changes[0]['new_description'] = 'Short.'
        with patch.object(b, 'build_changes', return_value=(changes, [])):
            with self.assertRaisesRegex(ValueError, 'shorten'):
                b.plan(self.db, FakeCache(), self.path.parent / 'bad')
        b.assert_no_shortening('Warning: spoilers\n\nKept prose.', 'Kept prose.', 'Fixture')
        for old, new in [('Lost prose.\n\nKept prose.', 'Kept prose.'),
                         ('Warning: spoilers\n\nKept prose.', 'Other prose.')]:
            with self.assertRaisesRegex(ValueError, 'shorten'):
                b.assert_no_shortening(old, new, 'Fixture')

    def test_copied_crawl_provenance_and_unchanged_text_preserved(self):
        donor = row('Alias', text='Longer crawl fixture description.', source_hash='a' * 64, fetched_at='2026-10-25T20:00:00Z')
        recipient = row(source_archive=archive(b'a'))
        same = row('Same', text=donor['description'], source_hash='b' * 64, fetched_at='2026-10-24T20:00:00Z')
        db = MemoryCrate([recipient, donor, same])
        stage = self.path.parent / 'crawl'
        b.plan(db, FakeCache('invalid'), stage)
        b.apply(db, stage)
        for field in b.PROVENANCE:
            self.assertEqual(db.rows['Signal'][field], donor[field])
            self.assertEqual(db.rows['Same'][field], same[field])
        self.assertEqual(b.apply(db, stage)['unchanged'], 3)

    def test_copied_archive_provenance(self):
        donor = row('Alias', source_archive=archive(b'a'))
        recipient = row(source_hash='b' * 64, fetched_at='2026-10-24T20:00:00Z')
        text = 'Archive description longer than either stored fixture.'
        db = MemoryCrate([donor, recipient])
        stage = self.path.parent / 'archive'
        original = b.build_changes
        def extract(*args, **kwargs):
            return {'description': text, 'description_doc': {
                'v': 1, 'source': 'archive', 'blocks': [{'kind': 'p', 'text': text}]}, 'canonical_url': URL}
        with patch.object(b, 'build_changes', side_effect=lambda rows, cache: original(rows, cache, extract)):
            b.plan(db, FakeCache(), stage)
        b.apply(db, stage)
        self.assertEqual(db.rows['Signal']['source_archive'], donor['source_archive'])
        self.assertIsNone(db.rows['Signal']['source_hash'])
        self.assertIsNone(db.rows['Signal']['fetched_at'])
        self.assertEqual(b.apply(db, stage)['unchanged'], 2)

    def test_provenance_readback_failure_is_not_stale(self):
        original = self.db.run
        def corrupt(sql, params=()):
            result = original(sql, params)
            if sql.startswith('UPDATE'):
                for r in self.db.rows.values():
                    r['source_hash'] = 'f' * 64
            return result
        self.db.run = corrupt
        with self.assertRaisesRegex(RuntimeError, 'verification failed'):
            b.apply(self.db, self.path)

    def test_stale_hash_skipped(self):
        self.db.rows['Signal']['description_hash'] = 'f' * 64
        self.assertEqual(b.apply(self.db, self.path)['stale'], 1)
        self.assertEqual(self.db.rows['Signal']['description_hash'], 'f' * 64)
    def test_atomic_concurrent_guard(self):
        self.db.race = lambda db: db.rows['Signal'].update(description_hash='f' * 64)
        self.assertEqual(b.apply(self.db, self.path)['stale'], 1)
        self.assertEqual(self.db.rows['Signal']['description_hash'], 'f' * 64)
    def test_deleted_not_recreated(self):
        del self.db.rows['Signal']
        self.assertEqual(b.apply(self.db, self.path)['stale'], 1)
        self.assertNotIn('Signal', self.db.rows)
    def test_manifest_tamper_before_db(self):
        for file in b.FILES:
            original = (self.path / file).read_bytes()
            (self.path / file).write_bytes(original + b' ')
            reads = len(self.db.reads)
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                b.apply(self.db, self.path)
            self.assertEqual(len(self.db.reads), reads)
            self.assertEqual(self.db.writes, [])
            (self.path / file).write_bytes(original)
    def test_staging_without_reviewed_provenance_rejected_before_db(self):
        changes, _ = b.load_staging(self.path)
        del changes[0]['new_provenance']
        data = b''.join(json.dumps(r).encode() + b'\n' for r in changes)
        (self.path / 'changes.jsonl').write_bytes(data)
        manifest = json.loads((self.path / 'manifest.json').read_text())
        manifest['files']['changes.jsonl'] = b.sha(data)
        (self.path / 'manifest.json').write_text(json.dumps(manifest))
        reads = len(self.db.reads)
        with self.assertRaisesRegex(ValueError, 'invalid staging'):
            b.apply(self.db, self.path)
        self.assertEqual(len(self.db.reads), reads)
        self.assertEqual(self.db.writes, [])

    def test_incomplete_staging(self):
        (self.path / 'manifest.json').unlink()
        with self.assertRaises(ValueError):
            b.apply(self.db, self.path)
        self.assertEqual(self.db.writes, [])
    def test_resume_partial_write(self):
        original, count = self.db.run, 0
        def interrupted(sql, params=()):
            nonlocal count
            if sql.startswith('UPDATE'):
                count += 1
                if count == 2:
                    raise RuntimeError('interrupted')
            return original(sql, params)
        self.db.run = interrupted
        with self.assertRaises(RuntimeError):
            b.apply(self.db, self.path, batch_size=1)
        self.db.run = original
        report = b.apply(self.db, self.path)
        self.assertEqual((report['unchanged'], report['written']), (1, 1))
    def test_readback_failure(self):
        original = self.db.run
        self.db.run = lambda sql, params=(): None if sql.startswith('UPDATE') else original(sql, params)
        with self.assertRaisesRegex(RuntimeError, 'verification failed'):
            b.apply(self.db, self.path)
    def test_keyset_paging(self):
        self.assertEqual(len(b.read_catalog(self.db, page_size=1)), 2)
    def test_samples_deterministic(self):
        changes, _ = b.load_staging(self.path)
        self.assertEqual(b.sample_markdown(changes), b.sample_markdown(changes))
    def test_samples_bounded_with_many_hash_failures(self):
        changes, _ = b.load_staging(self.path)
        many = [{**changes[0], 'name': f'Fixture {i}', 'notes': [f'Fixture {i}: Raw record SHA256 mismatch']} for i in range(100)]
        sample = b.sample_markdown(many)
        self.assertEqual(sample.count('## Fixture'), 30)
    def test_guarded_import_requires_expected_names(self):
        with self.assertRaises(ValueError):
            b.import_records(self.db, [row()], apply=True, replace_descriptions=True, expected_hashes={})
    def test_nonempty_staging_refused(self):
        with self.assertRaisesRegex(ValueError, 'empty staging'):
            b.plan(self.db, FakeCache(), self.path)

if __name__ == '__main__':
    unittest.main()
