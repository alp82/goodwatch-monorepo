"""Documented native request subsets, offline registration; no SDK or HTTP imports.

Based on provider owner's native_contract.py. Same harness synopsis/policy is used;
provider compact examples are provenance, never silently substituted prompts.
"""
import copy
import math
from core import CONTRACT, KEYS, SCHEMA_HASH, identity, state, wire
from adapters import POLICY

STATES={'U_INSUFFICIENT':'unknown_insufficient','U_CONFLICT':'unknown_conflict','U_ID_SCOPE':'unknown_identity_scope','NA':'not_applicable','NOT_ASSESSED':'not_assessed'}
NUMERIC={f'V{i:02d}':i for i in range(11)}
ENDPOINTS={
 'openrouter-systemone-map-v1':'https://openrouter.ai/api/v1/systemone',
 'openrouter-decisions-map-v1':'https://openrouter.ai/api/alpha/decisions',
 'direct-jev-choice-v1':'https://api.typesafe.ai/v1/systemone',
 'celeris-decisions-list-v1':'https://inference.celeris.ai/celeris-1-decision/v1/decisions',
 'systemone-map-v1':'https://api.bespokelabs.ai/v1/systemone',
}


def bank(c):
    option_bank=c['option_bank']
    if option_bank not in ('choice11','choice16_states'):raise ValueError('native_option_bank')
    return dict(NUMERIC,**({k:None for k in STATES} if option_bank=='choice16_states' else {}))


class NativeChoice:
    @staticmethod
    def render(t,c):
        adapter=c['adapter']
        if adapter not in ENDPOINTS:raise ValueError('native_endpoint_not_registered')
        labels=bank(c);keys=c.get('field_keys',KEYS)
        if not keys or len(keys)!=len(set(keys)) or keys!=[k for k in KEYS if k in keys]:raise ValueError('native_chunk_order')
        if c.get('max_choice_options') is not None and len(labels)>c['max_choice_options']:raise ValueError('known_native_option_limit')
        if c.get('max_questions') is not None and len(keys)>c['max_questions']:raise ValueError('known_native_question_limit')
        meanings={k:(str(v) if v is not None else STATES[k]) for k,v in labels.items()}
        shared={'identity_and_synopsis':state(t),'task_contract':{'shared_policy':POLICY,'option_meanings':meanings,'apply_to_every_question':True,'projection_version':'harness-shared-v1-synopsis-1'}}
        fields={f['key']:f for f in CONTRACT['fields']}
        questions={k:{'type':'choice','instructions':k+': '+fields[k]['definition'],'criteria':{label:None for label in labels}} for k in keys}
        native_state={'text':wire(shared).decode()} if c.get('state_renderer')=='scaledown-text-v1' else shared
        body={'model':c['model'],'state':native_state,'questions':questions}
        if adapter.startswith('openrouter-'):
            body['provider']={'only':[c['provider']],'allow_fallbacks':False}
            # Router native schemas do not inherit chat reasoning/output-token parameters.
            if c.get('native_guard_mode')=='documented-server-price-filter-v1':
                from route_runtime import validate_candidate
                validate_candidate(c);body['provider']['max_price']=copy.deepcopy(c['max_price'])
            elif c.get('native_priceguard_supported'):body['provider']['max_price']=copy.deepcopy(c['max_price'])
        if adapter=='celeris-decisions-list-v1':
            body={'model':c['model'],'input':wire(shared).decode(),'questions':[{'name':k,'type':'choice','instructions':q['instructions'],'choices':[{'value':label} for label in labels]} for k,q in questions.items()],'x_celeris':{'explain':False}}
        return body

    @staticmethod
    def parse(raw,t,c,*,raw_response_bytes=None,custody=None):
        from reviewed_native import parse_choice, normalization_envelope
        labels=bank(c);expected=c.get('field_keys',KEYS);answers=raw.get('answers');mapped={k:None for k in KEYS};diagnostic=dict(mapped);states={};errors=[];normalized=None
        # Empty whitelist means shape-only preparation, never host/build attestation.
        allowed=c.get('allowed_returned_models') or [raw.get('model')]
        envelope=normalization_envelope(raw,raw_response_bytes,custody)
        try:
            normalized=parse_choice(raw,'celeris' if c['adapter']=='celeris-decisions-list-v1' else 'openrouter',allowed,raw_response_bytes=raw_response_bytes,custody=custody,expected_keys=expected,include_nonordinal_states=c['option_bank']=='choice16_states')
            for k,row in normalized['records'].items():
                diagnostic[k]=row['normalized_value'];states[k]=row['assessment_state_prediction']
            mapped.update(zip(expected,normalized['comparison_scores_in_field_order']))
        except (ValueError,AssertionError,KeyError,TypeError):
            errors.append('corrected_choice_contract_failure')
            records={a.get('name'):a for a in answers if isinstance(a,dict) and isinstance(a.get('name'),str)} if isinstance(answers,list) else answers if isinstance(answers,dict) else {}
            for k in expected:
                a=records.get(k);label=a.get('choice') if isinstance(a,dict) else None
                diagnostic[k]=labels.get(label) if isinstance(label,str) else None;states[k]='invalid'
        eligible=not errors and envelope['eligibility_flags']['metadata_conflict_free']
        if not eligible:mapped={k:None for k in KEYS}
        return {'identity':identity(t),'identity_binding':'request-associated; serving proof remains a harness guard','schema_sha256':SCHEMA_HASH,'native':copy.deepcopy(answers),'diagnostic_projection':diagnostic,'mapped':mapped,'assessment_states':states,'comparison_withheld_fields':[k for k,row in (normalized['records'] if normalized else {}).items() if row['normalized_value'] is not None and not row['eligibility_flags']['numeric_comparison_eligible']],'format_valid':not errors,'comparison_eligible':eligible,'comparison_hold':None if eligible else 'Corrected contract or custody conflict','errors':errors,'expected_fields':expected,'unrequested_fields':[k for k in KEYS if k not in expected],'distribution_diagnostics':normalized['records'] if normalized else {},'corrected_normalization':normalized,'normalization_envelope':envelope,'raw_usage':raw.get('usage'),'returned_model':raw.get('model'),'returned_provider':raw.get('provider'),'generation_id':raw.get('id'),'parser_adoption':'review-v2; parser-adoption.json','canonical_acceptance':False}


def assemble_chunks(records,expected_chunks):
    if len(records)!=len(expected_chunks):raise ValueError('missing_native_chunk')
    first=records[0];seen=set();mapped={k:None for k in KEYS};native=[];errors=[];states={}
    for record,keys in zip(records,expected_chunks):
        if record['identity']!=first['identity'] or record['schema_sha256']!=SCHEMA_HASH or record.get('expected_fields')!=keys:raise ValueError('chunk_identity_schema_order')
        if record.get('input_sha256')!=first.get('input_sha256'):raise ValueError('chunk_evidence_changed')
        if seen&set(keys):raise ValueError('duplicate_chunk_field')
        seen.update(keys);native.append(record['native']);errors+=record['errors']
        if not record.get('comparison_eligible',True):errors.append('ineligible_chunk')
        if record.get('guard_errors'):errors.append('guard_failed_chunk')
        for k in keys:mapped[k]=record['mapped'][k];states[k]=record.get('assessment_states',{}).get(k)
    if seen!=set(KEYS):raise ValueError('chunk_field_coverage')
    return dict(first,native=native,mapped=mapped,assessment_states=states,expected_fields=KEYS,unrequested_fields=[],errors=errors,format_valid=not errors,comparison_eligible=not errors,comparison_withheld_fields=[k for r in records for k in r.get('comparison_withheld_fields',[])],guard_errors=[g for r in records for g in r.get('guard_errors',[])],actual_subcalls=len(records),chunk_records=records,transport_seconds=None,request_seconds_sum=sum(r.get('transport_seconds',0) or 0 for r in records),reported_cost_usd=None,cost_status='sum_authoritative_chunk_ledgers_separately',canonical_acceptance=False)
