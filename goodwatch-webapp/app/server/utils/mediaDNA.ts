/**
 * =============================================================================
 * MEDIA DNA: TYPE DEFINITIONS (FINAL ARCHITECTURE V11)
 * =============================================================================
 * Defines the final data structures for the entire analysis ecosystem.
 */

// Represents the full, detailed fingerprint of a media item.
export interface CoreScores {
  // --- Core Emotional Palette ---
  adrenaline: number; tension: number; scare: number; violence: number;
  romance: number; eroticism: number; wholesome: number; wonder: number;
  pathos: number; melancholy: number; uncanny: number;
  catharsis: number; nostalgia: number;

  // --- Humor Palette ---
  situational_comedy: number; wit_wordplay: number; physical_comedy: number;
  cringe_humor: number; absurdist_humor: number; satire_parody: number;
  dark_humor: number;

  // --- Thematic & World-Building ---
  fantasy: number; futuristic: number; historical: number; contemporary_realism: number;
  crime: number; mystery: number; warfare: number; political: number; sports: number;
  biographical: number; coming_of_age: number; family_dynamics: number;
  psychological: number; showbiz: number; gaming: number; pop_culture: number;
  social_commentary: number; class_and_capitalism: number;
  technology_and_humanity: number; spiritual: number;

  // --- Cognitive & Structural ---
  narrative_structure: number; dialogue_quality: number; character_depth: number;
  slow_burn: number; fast_pace: number; intrigue: number; complexity: number;
  rewatchability: number; hopefulness: number; bleakness: number;
  ambiguity: number; novelty: number; homage_and_reference: number;
  non_linear_narrative: number; meta_narrative: number; surrealism: number;
  eccentricity: number; philosophical: number; educational: number;

  // --- Aesthetic & Production ---
  direction: number; acting: number; cinematography: number; editing: number;
  music_composition: number; world_immersion: number; spectacle: number;
  visual_stylization: number; pastiche: number; psychedelic: number;
  grotesque: number; camp_and_irony: number;
  dialogue_centrality: number; music_centrality: number; sound_centrality: number;
}

// --- Client-Facing Trait Interfaces ---

// Defines the structure for returning a score that contributed to a trait match.
export interface MatchedScore {
  scoreName: keyof CoreScores;
  scoreValue: number;
}

// Level 1: The core identity or sub-genre. No icon.
export interface GenreBlend {
  id: string;
  name: string;
  description: string;
  matchedScores: MatchedScore[];
}

// Level 2: An area of exceptional craft or a unique cultural status. Has one icon.
export interface Highlight {
  id: string;
  name: string;
  icon: string;
  description: string;
  matchedScores: MatchedScore[];
}

// Level 3: A rare combination of two areas of mastery. Has two icons.
export interface DoubleFeature {
  id: string;
  name: string;
  icon: string;
  description: string;
  componentHighlights: [Highlight, Highlight];
}

// The final, comprehensive data object sent to the client.
export interface MediaDNA {
  genreBlends: GenreBlend[];
  highlights: Highlight[];
  doubleFeatures: DoubleFeature[];
}

// --- Internal Rule Engine Interfaces ---
export type ConditionValidator = (scores: CoreScores) => boolean;

export interface TraitRule {
    id: string;
    name: string;
    description: string;
    condition: ConditionValidator;
    matchedScoreKeys: (keyof CoreScores)[];
}

export interface HighlightRule extends TraitRule {
    icon: string;
    requiredGenreBlends?: string[]; // Dependency on Level 1
}

export interface DoubleFeatureRule {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (blends: GenreBlend[], highlights: Highlight[]) => boolean;
  getScore: (blends: GenreBlend[], highlights: Highlight[]) => number;
}
