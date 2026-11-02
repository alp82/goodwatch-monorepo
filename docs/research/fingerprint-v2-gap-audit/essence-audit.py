"""Reproducible lexical triage, not a semantic completeness classifier.

Run after essence-tags-all.json.gz extraction. Does not call remote services.
"""
import collections
import csv
import gzip
import json
import pathlib
import re

BASE = pathlib.Path(__file__).parent
ROOT = BASE.parents[2]

def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

def main():
    with gzip.open(BASE / "essence-tags-all.json.gz", "rt", encoding="utf-8") as source:
        rows = json.load(source)
    definition = json.loads((ROOT / "docs/design/fingerprint-v2/llm-definition.json").read_text())
    anchors = collections.defaultdict(list)
    for group, attrs in definition["attribute_groups"].items():
        for key in attrs:
            phrase = norm(key.rsplit("_", 1)[0])
            if phrase not in {"overall", "personal", "relationship", "community", "societal", "planetary", "cosmic", "urgency", "acting", "direction", "writing", "design prominence"}:
                anchors[phrase].append(f"{group}.{key}")
    # Explicit aliases are lexical clues only: e.g., romantic need not imply genre.
    aliases = {
        "nostalgic": "experience.nostalgia_intensity", "melancholic": "experience.melancholy_intensity",
        "lighthearted": "experience.playfulness_intensity", "heartwarming": "experience.warmth_intensity",
        "feel good": "experience.uplift_intensity", "suspenseful": "experience.tension_intensity",
        "thought provoking": "experience.thought_provocation_intensity", "psychological": "themes.psychology_centrality",
        "fast paced": "storytelling.plot_velocity_intensity",
        "slow burn": "storytelling.gradual_development_intensity", "situational humor": "humor.situational_intensity",
        "slapstick": "humor.physical_intensity", "absurdist humor": "humor.absurdist_intensity",
        "social commentary": "themes.social_critique_centrality", "satirical": "humor.satire_intensity",
        "showbiz": "themes.entertainment_industry_centrality", "pop culture": "themes.popular_culture_centrality",
        "moral ambiguity": "characters.morally_ambiguous_cast_centrality", "philosophical": "storytelling.philosophical_inquiry_intensity",
        "ensemble cast": "characters.ensemble_centrality", "dialogue driven": "dialogue.dependence_intensity",
        "witty": "humor.wit_wordplay_intensity", "non linear": "storytelling.nonlinearity_intensity",
        "found family": "relationships.found_family_centrality", "romantic": "experience.romantic_feeling_intensity",
        "friendship": "relationships.friendship_centrality", "whimsical": "experience.playfulness_intensity",
        "wholesome": "experience.wholesomeness_intensity", "bleak": "experience.bleakness_intensity",
        "grotesque": "aesthetics.grotesquerie_intensity", "surreal": "aesthetics.surrealism_intensity",
        "coming of age": "themes.coming_of_age_centrality", "family dynamics": "themes.family_centrality",
    }
    for a, b in aliases.items(): anchors[a].append(b)
    candidates = {
        "character_priority_and_introspection": r"\b(character driven|character focused|character study|introspect\w*|contemplative)\b",
        "moral_dilemmas_and_ethics": r"\b(moral dilemmas?|ethical dilemmas?|moral conflict|good vs evil|good versus evil)\b",
        "eccentric_characters": r"\b(eccentric characters?|quirky characters?|eccentric ensemble)\b",
        "supernatural_mechanism": r"\b(supernatural|paranormal|afterlife|reincarnation|immortality|resurrection)\b",
        "magical_realism": r"\bmagic(?:al)? realism\b",
        "power_corruption_and_abuse": r"\b(corruption|power dynamics|abuse of power|authoritarian\w*|totalitarian\w*)\b",
        "poverty_and_precarity": r"\b(poverty|homeless\w*|unemployment|economic hardship|financial hardship|working class)\b",
        "cults_and_religious_institutions": r"\b(cult dynamics|religious cult|cult leader|religious fanatic\w*|religious extrem\w*|religious oppression)\b",
        "mortality_and_death": r"\b(mortality|death and dying|death and rebirth|fear of death)\b",
        "sacrifice_and_resilience": r"\b(sacrifice|resilien\w*|perseverance|overcoming adversity|human endurance)\b",
        "secrets_and_deception": r"\b(family secrets|dark secrets|deception|manipulation|con artist|con artistry|con game)\b",
        "cultural_clash_and_tradition": r"\b(cultural clash|culture clash|cultural identity|traditional values|tradition vs modernity|tradition versus modernity)\b",
        "obsessive_romance_and_infidelity": r"\b(infidelity|adultery|unrequited love|second chance romance|romantic obsession)\b",
        "bullying_and_social_exclusion": r"\b(bullying|social exclusion|peer pressure|social alienation|alienation)\b",
        "monochrome_and_selective_color": r"\b(black and white|black white|monochrome|selective colou?r)\b",
        "silent_and_archival_form": r"\b(silent film|silent cinema|silent comedy|archival footage|archive footage|archival documentary)\b",
        "performative_and_niche_formats": r"\b(stand up comedy|concert film|concert documentary|concert footage|talk show|game show|variety show|puppetry)\b",
        "exploitation_and_schlock": r"\b(exploitation film|exploitation cinema|b movie|b movies|schlock|grindhouse|blaxploitation)\b",
        "missing_entities": r"\b(dragons?|witches?|wizards?|angels?|mermaids?|fairies|elves|dwarves|cyborgs?|clones?|shapeshift\w*|giant insects?)\b",
        "missing_sports_and_games": r"\b(chess|table tennis|badminton|bowling|billiards|snooker|pool hustl\w*|sumo|archery|fencing|equestrian|horse racing|figure skating|roller derby|mountaineering|rock climbing|parkour|sailing|fishing|olympics|olympic games)\b",
        "missing_music_styles": r"\b(blues|reggae|gospel|opera|operatic|punk rock|funk|soul music|r b music|rhythm and blues|disco|salsa music|flamenco)\b",
        "missing_disaster_specifics": r"\b(earthquake|tsunami|volcan\w*|tornado|hurricane|asteroid|shipwreck|avalanche|nuclear apocalypse|nuclear war)\b",
        "missing_settings": r"\b(jungle|rainforest|swamp|wetlands|outer space|deep space|submarine|underwater|cruise ship|summer camp|boarding school|orphanage|retirement home|shopping mall)\b",
        "missing_work_domains": r"\b(farming|agricultur\w*|mining|firefight\w*|emergency responders?|social work|sex work|prostitution|domestic workers?|hairstyl\w*)\b",
        "missing_horror_modes": r"\b(gore horror|splatter|slasher comedy|torture porn|psychosexual|eco horror|ecological horror)\b",
        "serial_killers": r"\bserial killers?\b",
        "isolation_and_claustrophobia": r"\b(isolation|claustrophob\w*)\b",
        "teamwork_and_heroism": r"\b(teamwork|heroism)\b",
        "poetic_form": r"\b(poetic|visual poetry)\b",
    }
    envelope = re.compile(r"\b(historical|contemporary|period piece|cinema|documentary|animation|animated|reality tv|christmas|halloween|holiday|world war|adaptation|based on|family friendly|comfort watch|comfort viewing|cult classic|low budget|independent film|indie film|classic film|short film|early cinema)\b")
    patterns = {k: re.compile(v) for k, v in candidates.items()}
    # Phrase lookup by first word avoids O(tags * registry) scans.
    first = collections.defaultdict(list)
    for phrase, ids in anchors.items(): first[phrase.split()[0]].append((phrase, ids))
    family_rows = collections.defaultdict(list)
    counts = collections.Counter()
    unresolved = []
    normalized = collections.Counter()
    with gzip.open(BASE / "essence-tag-triage.csv.gz", "wt", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["tag", "occurrences", "title_count", "lexical_attribute_clues", "full_design_annotation_clue", "candidate_gap_families"])
        for row in rows:
            text = norm(row["tag"])
            normalized[text] += row["occurrences"]
            padded = f" {text} "
            clues = set()
            for word in set(text.split()):
                for phrase, ids in first.get(word, []):
                    if f" {phrase} " in padded: clues.update(ids)
            flags = [name for name, pattern in patterns.items() if pattern.search(text)]
            # Reviewed ambiguity guards. Other contextual false positives remain.
            if "missing_music_styles" in flags and re.search(r"\b(space opera|soap opera)\b", text) and not re.search(r"\b(blues|reggae|gospel|punk rock|funk|soul music|disco|flamenco)\b", text):
                flags.remove("missing_music_styles")
            if "missing_sports_and_games" in flags and "chess" in text and re.search(r"\b(psychological|intellectual|political|emotional) chess", text):
                flags.remove("missing_sports_and_games")
            annotation = bool(envelope.search(text))
            for name in flags: family_rows[name].append(row)
            counts["all_tags"] += 1
            counts["all_occurrences"] += row["occurrences"]
            counts["tags_with_attribute_lexical_clue"] += bool(clues)
            counts["tags_with_annotation_lexical_clue"] += annotation
            counts["tags_with_gap_candidate_clue"] += bool(flags)
            if not clues and not annotation and not flags: unresolved.append(row)
            writer.writerow([row["tag"], row["occurrences"], row["title_count"], "|".join(sorted(clues)), int(annotation), "|".join(flags)])
    summary = {"method": "Lexical triage over every exact tag. Categories overlap. Clues do not prove semantic coverage. Family and normalized-label counts are tag-assignment sums, not distinct-title counts.", "counts": dict(counts), "normalized_unique_labels": len(normalized), "top_normalized_labels": normalized.most_common(100), "unresolved_tags": len(unresolved), "candidate_families": {name: {"unique_tags": len(items), "tag_assignments": sum(r["occurrences"] for r in items), "top_examples": items[:15]} for name, items in family_rows.items()}, "top_unresolved": unresolved[:150]}
    (BASE / "essence-triage-summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"counts": dict(counts), "unresolved_tags": len(unresolved), "families": {k: (len(v),sum(r["occurrences"] for r in v)) for k,v in family_rows.items()}}, indent=2))

if __name__ == "__main__":
    main()
