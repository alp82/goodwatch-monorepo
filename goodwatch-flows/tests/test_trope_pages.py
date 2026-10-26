"""URI page identity, capture priority, corrected text preservation, CAS/readback and durable write receipts."""
from copy import deepcopy
from contextlib import redirect_stderr, redirect_stdout
import io
import json
from urllib.error import URLError
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'windmill'),str(ROOT/'scripts')]
from f.tvtropes_catalog.pages import *
from f.tvtropes_catalog import pages
from f.sync.models.crate_schemas import ARCHIVE_COLUMN_TYPES
from import_trope_pages import Receipts,main
URL='https://tvtropes.org/pmwiki/pmwiki.php/Main/ActualPage'
OLD='https://tvtropes.org/pmwiki/pmwiki.php/Main/OldAlias'


def page(**patch):
    return normalize_page({'url':URL,'title':'Actual Page','description':'The actual linked page introduction.','source_hash':'a'*64,'fetched_at':100,**patch})
def ref(**patch):
    return normalize_reference({'reference_url':OLD,'canonical_url':URL,'source_hash':'a'*64,'fetched_at':100,**patch})
def archive(dataset='KaraKaraWitch/TvTroper-2025',revision='4d0928d851db919985081118b1f7f85abf0a90fd'):
    return {'provider':'huggingface','dataset':dataset,'revision':revision,'provider_url':f'https://huggingface.co/datasets/{dataset}/resolve/{revision}/file.jsonl',
            'file_sha256':'b'*64,'record_sha256':'c'*64,'article_sha256':'d'*64,'payload_kind':'article_html_fragment','retrieved_at':100}


class Database:
    def __init__(self):self.tables={PAGE_TABLE:{},REFERENCE_TABLE:{}};self.writes=[];self.timeout=False;self.drop_archive=False
    def select(self,sql,params=()):
        if 'information_schema.tables' in sql:return [{'table_name':t} for t in self.tables]
        if 'information_schema.columns' in sql:return [{'column_name':f"source_archive['{k}']",'data_type':v.lower()} for k,v in ARCHIVE_COLUMN_TYPES.items()]
        table=PAGE_TABLE if f'FROM {PAGE_TABLE} ' in sql else REFERENCE_TABLE
        key='url' if table==PAGE_TABLE else 'reference_url'
        return [{key:v,'actual_doc':deepcopy(self.tables[table][v])} for v in params if v in self.tables[table]]
    def run(self,sql,params=()):
        self.writes.append(sql)
        if self.timeout and sql.startswith(('INSERT','UPDATE')):raise TimeoutError('unknown')
        if sql.startswith('INSERT'):
            table=sql.split()[2];fields=PAGE_FIELDS if table==PAGE_TABLE else REFERENCE_FIELDS
            row=dict(zip(fields,params));row.update(imported_at=1,updated_at=1);key=fields[0]
            if self.drop_archive:row['source_archive']=None
            self.tables[table][row[key]]=row
        elif sql.startswith('UPDATE'):
            table=sql.split()[1];fields=PAGE_FIELDS if table==PAGE_TABLE else REFERENCE_FIELDS;changes=[f for f in fields if f!=fields[0]]
            key=params[len(changes)];self.tables[table][key].update(dict(zip(changes,params)));self.tables[table][key]['updated_at']=2
        return {'rowcount':1}


class BulkDatabase(Database):
    def __init__(self,events=None):
        super().__init__();self.bulk_calls=[];self.events=events
    def run_many(self,sql,params):
        assert sql.startswith('INSERT INTO '), 'Guarded UPDATE must never use the bulk transport'
        self.bulk_calls.append((sql,len(params)))
        if self.events is not None:
            assert all(e['phase']=='before_write' for e in self.events[-len(params):])
        return {'results':[self.run(sql,values) for values in params]}


class PagesTests(unittest.TestCase):
    def test_context_label_is_not_a_page_key_or_verified_title(self):
        doc=normalize_document({'pages':[page()],'references':[ref()]})
        self.assertEqual(doc['pages'][0]['title'],'Actual Page');self.assertNotIn('name',doc['pages'][0])
        self.assertEqual(doc['references'][0]['reference_url'],OLD)
    def test_rejects_nonmain_or_unproven_capture_and_preserves_archive_unknown_http_dates(self):
        for patch in ({'url':URL.replace('/Main/','/Creator/')},{'title':''},{'source_hash':None},{'fetched_at':None}):
            with self.subTest(patch=patch),self.assertRaises(ValueError):page(**patch)
        value=page(source_hash=None,fetched_at=None,source_archive=archive());self.assertIsNone(value['fetched_at'])
        with self.assertRaises(ValueError):page(source_archive=archive())
    def test_corrupt_controls_are_rejected_without_guessing_encoding_repair(self):
        for char in ('\x00','\x1b','\x7f','\x85','\x99','\x9f'):
            for field in ('title','description'):
                with self.subTest(field=field,char=ord(char)),self.assertRaises(ValueError):
                    page(**{field:'Actual'+char+' text'})
        text='A legitimate paragraph.\n\nA second\tparagraph with a normal line ending.\r\n'
        self.assertEqual(page(description=text)['description'],text)
        self.assertEqual(page(title='A ™ mark and 2²')['title'],'A ™ mark and 2²')

    def test_identical_input_dedupes_and_source_conflicts_reject(self):
        self.assertEqual(len(normalize_document({'pages':[page(),page()]})['pages']),1)
        with self.assertRaises(ValueError):normalize_document({'pages':[page(),page(title='Different')]})
    def test_same_capture_preserves_manual_numeric_and_icon_corrections(self):
        old=page(description='Corrected 2² * 3³ and restored complete introduction.')
        desired,reason=choose_record(old,page(description='Flattened 22 * 33.'),PAGE_FIELDS)
        self.assertIsNone(desired);self.assertEqual(reason,'same_capture_preserved')
    def test_source_priority_and_newer_http_are_explicit(self):
        archived=page(source_hash=None,fetched_at=None,source_archive=archive())
        older=page(source_hash=None,fetched_at=None,source_archive=archive('RyokoExtra/TvTroper','65ca60f908e536ce4ec1ac123415596379f363cd'))
        self.assertEqual(choose_record(older,archived,PAGE_FIELDS)[1],'higher_priority')
        self.assertEqual(choose_record(archived,page(),PAGE_FIELDS)[1],'higher_priority')
        self.assertIsNone(choose_record(page(),older,PAGE_FIELDS)[0])
        self.assertEqual(choose_record(page(),page(source_hash='e'*64,fetched_at=200),PAGE_FIELDS)[1],'newer_http')
    def test_newer_or_higher_priority_metadata_cannot_erase_definition_or_its_capture(self):
        archived=page(source_hash=None,fetched_at=None,source_archive=archive())
        metadata=page(title='A newer metadata heading',description=None,source_hash='e'*64,fetched_at=200)
        for old in (page(),archived):
            with self.subTest(old_source=old['source_hash']):
                self.assertEqual(choose_record(old,metadata,PAGE_FIELDS),(None,'definition_preserved'))
                db=Database();db.tables[PAGE_TABLE][URL]={**old,'imported_at':1,'updated_at':1}
                before=deepcopy(db.tables[PAGE_TABLE][URL])
                report=import_document(db,{'pages':[metadata]},apply=True)
                self.assertEqual(report['writes'],0)
                self.assertEqual(db.tables[PAGE_TABLE][URL],before)
                self.assertEqual(db.writes,[])

    def test_archive_definition_fills_http_metadata_with_its_own_title_and_provenance(self):
        metadata=page(title='A newer observed heading',description=None,fetched_at=500)
        definition=page(title='The source definition heading',source_hash=None,fetched_at=None,source_archive=archive())
        desired,reason=choose_record(metadata,definition,PAGE_FIELDS)
        self.assertEqual(reason,'fill_description')
        self.assertEqual(desired,definition)
        self.assertIsNone(desired['source_hash']);self.assertIsNone(desired['fetched_at'])
        db=Database();db.tables[PAGE_TABLE][URL]={**metadata,'imported_at':1,'updated_at':1}
        self.assertTrue(import_document(db,{'pages':[definition]},apply=True)['verified'])
        actual=db.tables[PAGE_TABLE][URL]
        self.assertEqual(actual['title'],definition['title'])
        self.assertEqual(actual['source_archive'],definition['source_archive'])
        self.assertIsNone(actual['source_hash']);self.assertIsNone(actual['fetched_at'])
        self.assertEqual(actual['imported_at'],1)

    def test_equal_rank_conflicting_mapping_is_preserved_and_reported(self):
        old=ref();incoming=ref(canonical_url=URL+'Other',source_hash='e'*64)
        self.assertEqual(choose_record(old,incoming,REFERENCE_FIELDS)[1],'equal_priority_conflict')
    def test_dry_run_has_no_writes_and_apply_verifies_both_tables_idempotently(self):
        db=Database();doc={'pages':[page()],'references':[ref()]}
        self.assertEqual(import_document(db,doc)['writes'],2);self.assertEqual(db.writes,[])
        self.assertTrue(import_document(db,doc,apply=True)['verified'])
        writes=len(db.writes);self.assertEqual(import_document(db,doc,apply=True)['writes'],0);self.assertEqual(len(db.writes),writes)
    def test_reference_without_reviewed_target_is_rejected_before_write(self):
        db=Database()
        with self.assertRaisesRegex(ValueError,'no reviewed page'):import_document(db,{'references':[ref()]},apply=True)
        self.assertEqual(db.writes,[])
    def test_lost_provenance_fails_stored_document_verification(self):
        db=Database();db.drop_archive=True
        with self.assertRaises(PageImportWriteError):import_document(db,{'pages':[page(source_hash=None,fetched_at=None,source_archive=archive())]},apply=True)
    def test_unknown_write_is_not_retried_and_receipt_precedes_it(self):
        db=Database();db.timeout=True;events=[]
        with self.assertRaises(PageImportWriteError):import_document(db,{'pages':[page()]},apply=True,on_event=events.append)
        self.assertEqual(sum(s.startswith('INSERT') for s in db.writes),1)
        self.assertEqual(events[-2]['phase'],'before_write');self.assertEqual(events[-1]['phase'],'uncertain_write')
    def test_scoped_update_preserves_import_timestamp_and_unowned_document_fields(self):
        db=Database();import_document(db,{'pages':[page()]},apply=True)
        db.tables[PAGE_TABLE][URL]['extra']='preserve'
        self.assertTrue(import_document(db,{'pages':[page(source_hash='e'*64,fetched_at=200)]},apply=True)['verified'])
        self.assertEqual(db.tables[PAGE_TABLE][URL]['extra'],'preserve');self.assertEqual(db.tables[PAGE_TABLE][URL]['imported_at'],1)
    def test_readback_transport_error_after_ack_is_never_retryable(self):
        class FailingReadback(Database):
            def select(self,sql,params=()):
                if any(s.startswith('INSERT') for s in self.writes) and '_doc AS actual_doc' in sql:
                    raise URLError('backend read unavailable')
                return super().select(sql,params)
        with self.assertRaises(PageImportWriteError) as caught:
            import_document(FailingReadback(),{'pages':[page()]},apply=True)
        self.assertIs(type(caught.exception).retryable,False)
        self.assertIsInstance(caught.exception.__context__,URLError)

    def test_cli_durable_apply_marker_refuses_a_second_attempt(self):
        import import_trope_pages as cli
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);input_path=root/'input.json';input_path.write_text(json.dumps({'pages':[page()]}))
            db=Database();args=['import_trope_pages',str(input_path),'--apply','--receipt-dir',str(root/'receipts')]
            with patch.object(cli,'Crate',return_value=db),patch.object(cli,'settings',return_value={}),patch.object(sys,'argv',args),redirect_stdout(io.StringIO()):
                self.assertTrue(cli.main()['verified'])
                count=len(db.writes)
                with redirect_stderr(io.StringIO()),self.assertRaises(SystemExit):cli.main()
                self.assertEqual(len(db.writes),count)
            self.assertTrue((root/'receipts/plan.json').exists())
            self.assertTrue((root/'receipts/complete.json').exists())
            self.assertTrue((root/'receipts/acknowledgements/000000.json').exists())

    def test_bulk_inserts_are_opt_in_and_preserve_perrow_receipt_order_and_verification(self):
        events=[];db=BulkDatabase(events)
        doc={'pages':[page(url=URL+str(i)) for i in range(5)]}
        self.assertTrue(import_document(db,doc,apply=True,batch_size=2,bulk_inserts=True,on_event=events.append)['verified'])
        self.assertEqual([count for _,count in db.bulk_calls],[2,2,1])
        self.assertEqual([e['index'] for e in events if e['phase']=='acknowledged'],list(range(5)))
        self.assertEqual(len([e for e in events if e['phase']=='verified_batch']),3)
        default=BulkDatabase();import_document(default,{'pages':[page()]},apply=True)
        self.assertEqual(default.bulk_calls,[])

    def test_bulk_mode_never_batches_guarded_updates(self):
        db=BulkDatabase();import_document(db,{'pages':[page()]},apply=True)
        doc={'pages':[page(source_hash='e'*64,fetched_at=200),page(url=URL+'New1'),page(url=URL+'New2')]}
        self.assertTrue(import_document(db,doc,apply=True,bulk_inserts=True)['verified'])
        self.assertEqual([count for _,count in db.bulk_calls],[2])
        self.assertEqual(sum(sql.startswith('UPDATE ') for sql in db.writes),1)

    def test_bulk_missing_acknowledgements_or_zero_error_row_counts_stop_without_retry(self):
        invalid=[None,{}, {'results':[]},{'results':[{'rowcount':1}]},
                 {'results':[{'rowcount':1},{'rowcount':0}]},
                 {'results':[{'rowcount':1},{'rowcount':-2,'error':{'message':'failed'}}]},
                 {'results':[{'rowcount':1},{'rowcount':'1'}]}]
        for response in invalid:
            with self.subTest(response=response):
                class FaultyBulk(BulkDatabase):
                    def run_many(self,sql,params):
                        super().run_many(sql,params)
                        return response
                db=FaultyBulk();events=[]
                with self.assertRaises(PageImportWriteError) as caught:
                    import_document(db,{'pages':[page(url=URL+'1'),page(url=URL+'2'),page(url=URL+'3')]},apply=True,batch_size=2,bulk_inserts=True,on_event=events.append)
                self.assertFalse(type(caught.exception).retryable)
                self.assertEqual(len(db.bulk_calls),1)
                self.assertEqual([e['phase'] for e in events].count('acknowledged'),0)
                self.assertEqual(events[-1]['phase'],'uncertain_write')
                self.assertEqual(events[-1]['group_indexes'],[0,1])

    def test_bulk_transport_partial_failure_halts_after_first_request(self):
        class PartialBulk(BulkDatabase):
            def run_many(self,sql,params):
                self.bulk_calls.append((sql,len(params)));self.run(sql,params[0]);raise URLError('response lost')
        db=PartialBulk()
        with self.assertRaises(PageImportWriteError):
            import_document(db,{'pages':[page(url=URL+'1'),page(url=URL+'2'),page(url=URL+'3')]},apply=True,batch_size=2,bulk_inserts=True)
        self.assertEqual(len(db.bulk_calls),1)
        self.assertEqual(len(db.tables[PAGE_TABLE]),1)

    def test_bulk_archive_inserts_still_require_full_stored_provenance(self):
        db=BulkDatabase();db.drop_archive=True
        with self.assertRaises(PageImportWriteError):
            import_document(db,{'pages':[page(source_hash=None,fetched_at=None,source_archive=archive())]},apply=True,bulk_inserts=True)

    def test_cli_bulk_flag_persists_each_pending_row_before_transport(self):
        import import_trope_pages as cli
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);receipt=root/'receipts';input_path=root/'input.json'
            input_path.write_text(json.dumps({'pages':[page(url=URL+'1'),page(url=URL+'2')]}))
            class ReceiptCheckingBulk(BulkDatabase):
                def run_many(self,sql,params):
                    assert (receipt/'pending/000000.json').exists()
                    assert (receipt/'pending/000001.json').exists()
                    return super().run_many(sql,params)
            db=ReceiptCheckingBulk();args=['import_trope_pages',str(input_path),'--apply','--bulk-inserts','--receipt-dir',str(receipt)]
            with patch.object(cli,'Crate',return_value=db),patch.object(cli,'settings',return_value={}),patch.object(sys,'argv',args),redirect_stdout(io.StringIO()):
                self.assertTrue(cli.main()['verified'])
            self.assertEqual(len(db.bulk_calls),1)
            self.assertEqual(len(list((receipt/'acknowledgements').glob('*.json'))),2)

    def test_receipts_persist_before_write_and_after_acknowledgement(self):
        with tempfile.TemporaryDirectory() as directory:
            callback=Receipts(directory);callback({'phase':'before_write','index':0});callback({'phase':'acknowledged','index':0,'rowcount':1})
            self.assertTrue((Path(directory)/'state.json').exists());self.assertTrue((Path(directory)/'acknowledgements/000000.json').exists())

if __name__=='__main__':unittest.main()
