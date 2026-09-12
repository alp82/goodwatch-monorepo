"""Offline guard checks: these never contact an API or spend credits."""
import copy
import unittest
from decimal import Decimal

import run


class Guards(unittest.TestCase):
    def setUp(self):
        self.meta = {'limit':9,'limit_remaining':9,'limit_reset':None,'usage':0,'byok_usage':0}
        self.reserved = {'usd':'0.1','input_token_allowance':1000}
        self.body = {'usage':{'cost':0.01,'prompt_tokens':100,'completion_tokens':200}}
        self.generation = {'total_cost':0.01,'is_byok':False,'native_tokens_completion':200}
        self.after = {**self.meta,'usage':0.01}

    def test_weekly_or_unlimited_key_fails(self):
        self.assertEqual(run.check_key(self.meta),[])
        for changes in [{'limit_reset':'weekly'},{'limit':None},{'limit':10},{'limit':0},{'byok_usage':0.1}]:
            with self.subTest(changes=changes):
                self.assertTrue(run.check_key({**self.meta,**changes}))

    def test_actual_cost_requires_three_way_reconciliation(self):
        self.assertEqual(Decimal(run.measured_charge(self.body,self.generation,self.meta,self.after,self.reserved)),Decimal('0.01'))
        for after in [{**self.after,'usage':0},{**self.after,'usage':0.02}]:
            with self.assertRaises(ValueError):
                run.measured_charge(self.body,self.generation,self.meta,after,self.reserved)

    def test_missing_usage_is_not_free(self):
        with self.assertRaises(KeyError):
            run.measured_charge({},self.generation,self.meta,self.after,self.reserved)

    def test_overspend_and_cap_overrun_stop(self):
        with self.assertRaises(ValueError):
            run.measured_charge(self.body,self.generation,self.meta,self.after,{**self.reserved,'usd':'0.001'})
        for field,value in [('prompt_tokens',1001),('completion_tokens',8193)]:
            body=copy.deepcopy(self.body);body['usage'][field]=value
            with self.assertRaises(ValueError):
                run.measured_charge(body,self.generation,self.meta,self.after,self.reserved)

    def test_byok_not_treated_as_free(self):
        with self.assertRaises(ValueError):
            run.measured_charge(self.body,{**self.generation,'is_byok':True},self.meta,self.after,self.reserved)

    def test_reservation_covers_price_overrides_and_cache_writes(self):
        route={'context_length':1000000,'pricing':{'prompt':'0.000001','completion':'0.000002',
            'discount':0.5,'overrides':[{'prompt':'0.000003','completion':'0.000004','input_cache_write':'0.000005'}]}}
        reservation=run.reservation({'messages':[]},route)
        expected=(Decimal(reservation['input_token_allowance'])*Decimal('0.000008')+8192*Decimal('0.000004'))*2
        self.assertEqual(Decimal(reservation['usd']),expected)

    def test_duplicate_json_and_abstention_not_repaired_into_validity(self):
        def body(text):
            return {'choices':[{'message':{'content':text},'finish_reason':'stop'}]}
        self.assertEqual(run.parse_output(body('{"a":1,"a":2}'),'movie:603')[0],'malformed_json')
        self.assertEqual(run.parse_output(body('{"unknown":true}'),'movie:603')[0],'abstention')
        self.assertEqual(run.parse_output(body('```json\n{}\n```'),'movie:603')[0],'malformed_json')

    def test_canonical_model_identity_requires_public_mapping(self):
        body={'model':'deepseek/deepseek-v4.1-flash'}
        generation={'model':'deepseek/deepseek-v4.1-flash-20260910','provider_name':'DeepInfra'}
        run.check_identity(body,generation,body['model'],{'provider_name':'DeepInfra'})
        with self.assertRaises(ValueError):
            run.check_identity(body,{**generation,'model':'deepseek/other'},body['model'],{'provider_name':'DeepInfra'})
        with self.assertRaises(ValueError):
            run.check_identity(body,generation,body['model'],{'provider_name':'Another provider'})

    def test_frozen_request_order_and_settings(self):
        candidates,pairs=run.build_requests()
        self.assertEqual(len(candidates),13)
        self.assertEqual(len({(p['candidate_index'],p['benchmark_id']) for p in pairs}),130)
        for p in pairs:
            self.assertEqual(p['payload']['max_tokens'],8192)
            self.assertFalse(p['payload']['provider']['allow_fallbacks'])
            for forbidden in ['temperature','top_p','seed','plugins','tools','models']:
                self.assertNotIn(forbidden,p['payload'])
        self.assertEqual(sum(p['payload']['response_format']['type']=='json_object' for p in pairs),10)


if __name__=='__main__':
    unittest.main()
