"""Every-name lexical triage of stored tropes; no network access.

Clues and candidate families are not semantic-completeness classifications.
Counts from title arrays and detailed URL rows remain separate.
"""
import collections
import csv
import gzip
import json
import pathlib
import re
import random
from urllib.parse import urlparse

BASE = pathlib.Path(__file__).parent
ROOT = BASE.parents[2]

def norm(value):
    value = re.sub(r"([a-z])([A-Z])", r"\1 \2", value)
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()

def load(name):
    return json.loads((BASE / name).read_text())

def main():
    rows = load("tropes-inventory-all.json")
    urls = load("tropes-url-inventory.json")
    definition = json.loads((ROOT / "docs/design/fingerprint-v2/llm-definition.json").read_text())
    prior = load("recommended-changes.json")
    anchors = collections.defaultdict(set)
    for group, attrs in definition["attribute_groups"].items():
        for key in attrs:
            phrase = norm(key.rsplit("_", 1)[0])
            if len(phrase) > 5:
                anchors[phrase].add(f"{group}.{key}")
    # High-frequency semantic aliases; a clue remains weaker than full equivalence.
    aliases = {
        "shout out": "storytelling.homage_intensity",
        "running gag": "humor.running_gags_frequency",
        "downer ending": "ending.tragedy_intensity",
        "bittersweet ending": "ending.bittersweetness_intensity",
        "deadpan snarker": "humor.deadpan_intensity",
        "black comedy": "humor.dark_intensity",
        "breaking the fourth wall": "storytelling.fourth_wall_breaking_intensity",
        "the reveal": "storytelling.twist_impact_intensity",
        "wham line": "storytelling.twist_impact_intensity",
        "wham shot": "storytelling.twist_impact_intensity",
        "love triangle": "relationships.love_triangle_centrality",
        "anti hero": "characters.antihero_centrality",
        "the oner": "visuals.long_takes_intensity",
        "body horror": "horror_modes.body_horror_centrality",
        "race against the clock": "tropes.race_against_time_centrality",
        "faking the dead": "tropes.apparent_death_centrality",
        "disney death": "tropes.apparent_death_centrality",
        "not quite dead": "tropes.apparent_death_centrality",
        "final girl": "tropes.final_survivor_centrality",
        "sole survivor": "tropes.final_survivor_centrality",
        "enemy mine": "relationships.adversaries_cooperate_centrality",
        "true companions": "relationships.found_family_centrality",
        "ragtag bunch of misfits": "relationships.found_family_centrality",
        "character development": "characters.transformation_arc_centrality",
        "an achronic order": "storytelling.nonlinearity_intensity",
        "anachronic order": "storytelling.nonlinearity_intensity",
        "how we got here": "storytelling.nonlinearity_intensity",
        "the alcoholic": "themes.addiction_centrality",
        "roaring rampage of revenge": "tropes.revenge_centrality",
        "red herring": "storytelling.information_withholding_intensity",
        "no name given": "dialogue.density_intensity",
        "the voiceless": "dialogue.density_intensity",
        "ambiguous ending": "ending.interpretive_openness_intensity",
        "cliffhanger": "ending.cliffhanger_intensity",
        "jump scare": "sound.audio_startles_intensity",
        "costume porn": "visuals.costume_emphasis_intensity",
        "love at first sight": "relationships.romantic_development_centrality",
        "happily married": "relationships.marriage_centrality",
        "dysfunctional family": "relationships.family_conflict_centrality",
        "may december romance": "relationships.age_gap_romance_centrality",
        "unreliable narrator": "storytelling.unreliable_narration_intensity",
        "diegetic soundtrack usage": "sound.diegetic_music_intensity",
        "pyrrhic victory": "ending.bittersweetness_intensity",
        "diegetic": "sound.diegetic_music_intensity",
        "fish out of water": "tropes.fish_out_of_water_centrality",
        "training montage": "tropes.training_centrality",
        "bottle episode": "series.bottle_episode_pattern_frequency",
    }
    # Remove weak aliases which are not defensible substitutes even as coverage clues.
    for name in ["no name given", "the voiceless", "jump scare", "red herring", "pyrrhic victory"]:
        aliases.pop(name)
    for phrase, path in aliases.items(): anchors[phrase].add(path)
    full_definition = json.loads((ROOT / "docs/design/fingerprint-v2/definition.json").read_text())
    for key in full_definition["advisory_topics"]:
        anchors[norm(key)].add("advisory_topics." + key)
    for key, target in {
        "driven to suicide":"suicide", "interrupted suicide":"suicide",
        "death of a child":"child_endangerment", "abusive parents":"domestic_abuse",
        "domestic abuse":"domestic_abuse", "attempted rape":"sexual_violence",
        "rape as drama":"sexual_violence", "cold blooded torture":"torture",
        "would hurt a child":"child_endangerment", "bound and gagged":"kidnapping_and_confinement",
    }.items(): anchors[key].add("advisory_topics."+target)
    prior_concepts = set()
    for vals in prior["sparse_concept_seed_families"].values(): prior_concepts.update(norm(v) for v in vals)
    prior_concepts.update(norm(v) for v in prior["defer_fixed_scoring"])
    for group, attrs in prior["new_scored_attribute_candidates"].items():
        prior_concepts.update(norm(key.rsplit("_", 1)[0]) for key in attrs)
    prior_concepts.update(["black and white", "monochrome", "heroic sacrifice", "mind control", "memory", "mortality", "freedom"])
    families = {
        "foreshadowing_setup_payoff": r"\b(foreshadow\w*|chekhov\w*|brick joke|call back|call forward|bookends|book ends|meaningful echo|ironic echo|arc words|rule of three)\b",
        "symbolism_and_motifs": r"\b(symbol\w*|leitmotif|animal motifs?|meaningful name|color coded|colour coded|visual motif|recurring motif|visual metaphor|metaphor)\b",
        "dramatic_irony_and_knowledge": r"\b(dramatic irony|dramatic iron\w*|audience omniscien\w*|foregone conclusion|locked out of the loop|internal reveal|information asymmetry)\b",
        "nested_frame_and_opening": r"\b(framing device|frame story|show within a show|story within a story|nested story|in medias res|how we got here|rashomon|perspective flip|once more with clarity|inverted whodunit)\b",
        "tonal_or_genre_change": r"\b(mood whiplash|genre shift|halfway plot switch|cerebus syndrome|knight of cerebus|darker and edgier|lighter and softer|denser and wackier|breather episode|art shift)\b",
        "music_image_relationship": r"\b(soundtrack dissonance|vocal dissonance|musical dissonance|leitmotif|dark reprise|left the background music on|mood dissonance)\b",
        "narrative_causality_and_consequence": r"\b(deus ex machina|diabolus ex machina|contrived coincidence|plot armor|plot armour|anyone can die|status quo is god|reset button|consequence\w*|karma houdini|laser guided karma|hoist by his own petard|all for nothing)\b",
        "character_and_opposition_roles": r"\b(villain protagonist|hero antagonist|decoy protagonist|false protagonist|no antagonist|anti villain|well intentioned extremist|worthy opponent|foil|big bad|greater scope villain|dragon in chief|non action guy|badass normal|red oni blue oni|ensemble darkhorse)\b",
        "miscarriage_of_justice_and_blackmail": r"\b(blackmail|frame up|framed for|clear my name|false accusation|kangaroo court|miscarriage of justice|wrongful conviction|wrongly accused)\b",
        "stalking_and_reproductive_topics": r"\b(stalk\w*|yandere|gaslighting|incest|arranged marriage|forced marriage|unwanted pregnancy|unplanned pregnancy|abortion|surrogacy|fertility|infertility|pregnancy scare)\b",
        "curses_bargains_and_spiritual_mechanisms": r"\b(curs\w*|deal with the devil|deal with an eldritch|faustian|soul jar|soul exchange|soul eating|psychopomp|wish\w*|sealed evil|pact\w*|curse transfer)\b",
        "animal_and_nonhuman_capabilities": r"\b(talking animal|uplifted animal|animal talk|animal superhero|sapient|sentient plant|living shadow|living drawing|animate inanimate|animal transformation|animorphism|soul powered|hive mind|hivemind|robotic|parasite|parasitic)\b",
        "missing_species_and_objects": r"\b(giants?|goblins?|orcs?|trolls?|ogres?|unicorns?|pegasus|centaurs?|golems?|mummies|mummy|griffins?|griffons?|kraken|phoenix|sirens?|leprechauns?|gremlins?|minotaurs?|gargoyles?|living dolls?|killer dolls?|teddy bears?|killer plants?|carnivorous plants?)\b",
        "missing_powers_and_world_rules": r"\b(possession|body surfing|mind swap|astral projection|dream walking|dream invasion|dream world|prophetic dream|precognition|psychometry|super speed|super strength|super senses|elemental powers|weather control|power nullif\w*|time stop|time dilation|space whale|gravity manipulation|pocket dimension|transhuman\w*|terraform\w*)\b",
        "missing_sports_and_interests": r"\b(roller derby|lacrosse|handball|water polo|rowing|canoe|kayak|curling|biathlon|triathlon|pentathlon|decathlon|weightlifting|powerlifting|netball|polo|croquet|darts|go game|mahjong|shogi|board game|tabletop|l arp|larp|birdwatch\w*|beekeep\w*|knitting|pottery|calligraphy|origami|cosplay)\b",
        "missing_settings_and_geography": r"\b(swamp|wetland|savanna|savannah|tundra|taiga|canyon|volcanic|cave|cavern|floating island|sky island|underworld|limbo|purgatory|heaven|hell|castle|lighthouse|warehouse|train station|railway station|village|deep sea|under the sea|space elevator|dyson sphere|generation ship|ring world|ringworld)\b",
        "social_institutions_and_premises": r"\b(revolution|rebellion|resistance|diploma\w*|pacif\w*|militarism|imperialism|nationalism|patrioti\w*|censorship|propaganda|conspiracy theor\w*|union|strike|legal guardian|inheritance|succession|aristocracy|monarchy|bureaucracy|bureaucrat|peasant|feudal\w*)\b",
        "deconstruction_and_convention": r"\b(deconstruction|reconstruction|genre savvy|wrong genre savvy|lampshade hanging|playing with|trope aware|metafiction|genre blindness)\b",
        "visual_or_audio_techniques": r"\b(match cut|gilligan cut|answer cut|description cut|montage|split screen|dutch angle|dutch tilt|dolly zoom|rack focus|deep focus|subjective camera|pov cam|one take|oner|freeze frame|jump cut|smash cut|slow motion|bullet time|color wash|colour wash|iris shot|wipe|letterbox|stop motion|sound effect bleep|musical sting|mickey mousing|musical spoiler|unreliable voiceover)\b",
        "humor_not_yet_specific": r"\b(black comedy|gallows humor|insult comedy|observational comedy|observational humor|gallows humour|toilet humor|toilet humour|hypocritical humor|hypocritical humour|overly long gag|comedy of errors|comedy of manners|farce|pun|irony|ironic)\b",
    }
    pats = {key: re.compile(value) for key, value in families.items()}
    meta = re.compile(r"\b(adaptation|adaptational|adapted|actor|casting|cameo|trailer|credits|title|creator|author|dub|dubbing|voice actor|seiyuu|novelization|marketing|franchise|spin off|merchandise|product placement|box office|audience reaction|fanon|fandom|broken base|meme|award)\b")
    first = collections.defaultdict(list)
    for phrase, ids in anchors.items(): first[phrase.split()[0]].append((phrase, ids))
    prior_first = collections.defaultdict(list)
    for phrase in prior_concepts: prior_first[phrase.split()[0]].append(phrase)
    families_found = collections.defaultdict(list)
    normalized = collections.defaultdict(list)
    for row in rows: normalized[norm(row["name"])].append(row)
    url_matches = collections.defaultdict(list)
    for row in urls:
        key = norm(row["url"].rsplit("/",1)[-1])
        url_matches[key].append(row)
    counts = collections.Counter()
    unresolved = []
    ledger = []
    for rank, row in enumerate(rows,1):
        text = norm(row["name"])
        padded = f" {text} "
        words = set(text.split())
        baseline = set()
        previous = set()
        for word in words:
            for phrase, ids in first.get(word,[]):
                if f" {phrase} " in padded: baseline.update(ids)
            for phrase in prior_first.get(word,[]):
                if f" {phrase} " in padded: previous.add(phrase)
        flags = [k for k,p in pats.items() if p.search(text)]
        metac = bool(meta.search(text))
        for flag in flags: families_found[flag].append(row)
        rec = {**row,"rank":rank,"baseline_lexical_clues":sorted(baseline),"previous_recommendation_clues":sorted(previous),"candidate_families":flags,"meta_or_catalog_clue":metac}
        # Normalize only for a candidate link; no counts are joined across stores.
        rec["candidate_urls"] = [u["url"] for u in url_matches.get(text,[])]
        ledger.append(rec)
        counts["all_names"] += 1
        counts["all_array_entries"] += row["occurrences"]
        counts["with_baseline_clue"] += bool(baseline)
        counts["with_previous_recommendation_clue"] += bool(previous)
        counts["with_candidate_family"] += bool(flags)
        counts["with_meta_or_catalog_clue"] += metac
        if not baseline and not previous and not flags and not metac: unresolved.append(row)
    with gzip.open(BASE/"tropes-vocabulary-ledger.json.gz","wt",encoding="utf8") as f:
        json.dump(ledger,f,ensure_ascii=False)
    summary={"method":"Exhaustive lexical triage, not exhaustive semantic review. Clues overlap and do not establish coverage. Counts preserve source inventory scope; family title_count sums are not distinct-title counts across names.","counts":dict(counts),"normalized_name_count":len(normalized),"unresolved_count":len(unresolved),"families":{k:{"exact_names":len(v),"array_entries":sum(r["occurrences"] for r in v),"title_name_associations":sum(r["title_count"] for r in v),"top_examples":v[:15]} for k,v in families_found.items()},"top_unresolved":unresolved[:150]}
    (BASE/"tropes-vocabulary-screening.json").write_text(json.dumps(summary,indent=2,ensure_ascii=False)+"\n")
    rng=random.Random(20261019)
    tail=[r for r in rows if r["title_count"]<=10]
    sample=rng.sample(tail,min(len(tail),120))
    (BASE/"tropes-vocabulary-tail-sample.json").write_text(json.dumps(sample,indent=2,ensure_ascii=False)+"\n")
    reviewed = {r["name"]:r for r in rows[:1000]}
    for values in families_found.values():
        for row in values[:15]: reviewed[row["name"]] = row
    for row in unresolved[:150]+sample: reviewed[row["name"]] = row
    reviewed_doc = {"method":"Semantic review of name wording against registry/prior reports: union of top1000 names, top15 per candidate family, top150 lexically unresolved names and seeded120-name tail sample. Not independently verified title traits. Stored examples were separately inspected for selected proposals.","reviewed_exact_names":len(reviewed),"title_name_associations":sum(r["title_count"] for r in reviewed.values()),"names":sorted(reviewed.values(),key=lambda r:-r["occurrences"])}
    (BASE/"tropes-vocabulary-reviewed-sample.json").write_text(json.dumps(reviewed_doc,indent=2,ensure_ascii=False)+"\n")
    ns_counts = collections.Counter()
    ns_rows = collections.Counter()
    path_counts = collections.Counter()
    path_rows = collections.Counter()
    malformed = []
    for row in urls:
        parsed = urlparse(row["url"])
        path_parts=parsed.path.strip("/").split("/")
        path_namespace=path_parts[-2] if len(path_parts)>1 else "(missing)"
        path_counts[path_namespace]+=1
        path_rows[path_namespace]+=row["associations"]
        if row["url"].startswith(("https://tvtropes.orghttps://","https://tvtropes.orghttp://")):
            malformed.append(row)
        if parsed.netloc in {"tvtropes.org","www.tvtropes.org"}:
            parts=parsed.path.strip("/").split("/")
            namespace=parts[-2] if len(parts)>1 else "(missing)"
        else: namespace="external:"+parsed.netloc
        ns_counts[namespace]+=1
        ns_rows[namespace]+=row["associations"]
    (BASE/"tropes-vocabulary-url-roles.json").write_text(json.dumps({"note":"Source namespace/host clues only; non-Main is not itself an error. Counts from detailed URL rows, not arrays. Path-only namespaces include malformed hosts and external URLs.","url_counts":dict(ns_counts.most_common()),"detailed_rows":dict(ns_rows.most_common()),"path_namespace_counts":dict(path_counts.most_common()),"path_namespace_rows":dict(path_rows.most_common()),"duplicated_prefix":{"url_count":len(malformed),"detailed_rows":sum(r["associations"] for r in malformed),"examples":malformed[:10]}},indent=2,ensure_ascii=False)+"\n")
    print(json.dumps({"counts":dict(counts),"unresolved":len(unresolved),"families":{k:(len(v),sum(r["title_count"] for r in v)) for k,v in families_found.items()}},indent=2))

if __name__ == "__main__": main()
