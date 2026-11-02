"""Disjoint three-call generation interface; stored fingerprint remains two parts."""
import copy
import hashlib
import json


def generate(here, registry, mapping, vector, attributes, catalog):
    from build import obj, VERSION, PROJECTION
    selected = set(mapping['ordered_fields'])
    vector_presence = {f: s for f, s in attributes['properties']['content_presence']['properties'].items() if f in selected}
    targeted_presence = {f: s for f, s in attributes['properties']['content_presence']['properties'].items() if f not in selected}
    dependent = {'presentation.jump_scares', 'presentation.jump_scare_modalities',
                 'performance.dance_styles', 'performance.dance_contexts'}
    target_facets, fact_facets = {}, {}
    for group, shape in attributes['properties']['facets']['properties'].items():
        for key, leaf in shape['properties'].items():
            (target_facets if group + '.' + key in dependent else fact_facets).setdefault(group, {})[key] = copy.deepcopy(leaf)
    partitions = {
        'vector': {'scores': copy.deepcopy(vector['properties']['scores']), 'content_presence': obj(vector_presence)},
        'targeted': {'attribute_groups': copy.deepcopy(attributes['properties']['attribute_groups']),
                     'content_presence': obj(targeted_presence), 'facets': obj({g: obj(v) for g, v in target_facets.items()})},
        'facts': {'facets': obj({g: obj(v) for g, v in fact_facets.items()}),
                  'advisories': copy.deepcopy(attributes['properties']['advisories'])},
    }
    # Intake permits honest unknowns; full vector publication still does not.
    for shape in partitions['vector']['scores']['properties'].values():
        for leaf in shape['properties'].values():
            leaf['type'] = ['integer', 'null']
    common = '''Assess only the supplied work, adaptation, edition and whole scope. Use supplied information and specific knowledge of the work; recollection is not direct viewing. Return JSON only, with every requested key and no extras. No previous scores, member preferences or assessor findings are inputs.

Use each field's rubric. Known zero is valid; 1 needs a supported trace, never an imaginable association. Unknown is null, never a guessed zero or midpoint. Present with zero narrative centrality is allowed. Absent with a positive score for that same concept/scope is not. Co-assess every requested score/presence pair in this response; never infer absence from synopsis silence or zero centrality. Whole-show values describe only the named seasons; every show-only movie value is null.

All categories allow overlapping supported choices; null is unknown, [] is assessed with no listed choice. Never fill all choices to signal uncertainty. Tags across fields need not refer to the same character, scene or group. Keep sources of uncertainty visible. Return no evidence prose or invented citations. Follow the exact output schema.
'''
    prompts = {
        'vector': common + '\nProduce the general-resemblance vector and its matching presence flags. Distinguish mood, subject, narrative mechanism and formal treatment. Physical staged reality is not simulation; criminal moral descent is not ideological radicalization. Do not guess to satisfy complete-vector publication: unknowns are retained but prevent publication.\n',
        'targeted': common + '''
Produce targeted scores, their presence flags and the four tightly dependent dance/jump-scare facets. Dance presence, dance prominence, styles and contexts must agree, but occurrence can have zero narrative centrality. Jump-scare presence unknown requires null frequency/modalities; absent requires [] modalities and zero or null frequency; present requires positive or null frequency and supported modes or null. Do not equate sustained dread with abrupt startles.

Older adult means established roughly 65+ or explicit late-life/elderly stage, not middle age or parenthood. Acting includes animation voice performance; assess original performances unless another version is specified. Unknown/no performed characterization uses null, never zero. Craft quality is not genre membership or catalog popularity. A legislative hearing is not automatically a court case, friendly peers are not adversaries, former partners are not an established couple, and voiceover alone is not fourth-wall breaking.

Character emphasis describes sustained attention to understanding people, not writing quality, slow pacing or a transformation requirement. Ethical dilemmas require competing moral obligations or harms, not simply morally ambiguous characters. Resilience need not end in recovery or success; voluntary sacrifice excludes coerced loss and unwilling ritual victims. Claustrophobic feeling is not merely a small setting. Economic precarity is not all finance or class conflict. Score blues, reggae and gospel only as audible musical traditions, not from titles, locations or named musicians alone.
''',
        'facts': common + '''
Produce the requested categorical facts and detailed advisories. Exact facts require specific knowledge: prefer null to invented dates, capture formats or colors. Numbered story years and decades are normalized BCE/CE only, never release dates or fictional epoch numbers. An invented calendar can be known while all normalized year/decade fields remain null. Predominant periods must be in their depicted sets. Original capture medium is not a streaming format. Limited series does not mean a completed multi-season show.

Distinguish whole-work or substantial-program presentation modes from a scene or subject: a concert film is not any film with music, a talk show is not every documentary with interviews, and live puppetry is not automatically puppet animation. Presentation modes can overlap; opera traditions do not automatically imply Western classical music. Bollywood affiliation alone does not establish masala style, and national origin or poetic treatment alone does not establish a named film movement. Family secrets/reconciliation must actually concern a family; rekindled romance must involve the same former partners. Supernatural mechanisms require an established operative mechanism, not merely an unconfirmed belief or research. Multi-select facets record supported patterns without inventing person/event links.

For each advisory: unknown presence requires all details null; absent requires depiction_modes [] and each numeric detail zero or null; present requires supported depiction modes or null, never []. Present frequency cannot be zero, although intensity/explicitness can be zero. Depicted fictional harm counts; do not infer real production harm. Topic discussion does not automatically establish graphic depiction. Animal harm unknown requires null harm types, absent requires [], and present requires supported types or null. Synopsis silence cannot certify absence. Original-version performance and scoped editions apply; do not invent universal edition claims.
''',
    }
    directory = here / 'requests'
    directory.mkdir(exist_ok=True)
    manifest = {'version': VERSION, 'projection_version': PROJECTION, 'stored_parts': ['vector', 'attributes'],
                'policy': 'Three disjoint initial calls; controller attaches supplied title/scope/version and merges exact returned keys. No score repair or imputation.', 'parts': {}}
    for name, properties in partitions.items():
        schema = {'$schema': 'https://json-schema.org/draft/2020-12/schema', **obj(properties)}
        if name == 'facts':
            schema['$defs'] = {'advisory': copy.deepcopy(attributes['$defs']['advisory'])}
        numeric = selected if name == 'vector' else ({r['field'] for r in mapping['fields']} - selected if name == 'targeted' else set())
        presence = vector_presence if name == 'vector' else targeted_presence if name == 'targeted' else {}
        facet_ids = dependent if name == 'targeted' else set(registry['facets']) - dependent if name == 'facts' else set()
        definition = {'version': VERSION, 'request_part': name, 'scoring_contract': registry['scoring_contract'],
                      'attributes': {f: registry['attribute_groups'][f.split('.')[0]][f.split('.')[1]] for f in sorted(numeric)},
                      'presence': {f: presence[f]['description'] for f in presence},
                      'facets': {f: registry['facets'][f] for f in registry['facets'] if f in facet_ids}}
        if name == 'facts':
            definition['advisory_topics'] = registry['advisory_topics']
        files = {name + '.schema.json': schema, name + '.definition.json': definition}
        for filename, content in files.items():
            (directory / filename).write_text(json.dumps(content, indent=2, ensure_ascii=False) + '\n')
        (directory / (name + '.PROMPT.md')).write_text(prompts[name])
        owned = [r for r in catalog if (r['id'] in numeric or r['id'] in facet_ids or
                 r['id'].startswith('presence.') and r['id'][9:] in presence or
                 name == 'facts' and r['id'].startswith('advisories.'))]
        manifest['parts'][name] = {'schema': 'requests/' + name + '.schema.json',
            'definition': 'requests/' + name + '.definition.json', 'prompt': 'requests/' + name + '.PROMPT.md',
            'counts': {'scores': len(numeric), 'presence': len(presence), 'facets': len(facet_ids),
                       'advisory_leaves': 110 if name == 'facts' else 0},
            'fields': [{'id': r['id'], 'stored_part': r['part'], 'pointer': r['pointer']} for r in owned]}
    owned = [r['id'] for p in manifest['parts'].values() for r in p['fields']]
    assert len(owned) == len(set(owned)) == len(catalog)
    manifest['hashes'] = {str(p.relative_to(here)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(directory.iterdir()) if p.is_file()}
    (here / 'request-contract.json').write_text(json.dumps(manifest, indent=2) + '\n')
