"""V1 compatibility, not factual grading. No database/model imports."""
import hashlib
import json
import math
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTRACT = json.loads((ROOT/'v1-contract.json').read_text())
KEYS = CONTRACT['score_keys']
CRAFT = ['narrative_structure','dialogue_quality','character_depth','direction','acting','cinematography','editing','music_composition']
SCHEMA_HASH = hashlib.sha256((ROOT/'v1-contract.json').read_bytes()).hexdigest()


def wire(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()


def digest(value):
    return hashlib.sha256(value).hexdigest()


def unique_json(raw):
    def pairs(items):
        d = {}
        for k, v in items:
            if k in d: raise ValueError('duplicate_json_key')
            d[k] = v
        return d
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite')))


def identity(t):
    if t['media_type'] not in ('movie', 'show') or type(t['tmdb_id']) is not int or t['tmdb_id'] <= 0:
        raise ValueError('identity_type')
    if type(t['year']) is not int or not isinstance(t['title'], str) or not t['title']:
        raise ValueError('identity_year_title')
    if not isinstance(t['scope'], str) or not t['scope']: raise ValueError('scope_required')
    return {k:t[k] for k in ('media_type', 'tmdb_id', 'title', 'year', 'scope')}


def state(t):
    """Same canonical title/year/type/synopsis/scope object for every adapter."""
    return dict(identity(t), original_title=t['original_title'], synopsis=t['synopsis'])


def vector(values, *, partial=False):
    if set(values) != set(KEYS): raise ValueError('score_key_set')
    for v in values.values():
        if v is None and partial: continue
        if type(v) is not int or not 0 <= v <= 10: raise ValueError('v1_integer_scale')
    return [values[k] for k in KEYS]


def mapping(answer, config):
    """Native numbers retained elsewhere. Probability never becomes intensity implicitly."""
    if answer is None: return None
    kind = config['kind']
    if kind == 'identity_integer':
        if type(answer) is not int or not 0 <= answer <= 10: raise ValueError('integer_mapping')
        return answer
    if kind == 'choice_labels':
        if not isinstance(answer, str) or answer not in config['labels']: raise ValueError('choice_label')
        return mapping(config['labels'][answer], {'kind':'identity_integer'})
    if kind in ('native_expected_linear', 'historical_python_round'):
        if type(answer) not in (float, int) or not math.isfinite(answer): raise ValueError('native_number')
        top = config['native_top']
        if type(top) is not int or top not in (5, 9, 10) or not 0 <= answer <= top: raise ValueError('native_range')
        scaled = answer * 10 / top
        # Historical Python ties-to-even is deliberately opt-in, never a silent default.
        return round(scaled) if kind == 'historical_python_round' else scaled
    raise ValueError('mapping_unregistered')


def field_coverage(record, requested_fields=None, *, attempted=True):
    """Classify actual predictions, never infer semantic abstention from null padding."""
    requested=list(requested_fields if requested_fields is not None else record.get('expected_fields',KEYS))
    if len(set(requested))!=len(requested) or any(k not in KEYS for k in requested):raise ValueError('coverage_requested_fields')
    categories=('assessed','semantic_unknown','not_applicable','not_assessed','refused','withheld_numeric','invalid','unattempted','unreturned','other_assessment_state')
    if record.get('chunk_records') is not None:
        children=[field_coverage(r,attempted=attempted) for r in record['chunk_records']]
        combined={k:v for child in children for k,v in child['field_states'].items()}
        fields={k:combined.get(k,'unattempted') for k in requested}
        return {'planned_field_ids':requested,'requested_field_ids':[k for k in requested if any(k in child['requested_field_ids'] for child in children)],'returned_field_ids':[k for k in requested if any(k in child['returned_field_ids'] for child in children)],'unexpected_returned_field_ids':sorted({k for child in children for k in child['unexpected_returned_field_ids']}),'field_states':fields,'counts':{c:sum(v==c for v in fields.values()) for c in categories},'failed_unreturned_cells':sum(child['failed_unreturned_cells'] for child in children)}
    native=record.get('native');explicit=record.get('returned_field_ids')
    if explicit is not None:
        if not isinstance(explicit,list) or any(not isinstance(k,str) for k in explicit) or len(explicit)!=len(set(explicit)):raise ValueError('coverage_returned_fields')
        returned=set(explicit)
    elif isinstance(native,dict):returned=set(native)
    elif isinstance(native,list):returned={a.get('name') for a in native if isinstance(a,dict)}
    else:returned=set()
    if not attempted or record.get('returned') is False:returned=set()
    fields={};states=record.get('assessment_states',{});mapped=record.get('mapped',{});diagnostic=record.get('diagnostic_projection',{})
    withheld=set(record.get('comparison_withheld_fields',[]))
    for k in requested:
        st=states.get(k)
        if not attempted:category='unattempted'
        elif k not in returned:category='unreturned'
        elif st=='invalid' or record.get('format_valid') is False:category='invalid'
        elif st=='unknown' or (isinstance(st,str) and st.startswith('unknown_')):category='semantic_unknown'
        elif st in ('not_applicable','not_assessed','refused'):category=st
        elif k in withheld or (mapped.get(k) is None and type(diagnostic.get(k)) in (int,float)):category='withheld_numeric'
        elif type(mapped.get(k)) in (int,float):category='assessed'
        elif st and st!='assessed':category='other_assessment_state'
        elif isinstance(native,dict) and k in native and native[k] is None:category='semantic_unknown'
        else:category='other_assessment_state'
        fields[k]=category
    return {'requested_field_ids':requested if attempted else [],'planned_field_ids':requested,'returned_field_ids':[k for k in requested if k in returned],
            'unexpected_returned_field_ids':sorted(str(k) for k in returned-set(requested)),
            'field_states':fields,'counts':{c:sum(v==c for v in fields.values()) for c in categories},
            'failed_unreturned_cells':sum(v=='unreturned' for v in fields.values()) if attempted and record.get('returned') is False else 0}


def compare(candidate, baseline):
    if candidate['identity'] != baseline['identity']: raise ValueError('identity_or_scope_mismatch')
    if candidate['schema_sha256'] != SCHEMA_HASH or baseline['schema_sha256'] != SCHEMA_HASH:
        raise ValueError('schema_mismatch')
    a,b = candidate['mapped'],baseline['mapped']
    if set(a) != set(KEYS) or set(b) != set(KEYS): raise ValueError('field_set')
    rows=[]
    for f in CONTRACT['fields']:
        k=f['key'];x,y=a[k],b[k]
        for v in (x,y):
            if v is not None and (type(v) not in (int,float) or not math.isfinite(v) or not 0 <= v <= 10): raise ValueError('comparison_range')
        rows.append(dict(f, candidate=x, baseline=y, delta=x-y if x is not None and y is not None else None))
    def summary(rs):
        ds=[r['delta'] for r in rs if r['delta'] is not None]
        return {'compared':len(ds),'total':len(rs),'mean_absolute_disagreement':sum(abs(v) for v in ds)/len(ds) if ds else None,'mean_signed_difference':sum(ds)/len(ds) if ds else None,'differences_ge3':sum(abs(v)>=3 for v in ds),'median_absolute_disagreement':statistics.median(abs(v) for v in ds) if ds else None,'max_absolute_disagreement':max(map(abs,ds)) if ds else None}
    complete=all(r['delta'] is not None for r in rows)
    cosine=None
    if complete:
        av=[a[k] for k in KEYS];bv=[b[k] for k in KEYS];den=math.sqrt(sum(x*x for x in av)*sum(y*y for y in bv))
        cosine=sum(x*y for x,y in zip(av,bv))/den if den else None
    return {'not_factual_error':True,'identity':candidate['identity'],'overall':summary(rows),'craft_quality':summary([r for r in rows if r['key'] in CRAFT]),'families':{f:summary([r for r in rows if r['family']==f]) for f in dict.fromkeys(r['family'] for r in rows)},'candidate_coverage':sum(a[k] is not None for k in KEYS)/74,'candidate_abstentions':field_coverage(candidate)['counts']['semantic_unknown'],'candidate_noncomparable_cells':sum(a[k] is None for k in KEYS),'candidate_missingness':field_coverage(candidate),'complete_vector_cosine':cosine,'fields':rows,'consequential_disagreements':sorted([r for r in rows if r['delta'] is not None],key=lambda r:-abs(r['delta']))[:8]}


def baseline(t, scores, provenance):
    vector(scores)
    if not provenance.get('source_sha256') or not provenance.get('locator'): raise ValueError('baseline_provenance')
    return {'identity':identity(t),'schema_sha256':SCHEMA_HASH,'native':scores,'mapped':scores,'vector_float_values':[float(scores[k]) for k in KEYS],'vector_sha256':digest(wire([float(scores[k]) for k in KEYS])),'vector_origin':'deterministic float conversion of saved raw scores; not independently fetched live vector','field_order_sha256':CONTRACT['field_order_sha256'],'provenance':provenance,'gold':False}
