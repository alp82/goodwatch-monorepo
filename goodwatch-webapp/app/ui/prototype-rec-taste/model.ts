// PROTOTYPE - throwaway. Types, demo member, and readable attribute phrases for /prototype/rec-taste.

export type PoolItem = {
	key: string // "movie-603"
	type: "movie" | "show"
	id: number
	title: string
	year: number
	poster: string
	backdrop: string
	genres: string[]
	score: number // GoodWatch score 0-100
	fp: number[] // fingerprint, in TastePool.keys order
	services: number[] // streaming service ids in Germany
	directors: string[]
	synopsis: string
	tags: string[]
}

export type Service = { id: number; name: string; logo: string; mine: boolean }

export type TastePool = { items: PoolItem[]; services: Service[]; keys: string[] }

// What the person told us about a title. A later signal replaces the earlier one.
export type Signal =
	| { kind: "score"; score: number } // rated 1-10
	| { kind: "seen" } // seen, not rated
	| { kind: "no" } // not interested
	| { kind: "want" } // Want to See
	| { kind: "unseen" } // confirmed not seen yet; stays in picks

export const SERVICE_IDS = [8, 9, 350, 337, 1899, 30]
export const DEMO_SERVICES = [8, 9, 350] // Netflix, Prime Video, Apple TV

const s = (score: number): Signal => ({ kind: "score", score })
const want: Signal = { kind: "want" }

// A returning member with about 40 ratings: slow-burn crime and prestige drama, cold on broad comedy.
export const DEMO_RATINGS: Record<string, Signal> = {
	"movie-807": s(9),
	"movie-1949": s(9),
	"movie-146233": s(9),
	"movie-6977": s(10),
	"movie-335984": s(9),
	"movie-329865": s(8),
	"movie-496243": s(10),
	"movie-155": s(8),
	"movie-76341": s(8),
	"movie-273481": s(8),
	"movie-949": s(9),
	"movie-37799": s(8),
	"movie-244786": s(9),
	"movie-7345": s(9),
	"movie-242582": s(8),
	"movie-210577": s(8),
	"movie-670": s(9),
	"movie-64690": s(7),
	"movie-157336": s(7),
	"movie-27205": s(7),
	"movie-11631": s(3),
	"movie-38365": s(2),
	"movie-91314": s(3),
	"movie-8966": s(2),
	"movie-11036": s(4),
	"movie-109445": s(5),
	"movie-385687": s(3),
	"movie-114150": s(4),
	"show-1396": s(10),
	"show-46648": s(9),
	"show-60059": s(9),
	"show-87108": s(10),
	"show-76331": s(9),
	"show-95396": s(9),
	"show-67744": s(9),
	"show-70523": s(8),
	"show-2316": s(6),
	"show-1668": s(5),
	"show-1418": s(3),
	"movie-1124": want,
	"movie-77": want,
	"show-1438": want,
	"show-1398": want,
	"show-60622": want,
}

// How each attribute reads in a sentence about someone's taste. Missing keys fall back to the label.
export const PHRASES: Record<string, string> = {
	adrenaline: "adrenaline",
	tension: "unbearable tension",
	scare: "real scares",
	violence: "hard-edged violence",
	romance: "romance",
	eroticism: "sensuality",
	wholesome: "wholesome warmth",
	wonder: "a sense of wonder",
	pathos: "stories that hurt",
	melancholy: "melancholy",
	uncanny: "the uncanny",
	catharsis: "a cathartic payoff",
	nostalgia: "nostalgia",
	situational_comedy: "sitcom setups",
	wit_wordplay: "sharp dialogue",
	physical_comedy: "slapstick",
	cringe_humor: "cringe comedy",
	absurdist_humor: "absurd humor",
	satire_parody: "satire",
	dark_humor: "pitch-black humor",
	fantasy: "fantasy worlds",
	futuristic: "the near future",
	historical: "period pieces",
	contemporary_realism: "grounded realism",
	crime: "crime",
	mystery: "a mystery to crack",
	warfare: "war stories",
	political: "politics",
	sports: "sports",
	biographical: "true stories",
	coming_of_age: "coming-of-age",
	family_dynamics: "family drama",
	psychological: "psychological games",
	showbiz: "showbiz",
	gaming: "games",
	pop_culture: "pop culture",
	social_commentary: "social critique",
	class_and_capitalism: "class and money",
	technology_and_humanity: "tech and what it does to us",
	spiritual: "the spiritual",
	narrative_structure: "tight plotting",
	dialogue_quality: "great writing",
	character_depth: "complicated people",
	slow_burn: "a slow burn",
	fast_pace: "breakneck pace",
	intrigue: "intrigue",
	complexity: "complexity",
	rewatchability: "comfort rewatches",
	hopefulness: "hope",
	bleakness: "bleak endings",
	ambiguity: "moral grey",
	novelty: "the unexpected",
	non_linear_narrative: "puzzle-box timelines",
	meta_narrative: "meta games",
	surrealism: "the surreal",
	eccentricity: "eccentrics",
	philosophical: "big questions",
	educational: "learning something",
	direction: "a strong director's hand",
	acting: "great performances",
	cinematography: "striking images",
	editing: "precise editing",
	music_composition: "a great score",
	world_immersion: "worlds to get lost in",
	spectacle: "spectacle",
	visual_stylization: "heavy style",
	pastiche: "pastiche",
	psychedelic: "the psychedelic",
	grotesque: "the grotesque",
	camp_and_irony: "camp",
	dialogue_centrality: "talky scenes",
	music_centrality: "musicals",
	sound_centrality: "sound design",
}

// Craft attributes are high for every acclaimed title, so they say little about a person.
export const CRAFT_KEYS = new Set(["direction", "acting", "cinematography", "editing", "music_composition", "dialogue_quality", "narrative_structure", "rewatchability"])

// Attributes offered as "more of this / less of that" dials. Grouped by what people think in.
export const DIAL_GROUPS: { name: string; keys: string[] }[] = [
	{ name: "Mood", keys: ["tension", "bleakness", "hopefulness", "wholesome", "melancholy", "scare", "adrenaline"] },
	{ name: "Story", keys: ["slow_burn", "fast_pace", "complexity", "ambiguity", "character_depth", "non_linear_narrative"] },
	{ name: "World", keys: ["crime", "futuristic", "historical", "fantasy", "psychological", "political", "romance"] },
	{ name: "Humor", keys: ["dark_humor", "wit_wordplay", "absurdist_humor", "situational_comedy", "satire_parody"] },
]

export const posterUrl = (item: PoolItem, size: "w185" | "w342" | "w500" | "w780" = "w342") => item.poster.replace("/w342/", `/${size}/`)
export const backdropUrl = (item: PoolItem, size: "w780" | "w1280" = "w1280") => item.backdrop.replace("/w1280/", `/${size}/`)
export const titleHref = (item: PoolItem) => `/${item.type}/${item.id}-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`
