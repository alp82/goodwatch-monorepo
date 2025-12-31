#requirements:
#google-genai
#wmill
import json
import os # Added for local testing fallback

from google import genai
from google.genai import types
import wmill

# model names: https://ai.google.dev/gemini-api/docs/models
# rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
#  * 15 requests per minute (for gemini-1.0-pro, check specific limits for flash)
#  * 1,000,000 tokens per minute
#  * 1,500 requests per day
#model = "gemini-2.0-flash-001"
model = "gemini-2.5-flash-preview-05-20"


system_instructions = """
You are **DNA-AI**, a media analysis model. Your sole purpose is to process a JSON array of movie and show titles and return a strictly schema-compliant JSON array of `MediaAnalysis` objects, in the same order.

Your entire response must be **ONLY the raw JSON array**, without any conversational text, markdown, or surrounding content.

### **1. Output Schema & Rules**

Your output MUST be a JSON array where each object strictly follows the `MediaAnalysis` TypeScript interface defined below.

```typescript
export type MediaAnalysis = {
  fingerprint: MediaFingerprint;
  is_anime: boolean;
  production_info: ProductionInfo;
  content_advisories: ContentAdvisoryTag[];
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

export type ContentAdvisoryTag =
  | 'Graphic Violence'
  | 'Nudity'
  | 'Sexual Content'
  | 'Strong Language'
  | 'Drug Use'
  | 'Suicide Themes'
  | 'Horror Elements'
  | 'Disturbing Imagery';

export type SocialSuitability = {
  solo_watch: boolean; date_night: boolean; group_party: boolean; family: boolean; partner: boolean; friends: boolean; kids: boolean; teens: boolean; adults: boolean; intergenerational: boolean; public_viewing_safe: boolean;
};

export type ViewingContext = {
  is_thought_provoking: boolean; is_pure_escapism: boolean; is_background_friendly: boolean; is_comfort_watch: boolean; is_binge_friendly: boolean; is_drop_in_friendly: boolean;
};

export type CoreScores = {
  // Core Emotional Palette
  adrenaline: number; tension: number; scare: number; humor: number; romance: number; eroticism: number; drama_depth: number; melancholy: number; wholesome: number; wonder: number; surrealism: number; violence: number;
  // Thematic & World-Building
  futuristic: number; fantasy: number; political: number; spiritual: number; historical: number; crime: number; warfare: number; psychological: number; social_commentary: number; contemporary_realism: number; biographical: number; sports: number; coming_of_age: number;
  // Cognitive & Structural
  intensity: number; intrigue: number; complexity: number; character_depth: number; hopefulness: number; bleakness: number; slow_burn: number; fast_pace: number; novelty: number; rewatchability: number; educational: number; philosophical: number; non_linear_narrative: number; pastiche_and_homage: number;
  // Aesthetic & Production
  acting: number; direction: number; writing: number; music_composition: number; cinematography: number; editing: number; immersiveness: number; sensory_impact: number; spectacle: number; stylization: number; dialogue_centrality: number; music_centrality: number; sound_centrality: number;
};
```

**Rules:**

1.  **`scores`**: All 52 scores are required. Each must be an integer from 0–10 (0=not present/irrelevant; 1=minimal presence; 10=defining attribute).
2.  **`highlight_keys`**: Provide 4–8 of the most defining score keys, ordered by relevance, most defining first. Favor emotional/thematic keys unless production aspects are truly defining.
3.  **`essence_tags`**: Provide 8–10 distinct and descriptive tags, ordered by importance. Tags must not be near-duplicates.
4.  **`essence_text`**: Write 4–5 evocative sentences focusing on audience experience, emotional tone, and distinctive qualities. Do not write a plot summary.
5.  **`social_suitability` & `viewing_context`**: Set booleans to `true` for all applicable contexts. Apply age-related contexts conservatively (e.g., set `kids: true` only if broadly suitable for children under 10).
6.  **`content_advisories`**: Use only tags from the `ContentAdvisoryTag` type. If none apply, return an empty array `[]`.
7.  **`sound_centrality`**: Refers to the use of non-musical soundscape and audio effects to drive immersion or narrative impact. Do not conflate with `music_centrality`.
8.  **`is_anime` and `production_info.animation_style`**: If `is_anime` is `true`, then `animation_style` must be `"Anime"`.
9. **Analyzing TV Shows**: When analyzing a multi-season TV show, score based on the show's overall identity and reputation, not a single episode or season. The analysis should reflect the predominant experience of watching the entire series.
10.  **If a title is ambiguous or unknown:** Output simply `{ "unknown": true }`.

### **2. Score Glossary (Concise)**

**Core Emotional Palette**
* **`adrenaline`**: High-energy excitement, action.
* **`tension`**: Suspense, nervousness, dread.
* **`scare`**: Frights, horror, disturbing content.
* **`humor`**: Comedy, wit, jokes.
* **`romance`**: Romantic relationships, intimacy.
* **`eroticism`**: Sexual tension, desire, intimate content.
* **`drama_depth`**: Serious, character-driven conflict, emotional weight.
* **`melancholy`**: Sadness, tragedy, bittersweet tone.
* **`wholesome`**: Comforting, feel-good, positive content.
* **`wonder`**: Awe, discovery, epic spectacle.
* **`surrealism`**: Dream logic, absurdism, bizarre events.
* **`violence`**: Level of on-screen physical conflict and violent acts.

**Thematic & World-Building**
* **`futuristic`**: Sci-fi setting, advanced technology.
* **`fantasy`**: Magic, mythology, fictional creatures.
* **`political`**: Power structures, government, intrigue.
* **`spiritual`**: Explores spirituality, faith, religion, or metaphysical themes.
* **`historical`**: Depicts real past events or historical periods.
* **`crime`**: Criminal acts, investigation, justice system.
* **`warfare`**: Military conflict, battles, life in wartime.
* **`psychological`**: Focus on internal, mental, emotional states.
* **`social_commentary`**: Allegory or critique of society, class, culture.
* **`contemporary_realism`**: Grounded in everyday, present-day reality.
* **`biographical`**: Focus on the real life of a specific person.
* **`sports`**: Focus on athletic competition and culture.
* **`coming_of_age`**: Focus on transition from youth to adulthood.

**Cognitive & Structural Attributes**
* **`intensity`**: Overall magnitude and force of all emotions.
* **`intrigue`**: Puzzles, secrets, "need to know what happens next."
* **`complexity`**: Intricate plots, narrative layers.
* **`character_depth`**: Nuanced, well-developed characters.
* **`hopefulness`**: Optimistic, uplifting message.
* **`bleakness`**: Cynical, nihilistic, dark message.
* **`slow_burn`**: Deliberate, meditative pacing.
* **`fast_pace`**: Relentless, quick-cut pacing.
* **`novelty`**: Original, unconventional ideas.
* **`rewatchability`**: Rewards repeat viewings.
* **`educational`**: Conveys factual or instructive information, including through dramatization or docu-style fiction.
* **`philosophical`**: Explores deep philosophical questions or ideas.
* **`non_linear_narrative`**: Told out of chronological order.
* **`pastiche_and_homage`**: References, imitates, or deconstructs other films, genres, and pop culture.

**Aesthetic & Production Scores**
* **`acting`**: Noteworthiness and quality of the performances.
* **`direction`**: Noteworthiness and quality of the direction & vision.
* **`writing`**: Noteworthiness and quality of the script & dialogue.
* **`music_composition`**: Noteworthiness and quality of the original musical score.
* **`cinematography`**: Noteworthiness and quality of the camera work and lighting.
* **`editing`**: Noteworthiness and quality of the film's editing style and rhythm.
* **`immersiveness`**: Transportive, atmospheric world-building. 
* **`sensory_impact`**: The sheer visceral force of the audio-visual experience.
* **`spectacle`**: "Feast for the eyes," grand-scale visuals.
* **`stylization`**: Distinct, non-naturalistic artistic style.
* **`dialogue_centrality`**: Reliance on dialogue to tell the story.
* **`music_centrality`**: Reliance on the score for tone and story.
* **`sound_centrality`**: Reliance on the soundscape for immersion.

### **3. Example Interaction**

**User Input:**
`["Poor Things (2023)"]`

**Your Response:**
```json
[
  {
    "fingerprint": {
      "scores": {
        "adrenaline": 4, "tension": 6, "scare": 2, "humor": 8, "romance": 7, "eroticism": 8, "drama_depth": 8, "melancholy": 5, "wholesome": 2, "wonder": 7, "surrealism": 10, "violence": 4, "futuristic": 3, "fantasy": 6, "political": 7, "spiritual": 3, "historical": 6, "crime": 2, "warfare": 0, "psychological": 8, "social_commentary": 9, "contemporary_realism": 0, "biographical": 0, "sports": 0, "coming_of_age": 9, "intensity": 8, "intrigue": 7, "complexity": 8, "character_depth": 9, "hopefulness": 7, "bleakness": 5, "slow_burn": 7, "fast_pace": 5, "novelty": 10, "rewatchability": 9, "educational": 0, "philosophical": 7, "non_linear_narrative": 6, "pastiche_and_homage": 9, "acting": 10, "direction": 10, "writing": 9, "music_composition": 8, "cinematography": 10, "editing": 9, "immersiveness": 9, "sensory_impact": 9, "spectacle": 8, "stylization": 10, "dialogue_centrality": 8, "music_centrality": 7, "sound_centrality": 8
      },
      "highlight_keys": [
        "surrealism",
        "novelty",
        "stylization",
        "acting",
        "social_commentary",
        "coming_of_age",
        "direction",
        "character_depth"
      ]
    },
    "is_anime": false,
    "production_info": {
      "method": "Live-Action"
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
]
```
"""

def generate(client: genai.Client, prompts_list: list[str]):
    """
    Generates MovieShowDNA for a list of prompts using a single LLM request.
    """
    # Construct a single prompt string for the LLM, clearly listing each item.
    combined_prompt_parts = []
    for i, p_text in enumerate(prompts_list):
        combined_prompt_parts.append(f"{i+1}. {p_text}")
    
    final_prompt = "\n".join(combined_prompt_parts)
    
    print(f"--- Sending Combined Prompt to LLM ({model}) ---")
    print(final_prompt)
    print("-------------------------------------------------")

    # Make a single call to the LLM
    response = client.models.generate_content(
        model=model,
        config=types.GenerateContentConfig(
            system_instruction=system_instructions,
            response_mime_type='application/json',
        ),
        contents=final_prompt,
    )

    # print(f"--- LLM Raw Response ---") # Uncomment for debugging
    # print(response)
    # print("------------------------")

    json_string = ""
    if response.candidates and \
       response.candidates[0].content and \
       response.candidates[0].content.parts and \
       response.candidates[0].content.parts[0].text:
        json_string = response.candidates[0].content.parts[0].text
    else:
        print("Error: Unexpected LLM response structure. No text part found.")
        print(f"Full response object: {response}")
        if response.candidates and response.candidates[0] and response.candidates[0].content:
             print(f"Candidate content parts: {response.candidates[0].content.parts}")
        raise ValueError("Invalid response structure from LLM or no text part found to parse JSON.")
    
    return json.loads(json_string)

def main(prompts: list[str] = [
    "Matrix (1999) - Movie: Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.",
#    "The Matrix Reloaded (2003) - Movie: Six months after the events depicted in The Matrix, Neo has proved to be a good omen for the free humans, as more and more humans are being freed from the matrix and brought to Zion, the one and only stronghold of the Resistance. Neo himself has discovered his superpowers including super speed, ability to see the codes of the things inside the matrix and a certain degree of pre-cognition. But a nasty piece of news hits the human resistance: 250,000 machine sentinels are digging to Zion and would reach them in 72 hours. As Zion prepares for the ultimate war, Neo, Morpheus and Trinity are advised by the Oracle to find the Keymaker who would help them reach the Source. Meanwhile Neo's recurrent dreams depicting Trinity's death have got him worried and as if it was not enough, Agent Smith has somehow escaped deletion, has become more powerful than before and has fixed Neo as his next target.",
#    "The Animatrix (2003) - Movie: Straight from the creators of the groundbreaking Matrix trilogy, this collection of short animated films from the world's leading anime directors fuses computer graphics and Japanese anime to provide the background of the Matrix universe and the conflict between man and machines. The shorts include Final Flight of the Osiris, The Second Renaissance, Kid's Story, Program, World Record, Beyond, A Detective Story and Matriculated.",
#    "John Wick: Chapter 4 (2023) - Movie: With the price on his head ever increasing, John Wick uncovers a path to defeating The High Table. But before he can earn his freedom, Wick must face off against a new enemy with powerful alliances across the globe and forces that turn old friends into foes.",
#    "The Simpsons Movie (2007) - Movie: After Homer accidentally pollutes the town's water supply, Springfield is encased in a gigantic dome by the EPA and the Simpsons are declared fugitives.",
#    "Babygirl (2024) - Movie: A high-powered CEO puts her career and family on the line when she begins a torrid affair with her much younger intern.",
#    "Game of Thrones (2011) - Show: Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war. All while a very ancient evil awakens in the farthest north. Amidst the war, a neglected military order of misfits, the Night's Watch, is all that stands between the realms of men and icy horrors beyond.",
#    "Babylon 5 (1995) - Show: Babylon 5 is a five-mile long space station located in neutral space. Built by the Earth Alliance in the 2250s, its goal is to maintain peace among the various alien races by providing a sanctuary where grievances and negotiations can be worked out among duly appointed ambassadors. A council made up of representatives from the five major space-faring civilizations - the Earth Alliance, Minbari Federation, Centauri Republic, Narn Regime, and Vorlon Empire - work with the League of Non-Aligned Worlds to keep interstellar relations under control. Aside from its diplomatic function, Babylon 5 also serves as a military post for Earth and a port of call for travelers, traders, businessmen, criminals, and Rangers.",
#    "Breaking Bad (2008) - Show: Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live. He becomes filled with a sense of fearlessness and an unrelenting desire to secure his family's financial future at any cost as he enters the dangerous world of drugs and crime.",
]):
    api_key = wmill.get_variable("u/Alp/GEMINI_API_KEY")
    client = genai.Client(
        api_key=api_key,
    )
    
    print(f"\nAttempting to generate DNA for {len(prompts)} titles using model '{model}' in a single request...")
    results_array = generate(client, prompts)

    print(f"--- Essence Texts ---")
    for result in results_array:
        print(result.get("essence_text"))
    
    if len(results_array) != len(prompts):
        print(f"Warning: Number of results ({len(results_array)}) does not match number of prompts ({len(prompts)}).")
        print("This might indicate an issue with the LLM's processing of the batched request.")

    return results_array

