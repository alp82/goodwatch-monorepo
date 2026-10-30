"""Hand-written sources only: description documents, import guards and additive schema."""
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.tvtropes_catalog import descriptions
from f.tvtropes_catalog.description_docs import validate_description_doc, serialize_description_doc, wiki_link
from f.tvtropes_catalog.catalog import FIELDS, import_records, merged_record, normalize_record
from f.tvtropes_catalog.pages import PAGE_FIELDS, normalize_page, choose_record, import_document
from test_trope_descriptions import page, URL, LEAD
from test_trope_archive_descriptions import record as archive_record, URL as ARCHIVE_URL
from test_trope_document_archive_descriptions import document, URL as DOCUMENT_URL
from test_trope_catalog import Database, record, archive
from test_trope_pages import Database as PageDatabase, page as page_record
from test_trope_catalog_initializer import RecordingCrate, initialized_tables, run_initializer


def doc(text=LEAD, source='crawl'):
    return {'v': 1, 'source': source, 'blocks': [{'kind': 'p', 'text': text}]}



class DescriptionDocumentsTests(unittest.TestCase):
    def extract(self, body):
        result = descriptions.extract_description(page(body), 'Serious Business', URL)
        self.assertIsNone(result['error'])
        validate_description_doc(result['description_doc'])
        return result

    def test_inline_whitespace_and_utf16_links_spoilers_and_emphasis(self):
        body = '<p>😀 <a href="/pmwiki/pmwiki.php/Main/Hero?from=x#top"><em>un</em>kind</a> <span class="spoiler">secret <i>ending</i></span> is explained in enough detail here.</p><hr>'
        result = self.extract(body)
        block = result['description_doc']['blocks'][0]
        self.assertEqual(block['text'], result['description'])
        self.assertEqual(block['links'], [[3, 9, 'https://tvtropes.org/pmwiki/pmwiki.php/Main/Hero']])
        self.assertEqual(block['spoilers'], [[10, 23]])
        self.assertEqual(block['em'], [[3, 5], [17, 23]])

    def test_links_filter_meta_external_invalid_and_normalize_wiki_namespaces(self):
        targets = ['/pmwiki/pmwiki.php/Main/Hero?x=1#part',
                   'http://www.tvtropes.org/pmwiki/pmwiki.php/Film/Example',
                   '/pmwiki/pmwiki.php/Administrivia/TropesAreTools', 'https://example.com/out',
                   'javascript:alert(1)', '//tvtropes.org.evil/pmwiki/pmwiki.php/Main/Hero',
                   '/pmwiki/pmwiki.php/Main/Hero/extra', 'https://user@tvtropes.org/pmwiki/pmwiki.php/Main/Hero']
        result = self.extract('<p>' + LEAD + ' ' + ' '.join(f'<a href="{url}">word{i}</a>' for i, url in enumerate(targets)) + '</p>')
        block = result['description_doc']['blocks'][0]
        self.assertEqual([link[2] for link in block['links']], [URL.replace('SeriousBusiness', 'Hero'), 'https://tvtropes.org/pmwiki/pmwiki.php/Film/Example'])
        self.assertTrue(all('word'+str(i) in block['text'] for i in range(len(targets))))

    def test_self_links_use_final_canonical_url_and_keep_text_and_other_marks(self):
        result = self.extract(f'<p>{LEAD} <a href="{URL}?from=alias#part"><em>self link</em></a></p>'
                              f'<ul><li><a href="{URL}">self item</a></li></ul>')
        blocks = result['description_doc']['blocks']
        self.assertNotIn('links', blocks[0])
        self.assertIn('em', blocks[0])
        self.assertTrue(blocks[0]['text'].endswith('self link'))
        self.assertEqual(blocks[1]['items'], [{'depth': 0, 'text': 'self item'}])

    def test_letter_scripts_match_legacy_extractor_without_guessing_modifiers(self):
        result = self.extract(f'<p>{LEAD} *d<sup>h</sup>oh<sub>1</sub>mos.</p>')
        self.assertTrue(result['description'].endswith('*dhoh₁mos.'))
        self.assertEqual(result['description_doc']['blocks'][0]['text'], result['description'])

    def test_inline_edge_spaces_and_whitespace_only_marks_are_unmarked(self):
        for opening, closing, key in (
                ('<a href="Main/Hero">', '</a>', 'links'),
                ('<span class="spoiler">', '</span>', 'spoilers'),
                ('<em>', '</em>', 'em')):
            for marked, expected in ((' bar ', [[4, 7]]), (' ', [])):
                with self.subTest(key=key, marked=marked):
                    result = self.extract(f'<p>foo{opening}{marked}{closing}baz {LEAD}</p>')
                    block = result['description_doc']['blocks'][0]
                    self.assertEqual(block['text'], f'foo{marked}baz {LEAD}')
                    self.assertEqual([r[:2] for r in block.get(key, [])], expected)

    def test_collapsed_spaces_keep_only_marks_shared_by_neighbors(self):
        result = self.extract(f'<p><a href="Main/Hero"><em>one \n<span class="spoiler"> </span> two</em></a> '
                              f'<span class="spoiler">a <i> \t </i> b</span> {LEAD}</p>')
        block = result['description_doc']['blocks'][0]
        self.assertEqual(block['text'], f'one two a b {LEAD}')
        self.assertEqual(block['links'], [[0, 7, URL.replace('SeriousBusiness', 'Hero')]])
        self.assertEqual(block['em'], [[0, 7]])
        self.assertEqual(block['spoilers'], [[8, 11]])

    def test_marked_spaces_at_paragraph_and_list_item_edges_are_trimmed(self):
        result = self.extract(f'<p> \n<a href="Main/Hero"><span class="spoiler"><em> {LEAD} </em></span></a> \t</p>'
                              '<ul><li><em> one </em></li><li><em> </em>two<em> </em></li></ul>')
        block, listing = result['description_doc']['blocks']
        self.assertEqual(block['text'], LEAD)
        self.assertEqual(block['links'], [[0, len(LEAD), URL.replace('SeriousBusiness', 'Hero')]])
        self.assertEqual(block['spoilers'], [[0, len(LEAD)]])
        self.assertEqual(block['em'], [[0, len(LEAD)]])
        self.assertEqual(listing['items'], [{'depth': 0, 'text': 'one', 'em': [[0, 3]]},
                                           {'depth': 0, 'text': 'two'}])

    def test_notes_junk_and_numeric_scripts_share_plain_text_cleanup(self):
        notes = ''.join(f'<span class="{cls}">unwanted</span>' for cls in ('notelabel', 'inlinefolder', 'notetext', 'footnote', 'footnotes', 'reference'))
        result = self.extract(f'<p>{LEAD}{notes} 2<sup>2</sup> <span hidden>unwanted</span><script>unwanted</script></p>')
        self.assertEqual(result['description'], LEAD + ' 2²')
        self.assertEqual(result['description_doc']['blocks'], [{'kind': 'p', 'text': LEAD + ' 2²'}])

    def test_ul_ol_nested_lists_have_depth_and_plain_text_keeps_legacy_flattening(self):
        result = self.extract(f'<p>{LEAD}</p><p>Compare and contrast with:</p><ul><li>First <em>item</em><ol><li>Inner <a href="/pmwiki/pmwiki.php/Main/Hero">hero</a></li><li>Second inner</li></ol></li><li>Last item</li></ul><p>Closing prose.</p><hr>')
        blocks = result['description_doc']['blocks']
        self.assertEqual([b['kind'] for b in blocks], ['p', 'p', 'list', 'p'])
        self.assertEqual([(i['depth'], i['text']) for i in blocks[2]['items']], [(0, 'First item'), (1, 'Inner hero'), (1, 'Second inner'), (0, 'Last item')])
        self.assertEqual(blocks[2]['items'][0]['em'], [[6, 10]])
        self.assertIn('First itemInner heroSecond inner\n\nLast item', result['description'])
        self.assertEqual(blocks[1]['text'], 'Compare and contrast with:')

    def test_distinct_lists_wrapped_nested_lists_and_empty_parent_items(self):
        result = self.extract(f'<p>{LEAD}</p><ul><li>Outer<div><ul><li>Wrapped inner</li></ul></div>Tail</li></ul><ol><li><ul><li>Only inner</li></ul></li></ol>')
        lists = result['description_doc']['blocks'][1:]
        self.assertEqual(len(lists), 2)
        self.assertEqual([(i['depth'], i['text']) for i in lists[0]['items']], [(0, 'Outer'), (1, 'Wrapped inner'), (0, 'Tail')])
        self.assertEqual(lists[1]['items'], [{'depth': 1, 'text': 'Only inner'}])

    def test_orphan_li_stays_a_paragraph(self):
        result = self.extract(f'<li>{LEAD}</li>')
        self.assertEqual(result['description_doc'], doc())

    def test_sibling_nested_list_keeps_depth_in_one_list_block(self):
        result = self.extract(f'<p>{LEAD}</p><ul><li>A</li><ul><li>B</li></ul><li>C</li></ul>')
        self.assertEqual(result['description_doc']['blocks'][1:], [
            {'kind': 'list', 'items': [{'depth': 0, 'text': 'A'}, {'depth': 1, 'text': 'B'},
                                       {'depth': 0, 'text': 'C'}]}])
        self.assertEqual(result['description'], LEAD + '\n\nA\n\nB\n\nC')

    def test_bounded_continuation_outside_article_carries_document(self):
        # Put the continuation after the article, within main-content.
        html = page(f'<p>{LEAD}</p>').replace('</div></div></body>', '</div><p>Continuation with <i>emphasis</i>.</p><hr></div></body>')
        result = descriptions.extract_description(html, 'Serious Business', URL)
        self.assertIsNone(result['error'])
        self.assertEqual(result['description_doc']['blocks'][1], {'kind': 'p', 'text': 'Continuation with emphasis.', 'em': [[18, 26]]})

    def test_relative_wiki_link_and_adjacent_different_targets(self):
        result = self.extract(f'<p>{LEAD}<a href="Main/Hero">one</a><a href="Main/Villain">two</a></p>')
        links = result['description_doc']['blocks'][0]['links']
        self.assertEqual([link[2] for link in links], [URL.replace('SeriousBusiness', 'Hero'), URL.replace('SeriousBusiness', 'Villain')])
        self.assertEqual(links[0][1], links[1][0])

    def test_adjacent_anchors_to_same_target_keep_separate_ranges(self):
        result = self.extract(f'<p><a href="Main/Hero">one</a><a href="Main/Hero">two</a> {LEAD}</p>')
        self.assertEqual(result['description_doc']['blocks'][0]['links'], [
            [0, 3, URL.replace('SeriousBusiness', 'Hero')],
            [3, 6, URL.replace('SeriousBusiness', 'Hero')]])

    def test_nested_annotations_merge_without_overlapping_same_kind(self):
        result = self.extract(f'<p>{LEAD} <em>one <i>two</i> three</em> <span class="spoiler">a<span class="spoiler">b</span>c</span></p>')
        block = result['description_doc']['blocks'][0]
        self.assertEqual(len(block['em']), 1)
        self.assertEqual(len(block['spoilers']), 1)

    def test_bare_inline_runs_keep_word_joins_and_break_whitespace(self):
        result = self.extract(f'{LEAD} <em>un</em>kind<br>next<div><p>Last paragraph.</p></div>')
        self.assertEqual([b['text'] for b in result['description_doc']['blocks']], result['description'].split('\n\n'))
        self.assertIn('unkind next', result['description'])

    def test_skipped_paragraphs_and_intro_boundary_are_shared(self):
        for boundary in ('<h2>A short heading</h2>', '<hr>', '<div class="folderlabel">Examples</div>', '<p>Examples:</p>'):
            with self.subTest(boundary=boundary):
                result = self.extract(f'<p>"Quoted material."</p><p><img src="x">Image caption.</p><p>Advertisement:</p><p>{LEAD}</p>{boundary}<p>Excluded text.</p>')
                self.assertEqual(result['description'], LEAD)
                self.assertEqual(result['description_doc'], doc())

    def test_byte_cap_selects_whole_legacy_paragraph_and_its_document(self):
        with patch.object(descriptions, 'MAX_DESCRIPTION_BYTES', len(LEAD.encode())):
            result = self.extract(f'<p>{LEAD}</p><ul><li>😀 nested<ol><li>Must not leak</li></ol></li></ul>')
            self.assertEqual(result['description_doc'], doc())
            self.assertEqual(result['description'], LEAD)
        with patch.object(descriptions, 'MAX_DESCRIPTION_BYTES', 10):
            result = descriptions.extract_description(page(f'<p>{LEAD}</p>'), 'Serious Business', URL)
            self.assertIsNone(result['description'])
            self.assertIsNone(result['description_doc'])

    def test_all_archive_adapters_set_archive_source(self):
        result = descriptions.extract_archive_description(archive_record(), 'Exactly What I Aimed At', ARCHIVE_URL)
        self.assertIsNone(result['error'])
        self.assertEqual(result['description_doc']['source'], 'archive')
        result = descriptions.extract_document_archive_description(DOCUMENT_URL, document(), 'Abandoned Catchphrase', DOCUMENT_URL)
        self.assertIsNone(result['error'])
        self.assertEqual(result['description_doc']['source'], 'archive')

    def test_rejected_identity_never_returns_a_document(self):
        result = descriptions.extract_description(page(f'<p>{LEAD}</p>'), 'Other Subject', URL)
        self.assertIsNotNone(result['error'])
        self.assertIsNone(result['description_doc'])


class DescriptionDocumentValidationTests(unittest.TestCase):
    def test_all_sources_and_optional_arrays_and_heading_shape(self):
        for source in ('archive', 'crawl', 'plain'):
            value = doc(source=source)
            value['blocks'] += [{'kind': 'heading', 'text': 'A heading'}, {'kind': 'list', 'items': [{'depth': 0, 'text': 'An item', 'links': [], 'em': [], 'spoilers': []}]}]
            self.assertIs(validate_description_doc(value), value)

    def test_invalid_shapes_versions_kinds_text_and_depth(self):
        invalid = [None, [], {}, {**doc(), 'v': True}, {**doc(), 'v': 2}, {**doc(), 'source': 'unknown'},
                   {**doc(), 'blocks': []}, {**doc(), 'blocks': [None]}, {**doc(), 'extra': 1}]
        for block in ({'kind': 'html', 'text': 'no'}, {'kind': 'p', 'text': ''}, {'kind': 'p', 'text': 1},
                      {'kind': 'p', 'text': '\ud800'}, {'kind': 'p', 'text': 'x', 'html': 'no'},
                      {'kind': 'list', 'items': []}, {'kind': 'list', 'items': [{'text': 'x', 'depth': True}]},
                      {'kind': 'list', 'items': [{'text': 'x', 'depth': -1}]},
                      {'kind': 'list', 'items': [{'text': 'x'}]}):
            invalid.append({**doc(), 'blocks': [block]})
        for value in invalid:
            with self.subTest(value=repr(value)), self.assertRaises(ValueError):
                validate_description_doc(value)

    def test_ranges_are_utf16_sorted_nonempty_in_bounds_and_per_kind_nonoverlapping(self):
        for ranges in ([[0, 1]], [[1, 2]], [[-1, 2]], [[0, 0]], [[0, 5]], [[0, 3], [2, 4]], [[3, 4], [0, 2]], [[False, 2]], [[0, 2, 3]], None):
            value = doc('😀ab'); value['blocks'][0]['em'] = ranges
            with self.subTest(ranges=ranges), self.assertRaises(ValueError):
                validate_description_doc(value)
        value = doc('😀ab'); value['blocks'][0].update(em=[[0, 2], [2, 3]], spoilers=[[0, 4]], links=[[2, 4, URL]])
        self.assertEqual(validate_description_doc(value), value)

    def test_link_ranges_must_use_filtered_canonical_urls(self):
        for target in (URL+'?x=1', URL+'#x', '/Main/X', 'https://example.com', URL.replace('/Main/', '/Administrivia/'), 3):
            value = doc(); value['blocks'][0]['links'] = [[0, 2, target]]
            with self.subTest(target=target), self.assertRaises(ValueError):
                validate_description_doc(value)

    def test_json_round_trip_and_legacy_null_document(self):
        serialized = serialize_description_doc(doc(), LEAD)
        self.assertEqual(json.loads(serialized), doc())
        self.assertEqual(serialize_description_doc(serialized, LEAD), serialized)
        self.assertIsNone(serialize_description_doc(None, LEAD))
        for value, description in (('not json', LEAD), (doc(), None)):
            with self.assertRaises(ValueError): serialize_description_doc(value, description)


class DescriptionDocumentImportTests(unittest.TestCase):
    def test_catalog_normalizes_and_stores_document_with_plain_text_guard(self):
        incoming = record(description_doc=doc())
        self.assertEqual(json.loads(incoming['description_doc']), doc())
        self.assertEqual(normalize_record(incoming), incoming)
        db = Database()
        import_records(db, [incoming], apply=True)
        sql, params = next((s, p) for s, p in db.writes if s.startswith('INSERT'))
        self.assertEqual(params[FIELDS.index('description_doc')], incoming['description_doc'])
        self.assertIn('description_doc = CASE WHEN excluded.description IS NOT NULL AND (description IS NULL)', sql)
        old = record(description_doc=doc('Reviewed old text'))
        self.assertEqual(merged_record(old, incoming), old)
        self.assertEqual(merged_record(old, incoming, replace_descriptions=True), incoming)
        self.assertEqual(merged_record(old, record(), replace_descriptions=True)['description_doc'], None)

    def test_importer_validates_before_database_access_even_for_direct_callers(self):
        incoming = record(); incoming['description_doc'] = {'v': 2}
        with self.assertRaises(ValueError): import_records(object(), [incoming], apply=True)
        with self.assertRaises(ValueError): normalize_record({'name': 'Metadata only', 'description_doc': doc()})

    def test_uri_page_import_writes_and_verifies_the_document(self):
        incoming = page_record(description_doc=doc())
        db = PageDatabase()
        report = import_document(db, {'pages': [incoming]}, apply=True)
        self.assertTrue(report['verified'])
        self.assertEqual(db.tables['trope_catalog_page'][incoming['url']]['description_doc'], incoming['description_doc'])
        self.assertEqual(import_document(db, {'pages': [incoming]}, apply=True)['unchanged'], 1)
        self.assertIsNone(choose_record(incoming, page_record(), PAGE_FIELDS)[0])
        with self.assertRaises(ValueError): normalize_page({**incoming, 'description_doc': {'v': 2}})

    def test_archive_readback_detects_document_loss(self):
        incoming = record(source_archive=archive(), description_doc=doc(source='archive'))
        class Lossy(Database):
            def run(self, sql, params=()):
                super().run(sql, params)
                if sql.startswith('INSERT'): self.rows[incoming['name']] = {**incoming, 'description_doc': None}
            def select(self, sql, params=()):
                rows = super().select(sql, params)
                return [{'name': row['name'], 'actual_doc': row} for row in rows] if '_doc AS actual_doc' in sql else rows
        with self.assertRaisesRegex(RuntimeError, 'stored-document verification failed'):
            import_records(Lossy(), [incoming], apply=True)

    def test_initializer_adds_missing_text_columns_and_dry_run_has_no_writes(self):
        tables = initialized_tables()
        for table in ('trope_catalog', 'trope_catalog_page'): del tables[table]['description_doc']
        db = RecordingCrate(tables)
        output = run_initializer(db, dry_run=True)
        for table in ('trope_catalog', 'trope_catalog_page'):
            self.assertIn(f'Would run: ALTER TABLE {table} ADD COLUMN description_doc TEXT', output)
        self.assertEqual(db.writes, [])
        run_initializer(db)
        alters = [sql for sql, _ in db.writes if sql.startswith('ALTER TABLE')]
        self.assertEqual(len(alters), 2)
        self.assertTrue(all('description_doc TEXT INDEX OFF STORAGE WITH (columnstore = false)' in sql for sql in alters))
