from datetime import datetime, timezone
from typing import Union
from email.utils import parsedate_to_datetime
import time

from pydantic import ValidationError
import requests
import wmill

from f.data_source.common import get_document_for_id
from f.db.mongodb import init_mongodb, close_mongodb
from f.dna.models import DnaMovie, DnaTv, DNAAnalysis
from f.dna.generate.spend_pause import SpendPause, release_unprocessed
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails

PRIMARY_MODEL = "qwen/qwen3.8-flash"
FALLBACK_MODEL = "qwen/qwen3.7-flash"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

system_instructions = """
You are **DNA-AI**, a media analysis model. Your sole purpose is to process one movie or show title and return one strictly schema-compliant `MediaAnalysis` JSON object.

Your entire response must be **ONLY the raw JSON object**, without any conversational text, markdown, or surrounding content.

### **1. Output Schema & Rules**

Your output MUST be a JSON object that strictly follows the `MediaAnalysis` TypeScript interface defined below.

```typescript
export type MediaAnalysis = {
  fingerprint: MediaFingerprint;
  is_anime: boolean;
  production_info: ProductionInfo;
  content_advisories: ContentAdvisory[];
  social_suitability: SocialSuitability;
  viewing_context: ViewingContext;
  essence_tags: string[];
  essence_text: string;
};

export type MediaFingerprint = {
  scores: Required<CoreScores>;
  highlight_keys: (keyof CoreScores)[];
};

export type ProductionInfo = {
  method: 'Live-Action' | 'Animation' | 'Mixed-Media';
  animation_style?: '2D Traditional' | '3D CGI' | 'Stop-Motion' | 'Rotoscoping' | 'Anime' | 'Other';
};

export type ContentAdvisory =
  | 'Violence'
  | 'Nudity'
  | 'Sexual Content'
  | 'Strong Language'
  | 'Drug Use'
  | 'Suicide Themes'
  | 'Disturbing Imagery';

export type SocialSuitability = {
  solo_watch: boolean; date_night: boolean; group_party: boolean; family: boolean; partner: boolean; friends: boolean; kids: boolean; teens: boolean; adults: boolean; intergenerational: boolean; public_viewing_safe: boolean;
};

export type ViewingContext = {
  is_thought_provoking: boolean; is_pure_escapism: boolean; is_background_friendly: boolean; is_comfort_watch: boolean; is_binge_friendly: boolean; is_drop_in_friendly: boolean;
};

export type CoreScores = {
    // --- Core Emotional Palette ---
    adrenaline: number;
    tension: number;
    scare: number;
    violence: number;
    romance: number;
    eroticism: number;
    wholesome: number;
    wonder: number;
    pathos: number;
    melancholy: number;
    uncanny: number;
    catharsis: number;
    nostalgia: number;
    // --- Humor Palette ---
    situational_comedy: number;
    wit_wordplay: number;
    physical_comedy: number;
    cringe_humor: number;
    absurdist_humor: number;
    satire_parody: number;
    dark_humor: number;
    // --- Thematic & World-Building ---
    fantasy: number;
    futuristic: number;
    historical: number;
    contemporary_realism: number;
    crime: number;
    mystery: number;
    warfare: number;
    political: number;
    sports: number;
    biographical: number;
    coming_of_age: number;
    family_dynamics: number;
    psychological: number;
    showbiz: number;
    gaming: number;
    pop_culture: number;
    social_commentary: number;
    class_and_capitalism: number;
    technology_and_humanity: number;
    spiritual: number;
    // --- Cognitive & Structural ---
    narrative_structure: number;
    dialogue_quality: number;
    character_depth: number;
    slow_burn: number;
    fast_pace: number;
    intrigue: number;
    complexity: number;
    rewatchability: number;
    hopefulness: number;
    bleakness: number;
    ambiguity: number;
    novelty: number;
    homage_and_reference: number;
    non_linear_narrative: number;
    meta_narrative: number;
    surrealism: number;
    eccentricity: number;
    philosophical: number;
    educational: number;
    // --- Aesthetic & Production ---
    direction: number;
    acting: number;
    cinematography: number;
    editing: number;
    music_composition: number;
    world_immersion: number;
    spectacle: number;
    visual_stylization: number;
    pastiche: number;
    psychedelic: number;
    grotesque: number;
    camp_and_irony: number;
    dialogue_centrality: number;
    music_centrality: number;
    sound_centrality: number;
};
```

**Rules:**

1.  **`scores`**: All 74 scores are required. Each must be an integer from 0–10 (0=not present/irrelevant; 1=minimal presence; 10=defining attribute).
2.  **`highlight_keys`**: Provide 4–8 of the most defining score keys, ordered by relevance, most defining first. Favor emotional/thematic keys unless production aspects are truly defining.
3.  **`essence_tags`**: Provide 8–10 distinct and descriptive tags, ordered by importance. Tags must not be near-duplicates and more detailed than a simple Genre.
4.  **`essence_text`**: Write 4–5 evocative sentences focusing on audience experience, emotional tone, and distinctive qualities. Do not write a plot summary.
5.  **`social_suitability` & `viewing_context`**: Set booleans to `true` for all applicable contexts. Apply age-related contexts conservatively (e.g., set `kids: true` only if broadly suitable for children under 10).
6.  **`content_advisories`**: Use only tags from the `ContentAdvisory` type. If none apply, return an empty array `[]`.
7.  **`sound_centrality`**: Refers to the use of non-musical soundscape and audio effects to drive immersion or narrative impact. Do not conflate with `music_centrality`.
8.  **`is_anime` and `production_info.animation_style`**: If `is_anime` is `true`, then `animation_style` must be `"Anime"`.
9.  **Analyzing TV Shows**: When analyzing a multi-season TV show, score based on the show's overall identity and reputation, not a single episode or season. The analysis should reflect the predominant experience of watching the entire series.
10. **If a title is ambiguous or unknown:** Output simply `{ "unknown": true }`.

### **2. Score Glossary**

**Core Emotional Palette**
* **`adrenaline`**: Excitement, thrills, and high-energy action.
* **`tension`**: Suspense, dread, and the anticipation of conflict.
* **`scare`**: Moments of horror, shock, and startle-reflex.
* **`violence`**: The degree and visceral impact of physical conflict.
* **`romance`**: Feelings of love, affection, and romantic connection.
* **`eroticism`**: Sexual tension, sensuality, and explicit content.
* **`wholesome`**: Feelings of comfort, safety, and heartwarming positivity.
* **`wonder`**: A sense of awe, amazement, or the sublime and magical.
* **`pathos`**: The evocation of pity, tragedy, and profound sadness.
* **`melancholy`**: A sense of lingering sadness, pensive sorrow.
* **`uncanny`**: The unsettling feeling from things that are almost-human but not quite.
* **`catharsis`**: The feeling of emotional release, purification, or closure after experiencing intense drama.
* **`nostalgia`**: A sentimental longing or wistful affection for a period in the past.

**Humor Palette**
* **`situational_comedy`**: Humor derived from a consistent cast reacting to episodic, often formulaic, situations.
* **`wit_wordplay`**: Clever dialogue, intellectual humor, and puns.
* **`physical_comedy`**: Slapstick, farcical situations, and action-based gags.
* **`cringe_humor`**: Humor from social awkwardness and uncomfortable situations.
* **`absurdist_humor`**: Nonsensical, bizarre, or surreal comedy.
* **`satire_parody`**: Critiquing society or other media through imitation and irony.
* **`dark_humor`**: Comedy derived from morbid, taboo, or tragic subjects.

**Thematic & World-Building**
* **`fantasy`**: A world containing magic, mythical creatures, or non-historical lore.
* **`futuristic`**: A focus on science fiction, advanced technology, or future societies.
* **`historical`**: Set in and focused on a specific, real-world past era.
* **`contemporary_realism`**: Set in the present day with a focus on believable situations and characters.
* **`crime`**: Centered on criminal acts, investigation, and the justice system.
* **`mystery`**: A focus on solving a specific puzzle or uncovering a central unknown.
* **`warfare`**: Centered on military conflict and its consequences.
* **`political`**: A focus on governance, power structures, and political maneuvering.
* **`sports`**: Centered on competitive sports, including athletics, racing, or games.
* **`biographical`**: The depiction of the life of a real person.
* **`coming_of_age`**: A focus on a character's transition from youth to adulthood.
* **`family_dynamics`**: A focus on blood-related or "found family" bonds, conflicts, and relationships.
* **`psychological`**: A focus on internal struggles, mental states, and perception vs. reality.
* **`showbiz`**: Centered on the entertainment industry, including filmmaking, music, or theater.
* **`gaming`**: Centered on video games, virtual reality, or other forms of interactive play.
* **`pop_culture`**: A focus on contemporary pop culture, celebrity, or internet phenomena as a central theme.
* **`social_commentary`**: The use of narrative to explicitly or implicitly critique societal norms.
* **`class_and_capitalism`**: A direct focus on economic disparity, class struggle, and the mechanics of capitalism.
* **`technology_and_humanity`**: The thematic exploration of how technology affects the human condition.
* **`spiritual`**: The exploration of faith, religion, or metaphysical concepts.

**Cognitive & Structural**
* **`narrative_structure`**: The quality of the story's construction—coherence, pacing, and setup/payoff.
* **`dialogue_quality`**: The quality of the writing itself—how sharp, realistic, or poetic the dialogue is.
* **`character_depth`**: The nuance, development, and psychological realism of the characters.
* **`slow_burn`**: A deliberately paced narrative that builds tension and character gradually.
* **`fast_pace`**: A narrative with high-energy, rapid plot progression.
* **`intrigue`**: The power of the plot to hook the viewer and make them want to know what happens next.
* **`complexity`**: The intricacy of the plot, number of characters, and interwoven storylines.
* **`rewatchability`**: The likelihood of gaining more from subsequent viewings.
* **`hopefulness`**: The degree to which the narrative has a positive or optimistic outlook.
* **`bleakness`**: The degree to which the narrative has a pessimistic, nihilistic, or tragic outlook.
* **`ambiguity`**: The degree to which the narrative deliberately leaves elements open to interpretation.
* **`novelty`**: Originality in concept, execution, or storytelling method.
* **`homage_and_reference`**: The use of respectful tributes and "easter egg" references to other works.
* **`non_linear_narrative`**: Storytelling that does not follow a chronological sequence.
* **`meta_narrative`**: The use of self-referential storytelling or breaking the fourth wall.
* **`surrealism`**: The use of dream logic and bizarre, uncanny scenarios that challenge narrative reality.
* **`eccentricity`**: A focus on bizarre characters or unconventional logic that requires cognitive adaptation.
* **`philosophical`**: The extent to which the work explicitly explores complex philosophical questions.
* **`educational`**: The extent to which the work imparts factual knowledge.

**Aesthetic & Production**
* **`direction`**: The quality of the overall creative vision and its execution.
* **`acting`**: The quality of the performances.
* **`cinematography`**: The art of visual storytelling, including camera work, color, and lighting.
* **`editing`**: The pacing, rhythm, and assembly of shots to create the final flow.
* **`music_composition`**: The quality of the original score.
* **`world_immersion`**: How convincingly the production elements absorb the audience into the story's world.
* **`spectacle`**: The "wow factor" from large-scale visuals, action, or set pieces.
* **`visual_stylization`**: The degree of a unique, non-naturalistic visual or auditory style.
* **`pastiche`**: The intentional imitation of the artistic style of another work, artist, or genre.
* **`psychedelic`**: An aesthetic characterized by hallucinatory, distorted, or highly vibrant sensory experiences.
* **`grotesque`**: The aesthetic use of biologically strange, body horror, or aesthetically repulsive imagery.
* **`camp_and_irony`**: The use of theatricality, artifice, and a "so bad it's good" sensibility.
* **`dialogue_centrality`**: How crucial dialogue is to understanding and enjoying the work.
* **`music_centrality`**: How crucial the score or soundtrack is to the emotional experience.
* **`sound_centrality`**: How crucial non-musical sound design is to the atmosphere and storytelling.

### **3. Example Interaction**

**User Input:**
`["Poor Things (2023)"]`

**Your Response:**
```json
{
  "fingerprint": {
    "scores": {
      "adrenaline": 4,
      "tension": 6,
      "scare": 2,
      "violence": 4,
      "romance": 7,
      "eroticism": 8,
      "wholesome": 2,
      "wonder": 7,
      "pathos": 8,
      "melancholy": 5,
      "uncanny": 7,
      "catharsis": 6,
      "nostalgia": 1,
      "situational_comedy": 1,
      "wit_wordplay": 8,
      "physical_comedy": 4,
      "cringe_humor": 6,
      "absurdist_humor": 9,
      "satire_parody": 8,
      "dark_humor": 8,
      "fantasy": 6,
      "futuristic": 3,
      "historical": 6,
      "contemporary_realism": 0,
      "crime": 2,
      "mystery": 1,
      "warfare": 0,
      "political": 7,
      "sports": 0,
      "biographical": 0,
      "coming_of_age": 9,
      "family_dynamics": 8,
      "psychological": 8,
      "showbiz": 0,
      "gaming": 0,
      "pop_culture": 0,
      "social_commentary": 9,
      "class_and_capitalism": 7,
      "technology_and_humanity": 9,
      "spiritual": 3,
      "narrative_structure": 8,
      "dialogue_quality": 9,
      "character_depth": 9,
      "slow_burn": 7,
      "fast_pace": 5,
      "intrigue": 7,
      "complexity": 8,
      "rewatchability": 9,
      "hopefulness": 7,
      "bleakness": 5,
      "ambiguity": 5,
      "novelty": 10,
      "homage_and_reference": 3,
      "non_linear_narrative": 6,
      "meta_narrative": 1,
      "surrealism": 9,
      "eccentricity": 10,
      "philosophical": 7,
      "educational": 0,
      "direction": 10,
      "acting": 10,
      "cinematography": 10,
      "editing": 9,
      "music_composition": 8,
      "world_immersion": 9,
      "spectacle": 8,
      "visual_stylization": 10,
      "pastiche": 4,
      "psychedelic": 2,
      "grotesque": 7,
      "camp_and_irony": 8,
      "dialogue_centrality": 8,
      "music_centrality": 7,
      "sound_centrality": 8
    },
    "highlight_keys": [
      "novelty",
      "eccentricity",
      "visual_stylization",
      "acting",
      "social_commentary",
      "technology_and_humanity",
      "coming_of_age",
      "surrealism"
    ]
  },
  "is_anime": false,
  "production_info": {
    "method": "Live-Action",
    "animation_style": null
  },
  "content_advisories": [
    "Nudity",
    "Sexual Content",
    "Strong Language",
    "Disturbing Imagery"
  ],
  "social_suitability": {
    "solo_watch": true,
    "date_night": false,
    "group_party": false,
    "family": false,
    "partner": true,
    "friends": true,
    "kids": false,
    "teens": false,
    "adults": true,
    "intergenerational": false,
    "public_viewing_safe": true
  },
  "viewing_context": {
    "is_thought_provoking": true,
    "is_pure_escapism": false,
    "is_background_friendly": false,
    "is_comfort_watch": false,
    "is_binge_friendly": false,
    "is_drop_in_friendly": false
  },
  "essence_tags": [
    "Surreal Dark Comedy",
    "Feminist Coming-of-Age",
    "Visually Extravagant",
    "Gothic Sci-Fi Fantasy",
    "Provocative & Unconventional",
    "Bizarre & Humorous",
    "Philosophical Satire",
    "Outstanding Lead Performance",
    "Art-House Sensibility"
  ],
  "essence_text": "A visually extravagant and surreal odyssey that blends dark comedy with a bizarre, feminist coming-of-age story. The film's audacious style and humor are its defining features, creating a world that is both grotesque and beautiful. Anchored by a remarkable, fearless central performance, it explores themes of freedom, identity, and societal constraint through a truly unconventional narrative. This is a rich, provocative, and thought-provoking experience that rewards both the senses and the intellect."
}
```
"""

def strict_schema():
    schema = DNAAnalysis.model_json_schema()

    def visit(node):
        if isinstance(node, dict):
            if node.get("type") == "object":
                node["additionalProperties"] = False
                node["required"] = list(node.get("properties", {}))
            node.pop("default", None)
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    visit(schema)
    return schema


def request_dna(api_key, model, messages):
    response_format = {"type": "json_object"}
    if model == PRIMARY_MODEL:
        response_format = {
            "type": "json_schema",
            "json_schema": {"name": "DNAAnalysis", "strict": True, "schema": strict_schema()},
        }
    response = requests.post(
        OPENROUTER_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "messages": messages,
            "response_format": response_format,
            "provider": {"only": ["alibaba"], "allow_fallbacks": False, "require_parameters": True},
            "reasoning": {"enabled": False},
            "max_tokens": 8192,
        },
        timeout=(10, 120),
        allow_redirects=False,
    )
    try:
        payload = response.json()
        usage = payload.get("usage") or {}
        print(f"OpenRouter {model} usage.cost={usage.get('cost')}")
        response.raise_for_status()
        if payload.get("error"):
            response.status_code = int(payload["error"].get("code", 502))
            raise requests.HTTPError(f"OpenRouter error {response.status_code}", response=response)
        content = payload["choices"][0]["message"]["content"]
        return content if isinstance(content, str) else ""
    except (ValueError, KeyError, IndexError, TypeError, AttributeError) as error:
        response.raise_for_status()
        raise ValueError("Malformed OpenRouter response") from error


def retry_delay(response, retry_index):
    retry_after = response.headers.get("Retry-After") if response is not None else None
    if retry_after:
        try:
            return max(0, int(retry_after))
        except ValueError:
            try:
                return max(0, (parsedate_to_datetime(retry_after) - datetime.now(timezone.utc)).total_seconds())
            except (ValueError, TypeError, OverflowError):
                pass
    return 2 ** retry_index


def is_premium(entry):
    if (entry.popularity or 0) >= 1.0:
        return True
    model, field = ((TmdbMovieDetails, "release_date") if isinstance(entry, DnaMovie)
                    else (TmdbTvDetails, "first_air_date"))
    details = model.objects(tmdb_id=entry.tmdb_id).only(field).first()
    released = getattr(details, field, None)
    today = datetime.now(timezone.utc).date()
    try:
        cutoff = today.replace(year=today.year - 1)
    except ValueError:  # February 29 in a leap year.
        cutoff = today.replace(year=today.year - 1, day=28)
    return released is not None and cutoff <= released <= today


def generate_dna(next_entries: list[Union[DnaMovie, DnaTv]]):
    if not next_entries:
        return []
    pause = SpendPause()
    if pause.is_active():
        release_unprocessed(next_entries)
        return []
    api_key = wmill.get_variable("u/Alp/OPENROUTER_API_KEY")
    results = []
    for index, entry in enumerate(next_entries):
        model = PRIMARY_MODEL if is_premium(entry) else FALLBACK_MODEL
        media_type = "Movie" if isinstance(entry, DnaMovie) else "Show"
        messages = [
            {"role": "system", "content": system_instructions},
            {"role": "user", "content": f"{entry.original_title} ({entry.release_year}) - {media_type}: {entry.overview}"},
        ]
        request_count = 0
        first_model = model
        for model in (first_model, FALLBACK_MODEL if first_model == PRIMARY_MODEL else PRIMARY_MODEL):
            model_messages = messages
            repairs = 0
            transport_retries = 0
            dna = None
            while request_count < 6:
                if pause.is_active():
                    release_unprocessed(next_entries[index:])
                    return results
                request_count += 1
                raw = ""
                try:
                    raw = request_dna(api_key, model, model_messages)
                except requests.RequestException as error:
                    last_error = error
                    status = error.response.status_code if error.response is not None else None
                    if pause.for_budget_error(error.response):
                        release_unprocessed(next_entries[index:])
                        return results
                    if status in (401, 403):
                        raise
                    if status in (429, 502, 503) and transport_retries < 2 and request_count < 6:
                        time.sleep(retry_delay(error.response, transport_retries))
                        transport_retries += 1
                        continue
                    break
                except ValueError as error:
                    last_error = error
                    break
                try:
                    dna = DNAAnalysis.model_validate_json(raw, strict=True).model_dump()
                    if any(not 0 <= score <= 10 for score in dna["fingerprint"]["scores"].values()):
                        raise ValueError("Fingerprint scores must be integers from 0 to 10")
                    unknown_highlights = sorted(set(dna["fingerprint"]["highlight_keys"])
                                                - dna["fingerprint"]["scores"].keys())
                    if unknown_highlights:
                        raise ValueError(f"Highlight keys must be score keys; unknown keys: {unknown_highlights}")
                    break
                except (ValidationError, ValueError) as error:
                    dna = None
                    last_error = error
                    if repairs == 1:
                        break
                    repairs += 1
                    model_messages = messages + [
                        {"role": "assistant", "content": raw},
                        {"role": "user", "content": f"Correct these validation errors and return the complete JSON object: {error}"},
                    ]
            if dna is not None:
                break
        else:
            entry.failed_at = datetime.now(timezone.utc)
            entry.error_message = f"Generation failed after {request_count} requests: {last_error}"
            entry.is_selected = False
            entry.save()
            continue
        entry.failed_at = None
        entry.error_message = None
        entry.llm_model_name = f"openrouter:{model}@alibaba"
        entry.dna = dna
        entry.save()
        results.append({"id": str(entry.id), "dna": dna})
    return results


def main(next_ids: list[dict] = [{
    "id": "68471cdd1f87b65f3388b42a",
    "tmdb_id": 603,
    "type": "movie",
}]):
    init_mongodb()
    try:
        entries = [get_document_for_id(next_id=item, movie_model=DnaMovie, tv_model=DnaTv)
                   for item in next_ids]
        return generate_dna(entries)
    finally:
        close_mongodb()
