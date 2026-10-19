"""Native interface regression checks, all fake urllib/fixtures."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from core import *
from adapters import render,ADAPTERS,register_native
from native_routes import *
from bench import freeze
from report import assemble
from test_bench import TITLE,FakeResponse,Opener,OPEN
import transport


def config(adapter='openrouter-systemone-map-v1',states=True):
    return {'id':'synthetic-native','adapter':adapter,'model':'SYNTHETIC','provider':'SYNTHETIC','option_bank':'choice16_states' if states else 'choice11','native_kind':'choice11','compatibility_lane':'strict_v1','full_cost_bound_usd':None,'mapping':{'kind':'choice_labels','labels':dict(NUMERIC,**{s:None for s in STATES}) if states else NUMERIC}}


def response(c,keys=KEYS):
    labels=bank(c);answers={k:{'type':'choice','choice':'V00','probabilities':{label:1 if label=='V00' else 0 for label in labels},'confidence':.8} for k in keys}
    if c['adapter']=='celeris-decisions-list-v1':
        answers=[dict(a,name=k,probabilities=[{'value':v,'probability':p} for v,p in a['probabilities'].items()]) for k,a in answers.items()]
    return {'model':'SYNTHETIC','answers':answers,'usage':{'input_tokens':100,'output_tokens':0}}


class NativeChecks(unittest.TestCase):
    def test_01_exact_native_endpoints_fake_urllib_no_chat_keys(self):
        for adapter,url in ENDPOINTS.items():
            with self.subTest(adapter=adapter):
                c=config(adapter);r=render(TITLE,c);op=Opener(FakeResponse(wire(response(c))));raw=transport.http('fixture-secret','POST','native/'+adapter,wire(r['body']),opener_factory=lambda:op)
                self.assertEqual(op.calls[0].full_url,url);self.assertEqual(len(op.calls),1);self.assertEqual(op.calls[0].data,wire(r['body']));self.assertNotIn('messages',r['body']);self.assertNotIn('max_tokens',r['body']);self.assertNotIn('max_completion_tokens',r['body']);self.assertNotIn('reasoning',r['body']);self.assertTrue(ADAPTERS[adapter].parse(raw,TITLE,c)['format_valid'])
    def test_02_11_vs_16_unknown_and_zero(self):
        c=config();raw=response(c);raw['answers'][KEYS[0]]['choice']='U_INSUFFICIENT';p=NativeChoice.parse(raw,TITLE,c);self.assertIsNone(p['mapped'][KEYS[0]]);self.assertEqual(p['mapped'][KEYS[1]],0);self.assertEqual(p['assessment_states'][KEYS[0]],'unknown_insufficient');self.assertEqual(p['native'][KEYS[0]]['confidence'],.8)
        small=config(states=False);self.assertEqual(len(render(TITLE,small)['body']['questions'][KEYS[0]]['criteria']),11);self.assertFalse(NativeChoice.parse(raw,TITLE,small)['format_valid'])
    def test_03_no_forced_16_on_small_limit(self):
        c=config();c['max_choice_options']=11
        with self.assertRaises(ValueError):render(TITLE,c)
        c['option_bank']='choice11';self.assertEqual(len(render(TITLE,c)['body']['questions'][KEYS[0]]['criteria']),11)
    def test_04_duplicate_celeris_and_probability(self):
        c=config('celeris-decisions-list-v1');raw=response(c);raw['answers'].append(copy.deepcopy(raw['answers'][0]));self.assertIn('corrected_choice_contract_failure',NativeChoice.parse(raw,TITLE,c)['errors'])
        raw=response(config());raw['answers'][KEYS[0]]['probabilities']['V00']=2;self.assertFalse(NativeChoice.parse(raw,TITLE,config())['format_valid'])
    def test_05_explicit_64_10_complete_and_call_denominator(self):
        c=config('systemone-map-v1');c.update(request_batches=[64,10],max_questions=64);m=freeze([TITLE],[c],OPEN);self.assertEqual([len(x['expected_keys']) for x in m['cells']],[64,10]);parts=[]
        for cell in m['cells']:
            sub=dict(c,field_keys=cell['expected_keys']);r=render(TITLE,sub);p=NativeChoice.parse(response(c,cell['expected_keys']),TITLE,sub);p.update(candidate_id=c['id'],cell_id=cell['id'],input_sha256=r['input_sha256'],charge_status='unknown',pending_bound_usd='0.01');parts.append(p)
        all_=assemble_chunks(parts,[KEYS[:64],KEYS[64:]]);self.assertEqual(all_['actual_subcalls'],2);self.assertEqual(len(all_['mapped']),74);self.assertTrue(all_['format_valid']);self.assertIsNone(all_['transport_seconds'])
        report=assemble(m,parts,[],evidence_kind='new_observation');row=report['model_results'][0];self.assertEqual(row['coverage']['expected_titles'],1);self.assertEqual(row['coverage']['expected_cells'],74);self.assertEqual(row['coverage']['strict74_titles'],1);self.assertEqual(row['efficiency']['paid_requests'],2);self.assertEqual(row['efficiency']['pending_bound_usd'],.02)
        with self.assertRaises(ValueError):assemble_chunks(parts[:1],[KEYS[:64],KEYS[64:]])
    def test_06_chunk_identity_and_overlap(self):
        c=config();p=NativeChoice.parse(response(c),TITLE,c);p['input_sha256']='a'
        with self.assertRaises(ValueError):assemble_chunks([p,p],[KEYS,KEYS])
    def test_07_empty_supported_parameters_not_a_schema_rejection(self):
        c=config();c['supported_parameters']=[];self.assertEqual(len(render(TITLE,c)['body']['questions']),74)


    def test_08_corrected_score_and_celeris_withhold_numeric_only(self):
        from adapters import TypeSafe
        from test_bench import CONFIG
        raw={'answers':{k:{'type':'score','score':9,'probabilities':{str(i):int(i==0) for i in range(10)}} for k in KEYS}}
        result=TypeSafe.parse(raw,TITLE,CONFIG[1]);self.assertIsNone(result['mapped'][KEYS[0]]);self.assertEqual(result['diagnostic_projection'][KEYS[0]],10);self.assertEqual(result['distribution_diagnostics'][KEYS[0]]['distribution_expected_level'],0)
        c=config('celeris-decisions-list-v1');raw=response(c);raw['answers'][0]['probabilities']=[{'value':label,'probability':.95 if label=='V00' else 0} for label in bank(c)];result=NativeChoice.parse(raw,TITLE,c);self.assertIsNone(result['mapped'][KEYS[0]]);self.assertFalse(result['distribution_diagnostics'][KEYS[0]]['eligibility_flags']['distribution_unit_mass']);self.assertFalse(result['distribution_diagnostics'][KEYS[0]]['probabilities_renormalized']);self.assertEqual(result['native'][0]['choice'],'V00');self.assertEqual(result['mapped'][KEYS[1]],0)
    def test_09_jev_mode_marker_not_proof(self):
        c=config('direct-jev-choice-v1');c['model']='jev-1.14.0';r=render(TITLE,c);self.assertEqual(r['request_bytes'],len(wire(r['body'])));self.assertIn('MARKER',r['jev_mode_qualification'])


if __name__=='__main__':unittest.main()
