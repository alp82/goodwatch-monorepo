"""Candidate structural/consistency checks, not source truth or a benchmark."""
from pathlib import Path
from copy import deepcopy
import hashlib
import json
import sys
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent

def read(name): return json.loads((ROOT / name).read_text())

FROZEN_KEYS = ['primary_scope_ref', 'scopes', 'sources', 'profiles', 'field_targets', 'coverage_manifests']

def context_sha256(doc):
    return hashlib.sha256(json.dumps({key: doc[key] for key in FROZEN_KEYS}, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def full_source_coverage(doc, profile, scope_ref):
    """Bounded case: matching full sources + resolved manifest. No aggregation."""
    ref = profile['coverage_manifest_ref']
    manifest = doc['coverage_manifests'].get(ref)
    if not (profile['coverage'] == 'entire_scope' and manifest
            and manifest['resolved'] is True and manifest['aggregation'] is False
            and manifest['scope_ref'] == scope_ref and manifest['extent'] == 'entire_scope'
            and manifest['denominator_ref'] and profile['evidence_refs']): return False
    for source_ref in profile['evidence_refs']:
        source = doc['sources'].get(source_ref)
        if not (source and source_ref in manifest['source_refs'] and source['identity_status'] == 'resolved'
                and source['scope_ref'] == scope_ref and source['coverage'] == 'entire_scope'
                and source['coverage_manifest_ref'] == ref): return False
    return True

def negative_eligible(doc, field, assessment):
    if not field.startswith('facts.'): return False
    if assessment['state'] != 'assessed': return False
    value = assessment['value']
    if value is not False and value != 'none_in_scope': return False
    p = doc['profiles'][assessment['profile_ref']]
    if not (p['basis'] == 'source_assertion' and p['modality'] == 'asserted' and p['polarity'] == 'negated'
            and p['conflict'] is False and p['coverage'] == 'entire_scope' and p['coverage_manifest_ref']
            and p['independently_verified'] is True and p['evidence_refs']): return False
    if not full_source_coverage(doc, p, doc['field_targets'][field]): return False
    for ref in p['evidence_refs']:
        s = doc['sources'][ref]
        if not (s['origin_class'] == 'independent_reference' and s['identity_status'] == 'resolved'
                and s['scope_ref'] == doc['field_targets'][field] and s['modality'] == 'asserted'
                and s['polarity'] == 'negated' and s['coverage'] == 'entire_scope' and s['coverage_manifest_ref']
                and s['independently_verified'] is True and field in s['negative_fields']): return False
    return True

def assertion_eligible(doc, field, assessment):
    """Eligibility of the stored assertion, not an arbitrary literal query."""
    if not field.startswith('facts.'): return False
    if assessment['state'] != 'assessed' or assessment['value'] is False or assessment['value'] == 'none_in_scope': return False
    p = doc['profiles'][assessment['profile_ref']]
    if not (p['basis'] == 'source_assertion' and p['modality'] == 'asserted' and p['polarity'] == 'asserted'
            and p['conflict'] is False and p['binding_verified'] is True and p['evidence_refs']): return False
    return all(doc['sources'][ref]['identity_status'] == 'resolved'
               and doc['sources'][ref]['origin_class'] in ['catalog_assertion', 'independent_reference']
               and doc['sources'][ref]['scope_ref'] == doc['field_targets'][field]
               and doc['sources'][ref]['modality'] == 'asserted'
               and doc['sources'][ref]['polarity'] == 'asserted'
               and doc['sources'][ref]['binding_verified'] is True for ref in p['evidence_refs'])

def exact_category_eligible(doc, field, assessment, requested_category):
    return bool(field == 'facts.object_agency_binding' and assertion_eligible(doc, field, assessment)
                and isinstance(requested_category, str) and assessment['value'] == requested_category)

def literal_presence_eligible(doc, field, assessment, requested_category=None):
    value = assessment['value']
    return bool(field == 'facts.object_agency_binding' and assertion_eligible(doc, field, assessment)
                and isinstance(value, str) and value.startswith('literal.')
                and (requested_category is None or value == requested_category))

def affirmative_eligible(doc, field, assessment, requested_category=None):
    """Boolean presence, or requested exact category; category default is literal."""
    if field == 'facts.object_agency_binding':
        return (exact_category_eligible(doc, field, assessment, requested_category)
                if requested_category is not None else literal_presence_eligible(doc, field, assessment))
    return bool(assertion_eligible(doc, field, assessment) and assessment['value'] is True)

def validate_shape(doc):
    schema = read('screen.schema.json')
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(doc)
    return {'success': True, 'mode': 'shape_only', 'frozen_context_assembly': False, 'source_truth_verified': False}

def validate(doc, frozen_context=None, run_manifest=None):
    validate_shape(doc)
    fields = {f['id']: f for f in read('candidate-matrix.json')['fields']}
    if frozen_context is not None:
        for key in FROZEN_KEYS:
            if doc[key] != frozen_context[key]: raise ValueError('Frozen input metadata changed: ' + key)
    if run_manifest is not None:
        if frozen_context is None: raise ValueError('Assembly requires frozen context')
        if context_sha256(frozen_context) != run_manifest['context_sha256']: raise ValueError('Run-manifest context hash mismatch')
        if doc['primary_scope_ref'] != run_manifest['primary_scope_ref']: raise ValueError('Run-manifest primary identity mismatch')
        if any(scope['title_key'] != run_manifest['title_key'] for scope in doc['scopes'].values()): raise ValueError('Run-manifest work identity mismatch')
        if doc['provenance'] != run_manifest['provenance']: raise ValueError('Producer/cell provenance must come from run manifest')
    if doc['primary_scope_ref'] not in doc['scopes']: raise ValueError('Unresolved primary scope')
    for target in doc['field_targets'].values():
        if target not in doc['scopes']: raise ValueError('Unresolved field target')
    for source in doc['sources'].values():
        if source['scope_ref'] not in doc['scopes']: raise ValueError('Unresolved source scope')
        if source['coverage'] == 'entire_scope' and not source['coverage_manifest_ref']: raise ValueError('Unsubstantiated full coverage')
        if source['independently_verified'] and source['origin_class'] != 'independent_reference': raise ValueError('Generated/catalog source promoted to independent reference')
        if source['coverage'] == 'entire_scope':
            manifest = doc['coverage_manifests'].get(source['coverage_manifest_ref'])
            if not manifest or manifest['resolved'] is not True or manifest['scope_ref'] != source['scope_ref']:
                raise ValueError('Unresolved source coverage manifest')
    for manifest in doc['coverage_manifests'].values():
        if manifest['scope_ref'] not in doc['scopes']: raise ValueError('Unresolved coverage scope')
        if any(ref not in doc['sources'] for ref in manifest['source_refs']): raise ValueError('Unresolved manifest source')
    for field in fields:
        if sum(field in p['fields'] for p in doc['profiles'].values()) > 6: raise ValueError('Profile bank exceeds field cap')
    for profile in doc['profiles'].values():
        if profile['scope_ref'] not in doc['scopes']: raise ValueError('Unresolved profile scope')
        if not profile['evidence_refs'] and profile['basis'] != 'unverified_model_knowledge': raise ValueError('Missing cited source')
        for ref in profile['evidence_refs']:
            if ref not in doc['sources']: raise ValueError('Unresolved evidence ID')
    for field, assessment in doc['assessments'].items():
        if assessment['state'] != 'assessed': continue
        if fields[field]['storage'] == 'ordinal_0_4' and type(assessment['value']) is not int: raise ValueError('Ordinal storage requires integer')
        if assessment['profile_ref'] not in doc['profiles']: raise ValueError('Unresolved source profile')
        p = doc['profiles'][assessment['profile_ref']]
        if field not in p['fields'] or p['scope_ref'] != doc['field_targets'][field] or p['conflict']: raise ValueError('Field/profile conflict or scope mismatch')
        for ref in p['evidence_refs']:
            s = doc['sources'][ref]
            if s['identity_status'] != 'resolved' or s['scope_ref'] != p['scope_ref']: raise ValueError('Unbound or wrong-scope evidence')
            if p['basis'] == 'source_assertion' and (s['origin_class'] == 'generated_assertion' or s['modality'] != p['modality'] or s['polarity'] != p['polarity']): raise ValueError('Source modality/polarity strengthened or generated assertion admitted')
        if fields[field]['storage'] != 'ordinal_0_4':
            if p['basis'] == 'interpretive_judgment': raise ValueError('Factual slot is not an interpretive score')
            if assessment['value'] is False or assessment['value'] == 'none_in_scope':
                if not negative_eligible(doc, field, assessment): raise ValueError('Unsupported negative fact')
            elif type(assessment['value']) is bool and p['polarity'] != 'asserted': raise ValueError('Affirmative presence has nonasserted polarity')
        if field == 'screen.violence_exposure' and not full_source_coverage(doc, p, doc['field_targets'][field]): raise ValueError('Frequency denominator lacks resolved matching full-source coverage; aggregation deferred')
    return {'success': True, 'assessments': len(fields), 'complete_for_representation_screen': True,
            'complete_title_analysis': False, 'source_truth_verified': False,
            'mode': 'frozen_context_assembly' if run_manifest is not None else 'internal_consistency_only',
            'run_manifest_bound': run_manifest is not None}

def assemble(raw_output, frozen_context, run_manifest, raw_receipt=None):
    """Keep raw predictions/readouts even when no safe canonical record is emitted."""
    outcome = {'raw_output': deepcopy(raw_output), 'raw_receipt': deepcopy(raw_receipt), 'canonical': None}
    try:
        if set(raw_output) != {'assessments'}: raise ValueError('Producer payload contains non-owned metadata')
        canonical = deepcopy(frozen_context)
        canonical['assessments'] = deepcopy(raw_output['assessments'])
        canonical['provenance'] = deepcopy(run_manifest['provenance'])
        validate(canonical, frozen_context, run_manifest)
        outcome.update({'canonical': canonical, 'canonical_status': 'validated', 'errors': []})
    except Exception as exc:
        outcome.update({'canonical_status': 'withheld', 'errors': [str(exc).splitlines()[0]]})
    return outcome

if __name__ == '__main__':
    doc = json.loads(Path(sys.argv[1]).read_text()) if len(sys.argv) > 1 else read('example.synthetic.json')
    print(json.dumps(validate_shape(doc), indent=2))
