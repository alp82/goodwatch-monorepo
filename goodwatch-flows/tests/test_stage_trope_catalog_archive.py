"""Archive staging proves original bytes and identity without writes or invented dates."""
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path[:0] = [str(Path(__file__).resolve().parents[1] / 'scripts'), str(Path(__file__).resolve().parent)]
import stage_trope_catalog_archive as stage
from test_trope_archive_descriptions import record, URL, LEAD

REVISION = 'a' * 40


def sha(value):
    return hashlib.sha256(value).hexdigest()


def fixture(directory, records):
    directory.mkdir()
    lines = [(json.dumps(row, ensure_ascii=False) + '\n').encode() for row in records]
    original = b'{"ns":"Film"}\n' + b''.join(lines)
    (directory / 'chunk.jsonl').write_bytes(original)
    manifest = {'repository': 'owner/dataset', 'revision': REVISION, 'file': 'RawPages/chunk.jsonl',
                'immutable_public_url': f'https://huggingface.co/datasets/owner/dataset/resolve/{REVISION}/RawPages/chunk.jsonl',
                'size_bytes': len(original), 'sha256': sha(original), 'whole_file_verified': True, 'records_usable': True,
                'retrieved_at': '2026-10-25T20:54:21.154579+00:00', 'original_tvtropes_capture_time': None,
                'provenance': 'published_third_party_archive_not_original_http_capture', 'main_records': len(records)}
    (directory / 'manifest.json').write_text(json.dumps(manifest))
    offset = len(b'{"ns":"Film"}\n')
    ledger = []
    for number, (row, line) in enumerate(zip(records, lines), 1):
        ledger.append({'main_record_number': number, 'source_byte_offset': offset, 'source_line_bytes': len(line),
                       'raw_record_sha256': sha(line), 'article_utf8_sha256': sha(row['article'].encode()),
                       'ns': row['ns'], 'id': row['id'], 'corpus_revision': REVISION,
                       'corpus_file_sha256': sha(original), 'original_tvtropes_capture_time': None})
        offset += len(line)
    with gzip.open(directory / 'Main.raw-records.jsonl.gz', 'wb') as handle:
        handle.write(b''.join(lines))
    save_ledger(directory, ledger)
    return manifest, ledger


def save_ledger(directory, ledger):
    with gzip.open(directory / 'Main.ledger.jsonl.gz', 'wt') as handle:
        for row in ledger:
            handle.write(json.dumps(row) + '\n')


class CandidateMetadataTests(unittest.TestCase):
    def assert_equivalent(self, html, chunk_size=4096):
        expected = stage._soup_candidate_urls(html)
        self.assertEqual(stage._observed_candidate_urls(html, chunk_size=chunk_size), expected)
        return expected

    def test_metadata_survives_all_incremental_chunk_boundaries_and_stops_early(self):
        html = '<div><!--before--><p class="hidden" id="current_url">  ' + URL + '  </p><div>Rest of a very large article</div>'
        for size in (1, 2, 3, 7, 31, 4096):
            with self.subTest(size=size), patch.object(stage, '_soup_candidate_urls', side_effect=AssertionError('unnecessary DOM parse')):
                self.assertEqual(stage._observed_candidate_urls(html, chunk_size=size), {URL.casefold()})

    def test_comment_and_script_lookalikes_are_not_metadata(self):
        fake = URL.replace('ExactlyWhatIAimedAt', 'FalseSubject')
        html = f'''<!--<p id="current_url">{fake}</p>--><script>const example = "<p id=\'current_url\'>{fake}</p>";</script><p id="current_url">{URL}</p>'''
        self.assertEqual(self.assert_equivalent(html, 3), {URL.casefold()})

    def test_textarea_lookalike_is_not_an_actual_metadata_element(self):
        html = '<textarea><p id="current_url">https://tvtropes.org/pmwiki/pmwiki.php/Main/FalseSubject</p></textarea><p id="current_url">' + URL + '</p>'
        self.assertEqual(self.assert_equivalent(html, 2), {URL.casefold()})

    def test_nested_comments_and_missing_close_use_browser_fallback(self):
        for html in ('<p id="current_url">' + URL,
                     '<p id="current_url">' + URL + '<div>Implicitly closes the paragraph</div>',
                     '<p id="current_url"><span>' + URL + '</span></p>',
                     '<p id="current_url">' + URL + '<!-- comment --></p>',
                     '<span id="current_url">' + URL + '</span>',
                     '<p id="current_url">' + URL + '</div>', '<p>No metadata here.</p>'):
            with self.subTest(html=html), patch.object(stage, '_soup_candidate_urls', wraps=stage._soup_candidate_urls) as fallback:
                self.assert_equivalent(html, 3)
                self.assertEqual(fallback.call_count, 2)  # expected baseline plus actual fallback

    def test_unicode_backslashes_and_entities_receive_only_html_parsing(self):
        for text in (URL, URL.replace('https:', 'http:'), URL + '\\u0041', URL + 'é', URL + '?x=1&amp;y=2'):
            with self.subTest(text=text):
                self.assert_equivalent('<p id="current_url">' + text + '</p>', 1)


class ArchiveStagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.chunk, self.output = self.root / 'chunk', self.root / 'output'
        self.catalog = [{'name': 'Exactly What I Aimed At', 'url': URL}]

    def run_stage(self, records=None):
        fixture(self.chunk, [record()] if records is None else records)
        return stage.stage_archive(self.chunk, self.catalog, self.output)

    def test_valid_identity_preserves_plain_text_and_unknown_capture_time(self):
        report = self.run_stage()
        rows = json.loads((self.output / 'records.json').read_text())
        self.assertEqual(report['accepted'], 1)
        self.assertEqual(report['records_sha256'], sha((self.output / 'records.json').read_bytes()))
        self.assertIsNone(rows[0]['fetched_at'])
        self.assertIsNone(rows[0]['source_hash'])
        self.assertIn(LEAD, rows[0]['description'])
        self.assertEqual(json.loads(rows[0]['description_doc'])['source'], 'archive')
        self.assertIn(LEAD, json.loads(rows[0]['description_doc'])['blocks'][0]['text'])
        self.assertEqual(rows[0]['source_archive']['revision'], REVISION)
        self.assertGreater(rows[0]['source_archive']['byte_offset'], 0)
        self.assertEqual(rows[0]['source_archive']['article_sha256'], sha(record()['article'].encode()))

    def test_duplicate_identical_text_keeps_first_original_locator(self):
        report = self.run_stage([record(), record()])
        self.assertEqual((report['accepted'], report['identical_duplicates']), (1, 1))
        rows = json.loads((self.output / 'records.json').read_text())
        self.assertEqual(rows[0]['source_archive']['byte_offset'], len(b'{"ns":"Film"}\n'))

    def test_identical_plain_text_with_different_links_is_a_conflict(self):
        other = record(record()['article'].replace('The character', '<a href="/pmwiki/pmwiki.php/Main/Hero">The character</a>'))
        report = self.run_stage([record(), other])
        self.assertEqual((report['accepted'], report['conflict_names']), (0, 1))

    def test_conflicting_definitions_quarantine_every_candidate(self):
        other = record(record()['article'].replace(LEAD, 'Another complete definition changes the explanation of this narrative convention.'))
        report = self.run_stage([record(), other, record()])
        self.assertEqual((report['accepted'], report['conflict_names'], report['conflict_candidates']), (0, 1, 3))
        self.assertEqual(json.loads((self.output / 'records.json').read_text()), [])
        self.assertEqual(len(json.loads((self.output / 'review.json').read_text())[0]['candidates']), 3)

    def test_candidate_selection_does_not_replace_identity_validation(self):
        row = record(record()['article'].replace('Exactly What I Aimed At</span>', 'Unrelated Name</span>'))
        report = self.run_stage([row])
        self.assertEqual((report['accepted'], report['rejected']), (0, 1))

    def test_original_id_candidates_support_verified_alias_route(self):
        row = record(record()['article'].replace('</span>\n<div class="watch_rank_wrap">', '</span><div class="aka-title">(aka: Original Name)</div>\n<div class="watch_rank_wrap">'))
        row['id'] = 'OriginalName'
        self.catalog = [{'name': 'Original Name', 'url': URL.rsplit('/', 1)[0] + '/OriginalName'}]
        report = self.run_stage([row])
        self.assertEqual(report['accepted'], 1)
        self.assertEqual(json.loads((self.output / 'records.json').read_text())[0]['url'], URL)

    def test_literal_backslashes_unicode_and_quotes_are_not_redecoded(self):
        text = 'A naïve character says "C:\\new\\file" and leaves the literal \\u0041 sequence alone.'
        row = record(record()['article'].replace(LEAD, text))
        self.run_stage([row])
        self.assertIn(text, json.loads((self.output / 'records.json').read_text())[0]['description'])

    def test_tampered_original_digest_fails_without_import_artifacts(self):
        fixture(self.chunk, [record()])
        path = self.chunk / 'chunk.jsonl'
        data = path.read_bytes()
        path.write_bytes(b'X' + data[1:])
        with self.assertRaisesRegex(ValueError, 'SHA256 mismatch'):
            stage.stage_archive(self.chunk, self.catalog, self.output)
        self.assertFalse((self.output / 'records.json').exists())

    def test_record_article_and_locator_integrity_fail_closed(self):
        for field, value, message in [('raw_record_sha256', '0' * 64, 'Raw record SHA256'),
                                      ('article_utf8_sha256', '0' * 64, 'Article UTF8 SHA256'),
                                      ('source_byte_offset', 1, 'byte slice mismatch'),
                                      ('source_line_bytes', 1, 'byte locator')]:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                chunk = Path(directory) / 'chunk'
                _, ledger = fixture(chunk, [record()])
                ledger[0][field] = value
                save_ledger(chunk, ledger)
                with self.assertRaisesRegex(ValueError, message):
                    stage.stage_archive(chunk, self.catalog, Path(directory) / 'output')
                self.assertFalse((Path(directory) / 'output/records.json').exists())

    def test_mutable_provider_reference_rejected(self):
        manifest, _ = fixture(self.chunk, [record()])
        manifest['immutable_public_url'] = manifest['immutable_public_url'].replace(REVISION, 'main')
        (self.chunk / 'manifest.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'does not pin'):
            stage.stage_archive(self.chunk, self.catalog, self.output)

    def test_ledger_cannot_smuggle_its_own_self_consistent_raw_record(self):
        _, ledger = fixture(self.chunk, [record()])
        forged = record(record()['article'].replace(LEAD, 'A fabricated but plausible definition must never enter the verified catalog.'))
        line = (json.dumps(forged) + '\n').encode()
        with gzip.open(self.chunk / 'Main.raw-records.jsonl.gz', 'wb') as handle:
            handle.write(line)
        ledger[0].update(source_line_bytes=len(line), raw_record_sha256=sha(line), article_utf8_sha256=sha(forged['article'].encode()))
        save_ledger(self.chunk, ledger)
        with self.assertRaises(ValueError):
            stage.stage_archive(self.chunk, self.catalog, self.output)

    def test_size_and_main_record_count_mismatches_fail_before_output(self):
        for field, value, message in [('size_bytes', 1, 'file size mismatch'), ('main_records', 2, 'record count')]:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                chunk, output = Path(directory) / 'chunk', Path(directory) / 'output'
                manifest, _ = fixture(chunk, [record()])
                manifest[field] = value
                (chunk / 'manifest.json').write_text(json.dumps(manifest))
                with self.assertRaisesRegex(ValueError, message):
                    stage.stage_archive(chunk, self.catalog, output)
                self.assertFalse((output / 'records.json').exists())

    def test_raw_ledger_length_mismatch_cannot_truncate_the_run(self):
        fixture(self.chunk, [record(), record()])
        with gzip.open(self.chunk / 'Main.ledger.jsonl.gz', 'rt') as handle:
            first = json.loads(next(handle))
        save_ledger(self.chunk, [first])
        with self.assertRaisesRegex(ValueError, 'count mismatch'):
            stage.stage_archive(self.chunk, self.catalog, self.output)
        self.assertFalse((self.output / 'records.json').exists())

    def test_known_url_slug_case_is_only_candidate_normalization(self):
        self.catalog[0]['url'] = URL.rsplit('/', 1)[0] + '/exactlywhatiaimedat'
        self.assertEqual(self.run_stage()['accepted'], 1)

    def test_cli_only_queries_missing_catalog_and_never_calls_write_api(self):
        fixture(self.chunk, [record()])
        owner = self
        class ReadOnlyDB:
            def select(self, sql, params=()):
                owner.assertTrue(sql.startswith('SELECT name,url FROM trope_catalog WHERE description IS NULL'))
                return owner.catalog
            def run(self, *args):
                raise AssertionError('Unexpected database write')
            run_many = run
        with patch.object(stage, 'Crate', return_value=ReadOnlyDB()), patch.object(stage, 'settings', return_value={}), patch.object(sys, 'argv', ['stage', str(self.chunk), '--output', str(self.output)]):
            self.assertEqual(stage.main()['accepted'], 1)


if __name__ == '__main__':
    unittest.main()
