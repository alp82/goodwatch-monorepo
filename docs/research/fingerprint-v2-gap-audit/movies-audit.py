import json,re,collections
from pathlib import Path
out=Path('docs/research/fingerprint-v2-gap-audit')
rows=json.loads((out/'top-movies.json').read_text())
# Candidate lexicons identify catalog mentions, not verified facts or trait centrality.
patterns={
'gambling':r'\b(?:gambl\w*|poker|casino\w*|blackjack|roulette|bookmak\w*|betting)\b',
'chess':r'\bchess\b', 'figure_skating':r'\b(?:figure skat\w*|ice skat\w*)\b',
'competitive_wrestling':r'\b(?:wrestl\w*)\b', 'climbing':r'\b(?:climb\w*|mountaineer\w*)\b',
'bowling':r'\bbowling\b', 'archery':r'\b(?:archery|archer\w*)\b', 'equestrian':r'\b(?:horse rac\w*|equestrian|jockey\w*|horseback|horse riding)\b',
'sailing':r'\b(?:sailing|yacht\w*|sailboat\w*)\b', 'table_tennis':r'\b(?:table tennis|ping.pong)\b',
'cheerleading':r'\bcheerlead\w*\b','ballet':r'\bballet\b',
'cults':r'\b(?:cult|cults|cultists|sect|sects)\b',
'corruption':r'\b(?:corrupt\w*|brib\w*)\b', 'slavery':r'\b(?:slavery|slave|slaves|enslav\w*)\b',
'freedom_and_autonomy':r'\b(?:freedom|liberation|free will|autonomy|emancipat\w*)\b',
'mortality_and_immortality':r'\b(?:mortality|immortal\w*|eternal life|eternal youth)\b',
'afterlife_and_reincarnation':r'\b(?:afterlife|reincarnat\w*|purgatory|heaven|hell)\b',
'bullying':r'\b(?:bully|bullies|bullying)\b', 'homelessness':r'\b(?:homeless\w*|houseless\w*)\b',
'food_insecurity':r'\b(?:starvat\w*|famine|hunger|starving)\b',
'genocide':r'\b(?:genocide|holocaust|ethnic cleansing)\b','religious_institutions':r'\b(?:catholic\w*|christian\w*|islam\w*|muslim\w*|jewish|judaism|buddhis\w*|hindu\w*)\b',
'cloning':r'\bclon(?:e|es|ed|ing)\b','mind_control':r'\b(?:mind control|brainwash\w*|hypnosis|hypnoti\w*)\b',
'memory_manipulation':r'\b(?:memory eras\w*|memories eras\w*|erase\w* memor\w*|memory implant\w*|implanted memor\w*)\b',
'shrinking':r'\b(?:shrink\w*|miniatur\w*|shrunken)\b','invisibility':r'\b(?:invisib\w*)\b',
'dream_worlds':r'\b(?:dream world\w*|dreamscape\w*|dream invasion|dream shar\w*|lucid dream\w*|dream within|dreams within|enter\w* dream\w*)\b',
'body_transformation':r'\b(?:shapeshift\w*|shape.shift\w*|metamorph\w*|body transformation|bodily transformation|physical transformation|transform\w* into)\b',
'alternate_history':r'\b(?:alternate history|alternative history|counterfactual)\b',
'first_contact':r'\bfirst contact\b', 'alien_invasion':r'\b(?:alien invasion|extraterrestrial invasion|alien conquer\w*)\b',
'space_exploration':r'\b(?:space explor\w*|interstellar travel|space mission|astronaut\w*)\b',
'zombies':r'\b(?:zombie\w*|undead)\b','dragons':r'\bdragon\w*\b','witches_and_wizards':r'\b(?:witch\w*|wizard\w*|sorcer\w*)\b',
'angels_and_gods':r'\b(?:angel|angels|god|gods|deity|deities|divine)\b','mermaids':r'\bmermaid\w*\b','fairies':r'\b(?:fairy|fairies)\b',
'sharks':r'\bshark\w*\b','apes_and_monkeys':r'\b(?:ape|apes|monkey\w*|gorilla\w*|chimpanzee\w*)\b','snakes':r'\b(?:snake|snakes|serpent\w*)\b',
'sentient_toys':r'\b(?:toys|toy|doll|dolls|puppet\w*)\b','anthropomorphic_animals':r'\b(?:anthropomorph\w*|talking animal\w*)\b',
'motorcycles':r'\b(?:motorcycl\w*|biker\w*|motorbike\w*)\b','submarines':r'\bsubmarin\w*\b','tanks':r'\b(?:tank|tanks)\b',
'jungle':r'\b(?:jungle\w*|rainforest\w*)\b','courtroom':r'\b(?:courtroom\w*|jury|juror\w*)\b','summer_camp':r'\b(?:summer camp\w*|camp counselor\w*)\b',
'other_planets':r'\b(?:alien planet\w*|distant planet\w*|another planet|other planet\w*|mars|martian\w*|pandora)\b',
'psychiatric_institutions':r'\b(?:psychiatric hospital|mental hospital|mental institution|asylum)\b',
'orphanage':r'\borphanage\w*\b','boarding_school':r'\bboarding school\w*\b','weddings':r'\b(?:wedding\w*|bride\w*|groom\w*)\b',
'pregnancy':r'\b(?:pregnan\w*|childbirth|expectant mother)\b','adoption_and_foster_care':r'\b(?:adopt\w*|foster\w*)\b',
'serial_killers':r'\bserial kill\w*\b','hostage_siege':r'\b(?:hostage\w*|siege)\b','disaster_mechanisms':r'\b(?:tsunami\w*|earthquake\w*|volcan\w*|tornado\w*|hurricane\w*|avalanche\w*|meteor\w*|asteroid\w*)\b',
'black_and_white':r'\b(?:black.and.white|monochrome|grayscale|greyscale)\b',
'magical_realism':r'\bmagic(?:al)? realism\b',
'confined_space':r'\b(?:claustrophobi\w*|confined|single.location|single.room|chamber piece|chamber drama)\b',
'physical_isolation':r'\b(?:isolat\w*|stranded|seclusion|secluded)\b',
'confidence_trick':r'\b(?:con artist|con man|conman|confidence trick|fraudster|scam\w*|swindl\w*)\b',
'undercover':r'\b(?:undercover|infiltrat\w*|mole)\b',
'ethics_and_moral_dilemmas':r'\b(?:ethic\w*|moral dilemma\w*|moral compromise|moral conflict)\b',
'memory_theme':r'\b(?:memory|memories|remembering)\b',
'body_image':r'\b(?:body image|beauty standard\w*|body dysmorph\w*)\b',
'whistleblowing':r'\bwhistle.?blow\w*\b',
'fake_relationship':r'\b(?:fake dating|fake family|fake marriage|pretend\w* (?:couple|marriage|relationship)|marriage of convenience)\b',
'friends_to_lovers':r'\b(?:friends.to.lovers|friendship to love|friends.with.benefits)\b',
'long_distance_romance':r'\blong.distance\b',
'aerial_combat':r'\b(?:dogfight\w*|aerial combat|aerial action|air combat)\b',
'naval_combat':r'\b(?:naval (?:warfare|combat|battle\w*)|sea battle\w*)\b',
'parkour':r'\bparkour\b',
'dodgeball':r'\bdodgeball\b',
'psychic_abilities':r'\b(?:telepath\w*|telekine\w*|psychic power\w*|precognition|premonition\w*)\b',
'teleportation':r'\b(?:teleport\w*|portal\w*)\b',
'genetic_engineering':r'\b(?:genetic engineer\w*|genetic manipulation|gene editing|genetically)\b',
'cyborgs_and_body_augmentation':r'\b(?:cyborg\w*|body augment\w*|cybernetic\w*)\b',
'death_games':r'\b(?:death game\w*|death match\w*|battle royale|deadly game\w*|human hunt\w*)\b',
'wrongful_accusation':r'\b(?:wrongful\w* (?:accus\w*|imprison\w*|convict\w*)|falsely accus\w*|false accus\w*)\b',
'illness_specificity':r'\b(?:aids|hiv|cancer|dementia|alzheimer\w*)\b',
'sex_work':r'\b(?:sex work\w*|prostitut\w*|pornograph\w*|porn\b|stripper\w*)\b',
'film_anthology':r'\banthology\b',
'screenlife':r'\bscreenlife\b',
'nonhuman_viewpoint':r'\b(?:anthropomorph\w*|animal as human|personification|non.human protagonist)\b',
'masculinity':r'\bmasculin\w*\b',
'poverty':r'\b(?:poverty|economic hardship|financial ruin)\b',
'political_oppression':r'\b(?:authoritarian\w*|dictatorship\w*|fascis\w*|totalitarian\w*|oppression|rebellion|revolution\w*)\b',
'rituals_and_curses':r'\b(?:curse\w*|ritual\w*|exorcis\w*|occult|haunted object)\b',
'real_time':r'\b(?:real.time|single.take|one.take|continuous.take|continuous.shot)\b',
}
fields=['title','original_title','synopsis','essence_text','essence_tags','keywords']
ledger=[];candidates={k:[] for k in patterns}
for r in rows:
 texts={f: r.get(f) if isinstance(r.get(f),str) else json.dumps(r.get(f) or [],ensure_ascii=False) for f in fields}
 matches=[]
 for k,p in patterns.items():
  evidence=[]
  for f,t in texts.items():
   m=re.search(p,t,re.I)
   if m:evidence.append({'field':f,'matched':m.group(),'excerpt':t[max(0,m.start()-80):min(len(t),m.end()+130)]})
  if evidence:
   matches.append(k);candidates[k].append({'rank':r['rank'],'tmdb_id':r['tmdb_id'],'title':r['title'],'evidence':evidence})
 ledger.append({'rank':r['rank'],'tmdb_id':r['tmdb_id'],'title':r['title'],'fields_available':[f for f in fields if r.get(f)],'candidate_mentions':matches,'coverage_method':'deterministic_lexical_scan_all_available_fields','manual_review':'not_a_full_title_fact_check'})
(out/'movies-title-ledger.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
(out/'movies-candidate-mentions.json').write_text(json.dumps({'method':'Case-insensitive lexical mentions; counts are not verified centrality or query demand. Titles/names may produce false positives.','candidates':candidates},ensure_ascii=False,indent=2)+'\n')
print('ROWS',len(rows))
for k,v in candidates.items():
 print(k,len(v),' | '.join(f"{x['rank']}: {x['title']}" for x in v[:14]))
