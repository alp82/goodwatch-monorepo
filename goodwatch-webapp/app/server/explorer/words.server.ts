// Short phrases for fingerprint attributes, as they read inside a sentence: "Real scares and a slow burn". Used for
// what sets an island apart and for a card's why line.
import type { CoreScores } from "~/server/utils/fingerprint"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"

const PHRASES: Partial<Record<keyof CoreScores, string>> = {
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
	character_depth: "complicated people",
	slow_burn: "a slow burn",
	fast_pace: "breakneck pace",
	intrigue: "intrigue",
	complexity: "complexity",
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

export const phraseOf = (key: string): string =>
	PHRASES[key as keyof CoreScores] ??
	getFingerprintMeta(key).label.toLowerCase()

/** "real scares", "a slow burn" -> "Real scares and a slow burn". */
export function sentence(parts: string[]): string {
	const text = parts.filter(Boolean).join(" and ")
	return text.charAt(0).toUpperCase() + text.slice(1)
}
