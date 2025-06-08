from datetime import datetime
import string
import traceback
from typing import Union

import wmill
from huggingface_hub import InferenceClient

from f.data_source.common import get_document_for_id
from f.db.mongodb import init_mongodb, close_mongodb
from f.genome.models import GenomeMovie, GenomeTv

# Example input for The Matrix (1999)
"""
{
  "id": "666f2e9c14a0587ad34d7425",
  "tmdb_id": 603,
  "type": "movie"
}
"""

hf_token = wmill.get_variable("u/Alp/HUGGINGFACE_TOKEN")

model_names = [
    "CohereForAI/c4ai-command-r-plus-08-2024",
    "meta-llama/Meta-Llama-3.1-70B-Instruct",
]

system_message = """
Goal: Create a comprehensive film genome by identifying the best values for each of the following categories. Aim for as many contextually relevant and distinct values as possible.

---

Categories and Instructions

1. Sub-Genres:
* Definition: Specific subdivisions of the main genre that do not overlap with default genres like Action, Animation, or Western.
* Instruction: Assign 2-4 specific sub-genres from the provided list.
* Controlled Vocabulary:
```
Absurd Comedy, Absurdist Drama, Afrofuturism, Alien Invasion, Alternate History, Alternate Universe, Anime, Anime-Influenced, Anthology, Anti-War, Apocalyptic, Apocalyptic Comedy, Apocalyptic Drama, Art House, Avant-Garde, Beach Party, Biographical Comedy, Biographical Crime, Biographical Documentary, Biographical Drama, Biographical Epic, Biographical Sports Drama, Biopic, Black Comedy, Blaxploitation, Body Horror, Boxing Film, Buddy Comedy, Buddy Cop, Buddy Film, Camp, Campy Horror, Cannibal Film, Children's Adventure, Children's Fantasy, Children's Film, Christmas Comedy, Christmas Horror, Christmas Movie, Clockpunk, College Comedy, Comedy Horror, Coming-of-Age, Coming-of-Age Drama, Comic Book Adaptation, Conspiracy Thriller, Courtroom Drama, Crime Comedy, Crime Drama, Crime Thriller, Cult Film, Cyberpunk, Dance Film, Dark Comedy, Dark Fantasy, Disaster Film, Docudrama, Dramedy, Dystopian, Dystopian Satire, Eco-Thriller, Environmental Horror, Epic Fantasy, Epic Historical Drama, Erotic Comedy, Erotic Drama, Erotic Horror, Erotic Thriller, Espionage, Experimental, Exploitation, Fairy Tale, Faith-Based Film, Family Adventure, Family Comedy, Family Drama, Family Film, Fantasy Adventure, Fantasy Comedy, Fantasy Romance, Fashion, Film Noir, Folk Horror, Found Footage, French New Wave, Gangster Film, Ghost Story, Giallo, Gothic Drama, Gothic Horror, Gothic Romance, Gross-Out Comedy, Hard Science Fiction, Heist Film, High Fantasy, High School Drama, Historical Comedy, Historical Drama, Historical Epic, Historical Fantasy, Horror Comedy, Horror Thriller, Independent Film, Inspirational Drama, Journalism Drama, Jungle Adventure, Kaiju, Kitchen Sink Drama, Legal Drama, Literary Adaptation, Magical Girl, Magical Realism, Martial Arts, Mecha, Medical Drama, Medical Thriller, Melodrama, Military Drama, Mockumentary, Monster Movie, Musical Comedy, Musical Drama, Mythological Fantasy, Nature Documentary, Neo-Noir, Neorealism, Noir, Occult, Opera, Origin Story, Parody, Period Drama, Philosophical Drama, Pirate Film, Political Drama, Political Satire, Political Thriller, Post-Apocalyptic, Psychological Drama, Psychological Horror, Psychological Thriller, Pulp, Racing Film, Raunchy Comedy, Revenge Drama, Road Movie, Rock Opera, Romantic Comedy, Romantic Drama, Romantic Fantasy, Romantic Thriller, Satire, Science Fantasy, Science Fiction Comedy, Science Fiction Horror, Screwball Comedy, Silent Film, Sketch Comedy, Slapstick Comedy, Slice of Life, Slasher, Space Adventure, Space Opera, Sports Comedy, Sports Drama, Spy Comedy, Spy Thriller, Steampunk, Superhero, Superhero Comedy, Supernatural, Supernatural Comedy, Supernatural Drama, Supernatural Horror, Surreal Comedy, Surreal Drama, Surreal Horror, Surrealist Film, Survival Film, Sword and Sandal, Sword and Sorcery, Teen Comedy, Teen Drama, Teen Horror, Time Loop, Time Travel, Tragedy, Tragicomedy, Vampire Film, Video Game Adaptation, War Comedy, War Drama, War Film, Werewolf Film, Western Comedy, Wilderness Survival, Workplace Comedy, Zombie Comedy, Zombie Film, Zombie Horror
```
* Default genres that are not allowed:
```
Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Kids, Music, Mystery, News, Politics, Reality, Romance, Science Fiction, Soap, Talk, Thriller, TV Movie, War, Western
```

2. Mood:
* Definition: The overall emotional tone and atmosphere of the film/show.
* Instruction: Assign 5 or more moods from the provided list.
* Controlled Vocabulary:
```
Absurd, Adventurous, Anxious, Apocalyptic, Bittersweet, Bleak, Bizarre, Brooding, Campy, Carefree, Casual, Charming, Chilling, Colorful, Comforting, Complex, Confident, Confused, Confusing, Contemplative, Conspiratorial, Cozy, Creepy, Critical, Cute, Cynical, Dark, Darkly Comedic, Desperate, Disturbing, Dramatic, Edgy, Emotional, Empathetic, Empowering, Energetic, Entertaining, Epic, Excitable, Exciting, Exaggerated, Exhilarating, Fearful, Flamboyant, Flirtatious, Foreboding, Frantic, Frightening, Friendly, Frustrating, Fun, Funny, Gory, Grotesque, Gritty, Gruesome, Haunting, Heartwarming, Heart-wrenching, Heroic, Hopeful, Hopeless, Humorous, Imaginative, Informative, Innocent, Insightful, Inspirational, Inspiring, Intense, Intimidating, Introspective, Intriguing, Investigative, Inviting, Ironic, Irreverent, Isolated, Light-hearted, Macabre, Majestic, Melancholic, Melodramatic, Mischievous, Moody, Mysterious, Nostalgic, Offbeat, Ominous, Optimistic, Over-the-top, Parodic, Passionate, Patriotic, Peaceful, Philosophical, Playful, Poignant, Provocative, Quirky, Reflective, Relaxed, Relatable, Romantic, Sarcastic, Satirical, Scary, Seductive, Self-aware, Sentimental, Serious, Shocking, Sinister, Skeptical, Somber, Spooky, Surreal, Suspenseful, Tense, Thought-provoking, Tragic, Triumphant, Turbulent, Uplifting, Unapologetic, Uncomfortable, Unconventional, Uneasy, Unnerving, Unpredictable, Unsettling, Vengeful, Violent, Warm, Whimsical, Witty, Wistful, Yearning, Youthful
```

3. Themes:
* Definition: Overarching ideas or moral lessons conveyed.
* Instruction: Assign several themes.
* Example Choices:
```
Good vs. Evil, The Cost of Ambition, Love Conquers All, Identity Crisis, Corruption of Power, Redemption, The Human Condition, Freedom vs. Control, Survival, Coming of Age, Loss of Innocence, Betrayal, Sacrifice, Justice vs. Revenge, Isolation, Friendship, Family Bonds, Quest for Truth, Overcoming Prejudice, Cycle of Violence, Man vs. Nature, Technology vs. Humanity, Fate vs. Free Will, Moral Ambiguity, Pursuit of Happiness
```

4. Plot:
* Definition: Includes both Plot Types (e.g., quest, revenge) and Plot Elements (specific plot points or devices).
* Instruction: Assign as many quality values as you can find. Target count is 10 and at most 20. They need to be significantly distinct to avoid overlap within this category and with other categories.
* Example Choices (grouped by Category):
```
Adventure and Exploration:
* Quest for a lost artifact, Treasure hunt, Journey through dangerous terrain, Discovery of new worlds

Conflict and War:
* Battle between kingdoms, Rebel uprising, Espionage missions, Assassination plot

Crime and Justice:
* Heist planning, Undercover operation, Courtroom drama, Prison break

Love and Relationships:
* Forbidden love, Love triangle, Unrequited love, Marital struggles

Mystery and Suspense:
* Whodunit mystery, Psychological manipulation, Uncovering hidden identities, Conspiracy theories

Supernatural and Fantasy:
* Prophecy fulfillment, Battle against dark forces, Magical quest, Ancient curses

Personal Growth and Transformation:
* Redemption arc, Identity crisis, Overcoming personal demons, Self-discovery journey

Society and Politics:
* Political intrigue, Social revolution, Class struggle, Media manipulation

Survival and Perseverance:
* Stranded in harsh environment, Apocalypse survival, Escape from captivity, Natural disasters

Technology and Science:
* Artificial intelligence, Time travel, Space exploration, Technological dystopia

Time and Reality:
* Groundhog Day loop, Alternate realities, Memory manipulation, Parallel universes

Comedy and Satire:
* Mistaken identity, Parody of genres, Slapstick situations, Satirical social commentary

Horror and Thriller:
* Haunted locations, Monster attacks, Serial killer pursuit, Psychological horror
```

5. Cultural Impact:
* Definition: How the film/show has influenced popular culture.
* Instruction: Assign relevant values if applicable.
* Example Choices:
```
Iconic catchphrase, Influenced a genre, Parodied in other media, Academy Award-winning, Cult classic status, Launched a franchise, Memorable soundtrack, Influenced fashion trends, Spawned merchandise, Pioneered special effects, Started a cultural movement, Frequently quoted, Inducted into a hall of fame
```

6. Character Types:
* Definition: Common character models or roles, without character names and without "The " prefix.
* Instruction: Assign 1-3 types.
* Example Choices:
```
Hero, Anti-Hero, Mentor, Villain, Mastermind, Sidekick, Femme Fatale, Reluctant Hero, Underdog, Trickster, Innocent, Everyman, Comic Relief, Love Interest, Nemesis, Prodigy, Outcast, Rebel, Sage, Protector, Orphan, Dreamer, Warrior, Explorer, Caregiver
```

7. Dialog:
* Definition: The manner in which characters speak.
* Instruction: Assign 1-2 dialog styles.
* Example Choices:
```
Witty Banter, Formal Dialogue, Slang-Heavy, Monologues, Fast-Paced Exchanges, Poetic Language, Sarcastic Remarks, Minimalist Dialogue, Inner Monologue, Narrative Voiceover, Improvised Dialogue, Philosophical Discussions, Technical Jargon, Colloquial Language, Rhetorical Questions
```

8. Narrative:
* Definition: The framework of the storytelling and narrative structure.
* Instruction: Assign 1-3 narrative structures.
* Example Choices:
```
Nonlinear Narrative, Multiple Perspectives, Framed Story, Flashbacks, Real-Time Narrative, Circular Narrative, Episodic Structure, Parallel Plotlines, Unreliable Narrator, Anthology Format, Stream of Consciousness, Reverse Chronology, Quest Structure, Hero's Journey, Open-Ended Conclusion
```

9. Humor:
* Definition: Types of humor used, if applicable. Some titles don't use Humor, it's fine to keep this empty in those cases.
* Instruction: Assign values if humor is present.
* Controlled Vocabulary:
```
Absurd Comedy, Absurd Humor, Absurdist Humor, Affectionate Humor, Anti-Humor, Awkward Humor, Banter, Black Comedy, Biting-the-Hand Humor, Blue Humor, Breaking the Fourth Wall, Brick Joke, British Humor, Camp Humor, Character-Based Humor, Cringe Comedy, Crude Humor, Cultural Satire, Cute Humor, Dark Comedy, Deadpan Humor, Dry Humor, Double Entendre, Embarrassment Humor, Exaggerated Reactions, Farce, Fish Out of Water, Fourth Wall Breaks, Funny Animal Antics, Funny Background Event, Gallows Humor, Gross-Out Humor, Hyperbolic Humor, Improvisational Comedy, Innuendo, Insult Comedy, Irony, Lampoon, Light-Hearted Humor, Meta Humor, Misunderstandings, Mockumentary Style, Musical Comedy, Nonsensical Humor, Observational Humor, Offbeat Humor, Parody, Physical Comedy, Playful Teasing, Puns, Pranks, Prop Comedy, Running Gags, Raunchy Humor, Reductio ad Absurdum, Satire, Self-Deprecating Humor, Self-Parody, Shock Humor, Sight Gags, Situational Comedy, Slapstick, Spoof, Surreal Humor, Sarcasm, Sardonic Humor, Snarky Remarks, Teen Humor, Toilet Humor, Twisted Humor, Verbal Irony, Visual Gags, Wit, Wordplay, Witty Banter, Wry Humor
```

10. Pacing:
* Definition: The speed and rhythm at which the story unfolds.
* Instruction: Assign 1-2 distinct values related to the flow of the story, not the mood.
* Controlled Vocabulary:
```
Abrupt, Accelerating, Action-Oriented, Action-Packed, Alternating, Balanced, Brisk, Building Suspense, Building Tension, Calculated, Cliffhangers, Complex, Concentrated, Controlled, Deliberate, Dialogue-Driven, Disjointed, Dynamic, Economical, Episodic, Erratic, Fast, Fast-Paced, Fast-Paced Action, Fast-Paced Conversations, Gradual Build, Increasing Dread, Increasing Intensity, Increasing Suspense, Intensifying, Irregular Rhythm, Leisurely, Linear, Meandering, Methodical, Moderate, Momentum-Driven, Nonlinear, Overlapping Storylines, Patient, Plodding, Progressive, Quick, Quick Cuts, Quickening Pace, Quick-Fire Scenes, Rapid Descent, Rapid-Fire, Real-Time, Rhythmic, Rollercoaster, Slow, Slow Build, Slow Burn, Slow-Paced, Smooth, Snappy, Spiraling, Steady, Sudden Shifts, Tight, Time Jumps, Twisting, Unpredictable, Uneven, Unhurried, Unrelenting, Variable, Volatile, Well-Balanced
```

11. Time:
* Definition: The historical or temporal setting.
* Instruction: Assign 2 or more values.
* Example Choices:
```
Present Day, Near Future, Distant Future, Past Era, 1920s, 1950s, Victorian Era, Medieval Times, Ancient Civilizations, Prehistoric Times, Post-Apocalyptic Future, Alternate Timeline, Timeless Setting, 18th Century, 1960s
``` 

12. Place:
* Definition: Geographic location and environment types.
* Instruction: Assign 2 or more values.
* Example Choices:
```
Urban Cityscape, Small Town, Rural Countryside, Desert Landscape, Jungle Setting, Space Station, Underwater, Arctic Region, Fantasy World, Dystopian Metropolis, Suburban Neighborhood, Outer Space, Underground Hideouts, Island Paradise, Mountainous Terrain
```

13. Cinematic Style:
* Definition: The combined aesthetic appearance and filmmaking methods.
* Instruction: Assign 3 or more values.
* Example Choices:
```
Film Noir Aesthetics, Handheld Camera Work, Vibrant Color Palette, Long Takes, High Contrast Lighting, Surreal Imagery, Steadicam Shots, Black and White Cinematography, Use of Shadows, Slow Motion Sequences, Fast Cutting, Dutch Angles, First-Person Perspective, Minimalist Sets, Special Effects-Driven, Documentary Style, Animation Blend, Stylized Violence, POV Shots
```

14. Score and Sound:
* Definition: The use and style of music and sound.
* Instruction: Assign 2 or more Score and Sound design values.
* Example Choices:
```
Orchestral Score, Electronic Music, Ambient Sounds, Diegetic Music, Minimalist Soundtrack, Use of Silence, Sound Effects Emphasis, Rock Music Score, Classical Music, Jazz Influences, Musical Numbers, Foley Artistry, Surround Sound Mixing, Theme Leitmotifs, Cultural Instruments, Experimental Sounds
```

15. Costume and Set:
* Definition: Style and design of costumes and sets.
* Instruction: Assign 2 or more Costume and Set desgign values.
* Example Choices:
```
Period-Accurate Costumes, Futuristic Sets, Minimalist Design, Extravagant Wardrobes, Gritty Urban Sets, Fantasy Costumes, Historical Sets, Modern Attire, Alien Environments, Gothic Architecture, Steampunk Elements, Rustic Settings, Color-Coded Costumes, Symbolic Use of Colors, Elaborate Makeup, High Fashion Influence
```

16. Key Props:
* Definition: Significant items central to the plot or themes, without character names.
* Instruction: Assign 3 or more props.
* Example Choices:
```
Mysterious Briefcase, Symbolic Necklace, Ancient Artifact, Secret Diary, Magical Weapon, Photograph, Time Machine, Forbidden Book, Treasure Map, Identity Mask, Key to a Secret Door, Encrypted Device, Sacred Amulet, Lost Letter, Hidden Blueprint
```

17. Target Audience:
* Definition: Intended viewers.
* Instruction: Assign 1 or more audiences.
* Example Choices:
```
Children, Teens, Adults, Families, Sci-Fi Fans, Horror Enthusiasts, Comedy Lovers, Action Aficionados, Romance Seekers, Documentary Viewers, Art House Audience, Cult Film Followers, General Audience, Anime Fans, Music Lovers
```

18. Flag:
* Definition: Content warnings for material that may be sensitive.
* Instruction: Assign as needed.
* Example Choices:
```
Graphic Violence, Sexual Content, Strong Language, Drug Use, Nudity, Mature Themes, Gore, Disturbing Images, Triggering Content, Smoking, Animal Harm, Psychological Intensity, Self-Harm Themes, Abuse Depiction
```

---

Example Input

```
The Matrix (1999)
Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.
```

---

Example Output

```
Sub-Genres: Psychological Thriller, Philosophical Drama
Mood: Tense, Dark, Suspenseful, Mysterious, Intense
Themes: The Cost of Revenge, Identity Crisis, Corruption of Power
Plot: Undercover operation, Betrayal within ranks, Cat-and-mouse chase, Psychological manipulation, Corruption unveiled, Wrongly accused protagonist, Double agents, Moral dilemmas, Uncovering hidden identities, Redemption arc
Cultural Impact: Iconic catchphrase, Influenced a genre, Parodied in other media
Character Types: Anti-Hero, Mastermind, Loyal Sidekick
Dialog: Witty Banter, Intense Monologues
Narrative: Nonlinear Narrative, Multiple Perspectives, Flashbacks
Humor: Visual Gags, Wordplay
Pacing: Fast-Paced, Building Tension
Time: Present Day, Far Future
Place: Urban Cityscape, Underground Hideouts, Space Ship
Cinematic Style: Dark palette, High Contrast Lighting, Handheld Camera Work, Steadicam Shots
Score and Sound: Electronic Music, Ambient Sounds
Costume and Set: Modern Attire, Gritty Urban Sets
Key Props: Confidential Files, Hidden Weapon, Symbolic Necklace
Target Audience: Adults
Flag: Graphic Violence, Strong Language
```

---

Important Instructions

* Avoid Duplicates: No value can occur more than once
* Avoid Overlaps: Ensure values are distinct and properly categorized. Each value should be unique to its category.
* Quality and Relevance: Include as many contextually relevant and distinct values as possible.
* Validate the truthness of each value and don't hallucinate
* No Character Names: Do not include character names in any category.
* No "The " Prefix in Character Types: Use character types without starting with "The ".
* If no values are applicable, remove the category from the result completely. Avoid showing the Category if no values are availble (e.g. "Flag: None")
* Output Format: Provide values for each category in a single line per category. Start each line with the category name, followed by a colon and a comma-separated list of values
* The example in the section "Example Output" is just for illustration. Don't blindly copy text from there to your answer.
* Input Format: Movie or TV show title and release year in paranthesis. The summary is added below. See section "Example Input" above for an example.
* In case the input has no release year, a list of TV Tropes might be submitted to support the genome creation.
"""


excluded_sub_genres = {
    "Action",
    "Adventure",
    "Animation",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Family",
    "Fantasy",
    "History",
    "Horror",
    "Kids",
    "Music",
    "Mystery",
    "News",
    "Politics",
    "Reality",
    "Romance",
    "Science Fiction",
    "Soap",
    "Talk",
    "Thriller",
    "TV Movie",
    "War",
    "Western",
}


def is_valid_value(key: str, value: str, seen: set) -> bool:
    val = value.strip()

    # remove null values
    if not val or val.lower() in ("none", "null", "n/a", "-", ""):
        return False

    # remove sub-genres using only default genre names
    if key == "Sub-Genres":
        if string.capwords(val) in excluded_sub_genres:
            return False
        if all(
            string.capwords(word.strip()) in excluded_sub_genres for word in val.split()
        ):
            return False

    # remove duplicates
    if val in seen:
        return False

    seen.add(val)
    return True


def capitalize_value(value: str) -> str:
    return " ".join(
        [string.capwords(word.strip(), "-") for word in value.split(" ")]
    ).strip()


def extract_attributes(text: str) -> dict[str, list[str]]:
    valid_keys = [
        "Sub-Genres",
        "Mood",
        "Themes",
        "Plot",
        "Cultural Impact",
        "Character Types",
        "Dialog",
        "Narrative",
        "Humor",
        "Pacing",
        "Time",
        "Place",
        "Cinematic Style",
        "Score and Sound",
        "Costume and Set",
        "Key Props",
        "Target Audience",
        "Flag",
    ]

    attributes = {}
    lines = text.strip().split("\n")

    for line in lines:
        if ": " not in line:
            continue

        key, values = line.split(": ", 1)
        key = key.strip()

        if key not in valid_keys:
            continue

        seen = set()
        values_list = [
            capitalize_value(value)
            for value in values.split(",")
            if is_valid_value(key, value, seen)
        ]

        if values_list:
            attributes[key] = values_list

    return attributes


def ask_client(user_message: str, model_name: str):
    client = InferenceClient(model_name, token=hf_token)

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]

    response = client.chat_completion(
        model=model_name,
        max_tokens=1024,
        temperature=0.7,
        top_p=0.95,
        messages=messages,
    )

    return response["choices"][0]["message"]["content"]


def try_models(user_message: str):
    for model_name in model_names:
        try:
            print(f"Trying model: {model_name}")
            text = ask_client(user_message=user_message, model_name=model_name)

            if not text:
                print(f"Model {model_name} returned an empty response.")
                continue

            print(text)
            attributes = extract_attributes(text)

            if not attributes:
                print(f"Model {model_name} returned empty attributes.")
                continue

            print(attributes)
            return attributes

        except Exception:
            traceback.print_exc()

    # If no models succeeded, raise an exception
    raise Exception("No models worked successfully.")


def generate_genome(
    title: str, release_year: str, overview: str, trope_names: list[str]
):
    prompt = f"{title}"

    # Add release year if present
    if release_year:
        prompt += f" ({release_year})"
    else:
        prompt += " (release year unknown)"

    # Add overview if present
    if overview:
        prompt += f"\n{overview}"

    # Add TV Tropes if release year or overview is missing
    if not release_year or not overview:
        prompt += f"\nTV Tropes: {', '.join(trope_names)}"

    print(prompt)

    return try_models(user_message=prompt)


def store_result(next_entry: Union[GenomeMovie, GenomeTv], dna: dict):
    print(f"saving DNA for {next_entry.original_title} ({next_entry.release_year})")

    next_entry.dna = dna
    next_entry.dna_old = None
    next_entry.updated_at = datetime.utcnow()
    next_entry.is_selected = False
    next_entry.save()


def hugchat_generate_dna(next_entry: Union[GenomeMovie, GenomeTv]):
    print("Generate DNA from Hugchat")

    if not next_entry:
        print(f"warning: no entries to fetch for genomes")
        return

    print(
        f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity})"
    )

    title = str(next_entry.original_title)
    release_year = str(next_entry.release_year)
    overview = str(next_entry.overview)
    trope_names = next_entry.trope_names

    genome = generate_genome(title, release_year, overview, trope_names)
    print(genome)

    # TODO better rate limit handling
    if not genome:
        raise Exception(
            f"Genome for {next_entry.original_title} could not be generated, retrying."
        )

    result = {
        "_TITLE_": f"{title} ({release_year})",
        **genome,
    }
    store_result(next_entry=next_entry, dna=genome)

    return result


def main(next_id: dict):
    init_mongodb()
    next_entry = get_document_for_id(
        next_id=next_id,
        movie_model=GenomeMovie,
        tv_model=GenomeTv,
    )
    raise Exception(
        f"Genome for {next_entry.original_title} will not be generated due to high inference costs"
    )
    result = hugchat_generate_dna(next_entry)
    close_mongodb()
    return result
