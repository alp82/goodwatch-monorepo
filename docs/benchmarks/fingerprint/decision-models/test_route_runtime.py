"""Real pipeline/urllib with synthetic public, native and billing responses only."""
import copy
import io
from pathlib import Path
import tempfile
import unittest
import urllib.error
from unittest.mock import patch
from core import KEYS,wire,digest,unique_json
from bench import freeze
from adapters import render
from session import Session,save,Stop,live_one
from test_bench import TITLE,Opener,FakeResponse
from test_native import config,response
from route_runtime import ROUTES,CONTRACT,POLICY,metadata_join,public_preflight,SHAPE
import transport


def candidate():
    r=next(iter(ROUTES.values()));c=config();c.update(id=r['candidate_id'],route_contract_id=r['candidate_id'],model=r['model'],provider=r['provider_tag'],max_price=r['documented_max_price_proposal'],native_guard_mode='documented-server-price-filter-v1',input_cap=262144,input_bound_tokens=262144,total_output_cap=8192,full_cost_bound_usd='.011010048',allowed_returned_models=[r['model'],r['advertised_dated_slug']],allowed_returned_providers=[r['provider_display_name']])
    return c


def catalog(r):
    return {'data':{'id':r['model'],'endpoints':[{'name':r['provider_display_name']+' | '+r['advertised_dated_slug'],'model_id':r['model'],'tag':r['provider_tag'],'provider_name':r['provider_display_name'],'context_length':r['context_tokens'],'max_prompt_tokens':r['max_prompt_tokens_metadata'],'status':0,'pricing':{'prompt':str(__import__('decimal').Decimal(r['documented_max_price_proposal']['prompt'])/1000000),'completion':'0'}}]}}


def native_and_metadata(c):
    r=ROUTES[c['id']];raw=response(c);raw.update(model=c['model'],id='gen-dec-SYNTHETIC-FIXTURE');raw['usage']={'input_tokens':100,'output_tokens':20}
    required={}
    for k in SHAPE['generation_required']:
        spec=SHAPE['generation_properties'][k];types=spec.get('type');types=[types] if isinstance(types,str) else types
        required[k]=None if 'null' in types else False if 'boolean' in types else 0 if 'number' in types or 'integer' in types else spec.get('enum',['SYNTHETIC'])[0]
    meta={'data':{'id':raw['id'],'model':r['advertised_dated_slug'],'provider_name':r['provider_display_name'],'api_type':'decisions','total_cost':.0000042,'native_tokens_prompt':100,'native_tokens_completion':20,'native_tokens_reasoning':None,'native_tokens_cached':None,'tokens_prompt':999,'user_id':'SYNTHETIC-MUST-NOT-PERSIST','session_id':'SYNTHETIC-MUST-NOT-PERSIST'}}
    values=meta['data'];required.update(values);required.update(is_byok=False,data_region='global',usage=.0000042);meta['data']=required
    return raw,meta


class Routes(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.root.chmod(0o700)
    def tearDown(self):self.tmp.cleanup()
    def join(self,raw=None,meta=None):
        c=candidate();a,b=native_and_metadata(c);raw=raw or a;meta=meta or b;calls=[]
        def lookup(path,artifact,index):
            calls.append(path);return transport.http('SYNTHETIC-KEY','GET',path,decoder=unique_json,opener_factory=lambda:Opener(FakeResponse(wire(meta))),sink=transport.PrivateEvidence(artifact/('meta-http-'+str(index))),retain_success_raw=False)
        out=metadata_join(raw,c,c['full_cost_bound_usd'],lookup,self.root,sleep=lambda n:self.fail('unexpected delay'))
        return out,calls
    def test_missing_provider_cost_alias_dated_and_null_usage(self):
        out,calls=self.join();self.assertEqual(out['binding_conflicts'],[]);self.assertEqual(out['metadata_GET_attempts'],1);self.assertEqual(out['reported_cost_usd'],'0.0000042');self.assertIsNone(out['body_reported_provider']);self.assertEqual(out['metadata_literal']['tokens_prompt'],999);self.assertIsNone(out['metadata_literal']['native_tokens_reasoning']);self.assertFalse(out['immutable_weights_verified']);self.assertIsNone(out['independent_region_attestation'])
        self.assertNotIn('SYNTHETIC-MUST-NOT-PERSIST',str(out));self.assertEqual(list(self.root.rglob('*.successful-response.private.bin')),[])
    def test_provider_id_model_cost_and_api_conflicts_stop_after_one(self):
        for i,(path,value,code) in enumerate([('id','gen-dec-OTHER','metadata_id_conflict'),('model','typesafe/jev-OTHER','metadata_model_conflict'),('provider_name','Azure','metadata_provider_conflict'),('api_type','completions','metadata_api_type_conflict'),('total_cost',-1,'metadata_cost_missing_or_invalid')]):
            p=self.root/str(i);p.mkdir(mode=0o700);c=candidate();raw,meta=native_and_metadata(c);meta['data'][path]=value;calls=[]
            def get(*args):calls.append(1);return meta
            out=metadata_join(raw,c,'.011010048',get,p,sleep=lambda n:self.fail('delay'));self.assertIn(code,out['binding_conflicts']);self.assertEqual(len(calls),1)
    def test_missing_generation_id_never_guesses_from_request_id(self):
        c=candidate();raw,meta=native_and_metadata(c);raw.pop('id');raw['request_id']='req-SYNTHETIC'
        out=metadata_join(raw,c,'.011010048',lambda *a:self.fail('lookup'),self.root);self.assertIn('generation_id_missing_or_invalid',out['binding_conflicts']);self.assertEqual(out['metadata_GET_attempts'],0)
    def test_native_required_counts_never_use_chat_tokens(self):
        c=candidate();raw,meta=native_and_metadata(c);raw['usage']={'prompt_tokens':100,'completion_tokens':20};out,_=self.join(raw,meta);self.assertIn('native_required_count_or_threshold:input_tokens',out['binding_conflicts']);self.assertIn('native_usage_conflict:native_tokens_prompt',out['binding_conflicts'])
    def test_conflicting_inline_cost_and_provider_retained(self):
        c=candidate();raw,meta=native_and_metadata(c);raw['usage']['cost']=.00001;out,_=self.join(raw,meta);self.assertIn('inline_metadata_cost_conflict',out['binding_conflicts']);self.assertEqual(out['native_usage_literal']['cost'],.00001);self.assertEqual(out['metadata_literal']['total_cost'],.0000042)
    def test_GET_three_only404_then_2_and5_seconds_no_POST(self):
        c=candidate();raw,meta=native_and_metadata(c);calls=[];delays=[];now=[0]
        def sleep(n):delays.append(n);now[0]+=n
        def lookup(path,artifact,index):
            op=Opener(error=urllib.error.HTTPError('https://example.invalid',404,'ignored',{},io.BytesIO(b'{"error":{"code":404}}')));calls.append(op)
            return transport.http('SYNTHETIC-KEY','GET',path,opener_factory=lambda:op)
        out=metadata_join(raw,c,'.011010048',lookup,self.root,sleep=sleep,clock=lambda:now[0]);self.assertEqual(delays,[2,3]);self.assertEqual(len(calls),3);self.assertTrue(all(op.calls[0].method=='GET' for op in calls));self.assertEqual(out['guard_status'],'held')
    def test_GET_auth_and_timeout_have_no_retry(self):
        for i,error in enumerate([urllib.error.HTTPError('https://example.invalid',401,'ignored',{},io.BytesIO(b'{}')),urllib.error.URLError(TimeoutError())]):
            p=self.root/str(i);p.mkdir(mode=0o700);c=candidate();raw,_=native_and_metadata(c);calls=[]
            def get(path,artifact,index):
                op=Opener(error=error);calls.append(op);return transport.http('SYNTHETIC-KEY','GET',path,opener_factory=lambda:op)
            out=metadata_join(raw,c,'.011010048',get,p,sleep=lambda n:self.fail('retry'));self.assertEqual(len(calls),1);self.assertEqual(out['guard_status'],'held')
    def test_public_exact_six_no_authorization_and_tariff_units(self):
        calls=[]
        def get(path):
            r=next(r for r in ROUTES.values() if path=='models/'+r['model']+'/endpoints');op=Opener(FakeResponse(wire(catalog(r))));calls.append(op);return transport.http(None,'GET',path,public=True,opener_factory=lambda:op)
        self.assertEqual(len(public_preflight(get)),6);self.assertTrue(all(op.calls[0].get_header('Authorization') is None for op in calls))
        with self.assertRaises(transport.TransportFailure):transport.http('DO-NOT-SEND','GET',next(iter(transport.PUBLIC_CATALOG_PATHS)),public=True,opener_factory=lambda:self.fail('opener'))
        def wrong(path):
            r=next(r for r in ROUTES.values() if path=='models/'+r['model']+'/endpoints');obj=catalog(r);obj['data']['endpoints'][0]['pricing']['prompt']=r['documented_max_price_proposal']['prompt'];return obj
        with self.assertRaisesRegex(Stop,'tariff'):public_preflight(wrong)
    def test_price_guard_routing_only_model_state_questions_identical(self):
        c=candidate();guarded=render(TITLE,c)['body'];plain=dict(c);plain.pop('native_guard_mode');plain['native_priceguard_supported']=False;old=render(TITLE,plain)['body'];self.assertEqual(guarded['state'],old['state']);self.assertEqual(guarded['questions'],old['questions']);changed=copy.deepcopy(guarded);changed['provider'].pop('max_price');self.assertEqual(changed,old);self.assertTrue(all(isinstance(v,str) for v in guarded['provider']['max_price'].values()))
    def test_F1_restart_never_resets_or_reissues_ambiguous_read(self):
        c=candidate();raw,meta=native_and_metadata(c);calls=[]
        def crash(path,artifact,index):
            calls.append(path);self.assertEqual(unique_json((artifact/'metadata-read-state.json').read_bytes())['attempted_GETs'],1);raise SystemExit('synthetic-process-stop')
        with self.assertRaises(SystemExit):metadata_join(raw,c,'.011010048',crash,self.root,context={'request_sha256':digest(b'fixture')})
        out=metadata_join(raw,c,'.011010048',lambda *a:self.fail('restart read'),self.root,context={'request_sha256':digest(b'fixture')});self.assertEqual(out['metadata_GET_attempts'],1);self.assertIn('metadata_restart_paused_no_automatic_reads',out['binding_conflicts']);self.assertEqual(len(calls),1)
    def test_F2_required_missing_is_malformed200_not404_retry(self):
        for i,key in enumerate(['api_type','native_tokens_prompt','provider_responses','is_byok','data_region']):
            p=self.root/str(i);p.mkdir(mode=0o700);c=candidate();raw,meta=native_and_metadata(c);meta['data'].pop(key);calls=[]
            def lookup(*a):calls.append(1);return meta
            out=metadata_join(raw,c,'.011010048',lookup,p,sleep=lambda n:self.fail('retry'));self.assertIn('metadata_missing:'+key,out['binding_conflicts']);self.assertEqual(len(calls),1);self.assertEqual(out['guard_status'],'held')
    def test_F2_required_nullable_preserves_actual_nulls(self):
        c=candidate();raw,meta=native_and_metadata(c)
        for k in ['api_type','native_tokens_prompt','provider_responses']:meta['data'][k]=None
        out,_=self.join(raw,meta);self.assertEqual(out['binding_conflicts'],[])
        for k in ['api_type','native_tokens_prompt','provider_responses']:self.assertIsNone(out['metadata_literal'][k])
    def test_F2_nonnullable_null_and_bool_token_are_invalid(self):
        for i,(key,value) in enumerate([('data_region',None),('is_byok',None),('native_tokens_prompt',True)]):
            p=self.root/str(i);p.mkdir(mode=0o700);c=candidate();raw,meta=native_and_metadata(c);meta['data'][key]=value
            out=metadata_join(raw,c,'.011010048',lambda *a:meta,p,sleep=lambda n:self.fail('retry'));self.assertIn('metadata_type:'+key,out['binding_conflicts'])

    def live_fixture(self):
        c=candidate();c.update(enabled=True,admission_status='REVIEWED',input_bound_proof_status='REVIEWED')
        opening={'accounting_kind':'retired_stage_carry','cash_usd':'0.00362023','pending':{'s02-attempt-1':'0.20914624'},'held_stage_usd':'0','attempts':3,'initial_attempt_capacity_total':72,'retries':0,'semantic_hold':False}
        m=freeze([TITLE],[c],opening,'.1');m.update(allocation_disposition_reviewed=True,native_metadata_policy=POLICY)
        proof=self.root/'fixture-root-documentary.json';save(proof,{'status':'ROOT_REVIEWED','fixture_only':True,'request_hashes':[x['request_sha256'] for x in m['cells']],'model':c['model'],'provider':c['provider'],'guard_mode':c['native_guard_mode'],'max_price':c['max_price'],'source_matrix_sha256':CONTRACT['source_matrix_sha256'],'source_schema_sha256':CONTRACT['source_schema_sha256'],'metadata_policy':POLICY,'input_bound_tokens':c['input_bound_tokens'],'output_observed_threshold':8192,'provider_enforced_output_cap':False,'native_work_profile':ROUTES[c['id']]['native_work']});m['candidates'][0].update(native_guard_receipt_path=str(proof),native_guard_receipt_sha256=digest(proof.read_bytes()))
        mp=self.root/'manifest.json';save(mp,m);rt=self.root/'runtime';a={'runtime_path':str(rt.resolve()),'carried_pending_exception':opening['pending'],'human_authorization_record_sha256':digest(b'fixture-human'),'root_release_sha256':digest(b'fixture-root'),'synthetic':True,'route_input_exceptions':{c['id']:c['input_cap']}}
        return c,m,mp,rt,a

    def test_actual_live_pipeline_faked_public_POST_join_preserves_liability(self):
        c,m,mp,rt,a=self.live_fixture();calls=[];real=transport.http
        def fake(key,method,path,body=None,**kwargs):
            calls.append((method,path,key));raw,meta=native_and_metadata(c)
            if path in transport.PUBLIC_CATALOG_PATHS:r=next(r for r in ROUTES.values() if path=='models/'+r['model']+'/endpoints');obj=catalog(r)
            elif path=='key':obj={'data':{'limit_remaining':1}}
            elif method=='POST':obj=raw
            else:obj=meta
            return real(key,method,path,body,opener_factory=lambda:Opener(FakeResponse(wire(obj))),**kwargs)
        with patch('session.approved',return_value=(m,a)),patch('session.os.environ',new={'FIXTURE_KEY':'SYNTHETIC-KEY'}),patch('session.transport.http',side_effect=fake):live_one(mp,rt,'fixture-only',digest(b'fixture-approval'),'FIXTURE_KEY')
        self.assertEqual(len(calls),9);self.assertEqual([x[0] for x in calls].count('POST'),1);self.assertTrue(all(x[2] is None for x in calls[:6]));ledger=unique_json((rt/'ledger.json').read_bytes());self.assertEqual(ledger['cash_usd'],'0.00362023');self.assertEqual(ledger['pending'],{'s02-attempt-1':'0.20914624','c0001':'0.011010048'});self.assertEqual(ledger['state'],'paused_output_review');parsed=unique_json((rt/'c0001/parsed.json').read_bytes());self.assertEqual(parsed['guard_errors'],[]);self.assertIsNone(parsed['native_generation_join']['metadata_literal']['native_tokens_reasoning']);self.assertFalse(parsed['canonical_acceptance'])

    def test_public_drift_latches_without_credentials_reservation_or_relaunch(self):
        c,m,mp,rt,a=self.live_fixture();calls=[];real=transport.http
        def fake(key,method,path,**kwargs):
            calls.append(path);r=next(r for r in ROUTES.values() if path=='models/'+r['model']+'/endpoints');obj=catalog(r);obj['data']['endpoints'][0]['pricing']['prompt']='1'
            return real(key,method,path,opener_factory=lambda:Opener(FakeResponse(wire(obj))),**kwargs)
        with patch('session.approved',return_value=(m,a)),patch('session.os.environ.get',side_effect=AssertionError('credential')),patch('session.transport.http',side_effect=fake):
            for i in range(2):
                with self.assertRaises(Stop):live_one(mp,rt,'fixture-only',digest(b'fixture-approval'),'NEVER')
        self.assertEqual(len(calls),1);l=unique_json((rt/'ledger.json').read_bytes());self.assertEqual(l['attempts'],[]);self.assertEqual(l['non_inference_read_attempts'],{'public_endpoint_GETs':1});self.assertEqual(l['state'],'paused_preflight_or_authority_no_dispatch');self.assertEqual(l['pending'],{'s02-attempt-1':'0.20914624'})


if __name__=='__main__':unittest.main()
