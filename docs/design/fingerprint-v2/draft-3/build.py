"""Build the two draft.3 contracts without mutating historical V2 artifacts."""
import copy
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
VERSION = '2.0.0-draft.3'
PROJECTION = 'similarity-v2.2'
STR = {'type': 'string', 'minLength': 1}
NULLSTR = {'type': ['string', 'null']}
SCORE = {'type': 'integer', 'minimum': 0, 'maximum': 10}


def obj(props, required=None, **extra):
    return {'type': 'object', 'properties': props, 'required': list(props) if required is None else required,
            'additionalProperties': False, **extra}


def arr(items, minimum=0):
    return {'type': 'array', 'items': items, 'minItems': minimum, 'uniqueItems': True}


def enum(*values):
    return {'enum': list(values)}


def ref(name):
    return {'$ref': '#/$defs/' + name}


def save(name, data):
    (HERE / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def fact(value):
    return obj({'status': enum('assessed', 'unknown', 'not_applicable', 'not_assessed'),
                'value': {'anyOf': [value, {'type': 'null'}]}, 'evidence_refs': arr(STR), 'notes': NULLSTR},
               allOf=[{'if': {'properties': {'status': {'const': 'assessed'}}},
                       'then': {'properties': {'value': value, 'evidence_refs': arr(STR, 1)}},
                       'else': {'properties': {'value': {'type': 'null'}}}}])


def collection(item):
    return obj({'status': enum('assessed', 'partial', 'unknown', 'not_applicable', 'not_assessed'),
                'coverage': enum('full_scope', 'targeted', 'partial', 'unknown'),
                'items': arr(item), 'evidence_refs': arr(STR)},
               description='Positive/explicit assertions only. An empty list is not proof that no such thing exists. Use a scoped absence assertion for hard exclusion.',
               allOf=[{'if': {'properties': {'status': {'enum': ['unknown', 'not_applicable', 'not_assessed']}}},
                       'then': {'properties': {'items': {'maxItems': 0}}}},
                      {'if': {'properties': {'status': {'enum': ['assessed', 'partial']}}},
                       'then': {'properties': {'evidence_refs': arr(STR, 1)}}}])


def prune(schema):
    """Keep each schema self-contained without irrelevant definitions."""
    needed = set()
    def walk(value):
        if isinstance(value, dict):
            if '$ref' in value:
                name = value['$ref'].removeprefix('#/$defs/')
                if name not in needed:
                    needed.add(name)
                    walk(schema['$defs'][name])
            for k, v in value.items():
                if k != '$defs': walk(v)
        elif isinstance(value, list):
            for v in value: walk(v)
    walk(schema)
    schema['$defs'] = {k: v for k, v in schema['$defs'].items() if k in needed}
    return schema


def build():
    old = json.loads((BASE / 'definition.json').read_text())
    legacy = json.loads((BASE / 'schema.json').read_text())
    mapping = json.loads((BASE / 'similarity/mapping.json').read_text())
    groups = copy.deepcopy(old['attribute_groups'])
    selected = set(mapping['ordered_fields'])
    new_fields = []
    promoted = ['tropes.revenge', 'tropes.redemption', 'tropes.fall_from_grace', 'tropes.underdog_rise']
    selected.update(promoted)

    additions = {
        'experience.tranquility': ('intensity', 'Calm, restful or meditative feeling evoked; not merely absence of tension.', True),
        'experience.indignation': ('intensity', 'Moral outrage or righteous anger evoked in the viewer; distinct from anger depicted by characters.', True),
        'experience.disgust': ('intensity', 'Revulsion evoked, independently of comic gross-out, frightening threat or grotesque visual style.', True),
        'aesthetics.lyricism': ('intensity', 'Poetic, associative presentation through image, language, sound or rhythm; not a synonym for slow pacing.', True),
        'aesthetics.transgression': ('intensity', 'Perceptible aesthetic treatment that deliberately challenges taboos or conventions; do not infer a creator\'s private intent or equate explicit content alone with transgression.', True),
        'visuals.cutting_pace': ('intensity', 'Perceived rate of shot changes and editing transitions: 0 means virtually no cuts, not low quality. Distinct from rate of plot events.', True),
        'world_treatment.magical_realism': ('intensity', 'Impossible or supernatural events are treated as ordinary within an otherwise everyday world; distinct from an explicitly elaborated magic system.', True),
        'storytelling.didacticism': ('intensity', 'How explicitly the work states, teaches or argues a message; independent of intellectual stimulation or whether the viewer agrees.', True),
        'storytelling.confined_setting': ('intensity', 'Concentration of the work within a single location or tightly bounded connected spaces; distinct from small cast, low budget or confinement as a plot event.', True),
        'themes.persuasion_and_propaganda': ('centrality', 'Shaping public or interpersonal belief through persuasion, spin, PR, advertising, propaganda or disinformation is a subject of the work; do not label the work itself propaganda from this score.', True),
        'themes.illness_and_dying': ('centrality', 'Personal illness, diagnosis, living with illness, dying or end-of-life care is a subject; distinct from population-level epidemics.', True),
        'themes.corruption': ('centrality', 'Abuse of entrusted public, organizational or professional power for private gain is a subject; not all crime or ambition is corruption.', True),
        'settings.courtroom': ('centrality', 'A courtroom or judicial hearing venue has narrative importance; distinguish legislative hearings.', False),
        'settings.casino': ('centrality', 'A casino or organized gambling venue has narrative importance.', False),
        'settings.suburban': ('centrality', 'A suburban residential environment has narrative importance.', False),
        'settings.jungle': ('centrality', 'A tropical dense forest environment has narrative importance.', False),
        'settings.coast_or_beach': ('centrality', 'A coast or beach environment has narrative importance.', False),
        'settings.military_base': ('centrality', 'A military base or barracks environment has narrative importance.', False),
        'occupations.government_and_politics': ('centrality', 'Government service, elected office or professional political work matters to the story.', False),
        'occupations.public_relations_and_advertising': ('centrality', 'Professional PR, lobbying communications, spin or advertising work matters to the story.', False),
        'occupations.science_research': ('centrality', 'Scientific research as professional work matters to the story.', False),
        'occupations.clergy': ('centrality', 'Religious leadership or clergy work matters to the story.', False),
        'occupations.sex_work': ('centrality', 'Sex work as work or livelihood matters to the story; do not infer exploitation from the occupation alone.', False),
        'occupations.agriculture': ('centrality', 'Farming or agricultural work matters to the story.', False),
        'occupations.royalty_and_aristocracy': ('centrality', 'Royal or aristocratic duties, social position and its obligations matter to the story.', False),
        'activities.gambling': ('centrality', 'Gambling activity matters to the story.', False),
        'activities.writing': ('centrality', 'Writing as an activity or creative practice matters to the story.', False),
        'activities.hunting_and_fishing': ('centrality', 'Hunting or fishing activity matters to the story; specific practices can be named in concept assertions.', False),
        'activities.climbing': ('centrality', 'Rock, mountain or sport climbing activity matters to the story.', False),
        'activities.sailing': ('centrality', 'Sailing activity matters to the story.', False),
        'activities.tabletop_games': ('centrality', 'Board games, tabletop role-playing or other tabletop games matter to the story.', False),
        'relationships.infidelity': ('centrality', 'A breach of an agreed romantic or sexual exclusivity commitment matters to the story; consensual non-monogamy is not infidelity.', False),
        'relationships.unrequited_love': ('centrality', 'Unreciprocated romantic attachment matters to the story.', False),
        'characters.nonhuman_protagonist': ('centrality', 'A nonhuman character occupies a protagonist role; distinguish role from production technique.', False),
        'characters.solo_protagonist': ('centrality', 'One protagonist carries the main narrative perspective; not a claim that there is only one cast member.', False),
        'entities.toys_or_puppets': ('centrality', 'Toys or puppets as depicted entities matter to the story; distinct from puppet animation as technique.', False),
        'tropes.home_invasion': ('centrality', 'Unwanted hostile entry into a home organizes a consequential part of the story.', False),
        'humor.raunchy': ('intensity', 'Sexually explicit or bawdy humor; distinct from noncomic sensuality and nonsexual gross-out humor.', False),
        'music_styles.soul_rnb': ('prominence', 'Soul or rhythm-and-blues music is perceptibly prominent; name specific traditions in concept assertions where supported.', False),
        'music_styles.funk': ('prominence', 'Funk music is perceptibly prominent.', False),
        'visuals.slow_motion': ('intensity', 'Slow-motion presentation is perceptibly used.', False),
        'visuals.static_camera': ('intensity', 'Locked-off or substantially stationary camera compositions characterize the visual treatment.', False),
        'storytelling.real_time': ('intensity', 'Elapsed story time closely tracks presentation time; not simply fast plotting.', False),
        'storytelling.vignette_structure': ('intensity', 'Discrete short episodes, scenes or chapters form the work; distinguish from multiple timelines.', False),
        'storytelling.narrativity': ('intensity', 'A developing sequence of causally or temporally linked events organizes the work; 0 indicates non-narrative form, not failure or low quality.', False),
    }
    for field, (measurement, definition, vector) in additions.items():
        group, key = field.split('.')
        assert key not in groups[group], field
        spec = {'definition': definition, 'measurement': measurement,
                'similarity_role': 'selected_similarity' if vector else 'targeted_only',
                'spoiler_sensitive': False, 'applicability': 'all'}
        if group in {'settings', 'occupations', 'activities', 'entities'} or field in {
            'relationships.infidelity', 'relationships.unrequited_love', 'tropes.home_invasion',
            'characters.nonhuman_protagonist', 'characters.solo_protagonist'}:
            spec['presence_definition'] = 'Whether this concept occurs within the assessed scope, independently of narrative importance: ' + definition
        groups[group][key] = spec
        if vector: selected.add(field)
        new_fields.append(field)
    edits = {
        'storytelling.fourth_wall_breaking': 'Explicit acknowledgment of the audience or of the work as a presented fiction, including direct address. Voiceover alone is not sufficient.',
        'narrative_engines.legal_case': 'Court proceedings, formal adjudication or preparation for a legal case organize the story. Legislative debate or a political committee hearing alone belongs to political_struggle.',
        'relationships.adversaries_cooperate': 'Characters with genuinely opposing goals cooperate in a consequential shared undertaking; friendly peers in different industries are not automatically adversaries.',
        'relationships.established_couple': 'An ongoing romantic partnership matters to the story; former partners or separated co-parents alone belong to breakup_or_divorce or parent_child.',
        'themes.disease_and_pandemics': 'Population-level disease transmission, epidemics, pandemics or public-health response matter as subjects. Personal diagnosis, dying and care are assessed separately as illness_and_dying.',
        'world.simulation': 'An artificial simulation is an important layer of depicted reality. A physically staged real environment or social deception alone is not a simulation.',
        'world.virtual_reality': 'Characters experience an interactive digitally mediated environment. A physical set, surveillance broadcast or deception alone is not virtual reality.',
    }
    for field, text in edits.items():
        g, k = field.split('.'); groups[g][k]['definition'] = text
    rows = []
    old_dest = {r['field']: r['destination'] for r in mapping['fields']}
    order = []
    for g, attrs in groups.items():
        for k, spec in attrs.items():
            field = f'{g}.{k}'
            destination = 'fingerprint' if field in selected else old_dest.get(field, 'content_metadata')
            if field in selected:
                assert spec['applicability'] == 'all'
                order.append(field)
            rows.append({'field': field, 'destination': destination,
                         'vector_index': len(order)-1 if field in selected else None,
                         'measurement': spec['measurement'], 'applicability': spec['applicability'],
                         'spoiler_sensitive': spec['spoiler_sensitive']})
    assert len(order) == 274
    registry = {'version': VERSION, 'status': 'owner_approved_design_not_deployed',
                'attribute_groups': groups, 'scoring_contract': copy.deepcopy(old['scoring_contract']),
                'advisory_topics': old['advisory_topics'], 'related_attributes': old['related_attributes']}
    for rubric in ['intensity', 'frequency', 'prominence', 'membership']:
        registry['scoring_contract']['rubrics'][rubric]['1'] = 'Supported trace under this rubric. Do not use 1 merely because a weak association is imaginable.'
    registry['scoring_contract']['rubrics']['centrality']['1'] = 'Supported, very minor narrative importance; occurrence alone is insufficient. Zero means no narrative importance, not certified absence.'
    registry['scoring_contract']['rubrics']['quality']['1'] = 'Very unsuccessful execution; not a default for unknown quality or absent craft.'
    save('definition.json', registry)

    defs = copy.deepcopy(legacy['$defs'])
    defs.pop('analysis'); defs.pop('temporal_segment')
    defs['score'] = SCORE
    defs['title'] = legacy['properties']['title']
    defs['scope']['properties']['covered_seasons']['uniqueItems'] = True
    defs['scope']['properties']['covered_seasons']['minItems'] = 1
    defs['scope']['properties']['covered_episode_ids']['uniqueItems'] = True
    defs['scope']['allOf'] += [
        {'if': {'properties': {'kind': {'const': 'movie'}}},
         'then': {'not': {'anyOf': [{'required': [k]} for k in ['season_number','episode_number','covered_seasons','covered_episode_ids']]}}},
        {'if': {'properties': {'kind': {'const': 'whole_show'}}}, 'then': {'required': ['covered_seasons']}}]
    defs['provenance'] = obj({'generated_at': {'type': 'string', 'format': 'date-time'},
        'generator': NULLSTR, 'model': NULLSTR, 'route': NULLSTR, 'request_id': NULLSTR,
        'registry_version': {'const': VERSION}, 'review_status': enum('unreviewed','editorial_reviewed','illustrative_only')})
    defs['group_basis'] = obj({'basis': enum('supplied_source','model_prior','direct_observation','mixed','unknown'),
                              'confidence': enum('low','medium','high',None), 'evidence_refs': arr(STR), 'notes': NULLSTR},
        allOf=[{'if': {'properties': {'basis': {'const':'unknown'}}},
                'then': {'properties': {'confidence': {'type':'null'}}},
                'else': {'properties': {'confidence': enum('low','medium','high'), 'evidence_refs': arr(STR,1)}}}])
    defs['concept'] = obj({'id': STR, 'label': STR,
                          'namespace': enum('goodwatch','wikidata','external','proposed'), 'external_uri': NULLSTR},
                         description='IDs resolve through a controlled vocabulary with aliases. Proposed concepts are not automatically indexed as canonical facts.')
    # Presence is evidence-bearing, unlike the historical compact sidecar.
    defs['presence'] = obj({'presence': enum('present','absent','unknown'),
        'applicability': enum('applicable','not_applicable','unknown'),
        'coverage': enum('full_scope','targeted_verified','partial','unknown'),
        'evidence_refs': arr(STR), 'spoiler_sensitive': {'type':'boolean'}}, allOf=[
        {'if': {'properties': {'presence': {'enum':['present','absent']}}},
         'then': {'properties': {'applicability': {'const':'applicable'}, 'evidence_refs': arr(STR,1)}}},
        {'if': {'properties': {'presence': {'const':'absent'}}},
         'then': {'properties': {'coverage': enum('full_scope','targeted_verified')}}}])
    defs['work_target'] = obj({'catalog_id': NULLSTR, 'label': STR,
        'resolution': enum('resolved','unresolved')}, allOf=[
            {'if': {'properties': {'resolution': {'const':'resolved'}}}, 'then': {'properties': {'catalog_id': STR}}},
            {'if': {'properties': {'resolution': {'const':'unresolved'}}}, 'then': {'properties': {'catalog_id': {'type':'null'}}}}])
    defs['entity'] = obj({'id': STR, 'label': STR,
        'kind': enum('character','animal_character','character_group','person','event','organization','place','artwork'),
        'external_id': NULLSTR, 'roles': arr(enum('protagonist','co_protagonist','supporting','minor','ensemble','subject')),
        'evidence_refs': arr(STR,1), 'spoiler_sensitive': {'type':'boolean'}})
    defs['representation_annotation']['properties']['entity_id'] = STR
    defs['representation_annotation']['required'].append('entity_id')
    defs['representation_annotation']['properties']['concept'] = ref('concept')
    defs['representation_annotation']['required'].append('concept')
    del defs['representation_annotation']['properties']['concept_id']
    defs['representation_annotation']['required'].remove('concept_id')
    defs['character_relationship'] = obj({'id': STR, 'subject_entity_id': STR, 'object_entity_id': STR,
        'relationship_concept': ref('concept'), 'assessment': ref('assessment'),
        'evidence_refs': arr(STR,1), 'spoiler_sensitive': {'type':'boolean'}})
    defs['character_outcome'] = obj({'entity_id': STR, 'relationship_id': NULLSTR,
        'outcome': enum('death','physical_harm','survival','romantic_union','romantic_separation','tragic_resolution','hopeful_resolution','other'),
        'other_concept': {'anyOf':[ref('concept'),{'type':'null'}]}, 'assertion': ref('presence')},
        allOf=[{'if':{'properties':{'outcome':{'const':'other'}}},'then':{'properties':{'other_concept':ref('concept')}}}])
    defs['work_relation'] = obj({'relation': enum('based_on','remake_of','reimagining_of','sequel_to','prequel_to','spinoff_of','homage_to','parody_of','references','spiritual_successor_of','shared_universe'),
        'target': ref('work_target'), 'claim_type': enum('catalog_fact','attributed_interpretation','editorial_hypothesis'),
        'attribution': NULLSTR, 'evidence_refs': arr(STR,1), 'spoiler_sensitive': {'type':'boolean'}},
        allOf=[{'if':{'properties':{'claim_type':{'const':'attributed_interpretation'}}},'then':{'properties':{'attribution':STR}}}])
    defs['depicted_subject'] = obj({'entity_id': STR, 'factual_basis': enum('documented','fictionalized','disputed','unknown'),
        'centrality': ref('assessment'), 'evidence_refs': arr(STR,1), 'spoiler_sensitive': {'type':'boolean'}})
    defs['concept_assertion'] = obj({'concept': ref('concept'),
        'facet': enum('genre','film_movement','cultural_tradition','music_tradition','documentary_device','setting','occupation','activity','representation','theme','production_technique','other'),
        'subject_entity_id': NULLSTR, 'assertion': ref('presence'),
        'centrality': ref('assessment'), 'claim_type': enum('explicit_content','catalog_fact','attributed_interpretation','editorial_hypothesis'),
        'attribution': NULLSTR}, allOf=[{'if':{'properties':{'claim_type':{'const':'attributed_interpretation'}}},'then':{'properties':{'attribution':STR}}}])
    defs['cultural_context']['properties']['concept_id'] = STR
    defs['cultural_context']['allOf'] = [{'if':{'properties':{'relation':{'enum':['critical_interpretation','artistic_influence']}}},
                                         'then':{'properties':{'attribution':STR}}}]
    defs['reception_observation']['properties']['observation_type']['enum'].append('derived_proxy')
    defs['reception_observation']['properties']['method'] = NULLSTR
    defs['reception_observation']['required'].append('method')
    defs['reception_observation']['allOf'] = [{'if':{'properties':{'observation_type':{'const':'derived_proxy'}}},
                                             'then':{'properties':{'method':STR}}}]
    # Make culturally named categories extensible rather than one global 'world music' score.
    format_values = {
        'production_method': enum('live_action','animation','mixed_media'),
        'animation_techniques': arr(enum('traditional_2d','digital_2d','cgi_3d','stop_motion','rotoscoping','cutout','puppetry','mixed','other')),
        'narrative_mode': enum('fiction','nonfiction','hybrid'),
        'presentation_modes': arr(enum('conventional_narrative','mockumentary','found_footage','sketch','observational_documentary','expository_documentary','participatory_documentary','essay','reality_competition','reality_observational','experimental','non_narrative','other')),
        'documentary_devices': arr(enum('interviews','archive','reenactment','voiceover','observation','participation','animation','other')),
        'anime_tradition': {'type':'boolean'},
        'series_structure': enum('limited','ongoing_serial','episodic','anthology','mixed'),
        'color_process': enum('color','black_and_white','mixed','tinted'),
        'capture_media': arr(enum('8mm','super_8','16mm','super_16','35mm','65mm','digital','analog_video','mixed','other')),
        'release_formats': arr(STR),
        'silent_or_intertitles': {'type':'boolean'}, 'single_take_presentation': {'type':'boolean'},
        'real_time_presentation': {'type':'boolean'},
        'post_credits_scene_present': {'type':'boolean'}, 'alternate_endings_present': {'type':'boolean'},
        'episode_runtime_min_minutes': {'type':'number','minimum':0}, 'episode_runtime_max_minutes': {'type':'number','minimum':0},
        'approximate_ensemble_size': {'type':'integer','minimum':0},
    }
    catalog_values = {
        'original_language_codes': arr(STR), 'spoken_language_codes': arr(STR), 'signed_language_codes': arr(STR),
        'production_country_codes': arr(STR), 'cast_person_ids': arr(STR), 'director_person_ids': arr(STR),
        'writer_person_ids': arr(STR), 'source_author_person_ids': arr(STR), 'production_company_ids': arr(STR),
        'distributor_ids': arr(STR), 'franchise_ids': arr(STR), 'collection_ids': arr(STR),
        'adaptation_type': enum('original','novel','short_story','play','comic','game','folklore','biography','mixed','other'),
        'source_work_ids': arr(STR), 'factual_basis': enum('fictional','based_on_real_events','biographical','documentary','mixed','disputed'),
        'runtime_minutes': {'type':'number','minimum':0}, 'release_date': {'type':'string','format':'date'},
        'show_status': enum('ongoing','ended','cancelled','limited_complete','hiatus'),
    }
    defs['highlight'] = obj({'field_id': STR, 'text': STR, 'evidence_refs': arr(STR,1), 'spoiler_sensitive': {'type':'boolean'}})
    defs['temporal_segment'] = obj({'label': STR,'start_fraction':{'type':'number','minimum':0,'maximum':1},
        'end_fraction':{'type':'number','minimum':0,'maximum':1},'spoiler_sensitive':{'type':'boolean'},
        'description': STR,'evidence_refs':arr(STR,1)})
    common = {'format_version': {'const': VERSION}, 'title': ref('title'), 'scope': ref('scope'),
              'provenance': ref('provenance'), 'evidence': arr(ref('evidence'))}
    score_groups, meta_groups, presence = {}, {}, {}
    for g, attrs in groups.items():
        for k, spec in attrs.items():
            field = f'{g}.{k}'
            if field in selected:
                score_groups.setdefault(g,{})[k] = {**SCORE, 'description': spec['definition'], 'x-measurement': spec['measurement'], 'x-spoiler-sensitive': spec['spoiler_sensitive']}
            else:
                meta_groups.setdefault(g,{})[k] = {**ref('assessment'), 'description': spec['definition'], 'x-measurement': spec['measurement'], 'x-applicability': spec['applicability']}
            if 'presence_definition' in spec:
                presence[field] = {**ref('presence'), 'description': spec['presence_definition']}
    basis_groups = obj({g:ref('group_basis') for g in score_groups})
    similarity = {'$schema':'https://json-schema.org/draft/2020-12/schema', '$id':'urn:goodwatch:fingerprint:v2:draft3:similarity',
        'title': 'GoodWatch V2 similarity fingerprint — complete 274-dimensional contract',
        **obj({**common, 'part':{'const':'similarity'}, 'projection_version':{'const':PROJECTION},
               'scores':obj({g:obj(attrs) for g,attrs in score_groups.items()}), 'assessment_basis':basis_groups}),
        '$defs':copy.deepcopy(defs)}
    prune(similarity)
    response = copy.deepcopy(similarity)
    response['$id'] += ':response'
    response['title'] = 'GoodWatch V2 similarity response — incomplete scores remain null'
    for attrs in response['properties']['scores']['properties'].values():
        for spec in attrs['properties'].values():spec['type']=['integer','null']
    metadata_props = {**common, 'part':{'const':'metadata'},
        'requested_score_ids':arr({'enum':[r['field'] for r in rows if r['destination']!='fingerprint']}),
        'requested_presence_ids':arr({'enum':list(presence)}),
        'attribute_groups':obj({g:obj(attrs,required=[]) for g,attrs in meta_groups.items()},required=[]),
        'content_presence':obj(presence,required=[]),
        'format_facts':obj({k:fact(v) for k,v in format_values.items()}),
        'catalog_facts':obj({k:fact(v) for k,v in catalog_values.items()}),
        'advisories':obj({k:ref('advisory') for k in old['advisory_topics']}),
        'world_contexts':collection(ref('world_context')), 'cultural_contexts':collection(ref('cultural_context')),
        'seasonal_contexts':collection(ref('seasonal_context')), 'entities':collection(ref('entity')),
        'representation_annotations':collection(ref('representation_annotation')),
        'character_relationships':collection(ref('character_relationship')), 'character_outcomes':collection(ref('character_outcome')),
        'work_relations':collection(ref('work_relation')), 'depicted_subjects':collection(ref('depicted_subject')),
        'concept_assertions':collection(ref('concept_assertion')), 'audience_contexts':collection(ref('audience_context')),
        'reception':collection(ref('reception_observation')), 'temporal_segments':collection(ref('temporal_segment')),
        'essence':obj({'text':fact(STR),'tags':fact(arr(STR)),'highlights':collection(ref('highlight'))})}
    metadata = {'$schema':'https://json-schema.org/draft/2020-12/schema', '$id':'urn:goodwatch:fingerprint:v2:draft3:metadata',
        'title':'GoodWatch V2 companion metadata — typed, evidence-bearing and scope-bound',
        'description':'Sparse long-tail scores; explicit fact/advisory states and collection coverage. Missing score entries are not assessed, never zero. Controller validates references and requested coverage.',
        **obj(metadata_props), '$defs':defs}
    prune(metadata)
    for name,schema in [('similarity.schema.json',similarity),('similarity.response.schema.json',response),('metadata.schema.json',metadata)]:save(name,schema)
    from collections import Counter
    counts=dict(Counter(r['destination'] for r in rows))
    save('mapping.json',{'version':PROJECTION,'registry_version':VERSION,'ordered_fields':order,'dimension_count':len(order),
                         'counts':counts,'presence_count':len(presence),'fields':rows})
    save('migration.json',{'from_registry':old['version'],'from_projection':mapping['version'],'to_registry':VERSION,'to_projection':PROJECTION,
        'new_fields':new_fields,'promoted_existing_fields':promoted,'definition_changes':edits,
        'do_not_copy_without_reassessment':list(edits)+new_fields,
        'policy':'Keep prior schemas/raws immutable. New vector order is incompatible with prior arrays. New or redefined values require assessment; no padding or zero imputation.',
        'deferred':['automatic low-score floors','hard fiction/nonfiction partitions','simulation/VR merging','unmeasured removal of correlated themes','reception proxies treated as facts']})
    save('indexing-contract.json',{'version':VERSION,'status':'implementation_contract_not_deployed',
        'numeric_fields':[{'field':r['field'],'source':r['destination'],'measurement':r['measurement'],
                           'operations':['eq','lt','lte','gt','gte','range','is_unknown','is_not_assessed'],
                           'zero_means_absence':r['measurement'] in ['intensity','prominence','frequency'],
                           'spoiler_sensitive':r['spoiler_sensitive']} for r in rows],
        'thresholds':{'minor':2,'meaningful_secondary':5,'major':8,'note':'Rubric labels, not universal calibrated percentiles; comparison uses the field\'s measurement type.'},
        'negation':'Unknown is neither false nor absent. Hard absence filters require applicable, evidence-supported absence over the requested scope. Omitted metadata is not assessed.',
        'relations':'Index canonical concept IDs, resolved target work IDs, subject/entity IDs and relation type together, preserving scope. Proposed/unresolved IDs do not become authoritative exact matches.',
        'personal_taste':'May use metadata preferences separately from general-vector distance; never infer a member identity from taste.',
        'retrieval':'Separate experience/content/form contribution budgets and correlated concepts; weights and metric deliberately unselected. No automatic score flooring or hard format partition.',
        'availability':'Time-varying offers, availability, certifications, ratings and financial reception facts come from existing authoritative catalog stores; do not ask the LLM to regenerate them.'})
    inputs={str(p.relative_to(BASE)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [BASE/'definition.json',BASE/'schema.json',BASE/'similarity/mapping.json']}
    save('manifest.json',{'version':VERSION,'projection_version':PROJECTION,'counts':counts,'all_numeric_fields':len(rows),
        'vector_dimensions':len(order),'presence_fields':len(presence),'advisory_topics':len(old['advisory_topics']),
        'source_hashes':inputs,'files':{name:hashlib.sha256((HERE/name).read_bytes()).hexdigest() for name in ['definition.json','similarity.schema.json','similarity.response.schema.json','metadata.schema.json','mapping.json','migration.json','indexing-contract.json']}})
    print(json.dumps({'counts':counts,'total':len(rows),'presence':len(presence)},indent=2))


if __name__ == '__main__':build()
