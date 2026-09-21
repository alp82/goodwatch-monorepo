from typing import Optional, Literal

from mongoengine import (
    DateTimeField,
    StringField,
    Document,
    DictField,
    IntField,
    FloatField,
    BooleanField,
    ListField,
)
from pydantic import BaseModel


# Database models


class BaseDNA(Document):
    tmdb_id = IntField()
    original_title = StringField()
    release_year = IntField()
    popularity = FloatField()
    overview = StringField()

    created_at = DateTimeField()
    updated_at = DateTimeField()
    selected_at = DateTimeField()
    failed_at = DateTimeField()
    error_message = StringField()
    is_selected = BooleanField(default=False)

    llm_model_name = StringField()
    dna = DictField()
    vector_essence_text = ListField(FloatField())
    vector_fingerprint = ListField(FloatField())

    meta = {
        "abstract": True,
        "indexes": [
            "tmdb_id",
            "popularity",
            "selected_at",
            "updated_at",
            "is_selected",
        ],
    }


class DnaMovie(BaseDNA):
    pass


class DnaTv(BaseDNA):
    pass


# Generation models


class CoreScores(BaseModel):
    # --- Core Emotional Palette ---
    # The primary feelings and visceral sensations evoked by the work.
    # High-Energy & Tension
    adrenaline: int             # Excitement, thrills, and high-energy action.
    tension: int                # Suspense, dread, and the anticipation of conflict.
    scare: int                  # Moments of horror, shock, and startle-reflex.
    violence: int               # The degree and visceral impact of physical conflict.
    # Social & Positive
    romance: int                # Feelings of love, affection, and romantic connection.
    eroticism: int              # Sexual tension, sensuality, and explicit content.
    wholesome: int              # Feelings of comfort, safety, and heartwarming positivity.
    wonder: int                 # A sense of awe, amazement, or the sublime and magical.
    # Dramatic & Negative
    pathos: int                 # The evocation of pity, tragedy, and profound sadness.
    melancholy: int             # A sense of lingering sadness, pensive sorrow.
    uncanny: int                # The unsettling feeling from things that are almost-human but not quite.
    # Reflective & Outcome-based
    catharsis: int              # The feeling of emotional release, purification, or closure after experiencing intense drama.
    nostalgia: int              # A sentimental longing or wistful affection for a period in the past.

    # --- Humor Palette ---
    # The specific styles of comedy used.
    situational_comedy: int     # Humor derived from a consistent cast reacting to episodic, often formulaic, situations.
    wit_wordplay: int           # Clever dialogue, intellectual humor, and puns.
    physical_comedy: int        # Slapstick, farcical situations, and action-based gags.
    cringe_humor: int           # Humor from social awkwardness and uncomfortable situations.
    absurdist_humor: int        # Nonsensical, bizarre, or surreal comedy.
    satire_parody: int          # Critiquing society or other media through imitation and irony.
    dark_humor: int             # Comedy derived from morbid, taboo, or tragic subjects.

    # --- Thematic & World-Building ---
    # The subject matter, core ideas, and nature of the story's world.
    # Primary Genres
    fantasy: int                # A world containing magic, mythical creatures, or non-historical lore.
    futuristic: int             # A focus on science fiction, advanced technology, or future societies.
    historical: int             # Set in and focused on a specific, real-world past era.
    contemporary_realism: int   # Set in the present day with a focus on believable situations and characters.
    # Sub-Genres & Focus
    crime: int                  # Centered on criminal acts, investigation, and the justice system.
    mystery: int                # A focus on solving a specific puzzle or uncovering a central unknown.
    warfare: int                # Centered on military conflict and its consequences.
    political: int              # A focus on governance, power structures, and political maneuvering.
    sports: int                 # Centered on competitive sports, including athletics, racing, or games.
    # Character & Social Themes
    biographical: int           # The depiction of the life of a real person.
    coming_of_age: int          # A focus on a character's transition from youth to adulthood.
    family_dynamics: int        # A focus on blood-related or "found family" bonds, conflicts, and relationships.
    psychological: int          # A focus on internal struggles, mental states, and perception vs. reality.
    # Meta & Societal Themes
    showbiz: int                # Centered on the entertainment industry, including filmmaking, music, or theater.
    gaming: int                 # Centered on video games, virtual reality, or other forms of interactive play.
    pop_culture: int            # A focus on contemporary pop culture, celebrity, or internet phenomena as a central theme.
    social_commentary: int      # The use of narrative to explicitly or implicitly critique societal norms.
    class_and_capitalism: int   # A direct focus on economic disparity, class struggle, and the mechanics of capitalism.
    technology_and_humanity: int # The thematic exploration of how technology affects the human condition.
    spiritual: int              # The exploration of faith, religion, or metaphysical concepts.

    # --- Cognitive & Structural ---
    # How the story is constructed and the intellectual engagement it demands.
    # Core Writing Quality
    narrative_structure: int    # The quality of the story's construction—coherence, pacing, and setup/payoff.
    dialogue_quality: int       # The quality of the writing itself—how sharp, realistic, or poetic the dialogue is.
    character_depth: int        # The nuance, development, and psychological realism of the characters.
    # Pacing & Engagement
    slow_burn: int              # A deliberately paced narrative that builds tension and character gradually.
    fast_pace: int              # A narrative with high-energy, rapid plot progression.
    intrigue: int               # The power of the plot to hook the viewer and make them want to know what happens next.
    complexity: int             # The intricacy of the plot, number of characters, and interwoven storylines.
    rewatchability: int         # The likelihood of gaining more from subsequent viewings.
    # Narrative Stance & Style
    hopefulness: int            # The degree to which the narrative has a positive or optimistic outlook.
    bleakness: int              # The degree to which the narrative has a pessimistic, nihilistic, or tragic outlook.
    ambiguity: int              # The degree to which the narrative deliberately leaves elements open to interpretation.
    novelty: int                # Originality in concept, execution, or storytelling method.
    homage_and_reference: int   # The use of respectful tributes and "easter egg" references to other works.
    # Unconventional Structures
    non_linear_narrative: int   # Storytelling that does not follow a chronological sequence.
    meta_narrative: int         # The use of self-referential storytelling or breaking the fourth wall.
    surrealism: int             # The use of dream logic and bizarre, uncanny scenarios that challenge narrative reality.
    eccentricity: int           # A focus on bizarre characters or unconventional logic that requires cognitive adaptation.
    # Purpose & Intent
    philosophical: int          # The extent to which the work explicitly explores complex philosophical questions.
    educational: int            # The extent to which the work imparts factual knowledge.

    # --- Aesthetic & Production ---
    # The quality and style of the audiovisual execution.
    # Core Production Roles
    direction: int              # The quality of the overall creative vision and its execution.
    acting: int                 # The quality of the performances.
    cinematography: int         # The art of visual storytelling, including camera work, color, and lighting.
    editing: int                # The pacing, rhythm, and assembly of shots to create the final flow.
    music_composition: int      # The quality of the original score.
    # Sensory Experience & Style
    world_immersion: int        # How convincingly the production elements absorb the audience into the story's world.
    spectacle: int              # The "wow factor" from large-scale visuals, action, or set pieces.
    visual_stylization: int     # The degree of a unique, non-naturalistic visual or auditory style.
    pastiche: int               # The intentional imitation of the artistic style of another work, artist, or genre.
    psychedelic: int            # An aesthetic characterized by hallucinatory, distorted, or highly vibrant sensory experiences.
    grotesque: int              # The aesthetic use of biologically strange, body horror, or aesthetically repulsive imagery.
    camp_and_irony: int         # The use of theatricality, artifice, and a "so bad it's good" sensibility.
    # Aural Experience
    dialogue_centrality: int    # How crucial dialogue is to understanding and enjoying the work.
    music_centrality: int       # How crucial the score or soundtrack is to the emotional experience.
    sound_centrality: int       # How crucial non-musical sound design is to the atmosphere and storytelling.


class MediaFingerprint(BaseModel):
    scores: CoreScores
    highlight_keys: list[str]  # Keys from CoreScores


class ProductionInfo(BaseModel):
    method: Literal['Live-Action', 'Animation', 'Mixed-Media']
    animation_style: Optional[Literal[
        '2D Traditional', 
        '3D CGI', 
        'Stop-Motion', 
        'Rotoscoping', 
        'Anime', 
        'Other'
    ]] = None


ContentAdvisory = Literal[
    'Violence',
    'Nudity', 
    'Sexual Content',
    'Strong Language',
    'Drug Use',
    'Suicide Themes',
    'Disturbing Imagery'
]


class SocialSuitability(BaseModel):
    solo_watch: bool
    date_night: bool
    group_party: bool
    family: bool
    partner: bool
    friends: bool
    kids: bool
    teens: bool
    adults: bool
    intergenerational: bool
    public_viewing_safe: bool


class ViewingContext(BaseModel):
    is_thought_provoking: bool
    is_pure_escapism: bool
    is_background_friendly: bool
    is_comfort_watch: bool
    is_binge_friendly: bool
    is_drop_in_friendly: bool


class DNAAnalysis(BaseModel):
    fingerprint: MediaFingerprint
    is_anime: bool
    production_info: ProductionInfo
    content_advisories: list[ContentAdvisory]
    social_suitability: SocialSuitability
    viewing_context: ViewingContext
    essence_tags: list[str]
    essence_text: str


def main():
    pass
