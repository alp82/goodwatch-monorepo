"""Focused reviewed-parser and rolling-policy regressions. Synthetic, no credentials."""
import copy
from decimal import Decimal
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from core import KEYS, wire, digest, unique_json
from adapters import TypeSafe, render
from native_routes import NativeChoice, assemble_chunks
from session import Session, Stop, save, adopt_reconciliation, next_bound_check, live_one
from bench import freeze
from test_bench import TITLE, CONFIG, OPEN, response, FakeResponse, Opener
from test_native import config, response as native_response
import transport


def score(x=2.25):
    return {'answers':{k:{'type':'score','score':x,'probabilities':{str(i):.75 if i==2 else .25 if i==3 else 0 for i in range(10)}} for k in KEYS}}


class Integrated(unittest.TestCase):
    def test_score_positive_and_mismatch_raw_custody(self):
        raw=score();r=TypeSafe.parse(raw,TITLE,CONFIG[1],raw_response_bytes=wire(raw));self.assertEqual(r['mapped'][KEYS[0]],2.5);self.assertTrue(r['comparison_eligible']);self.assertEqual(r['normalization_envelope']['raw_response_sha256'],digest(wire(raw)))
        raw['answers'][KEYS[0]]['score']=9;r=TypeSafe.parse(raw,TITLE,CONFIG[1]);self.assertIsNone(r['mapped'][KEYS[0]]);self.assertEqual(r['diagnostic_projection'][KEYS[0]],10);self.assertEqual(r['native'],raw['answers'])
    def test_celeris_pairwise_distinct_from_mass_tolerance(self):
        c=config('celeris-decisions-list-v1')
        for a,b,eligible in [(.47,.53,False),(.495,.505,True),(.5,.5,True)]:
            raw=native_response(c)
            for p in raw['answers'][0]['probabilities']:p['probability']=a if p['value']=='V00' else b if p['value']=='V01' else 0
            r=NativeChoice.parse(raw,TITLE,c);self.assertEqual(r['mapped'][KEYS[0]] is not None,eligible);self.assertEqual(r['native'][0]['choice'],'V00');self.assertEqual(r['corrected_normalization']['comparison_scores_in_field_order'][0],r['mapped'][KEYS[0]])
    def test_metadata_conflict_overrides_numeric_and_exact_bytes_required(self):
        c=config();raw=native_response(c);r=NativeChoice.parse(raw,TITLE,c,custody={'source':'synthetic','model':'OTHER'});self.assertFalse(r['comparison_eligible']);self.assertTrue(all(v is None for v in r['mapped'].values()));self.assertEqual(r['diagnostic_projection'][KEYS[0]],0)
        with self.assertRaises(ValueError):NativeChoice.parse(raw,TITLE,c,raw_response_bytes=b'{}')
    def test_scaledown_whole_shared_state_text_no_explanation_call(self):
        c=config();generic=render(TITLE,c)['body'];c['state_renderer']='scaledown-text-v1';r=render(TITLE,c)['body'];self.assertEqual(unique_json(r['state']['text']),generic['state']);self.assertEqual(r['questions'],generic['questions']);self.assertNotIn('explain',r);self.assertEqual(set(r),{'model','provider','state','questions'})
    def test_chunk_second_guard_blocks_complete_ranking(self):
        c=config();parts=[]
        for keys in [KEYS[:64],KEYS[64:]]:
            sub=dict(c,field_keys=keys);r=NativeChoice.parse(native_response(sub,keys),TITLE,sub);r['input_sha256']='same';parts.append(r)
        parts[1]['guard_errors']=['provider_identity'];r=assemble_chunks(parts,[KEYS[:64],KEYS[64:]]);self.assertFalse(r['comparison_eligible']);self.assertIn('provider_identity',r['guard_errors'])
    def test_fixed_round_rotation_and_drex_bounds(self):
        a=config();a['id']='A';b=copy.deepcopy(a);b.update(id='DREX',request_batches=[64,10],request_cost_bounds_usd=['0.503316480','0.078643200'])
        m=freeze([TITLE,dict(TITLE,tmdb_id=900000002)],[a,b],OPEN)
        self.assertEqual([x['candidate_id'] for x in m['cells']],['A','DREX','DREX','DREX','DREX','A']);self.assertEqual([x['full_cost_bound_usd'] for x in m['cells'][1:3]],['0.503316480','0.078643200']);self.assertEqual([len(x['expected_keys']) for x in m['cells'][1:3]],[64,10])
    def setup_session(self,root,ceiling='.015'):
        c=copy.deepcopy(CONFIG[0]);c.update(allowed_returned_models=['fixture-model'],allowed_returned_providers=['fixture-provider']);b=copy.deepcopy(c);b['id']='second'
        o=dict(OPEN,accounting_kind='retired_stage_carry',cash_usd='0.00362023',pending={'s02-attempt-1':'0.20914624'},held_stage_usd='0')
        m=freeze([TITLE],[c,b],o,ceiling);m['allocation_disposition_reviewed']=True;save(root/'manifest.json',m,exclusive=True);return Session(root/'manifest.json',root/'runtime')
    def reconcile(self,s,cost='.001',action='resume_next_unattempted'):
        from test_settlement import settlement_fixture, disposition_fixture
        from session import dispose_review_hold
        p,h=settlement_fixture(s,cost);adopt_reconciliation(s,p,h)
        if action=='resume_next_unattempted' and not s.l.get('bound_breaches'):
            p,h=disposition_fixture(s);dispose_review_hold(s,p,h)
    def test_rolling_settlement_not_full_grid_encumbrance(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);root.chmod(0o700);s=self.setup_session(root)
            try:
                sends=[]
                def send(*a):sends.append(1);return response()
                s.one(send,carried_pending_exception=s.l['opening']['pending']);self.assertEqual(len(sends),1);self.assertEqual(s.l['new_stage_reservation_usd'],'0');self.assertEqual(s.l['cash_usd'],'0.00362023')
                self.reconcile(s);self.assertEqual(s.l['attempts'][0]['unused_reservation_released_usd'],'0.009');s.one(send,carried_pending_exception=s.l['opening']['pending']);self.assertEqual(len(sends),2);self.assertEqual(s.l['pending'],{'s02-attempt-1':'0.20914624','c0002':'0.01'});self.assertEqual(s.l['cash_usd'],'0.00462023')
                with self.assertRaises(Stop):s.one(send,carried_pending_exception=s.l['opening']['pending'])
                self.assertEqual(len(sends),2)
            finally:s.close()
    def test_unknown_new_charge_stops_even_if_cursor_forced_ready(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);root.chmod(0o700);s=self.setup_session(root,'.1')
            try:
                s.one(lambda *a:response(),carried_pending_exception=s.l['opening']['pending']);s.l['state']='ready'
                with self.assertRaises(Stop):s.one(lambda *a:self.fail('extra send'),carried_pending_exception=s.l['opening']['pending'])
                self.assertEqual(len(s.l['attempts']),1)
            finally:s.close()
    def test_next_unaffordable_no_skip_no_send(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);root.chmod(0o700);s=self.setup_session(root,'.01')
            try:
                s.one(lambda *a:response(),carried_pending_exception=s.l['opening']['pending']);self.reconcile(s)
                with self.assertRaisesRegex(Stop,'new_run_budget'):s.one(lambda *a:self.fail('extra send'),carried_pending_exception=s.l['opening']['pending'])
                self.assertEqual(s.l['cursor'],1);self.assertEqual(len(s.l['attempts']),1)
            finally:s.close()
    def test_overbound_no_release_even_with_headroom(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);root.chmod(0o700);s=self.setup_session(root,'.1')
            try:
                s.one(lambda *a:response(),carried_pending_exception=s.l['opening']['pending']);before=s.ledger.read_bytes()
                self.reconcile(s,'.011');self.assertNotEqual(s.ledger.read_bytes(),before)
                self.assertEqual(s.l['cash_usd'],'0.01462023');self.assertEqual(s.l['pending'],{'s02-attempt-1':'0.20914624'});self.assertEqual(s.l['state'],'stopped_accounting_bound_breach');self.assertEqual(s.l['attempts'][0]['unused_reservation_released_usd'],'0')
            finally:s.close()
    def test_each_hard_ceiling_before_reservation(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);root.chmod(0o700);s=self.setup_session(root,'.1')
            try:
                for key in ['total_limit_usd','title_limit_usd','new_run_budget_usd']:
                    old=s.m[key];s.m[key]='0.001'
                    with self.assertRaises(Stop):next_bound_check(s.m,s.l)
                    s.m[key]=old
                self.assertEqual(s.l['attempts'],[])
            finally:s.close()
    def test_real_fake_urllib_raw_then_parser_custody(self):
        c=config();raw=native_response(c);body=wire(raw);op=Opener(FakeResponse(body,headers={'Content-Type':'application/json','X-Request-ID':'fixture-id'}))
        with tempfile.TemporaryDirectory() as t:
            p=Path(t);p.chmod(0o700);r=transport.http('synthetic-secret','POST','native/'+c['adapter'],wire(render(TITLE,c)['body']),opener_factory=lambda:op,sink=transport.PrivateEvidence(p))
            files=list(p.glob('*.successful-response.private.bin'));self.assertEqual(len(files),1);parsed=NativeChoice.parse(r,TITLE,c,raw_response_bytes=files[0].read_bytes());self.assertEqual(parsed['normalization_envelope']['raw_response_sha256'],digest(body));self.assertEqual(len(op.calls),1)

class PreparationChecks(unittest.TestCase):
    def test_matrix_planned_not_full_grid_reservation(self):
        from preparation import matrix
        c=config();c.update(full_cost_bound_usd='.6',admission_status='UNVERIFIED',enabled=False,input_cap=16000)
        m=freeze([TITLE,dict(TITLE,tmdb_id=900000002)],[c],dict(OPEN,held_stage_usd='0'),'.7');r=matrix(m)
        self.assertEqual(r['planned_external_POSTs'],2);self.assertEqual(r['worst_case_affordable_fixed_prefix_POSTs'],1);self.assertEqual(r['individually_affordable_POSTs'],2);self.assertEqual(r['new_actual_reservations_usd'],'0');self.assertEqual(r['admitted_POSTs'],0)
    def test_prepared_source_exact_bytes_no_scores_in_view(self):
        from core import SCHEMA_HASH, CONTRACT, identity, state
        from preparation import catalog_inputs
        from core import baseline
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);root.chmod(0o700);p=root/'source';p.mkdir(mode=0o700);views=p/'model-inputs';views.mkdir(mode=0o700)
            data=wire(state(TITLE));(views/'fixture.json').write_bytes(data)
            item={'file':'model-inputs/fixture.json','sha256':digest(data),'id':f"movie:{TITLE['tmdb_id']}",'identity':identity(TITLE),'synopsis_source':{'sha256':digest(data)},'baseline_reference':'baselines.json/0'}
            m={'schema_sha256':SCHEMA_HASH,'field_order_sha256':CONTRACT['field_order_sha256'],'all_inputs':[item],'recommended_initial_ids':[item['id']]};save(p/'input-manifest.json',m)
            save(p/'baselines.json',[baseline(TITLE,{k:5 for k in KEYS},{'kind':'synthetic','source_sha256':digest(b'synthetic'),'locator':'fixture'})]);save(p/'synopsis-inputs.json',[dict(TITLE,synopsis_source={'private_reference':True})])
            result=catalog_inputs(p,root/'output');self.assertEqual(result['all_titles'],1);view=unique_json((root/'output/screen-model-inputs.json').read_bytes())[0];self.assertEqual(view,state(TITLE));self.assertNotIn('synopsis_source',view)
            (views/'fixture.json').write_bytes(data+b' ')
            with self.assertRaisesRegex(ValueError,'input_source_hash'):catalog_inputs(p,root/'tamper-output')
    def test_route_guard_excludes_distance_even_strict_v1(self):
        from report import assemble
        from core import baseline
        c=config();m=freeze([TITLE],[c],OPEN);r=NativeChoice.parse(native_response(c),TITLE,c);r.update(candidate_id=c['id'],guard_errors=['provider_identity'])
        b=baseline(TITLE,{k:1 for k in KEYS},{'kind':'synthetic','source_sha256':digest(b'x'),'locator':'fixture'});result=assemble(m,[r],[b]);self.assertEqual(result['model_results'][0]['baseline_disagreement'],[]);self.assertEqual(result['model_results'][0]['coverage']['strict74_titles'],0)
    def test_public_hard_allocations_cannot_widen_in_manifest(self):
        from session import validate_manifest
        c=config();m=freeze([TITLE],[c],OPEN)
        for key,val in [('total_limit_usd','6'),('title_limit_usd','4'),('new_retries',1),('cumulative_attempt_cap',73)]:
            bad=copy.deepcopy(m);bad[key]=val
            with self.assertRaises(Stop):validate_manifest(bad)
    def test_no_actual_approval_before_credentials_or_network(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);root.chmod(0o700);c=config();m=freeze([TITLE],[c],OPEN);save(root/'manifest.json',m);save(root/'unapproved.json',{'status':'UNAPPROVED'})
            with patch('session.os.environ.get',side_effect=AssertionError('credential')),patch('session.transport.http',side_effect=AssertionError('network')):
                with self.assertRaises(Stop):live_one(root/'manifest.json',root/'runtime',root/'unapproved.json',digest((root/'unapproved.json').read_bytes()),'TEST')
            self.assertFalse((root/'runtime').exists())

    def test_unmatched_title_averages_do_not_become_comparison(self):
        from report import matched_intersections
        from core import identity, baseline
        a={'identity':identity(TITLE),'mapped':{k:2 for k in KEYS}};b=copy.deepcopy(a);b['identity']['tmdb_id']=900000002
        ref=baseline(TITLE,{k:5 for k in KEYS},{'kind':'synthetic','source_sha256':digest(b'x'),'locator':'fixture'})
        rows=matched_intersections({'A':[a],'B':[b]},[ref]);self.assertEqual(rows[0]['same_title_field_pairs'],[])
        b['identity']=identity(TITLE);rows=matched_intersections({'A':[a],'B':[b]},[ref]);self.assertEqual(rows[0]['same_title_field_pairs'][0]['n'],74)
        b['mapped'][KEYS[0]]=None;self.assertEqual(matched_intersections({'A':[a],'B':[b]},[ref])[0]['same_title_field_pairs'],[])

    def test_approved_manifest_cannot_create_second_runtime(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);root.chmod(0o700);c=copy.deepcopy(CONFIG[0]);m=freeze([TITLE],[c],OPEN);save(root/'manifest.json',m)
            with patch('session.approved',return_value=(m,{'runtime_path':str((root/'one-authoritative-runtime').resolve())})),patch('session.os.environ.get',side_effect=AssertionError('credential')),patch('session.transport.http',side_effect=AssertionError('network')):
                with self.assertRaisesRegex(Stop,'exclusive_runtime_binding'):live_one(root/'manifest.json',root/'another-runtime','unused','unused','TEST')
            self.assertFalse((root/'another-runtime').exists())


if __name__=='__main__':unittest.main()
