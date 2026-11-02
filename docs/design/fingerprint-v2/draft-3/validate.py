"""Offline contract validation and deterministic projection; no inference or imputation."""
import argparse
import json
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker, validators

HERE = Path(__file__).resolve().parent
StrictValidator = validators.extend(Draft202012Validator, type_checker=Draft202012Validator.TYPE_CHECKER.redefine(
    'integer', lambda checker, value: type(value) is int))


def load(path):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result: raise ValueError(f'duplicate key: {key}')
            result[key] = value
        return result
    def nonfinite(value): raise ValueError(f'nonfinite number: {value}')
    return json.loads(Path(path).read_text(), object_pairs_hook=pairs, parse_constant=nonfinite)


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values(): yield from walk(child)
    elif isinstance(value, list):
        for child in value: yield from walk(child)


def flattened(groups):
    return {f'{g}.{k}': v for g, values in groups.items() for k, v in values.items()}


def validate(data, response=False, companion=None):
    part = data.get('part')
    if part not in {'similarity', 'metadata'}: raise ValueError('unknown part')
    filename = 'similarity.response.schema.json' if part == 'similarity' and response else part + '.schema.json'
    StrictValidator(load(HERE / filename), format_checker=FormatChecker()).validate(data)
    errors = []
    def require(condition, message):
        if not condition: errors.append(message)
    evidence = {e['id']: e for e in data['evidence']}
    require(len(evidence) == len(data['evidence']), 'duplicate evidence IDs')
    movie = data['title']['media_type'] == 'movie'
    require(movie == (data['scope']['kind'] == 'movie'), 'title/scope media mismatch')
    for node in walk(data):
        refs = node.get('evidence_refs', [])
        require(all(r in evidence for r in refs), 'dangling evidence reference')
        if node.get('presence') == 'absent':
            require(any(evidence.get(r, {}).get('supports_verified_absence') and
                        evidence[r]['kind'] not in {'model_prior', 'plot_summary'} for r in refs),
                    'absence lacks scoped verification; model prior/summary silence is insufficient')
        for lower, upper in [('start_fraction','end_fraction'), ('start_year','end_year'), ('minimum_age','maximum_age')]:
            if node.get(lower) is not None and node.get(upper) is not None:
                require(node[lower] <= node[upper], f'inverted {lower}/{upper}')
        if node.get('basis') == 'unknown':
            require(response, 'complete vector requires an assessment basis')
        if isinstance(node.get('assertion'), dict) and isinstance(node.get('centrality'), dict):
            coherent(node['centrality'], node['assertion'], 'concept assertion', require)
    if part == 'similarity':
        if response:
            for g, scores in data['scores'].items():
                if any(v is not None for v in scores.values()):
                    require(data['assessment_basis'][g]['basis'] != 'unknown', f'{g}: numeric predictions require a basis')
    else:
        fields = flattened(data['attribute_groups'])
        require(set(data['requested_score_ids']) <= fields.keys(), 'requested numeric assessment missing')
        require(set(data['requested_presence_ids']) <= data['content_presence'].keys(), 'requested presence assessment missing')
        registry = {r['field']: r for r in load(HERE / 'mapping.json')['fields']}
        for field, assessment in fields.items():
            if movie and registry[field]['applicability'] == 'show':
                require(assessment['status'] == 'not_applicable', f'{field}: show-only field on movie')
            presence = data['content_presence'].get(field)
            if presence:
                coherent(assessment, presence, field, require)
        ids = {}
        for section in ['entities','character_relationships','world_contexts']:
            values = data[section]['items']
            ids[section] = {item['id'] for item in values}
            require(len(ids[section]) == len(values), f'duplicate {section} IDs')
        for node in walk(data):
            for key in ['entity_id','subject_entity_id','object_entity_id']:
                if node.get(key) is not None:
                    require(node[key] in ids['entities'], f'dangling {key}')
            if node.get('relationship_id') is not None:
                require(node['relationship_id'] in ids['character_relationships'], 'dangling relationship ID')
            if 'field_id' in node:
                require(node['field_id'] in registry, 'highlight field not in registry')
        for section, keys in [('format_facts', ['series_structure','episode_runtime_min_minutes','episode_runtime_max_minutes']),
                              ('catalog_facts',['show_status'])]:
            if movie:
                for key in keys:
                    require(data[section][key]['status'] == 'not_applicable', f'{key}: movie requires not_applicable')
        lo = data['format_facts']['episode_runtime_min_minutes']['value']
        hi = data['format_facts']['episode_runtime_max_minutes']['value']
        if lo is not None and hi is not None: require(lo <= hi, 'inverted episode duration')
    if errors: raise ValueError('; '.join(sorted(set(errors))))
    if companion is not None:
        validate(companion)
        if part != 'similarity' or companion['part'] != 'metadata': raise ValueError('join needs similarity + metadata')
        for key in ['title','scope','format_version']:
            if data[key] != companion[key]: raise ValueError(f'join {key} mismatch')
        for field, value in flattened(data['scores']).items():
            if field in companion['content_presence']:
                coherent({'status':'assessed' if value is not None else 'unknown', 'value':value},
                         companion['content_presence'][field], field, require)
        if errors: raise ValueError('; '.join(sorted(set(errors))))
    return True


def coherent(assessment, presence, field, require):
    if presence['presence'] == 'absent' and assessment['value'] is not None:
        require(assessment['value'] == 0, f'{field}: absent with positive score')
    if presence['applicability'] == 'not_applicable':
        require(assessment['status'] == 'not_applicable', f'{field}: applicability contradiction')
    # Present with zero narrative importance is valid. Presence and centrality differ.


def vector(data):
    validate(data)
    if data['part'] != 'similarity': raise ValueError('only similarity is a vector')
    scores = flattened(data['scores'])
    return [scores[f] for f in load(HERE / 'mapping.json')['ordered_fields']]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('input', type=Path)
    parser.add_argument('--response', action='store_true')
    parser.add_argument('--companion', type=Path)
    parser.add_argument('--vector-output', type=Path)
    args = parser.parse_args()
    data = load(args.input)
    validate(data, args.response, load(args.companion) if args.companion else None)
    if args.vector_output:
        # Never overwrite a prior vector or export an incomplete response.
        with args.vector_output.open('x') as f: json.dump(vector(data), f)
    print('valid')
