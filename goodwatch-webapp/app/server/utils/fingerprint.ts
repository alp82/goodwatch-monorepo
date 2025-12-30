// --- FINGERPRINT SCORES ---

export type CoreScores = {
	// --- Core Emotional Palette ---
	adrenaline: number; tension: number; scare: number; violence: number; romance: number; eroticism: number; wholesome: number; wonder: number; pathos: number; melancholy: number; uncanny: number; catharsis: number; nostalgia: number;
	// --- Humor Palette ---
	situational_comedy: number; wit_wordplay: number; physical_comedy: number; cringe_humor: number; absurdist_humor: number; satire_parody: number; dark_humor: number;
	// --- Thematic & World-Building ---
	fantasy: number; futuristic: number; historical: number; contemporary_realism: number; crime: number; mystery: number; warfare: number; political: number; sports: number; biographical: number; coming_of_age: number; family_dynamics: number; psychological: number; showbiz: number; gaming: number; pop_culture: number; social_commentary: number; class_and_capitalism: number; technology_and_humanity: number; spiritual: number;
	// --- Cognitive & Structural ---
	narrative_structure: number; dialogue_quality: number; character_depth: number; slow_burn: number; fast_pace: number; intrigue: number; complexity: number; rewatchability: number; hopefulness: number; bleakness: number; ambiguity: number; novelty: number; homage_and_reference: number; non_linear_narrative: number; meta_narrative: number; surrealism: number; eccentricity: number; philosophical: number; educational: number;
	// --- Aesthetic & Production ---
	direction: number; acting: number; cinematography: number; editing: number; music_composition: number; world_immersion: number; spectacle: number; visual_stylization: number; pastiche: number; psychedelic: number; grotesque: number; camp_and_irony: number; dialogue_centrality: number; music_centrality: number; sound_centrality: number;
}

// Valid fingerprint keys for runtime validation
export const VALID_FINGERPRINT_KEYS: readonly (keyof CoreScores)[] = [
	// Core Emotional Palette
	"adrenaline", "tension", "scare", "violence", "romance", "eroticism", "wholesome", "wonder", "pathos", "melancholy", "uncanny", "catharsis", "nostalgia",
	// Humor Palette
	"situational_comedy", "wit_wordplay", "physical_comedy", "cringe_humor", "absurdist_humor", "satire_parody", "dark_humor",
	// Thematic & World-Building
	"fantasy", "futuristic", "historical", "contemporary_realism", "crime", "mystery", "warfare", "political", "sports", "biographical", "coming_of_age", "family_dynamics", "psychological", "showbiz", "gaming", "pop_culture", "social_commentary", "class_and_capitalism", "technology_and_humanity", "spiritual",
	// Cognitive & Structural
	"narrative_structure", "dialogue_quality", "character_depth", "slow_burn", "fast_pace", "intrigue", "complexity", "rewatchability", "hopefulness", "bleakness", "ambiguity", "novelty", "homage_and_reference", "non_linear_narrative", "meta_narrative", "surrealism", "eccentricity", "philosophical", "educational",
	// Aesthetic & Production
	"direction", "acting", "cinematography", "editing", "music_composition", "world_immersion", "spectacle", "visual_stylization", "pastiche", "psychedelic", "grotesque", "camp_and_irony", "dialogue_centrality", "music_centrality", "sound_centrality"
] as const

export const DISTINCT_FINGERPRINT_KEYS: readonly (keyof CoreScores)[] = [
	"adrenaline", "tension", "scare", "violence", "romance", "eroticism", "wholesome", "wonder", "pathos", "melancholy", "uncanny", "catharsis", "nostalgia",
	"situational_comedy", "wit_wordplay", "physical_comedy", "cringe_humor", "absurdist_humor", "satire_parody", "dark_humor",
	"fantasy", "futuristic", "historical", "contemporary_realism", "crime", "mystery", "warfare", "political", "sports", "biographical", "coming_of_age", "family_dynamics", "psychological", "showbiz", "gaming", "pop_culture", "social_commentary", "class_and_capitalism", "technology_and_humanity", "spiritual",
] as const

export function isValidFingerprintKey(key: string): key is keyof CoreScores {
	return VALID_FINGERPRINT_KEYS.includes(key as keyof CoreScores)
}

// --- VIEWING GUIDE DEFINITIONS ---

export interface SocialSuitability {
	id: string
	name: string
	description: string
	score: number
}

export interface ViewingContext {
	id: string
	name: string
	description: string
	score: number
}

const SOCIAL_SUITABILITY_REGISTRY: Record<
	string,
	{ name: string; description: string }
> = {
	adults: { name: "Adults", description: "Mature themes, not for kids." },
	date_night: {
		name: "Date Night",
		description: "Great for a romantic evening.",
	},
	family: {
		name: "Family Movie Night",
		description: "Perfect for watching with the whole family.",
	},
	friends: {
		name: "Friends Night",
		description: "A fun watch with a group of friends.",
	},
	group_party: {
		name: "Party Vibe",
		description: "Lively and great for a group setting.",
	},
	intergenerational: {
		name: "Intergenerational",
		description: "Enjoyable for a wide range of ages.",
	},
	kids: { name: "Kids", description: "Made for children." },
	partner: {
		name: "Partner Watch",
		description: "Good to watch with a significant other.",
	},
	public_viewing_safe: {
		name: "Public Viewing Safe",
		description: "No awkward scenes when watching in public.",
	},
	solo_watch: { name: "Solo Watch", description: "Best enjoyed by yourself." },
	teens: { name: "Teens", description: "Aimed at a teenage audience." },
}

const VIEWING_CONTEXT_REGISTRY: Record<
	string,
	{ name: string; description: string }
> = {
	background_friendly: {
		name: "Background Watch",
		description: "Doesn't require your full attention.",
	},
	binge_friendly: {
		name: "Binge-Friendly",
		description: "You'll want to watch episode after episode.",
	},
	comfort_watch: {
		name: "Comfort Watch",
		description: "Cozy, familiar, and reassuring.",
	},
	drop_in_friendly: {
		name: "Drop-in Friendly",
		description: "Easy to follow along even if you miss a bit.",
	},
	pure_escapism: {
		name: "Pure Escapism",
		description: "Lets you completely disconnect from reality.",
	},
	thought_provoking: {
		name: "Thought-Provoking",
		description: "Will leave you with a lot to think about.",
	},
}

// --- VIEWING GUIDE BUILDERS ---

function getSocialSuitability(dnaAnalysis: DNAAnalysis): SocialSuitability[] {
	const matched: SocialSuitability[] = []
	for (const id in SOCIAL_SUITABILITY_REGISTRY) {
		const key = `suitability_${id}` as keyof DNAAnalysis
		const value = dnaAnalysis[key] as boolean
		if (value) {
			const rule = SOCIAL_SUITABILITY_REGISTRY[id]
			matched.push({
				id,
				name: rule.name,
				description: rule.description,
				score: 10,
			})
		}
	}
	return matched
}

function getViewingContext(dnaAnalysis: DNAAnalysis): ViewingContext[] {
	const matched: ViewingContext[] = []
	for (const id in VIEWING_CONTEXT_REGISTRY) {
		const key = `context_is_${id}` as keyof DNAAnalysis
		const value = dnaAnalysis[key] as boolean
		if (value) {
			const rule = VIEWING_CONTEXT_REGISTRY[id]
			matched.push({
				id,
				name: rule.name,
				description: rule.description,
				score: 10,
			})
		}
	}
	return matched
}

// --- PILLARS ---

type Tier = 0 | 1 | 2 | 3 | 4;

const ENERGY_KEYS = ['adrenaline','tension','scare','fast_pace','spectacle','violence'] as const;
const HEART_KEYS  = ['romance','wholesome','pathos','melancholy','hopefulness','catharsis','nostalgia','coming_of_age','family_dynamics','wonder'] as const;
const HUMOR_KEYS  = ['situational_comedy','wit_wordplay','physical_comedy','cringe_humor','absurdist_humor','satire_parody','dark_humor'] as const;
const WORLD_KEYS  = ['world_immersion','dialogue_centrality','rewatchability','ambiguity','novelty'] as const;
const CRAFT_KEYS  = ['direction','acting','narrative_structure','dialogue_quality','character_depth','intrigue','complexity','non_linear_narrative','meta_narrative'] as const;
const STYLE_KEYS  = ['cinematography','editing','music_composition','visual_stylization','music_centrality','sound_centrality'] as const;

export interface PillarScores {
	Energy: number
	Heart: number
	Humor: number
	World: number
	Craft: number
	Style: number
}

export interface PillarTiers {
	Energy: Tier
	Heart: Tier
	Humor: Tier
	World: Tier
	Craft: Tier
	Style: Tier
}

const rms    = (a: number[]) => Math.sqrt(a.reduce((s,v)=>s+v*v,0) / a.length);
const median = (a: number[]) => { const b=[...a].sort((x,y)=>x-y); return b[Math.floor(b.length/2)]; };
const top2   = (a: number[]) => { const b=[...a].sort((x,y)=>y-x); return (b[0]+(b[1] ?? 0))/2; };

const get = <K extends keyof CoreScores>(fp: CoreScores, keys: readonly K[]) =>
  keys.map(k => fp[k]);

const AGG = {
  Energy: (xs: number[]) => top2(xs),
  Heart:  (xs: number[]) => median(xs),
  Humor:  (xs: number[]) => top2(xs),
  World:  (xs: number[]) => rms(xs),
  Craft:  (xs: number[]) => median(xs),
  Style:  (xs: number[]) => median(xs),
} as const;

export const toTier = (s: number): Tier =>
  s >= 9 ? 4 : s >= 7 ? 3 : s >= 5 ? 2 : s >= 3 ? 1 : 0;

export function computePillarScores(fp: CoreScores): PillarTiers {
  const scores: PillarScores = {
    Energy: AGG.Energy(get(fp, ENERGY_KEYS)),
    Heart:  AGG.Heart (get(fp, HEART_KEYS)),
    Humor:  AGG.Humor (get(fp, HUMOR_KEYS)),
    World:  AGG.World (get(fp, WORLD_KEYS)),
    Craft:  AGG.Craft (get(fp, CRAFT_KEYS)),
    Style:  AGG.Style (get(fp, STYLE_KEYS)),
  };
  const tiers: PillarTiers = {
    Energy: toTier(scores.Energy),
    Heart:  toTier(scores.Heart),
    Humor:  toTier(scores.Humor),
    World:  toTier(scores.World),
    Craft:  toTier(scores.Craft),
    Style:  toTier(scores.Style),
  };
  return tiers;
}


// --- FINGERPRINT RESULT BUILDER ---

export interface DNAAnalysis {
	scores: CoreScores
	highlightKeys: string[]
	genres: string[]
	essenceTags: string[]
	essenceText: string
	content_advisories: any
	context_is_background_friendly: boolean
	context_is_binge_friendly: boolean
	context_is_comfort_watch: boolean
	context_is_drop_in_friendly: boolean
	context_is_pure_escapism: boolean
	context_is_thought_provoking: boolean
	suitability_adults: boolean
	suitability_date_night: boolean
	suitability_family: boolean
	suitability_friends: boolean
	suitability_group_party: boolean
	suitability_intergenerational: boolean
	suitability_kids: boolean
	suitability_partner: boolean
	suitability_public_viewing_safe: boolean
	suitability_solo_watch: boolean
	suitability_teens: boolean
}

export interface FingerprintResult {
	scores: CoreScores
	highlightKeys: string[]
	essenceText: string
	essenceTags: string[]
	socialSuitability: SocialSuitability[]
	viewingContext: ViewingContext[]
	pillars: PillarTiers
}

export function buildFingerprint(dnaAnalysis: DNAAnalysis): FingerprintResult {
	const { scores, highlightKeys, essenceText, essenceTags } = dnaAnalysis
	const socialSuitability = getSocialSuitability(dnaAnalysis)
	const viewingContext = getViewingContext(dnaAnalysis)
	const pillars = computePillarScores(scores)

	return {
		scores,
		highlightKeys,
		essenceText,
		essenceTags,
		socialSuitability,
		viewingContext,
		pillars,
	}
}
