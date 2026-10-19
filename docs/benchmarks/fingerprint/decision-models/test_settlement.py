"""R1–R4 focused regressions; all authority, billing and transport are synthetic.

Temporary fixture custody is never actual authorization/provider billing evidence.
"""
import copy
import io
from pathlib import Path
import tempfile
import unittest
import urllib.error
from unittest.mock import patch
from core import KEYS, wire, digest, unique_json, identity, SCHEMA_HASH
from bench import freeze
from session import Session, Stop, save, adopt_reconciliation, dispose_review_hold, live_one
from test_bench import TITLE, FakeResponse, Opener
from test_native import config, response
from native_routes import NativeChoice
from report import assemble
import transport


def bind_fixture(s):
    a={'runtime_path':str(s.root.resolve()),'human_authorization_record_sha256':digest(b'SYNTHETIC-HUMAN-NOT-AUTHORITY'),'root_release_sha256':digest(b'SYNTHETIC-ROOT-NOT-AUTHORITY'),'carried_pending_exception':s.l['opening']['pending'],'synthetic':True}
    s.bind_authority(digest(b'SYNTHETIC-CONSOLIDATED-APPROVAL-NOT-AUTHORITY'),a)
    return a


def common(s,operation):
    a=s.l['attempts'][-1]
    return {'status':'ROOT_REVIEWED','fixture_only':True,'operation':operation,'ledger_sha256':digest(s.ledger.read_bytes()),'manifest_sha256':digest(s.path.read_bytes()),'runtime_path':str(s.root.resolve()),'authority_sha256':digest((s.root/'authority.json').read_bytes()),'cell_id':a['cell_id'],'request_sha256':a['request_sha256']}


def ref(s,p):return {'path':str(p.relative_to(s.root)),'sha256':digest(p.read_bytes())}


def settlement_fixture(s,cost='.001',kind=None):
    if not (s.root/'authority.json').exists():bind_fixture(s)
    r=common(s,'settle_charge');r['cost_usd']=cost;cell=r['cell_id'];art=s.root/cell
    root=s.root/'fixture-evidence';root.mkdir(mode=0o700,exist_ok=True)
    suffix=str(len(list(root.iterdir())))
    billing=root/('billing-'+suffix+'.json');save(billing,{'fixture_only':True,'actual_provider_billing':False,'charge':cost},exclusive=True)
    a={k:r[k] for k in ('manifest_sha256','runtime_path','cell_id','request_sha256','cost_usd')};a.update(kind='reviewed_exact_charge_attribution',status='FINAL_ATTRIBUTABLE',fixture_only=True,billing_evidence_sha256=digest(billing.read_bytes()))
    raws=list((art/'http').glob('*.successful-response.private.bin'))
    kind=kind or ('retained_transport_raw' if raws else 'retained_decoded_response')
    e={'kind':kind,'billing':ref(s,billing)}
    if kind=='attributable_no_response':
        note=art/'diagnostic.json';v=unique_json(note.read_bytes());h=next(iter(v.get('correlation_headers',{})),None)
        a.update(correlation={'header':h,'value':v.get('correlation_headers',{}).get(h)},correlation_receipt_sha256=digest(note.read_bytes()));e['correlation_receipt']=ref(s,note)
    else:
        raw=raws[0] if kind=='retained_transport_raw' else art/'response.json';e['response']=ref(s,raw);a['response_sha256']=digest(raw.read_bytes())
    wrapper=root/('attribution-'+suffix+'.json');save(wrapper,a,exclusive=True);e['attribution']=ref(s,wrapper);r['evidence']=e
    p=root/('settlement-'+suffix+'.json');save(p,r,exclusive=True);return p,digest(p.read_bytes())


def disposition_fixture(s,independent=False):
    r=common(s,'dispose_review_hold');a=s.l['attempts'][-1];r['settlement_receipt_sha256']=a['reconciliation_receipt_sha256'];index=next(i for i,c in enumerate(s.m['cells']) if c['id']==r['cell_id'])+1
    r['next_cell_id']=s.m['cells'][index]['id'] if index<len(s.m['cells']) else None;r['action']='resume_next_unattempted' if r['next_cell_id'] else 'finish_after_review'
    root=s.root/'fixture-evidence';suffix=str(len(list(root.iterdir())))
    if independent:
        d={k:r[k] for k in ('manifest_sha256','runtime_path','authority_sha256','cell_id','request_sha256','settlement_receipt_sha256')};d.update(status='ROOT_DISPOSITIONED',original_stop=a['status'],decision='retain_invalid_advance',canonical_acceptance=False,fixture_only=True,stop_evidence=[ref(s,p) for p in [s.root/a['cell_id']/'diagnostic.json',s.root/a['cell_id']/'parsed.json'] if p.exists()])
        p=root/('independent-disposition-'+suffix+'.json');save(p,d,exclusive=True);r['independent_stop_disposition']=ref(s,p)
    p=root/('disposition-'+suffix+'.json');save(p,r,exclusive=True);return p,digest(p.read_bytes())


def fake_send(kind='valid'):
    def send(body,artifact,c):
        raw=response(c,c.get('field_keys',KEYS));raw.update(provider='SYNTHETIC',id='gen-synthetic-fixture');raw['usage']['cost']=.001
        data=wire(raw) if kind=='valid' else b'{invalid-but-retained-http200'
        opener=Opener(FakeResponse(data,headers={'Content-Type':'application/json','x-request-id':'req-synthetic-correlation'}))
        if kind=='no_response':opener=Opener(error=urllib.error.HTTPError('https://example.invalid',503,'ignored',{'x-request-id':'req-synthetic-correlation'},io.BytesIO(b'{"error":{"code":503}}')))
        if kind=='no_correlation':opener=Opener(error=urllib.error.URLError(TimeoutError()))
        return transport.http('SYNTHETIC-NOT-A-KEY','POST','native/'+c['adapter'],wire(body),decoder=unique_json,sink=transport.PrivateEvidence(artifact/'http'),opener_factory=lambda:opener)
    return send


class SettlementChecks(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.root.chmod(0o700);self.sessions=[]
    def tearDown(self):
        for s in self.sessions:
            if not s.lock.closed:s.close()
        self.tmp.cleanup()
    def setup_session(self,two=True):
        c=config();c.update(full_cost_bound_usd='.01',allowed_returned_models=['SYNTHETIC'],allowed_returned_providers=['SYNTHETIC'],input_cap=1000,total_output_cap=8192)
        opening={'accounting_kind':'retired_stage_carry','cash_usd':'0.00362023','pending':{'s02-attempt-1':'0.20914624'},'held_stage_usd':'0','attempts':3,'initial_attempt_capacity_total':72,'retries':0,'semantic_hold':False}
        m=freeze([TITLE,dict(TITLE,tmdb_id=900000002)] if two else [TITLE],[c],opening,'.1');m['allocation_disposition_reviewed']=True;save(self.root/'manifest.json',m,exclusive=True)
        s=Session(self.root/'manifest.json',self.root/'runtime');self.sessions.append(s);bind_fixture(s);return s
    def send(self,s,kind='valid'):return s.one(fake_send(kind),carried_pending_exception=s.l['opening']['pending'])
    def reopen(self,s):
        p=s.path;root=s.root;s.close();s=Session(p,root);self.sessions.append(s);return s
    def test_R1_settle_hold_close_reopen_disposition_and_one_next(self):
        s=self.setup_session();self.send(s);attempt_status=s.l['attempts'][0]['status'];r,h=settlement_fixture(s);adopt_reconciliation(s,r,h);self.assertEqual(s.l['state'],'paused_settled_review');self.assertEqual(s.l['cursor'],1)
        before=s.ledger.read_bytes();adopt_reconciliation(s,r,h);self.assertEqual(s.ledger.read_bytes(),before)
        s=self.reopen(s);cash=s.l['cash_usd'];history=copy.deepcopy(s.l['attempts']);r,h=disposition_fixture(s);dispose_review_hold(s,r,h);self.assertEqual(s.l['state'],'ready');self.assertEqual(s.l['cash_usd'],cash);self.assertEqual(s.l['attempts'],history)
        with self.assertRaisesRegex(Stop,'stale_disposition'):dispose_review_hold(s,r,h)
        self.send(s);self.assertEqual(len(s.l['attempts']),2);self.assertEqual(s.l['attempts'][0]['status'],attempt_status)
        with self.assertRaises(Stop):self.send(s)
    def test_R1_terminal_cell_settlement_and_finish_no_next_required(self):
        s=self.setup_session(False);self.send(s);r,h=settlement_fixture(s);adopt_reconciliation(s,r,h);s=self.reopen(s);r,h=disposition_fixture(s);dispose_review_hold(s,r,h);self.assertEqual(s.l['state'],'completed_reviewed');self.assertEqual(s.l['cursor'],1);self.assertEqual(len(s.l['attempts']),1)
        with self.assertRaises(Stop):self.send(s)
    def test_R1_new_settlement_receipt_cannot_release_twice(self):
        s=self.setup_session();self.send(s);r,h=settlement_fixture(s);adopt_reconciliation(s,r,h);before=s.ledger.read_bytes();r,h=settlement_fixture(s)
        with self.assertRaisesRegex(Stop,'already_settled_different_receipt'):adopt_reconciliation(s,r,h)
        self.assertEqual(before,s.ledger.read_bytes())
    def test_R1_stale_and_changed_scope_receipts_rejected(self):
        s=self.setup_session();self.send(s)
        for field,value in [('ledger_sha256',digest(b'old')),('authority_sha256',digest(b'other')),('manifest_sha256',digest(b'other')),('runtime_path',str(self.root/'other'))]:
            p,h=settlement_fixture(s);r=unique_json(p.read_bytes());r[field]=value;save(p,r)
            with self.assertRaises(Stop):adopt_reconciliation(s,p,digest(p.read_bytes()))
        self.assertEqual(s.l['cash_usd'],'0.00362023');self.assertIn('c0001',s.l['pending'])
    def test_R1_no_skip_to_other_authorized_cell(self):
        s=self.setup_session();self.send(s);p,h=settlement_fixture(s);adopt_reconciliation(s,p,h);p,h=disposition_fixture(s);r=unique_json(p.read_bytes());r['next_cell_id']='c0003';save(p,r)
        with self.assertRaisesRegex(Stop,'next_cell_binding'):dispose_review_hold(s,p,digest(p.read_bytes()))
        self.assertEqual(s.l['cursor'],1)
    def test_R2_malformed200_exact_raw_settle_hold_without_response_json(self):
        s=self.setup_session();self.send(s,'malformed');artifact=s.root/'c0001';self.assertFalse((artifact/'response.json').exists());raw=next((artifact/'http').glob('*.successful-response.private.bin'));before=raw.read_bytes();p,h=settlement_fixture(s);adopt_reconciliation(s,p,h)
        self.assertEqual(s.l['cash_usd'],'0.00462023');self.assertEqual(s.l['pending'],{'s02-attempt-1':'0.20914624'});self.assertEqual(raw.read_bytes(),before);self.assertFalse((artifact/'response.json').exists())
        p,h=disposition_fixture(s)
        with self.assertRaises(Stop):dispose_review_hold(s,p,h)
        self.assertEqual(s.l['state'],'paused_settled_review');p,h=disposition_fixture(s,True);dispose_review_hold(s,p,h);self.assertEqual(s.l['cursor'],1);self.assertEqual(s.l['attempts'][0]['status'],'paused_transport_or_local_unknown')
    def test_R2_no_response_exact_correlation_billing_link(self):
        s=self.setup_session();self.send(s,'no_response');p,h=settlement_fixture(s,kind='attributable_no_response');adopt_reconciliation(s,p,h);self.assertEqual(s.l['cash_usd'],'0.00462023');self.assertFalse((s.root/'c0001/response.json').exists());self.assertEqual(s.l['state'],'paused_settled_review')
    def test_R2_unattributable_missing_and_tampered_billing_stays_held(self):
        s=self.setup_session();self.send(s,'no_correlation');p,h=settlement_fixture(s,kind='attributable_no_response');before=s.ledger.read_bytes()
        with self.assertRaisesRegex(Stop,'correlation_linkage'):adopt_reconciliation(s,p,h)
        self.assertEqual(before,s.ledger.read_bytes())
        r=unique_json(p.read_bytes());r['evidence']['billing']['path']='missing.json';save(p,r)
        with self.assertRaises(Stop):adopt_reconciliation(s,p,digest(p.read_bytes()))
        self.assertEqual(before,s.ledger.read_bytes())
    def test_R2_response_billing_mismatch_stays_held(self):
        s=self.setup_session();self.send(s);p,h=settlement_fixture(s);r=unique_json(p.read_bytes());a=s.root/r['evidence']['attribution']['path'];v=unique_json(a.read_bytes());v['response_sha256']=digest(b'wrong');save(a,v);r['evidence']['attribution']=ref(s,a);save(p,r);before=s.ledger.read_bytes()
        with self.assertRaisesRegex(Stop,'response_billing_linkage'):adopt_reconciliation(s,p,digest(p.read_bytes()))
        self.assertEqual(before,s.ledger.read_bytes())
    def test_R1_same_consolidated_live_gate_after_reopen_no_cell_approval(self):
        from adapters import render
        s=self.setup_session();m=copy.deepcopy(s.m);s.close();c=m['candidates'][0]
        c.update(enabled=True,admission_status='REVIEWED',input_bound_proof_status='REVIEWED',input_bound_tokens=1000,native_priceguard_supported=True,max_price={'prompt':.04,'completion':0},price_and_usage_admission='REVIEWED')
        for cell in m['cells']:
            r=render(m['titles'][cell['title_index']],dict(c,field_keys=cell['expected_keys']));cell['request_sha256']=r['wire_sha256'];cell['request_bytes']=r['request_bytes']
        proof=self.root/'synthetic-guard.json';save(proof,{'status':'ROOT_REVIEWED','fixture_only':True,'request_hashes':[x['request_sha256'] for x in m['cells']],'model':c['model'],'provider':c['provider'],'input_bound_tokens':1000,'output_bound_tokens':8192,'no_implicit_generation_search_fallback':True,'price_guard_verified':True});c.update(native_guard_receipt_path=str(proof),native_guard_receipt_sha256=digest(proof.read_bytes()))
        mp=self.root/'live-fixture-manifest.json';save(mp,m);rt=self.root/'live-fixture-runtime'
        a={'runtime_path':str(rt.resolve()),'carried_pending_exception':m['opening_accounting']['pending'],'human_authorization_record_sha256':digest(b'fixture-human'),'root_release_sha256':digest(b'fixture-root'),'synthetic':True};approval_sha=digest(b'fixture-approval');calls=[];real_http=transport.http
        def http(key,method,path,body=None,**kwargs):
            calls.append((method,path))
            if method=='GET':return {'data':{'limit_remaining':1}}
            raw=response(c);raw.update(provider='SYNTHETIC',id='gen-synthetic-fixture');raw['usage']['cost']=.001
            return real_http(key,method,path,body,opener_factory=lambda:Opener(FakeResponse(wire(raw))),**kwargs)
        with patch('session.approved',return_value=(m,a)),patch('session.os.environ',new={'FIXTURE_ONLY':'SYNTHETIC-NOT-A-KEY'}),patch('session.transport.http',side_effect=http):
            for i in range(2):
                live_one(mp,rt,'not-actual-approval',approval_sha,'FIXTURE_ONLY');current=Session(mp,rt);self.sessions.append(current)
                p,h=settlement_fixture(current);adopt_reconciliation(current,p,h);current=self.reopen(current);p,h=disposition_fixture(current);dispose_review_hold(current,p,h);current.close()
            self.assertEqual(calls,[('GET','key'),('POST','native/'+c['adapter'])]*2)
            with self.assertRaises(Stop):live_one(mp,rt,'not-actual-approval',approval_sha,'FIXTURE_ONLY')
        current=Session(mp,rt);self.sessions.append(current);self.assertEqual(current.l['state'],'completed_reviewed');self.assertEqual(current.l['cash_usd'],'0.00562023');self.assertEqual(current.l['pending'],{'s02-attempt-1':'0.20914624'})

    def test_R2_after_settlement_tampered_evidence_blocks_disposition(self):
        s=self.setup_session();self.send(s);p,h=settlement_fixture(s);receipt=unique_json(p.read_bytes());adopt_reconciliation(s,p,h)
        billing=s.root/receipt['evidence']['billing']['path'];billing.write_bytes(b'changed-fixture');p,h=disposition_fixture(s);before=s.ledger.read_bytes()
        with self.assertRaisesRegex(Stop,'evidence_digest'):dispose_review_hold(s,p,h)
        self.assertEqual(s.ledger.read_bytes(),before)

    def test_R3_known_overbound_authoritative_even_above_caps(self):
        s=self.setup_session();self.send(s);p,h=settlement_fixture(s,'6');adopt_reconciliation(s,p,h)
        self.assertEqual(s.l['cash_usd'],'6.00362023');self.assertEqual(s.l['pending'],{'s02-attempt-1':'0.20914624'});self.assertEqual(s.l['new_run_pending_usd'],'0.00');self.assertEqual(s.l['attempts'][0]['unused_reservation_released_usd'],'0');self.assertEqual(s.l['attempts'][0]['bound_excess_usd'],'5.99');self.assertEqual(s.l['state'],'stopped_accounting_bound_breach')
        before=s.ledger.read_bytes();adopt_reconciliation(s,p,h);self.assertEqual(s.ledger.read_bytes(),before);s=self.reopen(s);p,h=disposition_fixture(s,True)
        with self.assertRaisesRegex(Stop,'accounting_bound_breach'):dispose_review_hold(s,p,h)
        with self.assertRaises(Stop):self.send(s)


class MissingnessChecks(unittest.TestCase):
    def partial(self,second=None):
        c=config();c.update(request_batches=[64,10],request_cost_bounds_usd=['.503316480','.078643200']);m=freeze([TITLE],[c],{'cash_usd':'0','pending':{},'held_stage_usd':'0','attempts':0,'retries':0,'semantic_hold':False})
        sub=dict(c,field_keys=KEYS[:64]);r=NativeChoice.parse(response(sub,KEYS[:64]),TITLE,sub);r.update(candidate_id=c['id'],cell_id='c0001',input_sha256='same',expected_fields=KEYS[:64],charge_status='reconciled',reconciled_cost_usd='.001',pending_bound_usd='0');parts=[r]
        if second is not None:parts.append(dict(second,candidate_id=c['id'],cell_id='c0002',expected_fields=KEYS[64:],identity=identity(TITLE),charge_status='unknown',pending_bound_usd='.078643200'))
        return assemble(m,parts,[])['model_results'][0]
    def test_R4_64_assessed_10_unattempted_zero_unknowns(self):
        r=self.partial();c=r['coverage'];self.assertEqual((c['assessed_cells'],c['unattempted_cells'],c['unknown_cells']),(64,10,0));self.assertEqual(c['strict74_titles'],0);self.assertEqual(r['efficiency']['cash_usd'],.001);self.assertEqual(r['baseline_disagreement'],[])
    def test_R4_failed_second_chunk_unreturned_not_abstention(self):
        r=self.partial({'returned':False,'native':None,'mapped':{k:None for k in KEYS},'format_valid':False,'errors':['failed'],'schema_sha256':SCHEMA_HASH});c=r['coverage'];self.assertEqual((c['unknown_cells'],c['unreturned_cells'],c['failed_unreturned_cells'],c['unattempted_cells']),(0,10,10,0));self.assertEqual(r['efficiency']['paid_requests'],2);self.assertEqual(r['efficiency']['pending_bound_usd'],.0786432)
    def test_R4_unknown_other_states_and_withheld_separate(self):
        from core import field_coverage
        native={KEYS[0]:None,KEYS[1]:{},KEYS[2]:{},KEYS[3]:{},KEYS[4]:{},KEYS[5]:{}}
        r={'native':native,'mapped':{k:None for k in KEYS},'format_valid':True,'assessment_states':dict(zip(KEYS[1:5],['not_applicable','not_assessed','refused','invalid'])),'comparison_withheld_fields':[KEYS[5]]}
        c=field_coverage(r,KEYS[:7])['counts'];self.assertEqual(c['semantic_unknown'],1);self.assertEqual(c['not_applicable'],1);self.assertEqual(c['not_assessed'],1);self.assertEqual(c['refused'],1);self.assertEqual(c['invalid'],1);self.assertEqual(c['withheld_numeric'],1);self.assertEqual(c['unreturned'],1)
    def test_R4_complete_chunk_diagnostics_use_child_field_ids(self):
        from native_routes import assemble_chunks
        from core import field_coverage
        c=config();parts=[]
        for keys in [KEYS[:64],KEYS[64:]]:
            sub=dict(c,field_keys=keys);r=NativeChoice.parse(response(sub,keys),TITLE,sub);r['input_sha256']='same';parts.append(r)
        assembled=assemble_chunks(parts,[KEYS[:64],KEYS[64:]]);coverage=field_coverage(assembled)
        self.assertEqual(coverage['counts']['assessed'],74);self.assertEqual(coverage['counts']['semantic_unknown'],0);self.assertEqual(len(coverage['returned_field_ids']),74)

    def test_R4_entire_no_response_not_74_unknowns(self):
        c=config();m=freeze([TITLE],[c],{'cash_usd':'0','pending':{},'held_stage_usd':'0','attempts':0,'retries':0,'semantic_hold':False});r={'identity':identity(TITLE),'candidate_id':c['id'],'cell_id':'c0001','native':None,'mapped':{k:None for k in KEYS},'format_valid':False,'returned':False,'errors':['failed'],'schema_sha256':SCHEMA_HASH};coverage=assemble(m,[r],[])['model_results'][0]['coverage'];self.assertEqual((coverage['unknown_cells'],coverage['unreturned_cells'],coverage['failed_unreturned_cells']),(0,74,74))


if __name__=='__main__':unittest.main()
