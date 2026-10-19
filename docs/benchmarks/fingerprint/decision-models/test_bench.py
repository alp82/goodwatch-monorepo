"""Offline invariants; urllib openers are fake. No credentials/network."""
import copy
import io
import json
import math
import socket
import tempfile
import threading
import time
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
from core import *
from adapters import *
from bench import freeze, demo
from session import *
import report
import transport

TITLE={'media_type':'movie','tmdb_id':900000001,'title':'Synthetic Fixture','original_title':'Synthetic Fixture','year':2001,'scope':'movie_work_edition_unrecorded','synopsis':'An invented courier delivers a letter.'}
CONFIG=json.loads((Path(__file__).parent/'example-candidates.json').read_text())
OPEN={'cash_usd':'0','pending':{},'held_stage_usd':'2.51','attempts':3,'retries':0,'semantic_hold':False}


def response(scores=None,**kwargs):
    return dict({'model':'fixture-model','provider':'fixture-provider','id':'gen-fixture','usage':{'prompt_tokens':100,'completion_tokens':100,'cost':0.001},'choices':[{'finish_reason':'stop','message':{'content':wire({'identity':identity(TITLE),'scores':scores or {k:5 for k in KEYS}}).decode()}}]},**kwargs)


class FakeResponse:
    def __init__(self,body,status=200,headers=None,delay=0):self.body=body;self.status=status;self.headers=headers or {'Content-Type':'application/json'};self.delay=delay
    def read(self,n):time.sleep(self.delay);return self.body[:n]
    def __enter__(self):return self
    def __exit__(self,*args):pass


class Opener:
    def __init__(self,response=None,error=None):self.response=response;self.error=error;self.calls=[]
    def open(self,req,timeout):
        self.calls.append(req)
        if self.error:raise self.error
        return self.response


class BenchChecks(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.root.chmod(0o700)
        self.c=copy.deepcopy(CONFIG[0]);self.c.update(allowed_returned_models=['fixture-model'],allowed_returned_providers=['fixture-provider'])
    def tearDown(self):self.tmp.cleanup()
    def session(self,opening=None,budget='0.02'):
        m=freeze([TITLE],[self.c],opening or OPEN,budget);save(self.root/'manifest.json',m,exclusive=True);return Session(self.root/'manifest.json',self.root/'runtime')
    def test_01_order_and_contract(self):
        self.assertEqual(len(KEYS),74);self.assertEqual(CONTRACT['field_order_sha256'],'d43f6e429107a705c5599f8ef55e0dd63a83d93bea3c452ce7dbdc581e3a5f5b');self.assertEqual(vector({k:i%11 for i,k in reversed(list(enumerate(KEYS)))}),[i%11 for i in range(74)])
    def test_02_strict_no_bool_fraction_or_missing(self):
        for v in [True,1.2,'5',-1,11,None]:
            with self.subTest(v=v),self.assertRaises(ValueError):vector({k:v for k in KEYS})
    def test_03_unknown_and_native_fraction(self):
        self.assertIsNone(mapping(None,CONFIG[0]['mapping']));self.assertAlmostEqual(mapping(4.5,CONFIG[1]['mapping']),5);self.assertAlmostEqual(mapping(4,CONFIG[1]['mapping']),40/9);self.assertEqual(mapping(4.5,{'kind':'historical_python_round','native_top':9}),5)
        self.assertEqual(mapping(2.25,{'kind':'historical_python_round','native_top':9}),2) # ties-to-even
    def test_04_choice_not_probability(self):
        self.assertEqual(mapping('s10',CONFIG[2]['mapping']),10)
        with self.assertRaises(ValueError):mapping(.95,CONFIG[2]['mapping'])
    def test_05_same_input_and_every_field(self):
        renders=[render(TITLE,c) for c in CONFIG];self.assertEqual(len({r['input_sha256'] for r in renders}),1);self.assertEqual(len({r['policy_sha256'] for r in renders}),1)
        self.assertEqual(list(renders[1]['body']['questions']),KEYS);self.assertEqual(len(renders[2]['body']['questions']),74)
    def test_06_guarded_chat_serializer(self):
        r=render(TITLE,self.c)['body'];self.assertNotIn('max_tokens',r);self.assertEqual(r['max_completion_tokens'],8182);self.assertFalse(r['provider']['allow_fallbacks']);self.assertTrue(r['provider']['require_parameters']);self.assertEqual(r['plugins'],[])
    def test_07_identity_scope_invalid_and_refusal(self):
        raw=response();obj=unique_json(raw['choices'][0]['message']['content']);obj['identity']['year']=2002;raw['choices'][0]['message']['content']=wire(obj).decode();self.assertIn('identity_or_envelope',OpenRouter.parse(raw,TITLE,self.c)['errors'])
        for content in [None,response()['choices'][0]['message']['content']]:
            raw=response();raw['choices'][0]['message'].update(refusal='refused',content=content);self.assertIn('explicit_refusal',OpenRouter.parse(raw,TITLE,self.c)['errors']);self.assertTrue(all(v is None for v in OpenRouter.parse(raw,TITLE,self.c)['mapped'].values()))
    def test_08_null_empty_refusal_controls(self):
        for refusal in ['',None]:
            r=response();r['choices'][0]['message']['refusal']=refusal;self.assertTrue(OpenRouter.parse(r,TITLE,self.c)['format_valid'])
    def test_09_duplicate_json_unknown_not_zero(self):
        with self.assertRaises(ValueError):unique_json('{"a":1,"a":2}')
        raw=response({k:None for k in KEYS});p=OpenRouter.parse(raw,TITLE,self.c);self.assertTrue(p['format_valid']);self.assertTrue(all(x is None for x in p['mapped'].values()))
    def test_10_actual_serializer_fake_http_raw_custody(self):
        body=wire(render(TITLE,self.c)['body']);raw=wire(response());op=Opener(FakeResponse(raw));obj=transport.http('fixture-secret','POST','chat/completions',body,opener_factory=lambda:op,sink=transport.PrivateEvidence(self.root/'http'))
        self.assertEqual(len(op.calls),1);self.assertEqual(op.calls[0].data,body);self.assertTrue(OpenRouter.parse(obj,TITLE,self.c)['format_valid']);self.assertEqual(next((self.root/'http').glob('*.bin')).read_bytes(),raw)
    def test_11_http_error_status_sanitized_no_raw_echo(self):
        error=urllib.error.HTTPError('https://example.invalid',402,'SECRET arbitrary',{'x-request-id':'req-fixture'},io.BytesIO(b'{"error":{"code":"payment_required","message":"fixture-secret synopsis"}}'))
        op=Opener(error=error)
        with self.assertRaises(transport.TransportFailure) as c:transport.http('fixture-secret','POST','chat/completions',b'{}',opener_factory=lambda:op,sink=transport.PrivateEvidence(self.root/'http'))
        note=c.exception.note;self.assertEqual(note['http_status'],402);self.assertEqual(note['provider_error_code'],'payment_required');self.assertNotIn('fixture-secret',json.dumps(note));self.assertNotIn('synopsis',json.dumps(note));self.assertEqual(len(op.calls),1);self.assertFalse(list((self.root/'http').glob('*.bin')))
    def test_12_timeout_headers_and_no_late_writes(self):
        op=Opener(FakeResponse(b'{}',headers={'Content-Type':'application/json','x-request-id':'req-fixture'},delay=.08))
        with self.assertRaises(transport.TransportFailure) as c:transport.http('fixture-secret','POST','chat/completions',b'{}',opener_factory=lambda:op,outer_timeout=.02,sink=transport.PrivateEvidence(self.root/'http'))
        self.assertEqual(c.exception.note['category'],'outer_timeout');self.assertEqual(c.exception.note['http_status'],200);self.assertEqual(c.exception.note['read_phase'],'body_read');before=list((self.root/'http').iterdir());time.sleep(.1);self.assertEqual(before,list((self.root/'http').iterdir()))
    def test_13_http_error_header_timeout(self):
        class Slow(io.BytesIO):
            def read(self,n):time.sleep(.08);return super().read(n)
        error=urllib.error.HTTPError('https://example.invalid',503,'ignored',{'x-request-id':'req-fixture'},Slow(b'{}'));op=Opener(error=error)
        with self.assertRaises(transport.TransportFailure) as c:transport.http('fixture-secret','POST','chat/completions',b'{}',opener_factory=lambda:op,outer_timeout=.02)
        self.assertEqual(c.exception.note['http_status'],503);self.assertEqual(c.exception.note['category'],'outer_timeout')
    def test_14_timeout_no_headers(self):
        class Delayed:
            def open(self,*a,**kw):time.sleep(.08);return FakeResponse(b'{}')
        with self.assertRaises(transport.TransportFailure) as c:transport.http('fixture-secret','POST','chat/completions',b'{}',opener_factory=Delayed,outer_timeout=.02)
        self.assertIsNone(c.exception.note['http_status']);self.assertEqual(c.exception.note['read_phase'],'awaiting_headers')
    def test_15_dns_socket_tls_categories(self):
        import ssl
        for e,cat in [(socket.gaierror(),'dns_failure'),(TimeoutError(),'socket_timeout'),(ssl.SSLError(),'tls_failure')]:
            with self.subTest(cat=cat),self.assertRaises(transport.TransportFailure) as c:transport.http('fixture-secret','POST','chat/completions',b'{}',opener_factory=lambda:Opener(error=urllib.error.URLError(e)))
            self.assertEqual(c.exception.note['category'],cat)
    def test_16_non_json_and_oversize(self):
        for raw,cat in [(b'not-json','response_json_parse_failure'),(b' '*2000001,'response_oversized')]:
            with self.subTest(cat=cat),self.assertRaises(transport.TransportFailure) as c:transport.http('fixture-secret','POST','chat/completions',b'{}',opener_factory=lambda:Opener(FakeResponse(raw)))
            self.assertEqual(c.exception.note['category'],cat)
    def test_17_native_serializer_through_fake_http(self):
        # Serializer reaches real urllib handling only under test injection; native live disabled.
        payload=wire(render(TITLE,CONFIG[1])['body']);op=Opener(FakeResponse(b'{"answers":{}}'));transport.http('fixture-secret','POST','chat/completions',payload,opener_factory=lambda:op);self.assertEqual(unique_json(op.calls[0].data)['state'],state(TITLE))
    def test_18_atomic_reservation_before_send(self):
        s=self.session();seen=[]
        try:
            def send(body,artifact,c):
                l=unique_json(s.ledger.read_bytes());seen.append(l['pending']);self.assertEqual(l['state'],'paused_reserved');self.assertEqual(digest((artifact/'request.json').read_bytes()),l['attempts'][0]['request_sha256']);return response()
            s.one(send,synthetic=True);self.assertEqual(len(seen),1);self.assertEqual(len(s.l['attempts']),1);self.assertEqual(s.l['cash_usd'],'0');self.assertEqual(s.l['held_stage_usd'],'2.51');self.assertEqual(s.l['new_stage_reservation_usd'],'0')
        finally:s.close()
    def test_19_unknown_held_and_no_replay(self):
        s=self.session();calls=[]
        try:
            def send(*a):calls.append(1);raise TimeoutError()
            s.one(send,synthetic=True);self.assertEqual(s.l['pending'],{'c0001':'0.01'});self.assertEqual(s.l['cursor'],0)
            with self.assertRaises(Stop):s.one(send,synthetic=True)
            self.assertEqual(calls,[1])
        finally:s.close()
    def test_20_budget_before_any_send(self):
        s=self.session(budget='0.001')
        try:
            with self.assertRaises(Stop):s.one(lambda *a:self.fail('send'),synthetic=True)
            self.assertFalse(s.l['attempts'])
        finally:s.close()
    def test_21_prior_pending_blocks_live_and_preserved(self):
        o=dict(OPEN,cash_usd='0.00362023',pending={'s02-attempt-1':'0.20914624'});s=self.session(o)
        try:
            with self.assertRaises(Stop):s.one(lambda *a:self.fail('send'))
            self.assertEqual(s.l['pending'],o['pending']);self.assertEqual(s.l['held_stage_usd'],'2.51')
        finally:s.close()
    def test_22_original_attempt_cap(self):
        s=self.session(dict(OPEN,attempts=12))
        try:
            with self.assertRaises(Stop):s.one(lambda *a:self.fail('send'),synthetic=True)
        finally:s.close()
    def test_23_refusal_cap_route_known_cost_no_release(self):
        s=self.session()
        try:
            raw=response();raw['choices'][0]['message']['refusal']='refused';raw['usage']['completion_tokens']=9000;raw['model']='wrong'
            s.one(lambda *a:raw,synthetic=True);p=unique_json((s.root/'c0001/parsed.json').read_bytes());self.assertIn('explicit_refusal',p['errors']);self.assertIn('model_identity',p['guard_errors']);self.assertIn('output_cap_or_accounting',p['guard_errors']);self.assertEqual(s.l['cash_usd'],'0');self.assertEqual(p['reported_cost_usd'],'0.001');self.assertFalse(p['canonical_acceptance'])
        finally:s.close()
    def test_24_wrong_manifest_no_reenter(self):
        s=self.session();s.close();m=unique_json((self.root/'manifest.json').read_bytes());m['total_limit_usd']='4';save(self.root/'manifest.json',m)
        with self.assertRaises(Stop):Session(self.root/'manifest.json',self.root/'runtime')
    def test_25_old_approval_before_credentials_network(self):
        s=self.session();s.close();p=self.root/'old-approval.json';save(p,{'status':'APPROVED','purpose':'Q12'})
        with patch('session.os.environ',new={}),patch('session.transport.http',side_effect=AssertionError('network')):
            with self.assertRaises(Stop):live_one(self.root/'manifest.json',self.root/'live',p,digest(p.read_bytes()),'MUST_NOT_RESOLVE')
    def test_26_compare_common_cells_and_identity(self):
        b=baseline(TITLE,{k:5 for k in KEYS},{'source_sha256':'a'*64,'locator':'fixture'});c=copy.deepcopy(b);c['mapped'][KEYS[0]]=None;c['mapped'][KEYS[1]]=8;r=compare(c,b);self.assertEqual(r['overall']['compared'],73);self.assertAlmostEqual(r['overall']['mean_absolute_disagreement'],3/73);self.assertEqual(r['candidate_abstentions'],1);self.assertEqual(r['candidate_noncomparable_cells'],1);self.assertTrue(r['not_factual_error']);self.assertIn('craft_quality',r)
        c['identity']['year']=2002
        with self.assertRaises(ValueError):compare(c,b)
    def test_27_demo_report_schema_and_privacy(self):
        d=self.root/'demo';result=demo(d);self.assertEqual(result['real_network_sends'],0)
        import jsonschema
        report=unique_json((d/'review/review-report.json').read_bytes());jsonschema.validate(report,unique_json((Path(__file__).parent/'review.schema.json').read_bytes()));self.assertEqual(report['evidence_kind'],'synthetic');self.assertTrue(all(r['recommendation']=='unreviewed' for r in report['model_results']))
        self.assertTrue(all(not p.stat().st_mode&0o077 for p in d.rglob('*')))
    def test_28_unknown_adapter_disabled(self):
        c=dict(self.c,adapter='not-a-plugin')
        with self.assertRaises(ValueError):render(TITLE,c)
    def test_29_no_probability_to_intensity(self):
        c=copy.deepcopy(CONFIG[1]);a={k:{'type':'score','score':4,'probabilities':{str(i):.1 if i==0 else .9 if i==9 else 0 for i in range(10)}} for k in KEYS};p=TypeSafe.parse({'answers':a},TITLE,c);self.assertIsNone(p['mapped'][KEYS[0]]);self.assertAlmostEqual(p['diagnostic_projection'][KEYS[0]],40/9);self.assertEqual(p['native'],a)
    def test_30_manifest_request_tamper(self):
        m=freeze([TITLE],[self.c],OPEN);m['titles'][0]['scope']='other'
        with self.assertRaises(Stop):validate_manifest(m)


    def test_31_post_preflight_approval_changed_no_reservation(self):
        m=freeze([TITLE],[self.c],OPEN,'0.02');c=m['candidates'][0];c.update(enabled=True,admission_status='REVIEWED',input_bound_proof_status='REVIEWED',input_bound_tokens=100,output_accounting='completion_includes_reasoning');save(self.root/'manifest.json',m,exclusive=True)
        calls=[]
        def http(key,method,path,*args,**kwargs):calls.append((method,path));return {'data':{'limit_remaining':1}}
        with patch('session.approved',side_effect=[(m,{'runtime_path':str((self.root/'runtime').resolve())}),Stop('approval_changed')]),patch('session.os.environ',new={'FIXTURE_ONLY_KEY':'fixture-secret'}),patch('session.transport.http',side_effect=http):
            with self.assertRaises(Stop):live_one(self.root/'manifest.json',self.root/'runtime','unused','unused','FIXTURE_ONLY_KEY')
        self.assertEqual(calls,[('GET','key')]);self.assertFalse(unique_json((self.root/'runtime/ledger.json').read_bytes())['attempts'])
    def test_32_known_charge_adoption_stale_receipt_no_clear(self):
        s=self.session()
        try:
            s.one(lambda *args:response(),synthetic=True);r={'status':'ROOT_REVIEWED','ledger_sha256':'wrong','cell_id':'c0001'};p=self.root/'receipt.json';save(p,r)
            with self.assertRaises(Stop):adopt_reconciliation(s,p,digest(p.read_bytes()))
            self.assertEqual(s.l['pending'],{'c0001':'0.01'})
        finally:s.close()
    def test_33_no_double_count_reasoning(self):
        s=self.session()
        try:
            raw=response();raw['usage'].update(completion_tokens=8192,completion_tokens_details={'reasoning_tokens':100});s.one(lambda *args:raw,synthetic=True);p=unique_json((s.root/'c0001/parsed.json').read_bytes());self.assertNotIn('output_cap_or_accounting',p['guard_errors'])
        finally:s.close()
    def test_34_global_cap_no_send(self):
        s=self.session(dict(OPEN,cash_usd='4.999'))
        try:
            with self.assertRaises(Stop):s.one(lambda *a:self.fail('send'),synthetic=True)
            self.assertFalse(s.l['attempts'])
        finally:s.close()


    def test_35_explicit_native_unknown_overrides_numeric_zero(self):
        answers={k:{'score':0,'state':'unknown'} for k in KEYS};p=TypeSafe.parse({'answers':answers},TITLE,CONFIG[1]);self.assertTrue(all(v is None for v in p['mapped'].values()));self.assertEqual(p['native'][KEYS[0]]['score'],0)


    def test_36_retired_carry_requires_exact_exception_and_new_envelope_once(self):
        o=dict(OPEN,accounting_kind='retired_stage_carry',cash_usd='0.00362023',pending={'s02-attempt-1':'0.20914624'},held_stage_usd='0');s=self.session(o)
        s.m['allocation_disposition_reviewed']=True
        try:
            with self.assertRaises(Stop):s.one(lambda *a:self.fail('send'))
            s.one(lambda *a:response(),carried_pending_exception=o['pending']);self.assertEqual(s.l['cash_usd'],'0.00362023');self.assertEqual(s.l['held_stage_usd'],'0');self.assertEqual(s.l['new_stage_reservation_usd'],'0');self.assertEqual(s.l['pending'],{'s02-attempt-1':'0.20914624','c0001':'0.01'})
            with self.assertRaises(Stop):s.one(lambda *a:self.fail('send'),carried_pending_exception=o['pending'])
        finally:s.close()


if __name__=='__main__':unittest.main()
