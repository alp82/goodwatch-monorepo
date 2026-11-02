"""Build reproducible flat V2 contracts; no inference or source mutation."""
import copy
import hashlib
import json
from collections import Counter
from pathlib import Path

from facets import ALIASES, FIELDS

HERE = Path(__file__).resolve().parent
PREVIOUS = HERE.parent / 'draft-8'
VERSION = '2.0.0-draft.9'
PROJECTION = 'similarity-v2.3'
SCORE = {'type': 'integer', 'minimum': 0, 'maximum': 10}
NULL_SCORE = {**SCORE, 'type': ['integer', 'null']}
PRESENCE = {'enum': ['present', 'absent', 'unknown']}
from essence_changes import ADDITIONS, ENUM_ADDITIONS, FACET_ADDITIONS, FACET_DEFINITION_SUFFIXES


def obj(properties):
    return {'type': 'object', 'properties': properties, 'required': list(properties), 'additionalProperties': False}


def nullable(schema):
    return {'anyOf': [copy.deepcopy(schema), {'type': 'null'}]}


def read(path):
    return json.loads(path.read_text())


def save(name, value):
    (HERE / name).parent.mkdir(parents=True, exist_ok=True)
    (HERE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def schema(name, properties, definitions):
    return {'$schema': 'https://json-schema.org/draft/2020-12/schema',
            '$id': f'urn:goodwatch:fingerprint:v2:draft9:{name}',
            'title': f'GoodWatch V2 draft.9 {name}', **obj(properties), '$defs': copy.deepcopy(definitions)}


def readable_type(value):
    if 'anyOf' in value:
        return ' | '.join(readable_type(branch) for branch in value['anyOf'])
    kind = value.get('type')
    if isinstance(kind, list):
        return ' | '.join(readable_type({**value, 'type': item}) for item in kind)
    if kind == 'integer':
        return 'integer 0–10' if value.get('minimum') == 0 and value.get('maximum') == 10 else 'signed calendar year (no year zero)'
    if kind == 'null':
        return 'null'
    if kind == 'boolean':
        return 'true | false'
    if kind == 'array':
        return 'multi-select [' + readable_type(value['items']) + '] (unique choices)'
    if 'enum' in value:
        return ' | '.join(json.dumps(v, ensure_ascii=False) for v in value['enum'])
    raise ValueError(f'Unhandled readable type: {value}')


def write_readable(catalog):
    names = []
    for part in ['vector', 'attributes']:
        entries = {}
        for row in catalog:
            if row['part'] != part:
                continue
            value = readable_type(row['value_schema'])
            if 'measurement' in row:
                value += f' ({row["measurement"]})'
            value += ' — ' + row['definition']
            if row['applicability'] == 'show':
                value += ' Show-only; null on movies.'
            if row['spoiler_sensitive']:
                value += ' Spoiler-sensitive.'
            entries[row['id']] = value
        save(part + '.readable.json', entries)
        doc = (f'# Fingerprint {part}: full readable reference\n\n'
               f'**{len(entries)} key/value pairs**, one per attribute. Values describe the allowed data and meaning; '
               'these are definitions, not predicted film values. The JSON below has no nested groups or omitted fields. '
               'Title/scope/version fields are envelope information and are not counted as attributes.\n\n'
               'For multi-select fields: choose every supported category; `[]` means assessed with no listed choice, '
               '`null` means undetermined. An empty list is not a universal absence guarantee. '
               'Boolean facts and mutually exclusive presence states remain scalar. '
               'The vector publication contract requires integers; unknown response scores cannot publish.\n\n'
               '```json\n' + (HERE / (part + '.readable.json')).read_text() + '```\n')
        (HERE / (part + '.readable.md')).write_text(doc)
        names.extend([part + '.readable.json', part + '.readable.md'])
    return names


def build():
    registry = read(PREVIOUS / 'definition.json')
    mapping = read(PREVIOUS / 'mapping.json')
    previous_meta = read(PREVIOUS / 'attributes.schema.json')
    registry['version'] = VERSION
    registry['status'] = 'acceptance_candidate_not_deployed'
    registry['attribute_groups']['world']['simulation']['presence_definition'] = 'An artificial computed or explicitly constructed simulated reality is depicted; a physical studio set, social deception or fictional work existing alone does not qualify.'
    registry['advisory_topics']['discrimination'] = 'Discriminatory abuse or exclusion. This bounded advisory records presence and depiction, not an identified target or a free-text note.'
    for field, (measurement, destination, definition) in ADDITIONS.items():
        group, key = field.split('.')
        assert field not in {row['field'] for row in mapping['fields']}
        registry['attribute_groups'].setdefault(group, {})[key] = {
            'definition': definition, 'measurement': measurement,
            'similarity_role': 'context_only' if destination == 'viewing_context' else 'targeted_only',
            'spoiler_sensitive': field.startswith(('characters.', 'storytelling.', 'activities.')), 'applicability': 'all'}
        mapping['fields'].append({'field': field, 'destination': destination, 'vector_index': None,
                                  'measurement': measurement, 'applicability': 'all', 'spoiler_sensitive': field.startswith(('characters.', 'storytelling.', 'activities.'))})
    registry['facets'] = FIELDS
    registry['attributes_value_contract'] = {
        'numeric': '0–10 integer or null. Null means unknown/unassessed; show-only movie values are inapplicable and must be null.',
        'presence': 'present/absent/unknown. Never derive absence from zero or silence. These are model assessments, not verified exclusion guarantees.',
        'categorical': 'Every categorical facet is a multi-select array of distinct supported choices, or null when undetermined. [] means assessed with no listed category identified. Binary facts and mutually exclusive presence states remain scalar. Never use mixed/both/none sentinels in a multi-select list.',
        'combinations': 'All fields refer to the same title scope, but independent tags need not refer to the same character, event, season or scene.',
        'calendar_years': 'Year bounds and numbered decades are normalized BCE/CE only, and require established real-world calendar correspondence. Fictional calendar numbers must never be copied into these fields. Unknown remains null.',
        'prose': 'No prose field participates in this data contract. Optional existing display descriptions remain outside matching attributes.'}
    save('definition.json', registry)

    mapping['registry_version'] = VERSION
    mapping['version'] = PROJECTION
    for row in mapping['fields']:
        row['destination'] = {'fingerprint': 'vector', 'content_metadata': 'content_attributes',
                              'series_metadata': 'series_attributes'}.get(row['destination'], row['destination'])
    mapping['counts'] = dict(Counter(r['destination'] for r in mapping['fields']))
    assert mapping['dimension_count'] == len(mapping['ordered_fields']) == 274
    assert len(mapping['fields']) == 627
    save('mapping.json', mapping)

    # The controller supplies identity/scope. No model-generated source IDs or entity links.
    defs = {'title': copy.deepcopy(previous_meta['$defs']['title'])}
    scope = copy.deepcopy(previous_meta['$defs']['scope'])
    defs['scope'] = scope
    common = {'format_version': {'const': VERSION}, 'title': {'$ref': '#/$defs/title'},
              'scope': {'$ref': '#/$defs/scope'},
              'assessment_basis': {'enum': ['model_knowledge', 'supplied_sources', 'mixed', 'unknown']}}
    scores, attributes_scores, presence, catalog = {}, {}, {}, []
    selected = set(mapping['ordered_fields'])
    for row in mapping['fields']:
        field = row['field']
        g, k = field.split('.')
        spec = registry['attribute_groups'][g][k]
        is_vector = field in selected
        shape = {**(SCORE if is_vector else NULL_SCORE), 'description': spec['definition'],
                 'x-measurement': spec['measurement'], 'x-applicability': spec['applicability'],
                 'x-spoiler-sensitive': spec['spoiler_sensitive']}
        (scores if is_vector else attributes_scores).setdefault(g, {})[k] = shape
        catalog.append({'id': field, 'part': 'vector' if is_vector else 'attributes',
                        'pointer': f'/{"scores" if is_vector else "attribute_groups"}/{g}/{k}',
                        'kind': 'score', 'definition': spec['definition'],
                        'value_schema': copy.deepcopy(SCORE if is_vector else NULL_SCORE),
                        'measurement': spec['measurement'], 'applicability': spec['applicability'],
                        'spoiler_sensitive': spec['spoiler_sensitive'], 'aliases': ALIASES.get(field, [])})
        if 'presence_definition' in spec:
            presence[field] = {**PRESENCE, 'description': spec['presence_definition'],
                               'x-applicability': spec['applicability']}
            catalog.append({'id': 'presence.' + field, 'part': 'attributes', 'pointer': '/content_presence/' + field,
                            'kind': 'presence', 'definition': spec['presence_definition'],
                            'value_schema': PRESENCE, 'applicability': spec['applicability'],
                            'spoiler_sensitive': spec['spoiler_sensitive'], 'aliases': []})
    vector = schema('vector', {**common, 'part': {'const': 'vector'},
        'projection_version': {'const': PROJECTION}, 'scores': obj({g: obj(v) for g, v in scores.items()})}, defs)
    response = copy.deepcopy(vector)
    response['$id'] += ':response'
    response['title'] += ' response (unknowns allowed; incomplete responses cannot publish)'
    for attrs in response['properties']['scores']['properties'].values():
        for shape in attrs['properties'].values():
            shape['type'] = ['integer', 'null']
    facets = {}
    for field, spec in FIELDS.items():
        g, k = field.split('.')
        value = spec['value_schema']
        # Explicit presence fields have one unknown state, rather than unknown plus null.
        shape = copy.deepcopy(value) if value == PRESENCE else nullable(value)
        facets.setdefault(g, {})[k] = {**shape, 'description': spec['definition'],
                                      'x-applicability': spec['applicability'], 'x-spoiler-sensitive': spec['spoiler_sensitive']}
        catalog.append({'id': field, 'part': 'attributes', 'pointer': f'/facets/{g}/{k}',
                        'kind': 'presence' if value == PRESENCE else ('calendar_year' if value.get('type') == 'integer' else 'categorical'),
                        **spec, 'value_schema': copy.deepcopy(shape), 'aliases': ALIASES.get(field, [])})

    modes = ['on_screen', 'off_screen', 'implied', 'verbal_reference']
    advisory_fields = {
        'presence': PRESENCE,
        'depiction_modes': nullable({'type': 'array', 'items': {'enum': modes}, 'uniqueItems': True}),
        'intensity': {**NULL_SCORE, 'description': 'Perceived severity/force of the depicted topic, distinct from frequency and narrative importance.'},
        'frequency': {**NULL_SCORE, 'description': 'How recurrent the topic is across the assessed work, not an invented scene count.'},
        'explicitness': {**NULL_SCORE, 'description': 'How directly/detailed the topic is presented, including explicit verbal accounts. Not its narrative importance.'},
    }
    defs['advisory'] = obj(advisory_fields)
    advisories = {}
    for topic, description in registry['advisory_topics'].items():
        advisories[topic] = {'$ref': '#/$defs/advisory', 'description': description}
        for key, value in advisory_fields.items():
            field = f'advisories.{topic}.{key}'
            catalog.append({'id': field, 'part': 'attributes', 'pointer': f'/advisories/{topic}/{key}',
                            'kind': 'score' if key in ['intensity', 'frequency', 'explicitness'] else key,
                            'definition': description + ' ' + value.get('description', key.replace('_', ' ')),
                            'value_schema': value, 'applicability': 'all', 'spoiler_sensitive': True,
                            'aliases': ALIASES.get(field, [])})
    attributes = schema('attributes', {**common, 'part': {'const': 'attributes'},
        'attribute_groups': obj({g: obj(v) for g, v in attributes_scores.items()}),
        'content_presence': obj(presence), 'facets': obj({g: obj(v) for g, v in facets.items()}),
        'advisories': obj(advisories)}, defs)
    assert len(presence) == 171
    assert len({r['id'] for r in catalog}) == len(catalog)
    for name, data in [('vector.schema.json', vector), ('vector.response.schema.json', response),
                       ('attributes.schema.json', attributes)]:
        save(name, data)
    save('field-catalog.json', {'version': VERSION, 'purpose': 'Stable field IDs, paths and types for future attribute/filter consumers; no query execution or weighting.', 'fields': catalog})
    readable_files = write_readable(catalog)

    # Feed each prompt only its own numerical definitions, reducing repeated input.
    for part, chosen in [('vector', selected), ('attributes', {r['field'] for r in mapping['fields']} - selected)]:
        compact = {'version': VERSION, 'part': part, 'scoring_contract': registry['scoring_contract'],
                   'attributes': {f: registry['attribute_groups'][f.split('.')[0]][f.split('.')[1]] for f in
                                  [r['field'] for r in mapping['fields']] if f in chosen}}
        if part == 'attributes':
            compact.update(facets=FIELDS, advisory_topics=registry['advisory_topics'], value_contract=registry['attributes_value_contract'])
        save(part + '.definition.json', compact)

    ownership = read(PREVIOUS / 'catalog-ownership.json')
    ownership['version'] = VERSION
    save('catalog-ownership.json', ownership)
    save('migration.json', {'from': '2.0.0-draft.8', 'to': VERSION,
        'projection_version': PROJECTION, 'previous_projection_version': PROJECTION,
        'vector_order_unchanged': True, 'vector_definitions_unchanged': True,
        'numeric_additions': list(ADDITIONS), 'numeric_definition_changes': {},
        'facet_additions': list(FACET_ADDITIONS), 'enum_additions': ENUM_ADDITIONS,
        'facet_definition_changes': {field: FIELDS[field]['definition'] for field in FACET_DEFINITION_SUFFIXES},
        'presence_definition_changes': [],
        'conversion': 'Vector order, rubrics and definitions retain similarity-v2.3. Do not relabel old full fingerprints as draft.9: new attributes require assessment. Earlier empty or other categorical results do not establish absence of newly listed choices. Preserve historical raw outputs and their original versions; no automatic conversion is implemented.',
        'no_imputation': 'Unknown stays null. Present with zero centrality is valid. New keys must not be backfilled with guessed zeros or empty selections.'})

    # Synthetic fixtures demonstrate serialization only, never a real film's predictions.
    title = {'catalog_id': None, 'name': 'Synthetic contract fixture — not a film', 'release_year': 2000, 'media_type': 'movie'}
    scope_value = {'id': 'synthetic-movie', 'kind': 'movie', 'as_of': '2026-10-28',
        'coverage_description': 'Synthetic shape only; not a prediction or source claim.', 'edition_id': None,
        'season_number': None, 'episode_number': None, 'covered_seasons': None, 'covered_episode_ids': None}
    base = {'format_version': VERSION, 'title': title, 'scope': scope_value, 'assessment_basis': 'unknown'}
    sim_example = {**copy.deepcopy(base), 'part': 'vector', 'projection_version': PROJECTION,
                   'scores': {g: {k: 0 for k in attrs} for g, attrs in scores.items()}}
    meta_example = {**copy.deepcopy(base), 'part': 'attributes',
        'attribute_groups': {g: {k: None for k in attrs} for g, attrs in attributes_scores.items()},
        'content_presence': {k: 'unknown' for k in presence},
        'facets': {g: {k: ('unknown' if attrs[k].get('enum') == PRESENCE['enum'] else None) for k in attrs} for g, attrs in facets.items()},
        'advisories': {k: {'presence': 'unknown', 'depiction_modes': None, 'intensity': None,
                           'frequency': None, 'explicitness': None} for k in advisories}}
    save('examples/vector.synthetic.json', sim_example)
    save('examples/attributes.synthetic.json', meta_example)
    overview = ['# Complete field inventory', '', 'Generated by `build.py`. All categorical values and their unknown states are explicit in the schemas.', '',
        '## Numeric fields', '', '| Group | Vector | Attributes |', '|---|---:|---:|']
    for g in registry['attribute_groups']:
        overview.append(f'| {g} | {len(scores.get(g, {}))} | {len(attributes_scores.get(g, {}))} |')
    overview += ['', '## Fixed companion facets', '', '| Field | Values | Meaning |', '|---|---|---|']
    for field, spec in FIELDS.items():
        value = spec['value_schema']
        labels = readable_type(value)
        overview.append(f'| `{field}` | {labels}' + (' (list)' if value.get('type') == 'array' else '') + f' | {spec["definition"]} |')
    overview += ['', '## Advisory topics', '', *[f'- **{k}**: {v}' for k, v in registry['advisory_topics'].items()], '']
    (HERE / 'schema-overview.md').write_text('\n'.join(overview))
    outputs = ['definition.json', 'mapping.json', 'vector.schema.json', 'vector.response.schema.json',
        'attributes.schema.json', 'field-catalog.json', 'vector.definition.json', 'attributes.definition.json',
        'catalog-ownership.json', 'migration.json', 'schema-overview.md',
        'examples/vector.synthetic.json', 'examples/attributes.synthetic.json'] + readable_files
    save('manifest.json', {'version': VERSION, 'projection_version': PROJECTION,
        'counts': mapping['counts'], 'numeric_fields': len(mapping['fields']), 'vector_dimensions': 274,
        'attributes_scores': 353, 'presence_concepts': len(presence), 'fixed_facets': len(FIELDS),
        'multiselect_facets': sum(s['value_schema'].get('type') == 'array' for s in FIELDS.values()),
        'calendar_year_facets': sum(s['value_schema'].get('type') == 'integer' for s in FIELDS.values()),
        'boolean_facets': sum(s['value_schema'].get('type') == 'boolean' for s in FIELDS.values()),
        'presence_state_facets': sum(s['value_schema'] == PRESENCE for s in FIELDS.values()),
        'advisory_topics': len(advisories), 'field_catalog_entries': len(catalog),
        'source_hashes': {p.name: sha(p) for p in [PREVIOUS / 'definition.json', PREVIOUS / 'mapping.json', PREVIOUS / 'attributes.schema.json', PREVIOUS / 'catalog-ownership.json']},
        'output_hashes': {n: sha(HERE / n) for n in outputs}})
    from acceptance_contract import generate
    generate(HERE, registry, mapping, vector, attributes, catalog)
    print(json.dumps({'vector': 274, 'attributes_scores': 353, 'presence': len(presence), 'facets': len(FIELDS), 'advisories': len(advisories)}))


if __name__ == '__main__':
    build()
