"""Serializers are plugins; unregistered adapters and unverified catalogs fail closed."""
import copy
import math
from core import CONTRACT, KEYS, SCHEMA_HASH, identity, state, wire, digest, unique_json, mapping

POLICY = ('V1 compatibility vector experiment, scores only. Judge the whole title as viewers know it, '
          'not only the synopsis wording. Use the supplied identity, scope and synopsis. '
          'Do not confuse missing support with absence. When unable to assess, return null. '
          'No prose, highlights, tags or companions. All 74 fields are required; null is an explicit abstention, '
          'not a production V1 score. V1 anchors: 0=not present/irrelevant; 1=minimal presence; 10=defining attribute. '
          'This historical mixed-purpose scale includes craft quality as well as presence; do not reinterpret definitions.')
GLOSSARY = '\n'.join(f"{f['key']}: {f['definition']}" for f in CONTRACT['fields'])
PROMPT = POLICY+'\n'+GLOSSARY


def response_schema(t):
    ident=identity(t)
    return {'type':'object','additionalProperties':False,'required':['identity','scores'],'properties':{
        'identity':{'type':'object','additionalProperties':False,'required':list(ident),'properties':{k:{'const':v,'type':'integer' if type(v) is int else 'string'} for k,v in ident.items()}},
        'scores':{'type':'object','additionalProperties':False,'required':KEYS,'properties':{k:{'anyOf':[{'type':'integer','minimum':0,'maximum':10},{'type':'null'}]} for k in KEYS}}}}


class OpenRouter:
    @staticmethod
    def render(t, c):
        mode=c.get('mode')
        if mode not in ('json_schema','json_object'): raise ValueError('output_mode')
        body={'model':c['model'],'provider':{'only':[c['provider']], 'allow_fallbacks':False,'require_parameters':True,'max_price':copy.deepcopy(c['max_price'])},'stream':False,'reasoning':copy.deepcopy(c['reasoning']),'max_completion_tokens':c['max_completion_tokens'],'plugins':[],
              'messages':[{'role':'system','content':PROMPT+'\nReturn exactly this response schema: '+wire(response_schema(t)).decode()},{'role':'user','content':wire(state(t)).decode()}]}
        body['response_format']={'type':'json_schema','json_schema':{'name':'v1_scores','strict':True,'schema':response_schema(t)}} if mode=='json_schema' else {'type':'json_object'}
        return body

    @staticmethod
    def parse(raw, t, c):
        errors=[];obj=None
        try:
            msg=raw['choices'][0]['message']
            if msg.get('refusal'): errors.append('explicit_refusal')
            if raw['choices'][0].get('finish_reason') != 'stop': errors.append('finish_not_stop')
            obj=unique_json(msg.get('content'))
            if set(obj) != {'identity','scores'} or obj['identity'] != identity(t): errors.append('identity_or_envelope')
        except (KeyError,IndexError,TypeError,ValueError): errors.append('output_parse')
        native=obj.get('scores',{}) if isinstance(obj,dict) else {}
        if not isinstance(native,dict): native={};errors.append('scores_shape')
        if set(native)!=set(KEYS):errors.append('score_key_set')
        mapped={}
        for k in KEYS:
            try: mapped[k]=mapping(native.get(k),c['mapping'])
            except ValueError: mapped[k]=None;errors.append('score_value:'+k)
        diagnostic=dict(mapped)
        if any(e in errors for e in ('explicit_refusal','identity_or_envelope','output_parse')):mapped={k:None for k in KEYS}
        # Raw projections remain available even when scope/refusal prevents eligibility.
        return {'diagnostic_projection':diagnostic,'identity':identity(t),'schema_sha256':SCHEMA_HASH,'native':native,'mapped':mapped,'format_valid':not errors,'errors':errors,'raw_usage':raw.get('usage'),'returned_model':raw.get('model'),'returned_provider':raw.get('provider'),'generation_id':raw.get('id')}


class TypeSafe:
    """Historical native Score/Choice wire shape, serializer-only until catalog verification.

    Score expectations/probabilities are preserved; no presence gate or silent argmax.
    No native network dispatch is implemented without independently verified current API/caps.
    """
    @staticmethod
    def render(t,c):
        criteria=c['criteria']
        if len(criteria) not in (6,10,11): raise ValueError('native_categories')
        if c['question_type'] not in ('score','choice'): raise ValueError('native_type')
        return {'model':c['model'],'state':state(t),'questions':{f['key']:{'type':c['question_type'],'instructions':POLICY+'\n'+f['key']+': '+f['definition'],'criteria':copy.deepcopy(criteria)} for f in CONTRACT['fields']}}

    @staticmethod
    def parse(raw,t,c,*,raw_response_bytes=None,custody=None):
        from reviewed_native import project_score10, normalization_envelope
        answers=raw.get('answers',{});errors=[];mapped={k:None for k in KEYS};diagnostic=dict(mapped);details={};states={};withheld=[]
        if not isinstance(answers,dict):answers={};errors.append('answers_shape')
        if set(answers)!=set(KEYS):errors.append('answer_key_set')
        lane=c['question_type']=='score' and c['mapping'].get('native_top')==9 and c['mapping']['kind']=='native_expected_linear'
        for k in KEYS:
            a=answers.get(k)
            if a is None:states[k]='missing';continue
            if not isinstance(a,dict):errors.append('native_value:'+k);states[k]='invalid';continue
            if a.get('state') in ('unknown','not_assessed','refused','missing','invalid') or a.get('refusal'):
                states[k]=a.get('state','refused');continue
            try:
                value=a.get('score') if c['question_type']=='score' else a.get('choice')
                diagnostic[k]=mapping(value,c['mapping'])
                if lane:
                    row=project_score10(a,precision_policy=c.get('documented_precision_policy'));details[k]=row
                    mapped[k]=row['normalized_continuous_value'];states[k]='assessed'
                    if not row['eligibility_flags']['numeric_comparison_eligible']:withheld.append(k)
                else:states[k]='historical_replication_only';withheld.append(k)
            except (ValueError,KeyError,TypeError):errors.append('native_value:'+k);states[k]='invalid'
        envelope=normalization_envelope(raw,raw_response_bytes,custody)
        eligible=lane and envelope['eligibility_flags']['metadata_conflict_free']
        if not eligible:mapped={k:None for k in KEYS}
        return {'identity':identity(t),'schema_sha256':SCHEMA_HASH,'native':copy.deepcopy(answers),'diagnostic_projection':diagnostic,'mapped':mapped,'assessment_states':states,'comparison_withheld_fields':withheld,'format_valid':not errors,'errors':errors,'raw_usage':raw.get('usage'),'returned_model':raw.get('model'),'returned_provider':raw.get('provider'),'generation_id':raw.get('id'),'distribution_diagnostics':details,'normalization_envelope':envelope,'comparison_eligible':eligible,'comparison_hold':None if eligible else 'Historical lane or custody conflict','parser_adoption':'review-v2; parser-adoption.json','identity_binding':'request-associated; native API does not echo work identity'}


ADAPTERS={'openrouter':OpenRouter,'typesafe_native':TypeSafe}

def register_native():
    from native_routes import NativeChoice, ENDPOINTS
    ADAPTERS.update({name:NativeChoice for name in ENDPOINTS})


def render(t,c):
    kind=c['mapping']['kind']
    if c['compatibility_lane']=='strict_v1' and kind not in ('identity_integer','choice_labels'):raise ValueError('strict_lane_mapping')
    if c['adapter']=='openrouter' and kind!='identity_integer':raise ValueError('chat_integer_mapping')
    if c['adapter']=='typesafe_native':
        if c['question_type']=='choice':
            labels=c['mapping'].get('labels',{})
            if kind!='choice_labels' or len(labels)!=11 or set(labels.values())!=set(range(11)) or any(type(v) is not int for v in labels.values()) or set(c['criteria'])!=set(labels):raise ValueError('choice11_contract')
        elif kind not in ('native_expected_linear','historical_python_round') or len(c['criteria'])!=c['mapping']['native_top']+1:raise ValueError('score_category_mapping')
    register_native()
    if c['adapter'] not in ADAPTERS:raise ValueError('unknown_adapter_disabled')
    body=ADAPTERS[c['adapter']].render(t,c)
    payload_bytes=wire(body)
    jev=c['model'].startswith(('typesafe/jev','jev-'))
    mode_note=('MAY_TRIGGER_AUTOMATIC_LONG_CONTEXT_APPROXIMATE_GUIDE_MARKER' if len(payload_bytes)>=32000 else 'BELOW_APPROXIMATE_MARKER_NOT_PROOF_OF_MODE') if jev else None
    return {'request_bytes':len(payload_bytes),'jev_mode_qualification':mode_note,'identity':identity(t),'schema_sha256':SCHEMA_HASH,'input_sha256':digest(wire(state(t))),'policy_sha256':digest(PROMPT.encode()),'wire_sha256':digest(wire(body)),'body':body,'endpoint':native_endpoint(c)}


def native_endpoint(c):
    from native_routes import ENDPOINTS
    return ENDPOINTS.get(c['adapter'],'https://openrouter.ai/api/v1/chat/completions' if c['adapter']=='openrouter' else 'historical serializer; no dispatch endpoint')
