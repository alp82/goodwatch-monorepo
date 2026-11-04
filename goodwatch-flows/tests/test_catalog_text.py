"""Publisher/backfill regression checks; no live services."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'windmill'), str(ROOT/'scripts')]
from pydantic import BaseModel
from f.db.cratedb import CrateConnector
from f.catalog_text import normalize_row
from f.media_language.episode_translations import publish_rows
from f.tvtropes_catalog.catalog import normalize_record
from f.tvtropes_catalog.pages import normalize_page
from f.tvtropes_catalog.description_docs import validate_description_doc, utf16_length
from normalize_catalog_dashes import correction, update_statement

URL = 'https://tvtropes.org/pmwiki/pmwiki.php/Main/RedHerring'
TEXT = 'A clue—😀—leads away from the truth.'
DOC = {'v': 1, 'source': 'crawl', 'blocks': [
    {'kind': 'p', 'text': TEXT, 'em': [[0, utf16_length(TEXT)]], 'links': [[0, 1, URL]]},
    {'kind': 'list', 'items': [{'depth': 0, 'text': 'why—now', 'spoilers': [[0, 7]]}]},
]}


class CatalogTextTests(unittest.TestCase):
    def test_catalog_import_normalizes_both_representations_and_rehashes_only_description(self):
        original = {'name': 'Name—with punctuation', 'url': URL, 'description': TEXT,
                    'description_doc': DOC, 'source_hash': 'a'*64, 'fetched_at': 1000}
        before = deepcopy(original)
        row = normalize_record(original)
        self.assertEqual(original, before)
        self.assertEqual(row['name'], original['name'])
        self.assertEqual(row['source_hash'], 'a'*64)
        self.assertEqual(row['description'], TEXT.replace('—','-'))
        self.assertEqual(row['description_hash'], hashlib.sha256(row['description'].encode()).hexdigest())
        doc = json.loads(row['description_doc'])
        validate_description_doc(doc)
        self.assertEqual(doc['blocks'][0]['text'], row['description'])
        self.assertEqual(doc['blocks'][0]['em'], DOC['blocks'][0]['em'])
        self.assertEqual(doc['blocks'][0]['links'], DOC['blocks'][0]['links'])
        self.assertEqual(doc['blocks'][1]['items'][0]['text'], 'why-now')

    def test_url_page_import_normalizes_staged_escaped_json_and_retains_identity(self):
        row = normalize_page({'url': URL, 'title': 'Title—with dash', 'description': TEXT,
                              'description_doc': json.dumps(DOC), 'source_hash': 'a'*64, 'fetched_at': 1000})
        self.assertEqual(row['title'], 'Title—with dash')
        self.assertEqual(row['description'], TEXT.replace('—','-'))
        self.assertNotIn('—', row['description_doc'])
        self.assertEqual(row['description_hash'], hashlib.sha256(row['description'].encode()).hexdigest())

    def test_shared_upsert_covers_tmdb_and_dna_without_mutating_input(self):
        class Record(BaseModel):
            tmdb_id: int = 1
            title: str = 'Title—stays'
            synopsis: str = 'Story—changes'
            tagline: str = 'Tag—changes'
            essence_text: str = 'Feel—changes'
        record = Record()
        db = CrateConnector.__new__(CrateConnector)
        db.cur = SimpleNamespace(executemany=Mock(return_value=[{'rowcount': 1}]))
        db.upsert_many('movie', [record], ['tmdb_id'], silent=True)
        sql, values = db.cur.executemany.call_args.args
        columns = sql.split('(',1)[1].split(')',1)[0].replace('"','').split(',')
        written = dict(zip([c.strip() for c in columns], values[0]))
        self.assertEqual(written['synopsis'], 'Story-changes')
        self.assertEqual(written['tagline'], 'Tag-changes')
        self.assertEqual(written['essence_text'], 'Feel-changes')
        self.assertEqual(written['title'], 'Title—stays')
        self.assertEqual(record.synopsis, 'Story—changes')

    def test_direct_translation_sql_is_also_normalized(self):
        db = SimpleNamespace(run_many=Mock())
        row = {'show_id': 1, 'tmdb_id': 2, 'language_code': 'en', 'country_code': 'US',
               'name': 'Name—stays', 'overview': 'Overview—changes'}
        publish_rows(db, 'episode_translation', [row])
        sql, values = db.run_many.call_args.args
        self.assertIn('Overview-changes', values[0])
        self.assertIn('Name—stays', values[0])
        self.assertEqual(row['overview'], 'Overview—changes')

    def test_backfill_has_full_routed_key_and_occ_without_overwriting_provenance(self):
        row = {'description': TEXT, 'description_doc': json.dumps(DOC), 'description_hash': 'old',
               'name': 'Name—stays', 'url': URL, '_seq_no': 12, '_primary_term': 3}
        changes = correction('trope_catalog', row)
        sql, args = update_statement('trope_catalog', row, changes)
        self.assertEqual(set(changes), {'description','description_doc','description_hash'})
        self.assertTrue(sql.endswith('WHERE "name"=? AND _seq_no=? AND _primary_term=?'))
        self.assertEqual(args[-3:], ['Name—stays',12,3])
        ep = {'show_id': 1, 'tmdb_id': 2, 'overview': 'Story—changes', '_seq_no': 8, '_primary_term': 1}
        sql, args = update_statement('episode', ep, correction('episode',ep))
        self.assertTrue(sql.endswith('WHERE "show_id"=? AND "tmdb_id"=? AND _seq_no=? AND _primary_term=?'))
        self.assertEqual(args[-4:], [1,2,8,1])
        done = {**row, **changes}
        self.assertEqual(correction('trope_catalog', done), {})

    def test_other_punctuation_nulls_keys_and_unrelated_tables_are_preserved(self):
        row = {'synopsis': None, 'tagline': 'a–b--c-d', 'title': 'Name—stays'}
        self.assertEqual(normalize_row('movie',row), row)
        self.assertEqual(normalize_row('user_list',{'description':'Member—text'}), {'description':'Member—text'})


if __name__ == '__main__':
    unittest.main()
