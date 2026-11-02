"""Reproduce complete field-purpose inventory; human cluster decisions are explicit below."""
import csv, hashlib, json
from collections import Counter
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
catalog = json.loads((ROOT / 'field-catalog.json').read_text())['fields']
owner = json.loads((ROOT / 'catalog-ownership.json').read_text())
clusters = [
 ('survival', ['themes.survival','narrative_engines.survival','genres.survival_thriller','tropes.apocalypse_survival'], 'Subject of staying alive versus events organized around immediate survival versus genre conventions versus collapse-specific arc. A retrospective survival drama need not have an ongoing survival engine. Two vector fields are close; retain provisionally and flag their contribution for judged-pair assessment.'),
 ('mystery', ['themes.mystery','narrative_engines.investigation','genres.mystery','storytelling.intrigue','viewing_affordances.theorizing'], 'Uncovering an important unknown can matter without characters gathering evidence. Intrigue is audience curiosity; theorizing is optional speculation. Mystery theme and investigation remain near-neighbors, not proven independent.'),
 ('adventure', ['themes.adventure','narrative_engines.quest','genres.adventure','experience.escapism','activities.travel'], 'Exploration/risk as subject differs from a defined-objective journey. Travel can be ordinary; escapism can occur without travel or adventure. Retain distinct meanings without assuming equal independent distance contributions.'),
 ('recovery', ['themes.addiction','themes.addiction_recovery','themes.recovery','themes.illness_and_dying','themes.trauma'], 'Dependency, attempts to overcome dependency, and rebuilding after any crisis are nested but distinguishable. A non-recovery addiction story and non-addiction recovery story differ. All three vector coordinates may overrepresent an addiction-recovery title; empirical redundancy remains open.'),
 ('belief', ['themes.faith_and_spirituality','world.myth_and_folklore','horror_modes.folk_horror','horror_elements.occult_rituals'], 'Faith/spiritual meaning need not manifest in world mythology, and mythology can be secular fantasy. Folk horror adds a horror mechanism; occult rituals require actual ceremonies rather than unfamiliar religion. No merge.'),
 ('simulation', ['world.simulation','world.virtual_reality','world_context.reality_layers','storytelling.unreliable_reality'], 'Simulated reality can operate without a character entering interactive VR; VR is a mediated experience. Physical staged reality and deceptive perception are different. Both numeric coordinates retained; simulation definition/presence clarified and versioned. A physically staged layer does not forbid another digital layer in the same work.'),
 ('startles', ['sound.audio_startles','presentation.jump_scare_frequency','presentation.jump_scares','presentation.jump_scare_modalities','atmosphere.sustained_dread','experience.fear'], 'Audio-startle intensity, recurrence of all audiovisual jump scares, occurrence and modality answer different questions. A single strong audio startle can differ from many weak visual startles. Dread/fear are not startle counts. Retain; co-generate frequency and its dependent facets.'),
 ('political_economy', ['themes.business','themes.capitalism','themes.consumerism','themes.finance','themes.politics','narrative_engines.political_struggle','occupations.business'], 'Enterprise subject, economic systems, consumption identity, finance, governance, plot engine and professional activity are distinguishable. The thematic cluster can receive disproportionate vector representation; do not count apparent name diversity as independence.'),
 ('crime_ideology', ['themes.radicalization','characters.transformation_arc','tropes.fall_from_grace','themes.crime','groups.types','groups.internal_dynamics'], 'Ideological adoption process differs from moral descent, crime and established group identity. Radicalization clarified; no cross-field auto-derivation.'),
 ('voice_and_address', ['storytelling.voiceover','storytelling.fourth_wall_breaking','presentation.narration_sources','humor.meta','storytelling.self_reference'], 'Narration can never acknowledge an audience; explicit address can occur without narration or comedy. Sources are categories rather than intensity. Existing boundaries retained.'),
 ('romance', ['relationships.romantic_development','narrative_engines.relationship_development','relationships.established_couple','relationships.marriage','relationships.breakup_or_divorce'], 'Romantic development is one relation type; the engine covers organizing change in any relationship. Existing partnership, marriage and separation can coexist across a whole work but not follow automatically from one another.'),
 ('dance', ['activities.dancing','performance.dance_prominence','performance.dance_styles','performance.dance_contexts','sound.musical_numbers'], 'Narrative centrality, perceptual prominence, style, context and expressive musical-number treatment differ. Occurrence can have zero plot centrality. Co-locate dance presence and dependent fields; no new coordinates.'),
 ('dependence', ['viewing_demands.franchise_knowledge','viewing_affordances.standalone_viewing','series.serialized_dependence','series.episodic_independence','viewing_affordances.drop_in_viewing','viewing_affordances.interruption_recovery'], 'Outside-installment knowledge, standalone comprehension, within-show continuity, joining midway and regaining a previously followed story differ. Franchise-knowledge/standalone is the strongest likely inverse pair: retain as attributes for acceptance, mark a merge candidate if judgments cannot distinguish them.'),
 ('visual_color', ['visuals.vibrant_palette','visuals.muted_palette','visuals.restricted_palette','visuals.warm_color','visuals.cool_color','visuals.dominant_colors','visuals.palette_patterns','format_facts.color_process'], 'Saturation, palette breadth, temperature, named colors, relationships and color/monochrome presentation differ. Warm and cool can coexist in different substantial sequences. No pixel-level precision or grading-process claim follows.'),
 ('time_setting', ['world_context.eras','world_context.predominant_eras','world_context.relative_periods','world_context.depicted_decades','world_context.predominant_decades','world_context.earliest_substantial_year','world_context.latest_substantial_year','world_context.calendar_systems'], 'Occurrence, dominance, release-relative period, numbered decades and exact boundaries offer different precision. New calendar correspondence prevents fictional epoch numbers from becoming CE facts. Partial known era with unknown dates is valid. Release date remains catalog-owned.'),
 ('age_identity', ['characters.older_adult_protagonist','characters.teen_protagonist','characters.child_protagonist','characters.female_protagonist','representation.established_protagonist_traits','themes.aging','themes.midlife'], 'Focal-role centrality differs from established categorical traits and subject matter. Older-adult anchor clarified to about65+/explicit late life; actor age and parenthood excluded. Whole-work tags do not bind all traits to the same protagonist.'),
 ('craft', ['evaluations.acting','evaluations.writing','evaluations.dialogue','evaluations.characterization','evaluations.narrative_cohesion','dialogue.naturalistic_delivery'], 'Quality of execution is distinct from amount/style. Writing contains several craft components intentionally exposed for enthusiast preferences; these are attributes, not added general-vector coordinates. Animation voice performance is explicitly eligible. Exact quality integers remain interpretive.'),
 ('harm', ['advisories.animal_harm.presence','advisories.death.presence','advisories.violence.presence','advisories.gore.presence','advisory_details.animal_harm_types'], 'Animal harm, death, violence and graphic detail are overlapping but not interchangeable. Natural death need not be violent; harm need not kill. Harm types support exclusions but unknown cannot satisfy absence. Depicted fictional harm is not a claim of harm during production.'),
]
cluster_map = {}
for name, fields, decision in clusters:
 for f in fields: cluster_map.setdefault(f, []).append(name)
kind_purpose = {
 'centrality':'Narrative importance, independently of mere occurrence.',
 'intensity':'Strength of the defined experience or treatment.',
 'prominence':'Perceptual prominence, independently of narrative importance.',
 'frequency':'Recurrence over the stated scope, not an exact scene count.',
 'membership':'Use of genre conventions, independently of topic presence.',
 'quality':'Interpretive execution quality, not descriptive resemblance or popularity.',
 'explicitness':'Degree of directly presented detail, not recurrence or importance.',
 'suitability':'Work-level affordance under stated assumptions, not a universal viewer verdict.'}
rows=[]
for row in catalog:
 f=row['id']; kind=row['kind']; group=f.split('.')[0]
 if f.startswith('advisories.'):
  leaf=f.rsplit('.',1)[1]
  purpose={'presence':'Whether this advisory topic occurs; unknown remains explicit.', 'depiction_modes':'How the topic is depicted/referred to; multimodal and edition-scoped.', 'intensity':'Severity/force, independent of recurrence.', 'frequency':'Recurrence, independent of severity.', 'explicitness':'Directness/detail, independent of presence and intensity.'}[leaf]
 elif f.startswith('presence.'):
  purpose='Occurrence status for '+f[9:]+', independent of narrative centrality; zero does not imply absent.'
 elif kind=='score':
  purpose=kind_purpose[row['measurement']]
 elif kind=='calendar_year':
  purpose='Exact normalized story-time boundary only when established; not a release date or inferred decade endpoint.'
 else:
  purpose='Bounded categorical or factual distinction for '+f+'; permits supported overlap and explicit unknown.'
 risks=[]
 if group in ['visuals','sound','music_styles'] or f.startswith('format_facts.capture_media'):
  risks.append('model recollection may not establish perceptual/production facts')
 if group=='evaluations':risks.append('interpretive ordinal, not objective quality gold')
 if f.startswith(('representation.','characters.')):risks.append('no identity inference from actors/stereotypes; flat tags not person-linked')
 if f.startswith(('advisories.','presence.')):risks.append('absence requires scope knowledge; not certified safety/exclusion')
 if f.startswith('world_context.'):risks.append('story setting, never release/production inference')
 rows.append({'id':f,'part':row['part'],'pointer':row['pointer'],'kind':kind,'measurement':row.get('measurement'),
  'purpose':purpose,'meaning':row['definition'],'disposition':'retain_for_acceptance',
  'near_neighbor_clusters':cluster_map.get(f,[]),'reliability_limits':risks,
  'catalog_owned':False})
(HERE/'field-purpose.json').write_text(json.dumps({'version':'2.0.0-draft.8','method':'Exhaustive definition/type/ownership inventory plus qualitative family and near-neighbor review; no empirical covariance or retrieval validation.', 'fields':rows},indent=2)+'\n')
with (HERE/'field-purpose.csv').open('w') as out:
 w=csv.DictWriter(out,fieldnames=['id','part','kind','measurement','purpose','meaning','disposition','near_neighbor_clusters','reliability_limits','catalog_owned','pointer']);w.writeheader();w.writerows(rows)
(HERE/'near-neighbors.json').write_text(json.dumps([{'id':n,'fields':f,'decision':d,'empirical_independence_established':False} for n,f,d in clusters],indent=2)+'\n')
# This is a schema-purpose audit, not fabricated per-field truth labels.
assert len(rows)==960 and len({r['id'] for r in rows})==960
assert sum(r['part']=='vector' for r in rows)==274
assert sum(r['part']=='attributes' for r in rows)==686
allids={r['id'] for r in rows}
assert all(set(fs)<=allids for _,fs,_ in clusters)
counts=Counter(r['id'].split('.')[0] for r in rows if r['part']=='vector')
(HERE/'coverage.json').write_text(json.dumps({'total_fields':960,'vector':274,'attributes':686,'draft7_retained':959,'new_fields':['world_context.calendar_systems'],'near_neighbor_clusters':len(clusters),'vector_groups':counts,'catalog_owned_fields':owner['fields'],'source_hashes':{n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in ['field-catalog.json','catalog-ownership.json','mapping.json','migration.json']}},indent=2)+'\n')
print('960 field purposes, 18 near-neighbor clusters, all IDs valid')
