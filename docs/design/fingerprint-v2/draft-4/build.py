"""Build reproducible flat V2 contracts; no inference or source mutation."""
import copy
import hashlib
import json
from collections import Counter
from pathlib import Path

from facets import ALIASES, FIELDS

HERE = Path(__file__).resolve().parent
PREVIOUS = HERE.parent / 'draft-3'
VERSION = '2.0.0-draft.4'
PROJECTION = 'similarity-v2.2'
SCORE = {'type': 'integer', 'minimum': 0, 'maximum': 10}
NULL_SCORE = {**SCORE, 'type': ['integer', 'null']}
PRESENCE = {'enum': ['present', 'absent', 'unknown']}


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
            '$id': f'urn:goodwatch:fingerprint:v2:draft4:{name}',
            'title': f'GoodWatch V2 draft.4 {name}', **obj(properties), '$defs': copy.deepcopy(definitions)}


def build():
    registry = read(PREVIOUS / 'definition.json')
    previous_registry = copy.deepcopy(registry)
    mapping = read(PREVIOUS / 'mapping.json')
    previous_meta = read(PREVIOUS / 'metadata.schema.json')
    registry['version'] = VERSION
    registry['status'] = 'owner_approved_design_not_deployed'
    registry['attribute_groups']['characters']['demonstrated_competence'] = {
        'definition': 'How consistently focal characters demonstrate effective practical, professional or intellectual skill in consequential tasks. Distinct from intelligence, claimed expertise, power, luck or training merely occurring. Zero means no demonstrated competence, not an unintelligent person. Assess the depicted performance; competence_basis separately records how skill is established.',
        'measurement': 'intensity', 'similarity_role': 'targeted_only',
        'spoiler_sensitive': False, 'applicability': 'all'}
    # Metadata wording can no longer point at removed, dynamically invented concept records.
    for g, attrs in registry['attribute_groups'].items():
        for k, spec in attrs.items():
            if f'{g}.{k}' in mapping['ordered_fields']:
                assert spec == previous_registry['attribute_groups'][g][k]
            else:
                spec['definition'] = spec['definition'].replace(
                    '; specific practices can be named in concept assertions', '').replace(
                    '; name specific traditions in concept assertions where supported', '')
    registry['advisory_topics']['death'] = (
        'Human or animal death occurring, shown, implied or explicitly discussed within the work, '
        'including natural/nonviolent and offscreen death. Ordinary mortality as an abstract theme alone is insufficient. '
        'Do not infer absence from low violence, low stakes or synopsis silence.')
    registry['scoring_contract']['statuses'] = {
        'numeric': 'A 0–10 integer is assessed; null means unknown/unassessed. Movie show-only fields are inapplicable and null.',
        'presence': 'Use the explicit present/absent/unknown states; never collapse unknown into absence.'}
    registry['scoring_contract']['omission'] = 'All declared keys are required. Missing keys are contract failures, not zeros or implicit negatives.'
    registry['scoring_contract']['confidence'] = 'No calibrated confidence or per-field evidence object is requested. Record assessment_basis honestly; controller-owned source/run records retain actual provenance.'
    registry['scoring_contract']['series_policy'] = 'Movie scopes require null for every show-only numeric field and facet. Whole-show assessments name covered seasons; no claims about unassessed later releases.'
    registry['facets'] = FIELDS
    registry['metadata_value_contract'] = {
        'numeric': '0–10 integer or null. Null means unknown/unassessed; show-only movie values are inapplicable and must be null.',
        'presence': 'present/absent/unknown. Never derive absence from zero or silence. These are model assessments, not verified exclusion guarantees.',
        'categorical': 'A fixed enum/boolean or null when unknown; arrays contain only supported listed categories. [] means assessed with no listed category identified, not proof of universal absence.',
        'combinations': 'All fields refer to the same title scope, but independent tags need not refer to the same character, event, season or scene.',
        'prose': 'No prose field participates in this data contract. Optional existing display descriptions remain outside matching attributes.'}
    save('definition.json', registry)

    mapping['registry_version'] = VERSION
    mapping['fields'].append({'field': 'characters.demonstrated_competence', 'destination': 'content_metadata',
                              'vector_index': None, 'measurement': 'intensity', 'applicability': 'all', 'spoiler_sensitive': False})
    mapping['counts'] = dict(Counter(r['destination'] for r in mapping['fields']))
    assert mapping['dimension_count'] == len(mapping['ordered_fields']) == 274
    assert len(mapping['fields']) == 600
    save('mapping.json', mapping)

    # The controller supplies identity/scope. No model-generated source IDs or entity links.
    defs = {'title': copy.deepcopy(previous_meta['$defs']['title'])}
    scope = copy.deepcopy(previous_meta['$defs']['scope'])
    scope.pop('allOf')
    for k in ['season_number', 'episode_number', 'covered_seasons', 'covered_episode_ids']:
        scope['properties'][k] = nullable(scope['properties'][k])
    scope['required'] = list(scope['properties'])
    defs['scope'] = scope
    common = {'format_version': {'const': VERSION}, 'title': {'$ref': '#/$defs/title'},
              'scope': {'$ref': '#/$defs/scope'},
              'assessment_basis': {'enum': ['model_knowledge', 'supplied_sources', 'mixed', 'unknown']}}
    scores, metadata_scores, presence, catalog = {}, {}, {}, []
    selected = set(mapping['ordered_fields'])
    for row in mapping['fields']:
        field = row['field']
        g, k = field.split('.')
        spec = registry['attribute_groups'][g][k]
        is_vector = field in selected
        shape = {**(SCORE if is_vector else NULL_SCORE), 'description': spec['definition'],
                 'x-measurement': spec['measurement'], 'x-applicability': spec['applicability'],
                 'x-spoiler-sensitive': spec['spoiler_sensitive']}
        (scores if is_vector else metadata_scores).setdefault(g, {})[k] = shape
        catalog.append({'id': field, 'part': 'similarity' if is_vector else 'metadata',
                        'pointer': f'/{"scores" if is_vector else "attribute_groups"}/{g}/{k}',
                        'kind': 'score', 'definition': spec['definition'],
                        'value_schema': copy.deepcopy(SCORE if is_vector else NULL_SCORE),
                        'measurement': spec['measurement'], 'applicability': spec['applicability'],
                        'spoiler_sensitive': spec['spoiler_sensitive'], 'aliases': ALIASES.get(field, [])})
        if 'presence_definition' in spec:
            presence[field] = {**PRESENCE, 'description': spec['presence_definition'],
                               'x-applicability': spec['applicability']}
            catalog.append({'id': 'presence.' + field, 'part': 'metadata', 'pointer': '/content_presence/' + field,
                            'kind': 'presence', 'definition': spec['presence_definition'],
                            'value_schema': PRESENCE, 'applicability': spec['applicability'],
                            'spoiler_sensitive': spec['spoiler_sensitive'], 'aliases': []})
    similarity = schema('similarity', {**common, 'part': {'const': 'similarity'},
        'projection_version': {'const': PROJECTION}, 'scores': obj({g: obj(v) for g, v in scores.items()})}, defs)
    response = copy.deepcopy(similarity)
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
        catalog.append({'id': field, 'part': 'metadata', 'pointer': f'/facets/{g}/{k}',
                        'kind': 'presence' if value == PRESENCE else 'categorical',
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
            catalog.append({'id': field, 'part': 'metadata', 'pointer': f'/advisories/{topic}/{key}',
                            'kind': 'score' if key in ['intensity', 'frequency', 'explicitness'] else key,
                            'definition': description + ' ' + value.get('description', key.replace('_', ' ')),
                            'value_schema': value, 'applicability': 'all', 'spoiler_sensitive': True,
                            'aliases': ALIASES.get(field, [])})
    metadata = schema('metadata', {**common, 'part': {'const': 'metadata'},
        'attribute_groups': obj({g: obj(v) for g, v in metadata_scores.items()}),
        'content_presence': obj(presence), 'facets': obj({g: obj(v) for g, v in facets.items()}),
        'advisories': obj(advisories)}, defs)
    assert len(presence) == 171
    assert len({r['id'] for r in catalog}) == len(catalog)
    for name, data in [('similarity.schema.json', similarity), ('similarity.response.schema.json', response),
                       ('metadata.schema.json', metadata)]:
        save(name, data)
    save('field-catalog.json', {'version': VERSION, 'purpose': 'Stable field IDs, paths and types for future attribute/filter consumers; no query execution or weighting.', 'fields': catalog})

    # Feed each prompt only its own numerical definitions, reducing repeated input.
    for part, chosen in [('similarity', selected), ('metadata', {r['field'] for r in mapping['fields']} - selected)]:
        compact = {'version': VERSION, 'part': part, 'scoring_contract': registry['scoring_contract'],
                   'attributes': {f: registry['attribute_groups'][f.split('.')[0]][f.split('.')[1]] for f in
                                  [r['field'] for r in mapping['fields']] if f in chosen}}
        if part == 'metadata':
            compact.update(facets=FIELDS, advisory_topics=registry['advisory_topics'], value_contract=registry['metadata_value_contract'])
        save(part + '.definition.json', compact)

    inherited_catalog = list(previous_meta['properties']['catalog_facts']['properties'])
    external = [k for k in inherited_catalog if k not in ['adaptation_type', 'factual_basis']]
    external += ['release_formats', 'episode_runtime_min_minutes', 'episode_runtime_max_minutes',
                 'ratings_and_rating_distributions', 'certifications', 'release_region', 'provider_availability',
                 'edition_audio_tracks', 'audio_description_tracks', 'subtitle_tracks', 'audio_mix_formats',
                 'resolved_work_relations', 'named_real_people_and_events', 'reception_and_award_records']
    save('catalog-ownership.json', {'version': VERSION, 'owner': 'existing catalog data and independently sourced integrations',
        'fields': external,
        'rule': 'Keep existing discovery facts outside the LLM payload. Join only attributable catalog values by title/edition/scope. This file does not implement joins or assert these data are currently available.',
        'display_only': ['essence', 'highlights', 'explanatory_notes'],
        'removed_from_generation': ['entity_graph', 'character_relationship_records', 'character_outcome_records',
            'event_motives', 'temporal_segments', 'open_ended_concept_assertions', 'per_field_evidence_objects',
            'audience_suitability_certificates', 'model_generated_reception_claims', 'approximate_ensemble_size']})
    save('migration.json', {'from': '2.0.0-draft.3', 'to': VERSION,
        'projection_version': PROJECTION, 'vector_order_and_definitions_unchanged': True,
        'numeric_additions': ['characters.demonstrated_competence'],
        'advisory_additions': ['death'], 'fixed_facets': list(FIELDS),
        'retained': 'All 599 prior numeric definitions/destinations (274 vector + 325 metadata) and 171 presence concepts; only metadata descriptions pointing to removed concept records are cleaned up.',
        'breaking_envelope_change': 'Both response envelopes are simpler. Preserve raw draft.3 objects; do not relabel them or discard their evidence. Projection identity only guarantees the same 274 axes, not identical model outputs.',
        'metadata_conversion': 'Requires an explicit future adapter. Numeric assessed.value can transfer only with matching scope/rubric. Unknown/unassessed becomes null; show-only movie null is inapplicable. Rich relational records cannot be flattened losslessly.',
        'no_imputation': 'Do not fill unknowns with zero, infer absence from zero, or infer unobserved tags from other fields.',
        'not_implemented': ['query planning', 'Jev integration', 'taste weights', 'Qdrant indexing', 'production migration', 'paid inference']})

    # Synthetic fixtures demonstrate serialization only, never a real film's predictions.
    title = {'catalog_id': None, 'name': 'Synthetic contract fixture — not a film', 'release_year': 2000, 'media_type': 'movie'}
    scope_value = {'id': 'synthetic-movie', 'kind': 'movie', 'as_of': '2026-10-24',
        'coverage_description': 'Synthetic shape only; not a prediction or source claim.', 'edition_id': None,
        'season_number': None, 'episode_number': None, 'covered_seasons': None, 'covered_episode_ids': None}
    base = {'format_version': VERSION, 'title': title, 'scope': scope_value, 'assessment_basis': 'unknown'}
    sim_example = {**copy.deepcopy(base), 'part': 'similarity', 'projection_version': PROJECTION,
                   'scores': {g: {k: 0 for k in attrs} for g, attrs in scores.items()}}
    meta_example = {**copy.deepcopy(base), 'part': 'metadata',
        'attribute_groups': {g: {k: None for k in attrs} for g, attrs in metadata_scores.items()},
        'content_presence': {k: 'unknown' for k in presence},
        'facets': {g: {k: ('unknown' if attrs[k].get('enum') == PRESENCE['enum'] else None) for k in attrs} for g, attrs in facets.items()},
        'advisories': {k: {'presence': 'unknown', 'depiction_modes': None, 'intensity': None,
                           'frequency': None, 'explicitness': None} for k in advisories}}
    save('examples/similarity.synthetic.json', sim_example)
    save('examples/metadata.synthetic.json', meta_example)
    overview = ['# Complete field inventory', '', 'Generated by `build.py`. All categorical values and their unknown states are explicit in the schemas.', '',
        '## Numeric fields', '', '| Group | Vector | Metadata |', '|---|---:|---:|']
    for g in registry['attribute_groups']:
        overview.append(f'| {g} | {len(scores.get(g, {}))} | {len(metadata_scores.get(g, {}))} |')
    overview += ['', '## Fixed companion facets', '', '| Field | Values | Meaning |', '|---|---|---|']
    for field, spec in FIELDS.items():
        value = spec['value_schema']
        labels = ', '.join(value.get('items', value).get('enum', ['true', 'false']))
        overview.append(f'| `{field}` | {labels}' + (' (list)' if value.get('type') == 'array' else '') + f' | {spec["definition"]} |')
    overview += ['', '## Advisory topics', '', *[f'- **{k}**: {v}' for k, v in registry['advisory_topics'].items()], '']
    (HERE / 'schema-overview.md').write_text('\n'.join(overview))
    outputs = ['definition.json', 'mapping.json', 'similarity.schema.json', 'similarity.response.schema.json',
        'metadata.schema.json', 'field-catalog.json', 'similarity.definition.json', 'metadata.definition.json',
        'catalog-ownership.json', 'migration.json', 'schema-overview.md',
        'examples/similarity.synthetic.json', 'examples/metadata.synthetic.json']
    save('manifest.json', {'version': VERSION, 'projection_version': PROJECTION,
        'counts': mapping['counts'], 'numeric_fields': len(mapping['fields']), 'vector_dimensions': 274,
        'metadata_scores': 326, 'presence_concepts': len(presence), 'fixed_facets': len(FIELDS),
        'advisory_topics': len(advisories), 'field_catalog_entries': len(catalog),
        'source_hashes': {p.name: sha(p) for p in [PREVIOUS / 'definition.json', PREVIOUS / 'mapping.json', PREVIOUS / 'metadata.schema.json']},
        'output_hashes': {n: sha(HERE / n) for n in outputs}})
    print(json.dumps({'vector': 274, 'metadata_scores': 326, 'presence': len(presence), 'facets': len(FIELDS), 'advisories': len(advisories)}))


if __name__ == '__main__':
    build()
