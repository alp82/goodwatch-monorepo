// The word table the portrait names a taste with, without an LLM: for every attribute that isn't craft, an adjective,
// a plural noun for that kind of title, and a persona; for every attribute, a phrase that reads in a sentence.
import { CRAFT_KEYS, type FingerprintKey } from "~/server/taste/index.server"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"

type CraftKey =
	| "direction"
	| "acting"
	| "cinematography"
	| "editing"
	| "music_composition"
	| "dialogue_quality"
	| "narrative_structure"
	| "rewatchability"
type WordedKey = Exclude<FingerprintKey, CraftKey>

const WORDS: Record<
	WordedKey,
	[adjective: string, noun: string, persona: string]
> = {
	adrenaline: ["high-octane", "adrenaline rushes", "adrenaline chaser"],
	tension: ["white-knuckle", "nail-biters", "tension addict"],
	scare: ["nightmare-fed", "horror", "horror hound"],
	violence: ["hard-edged", "brutal stories", "bruiser"],
	romance: ["romantic", "love stories", "romantic"],
	eroticism: ["sensual", "sensual dramas", "sensualist"],
	wholesome: ["warm-hearted", "feel-good stories", "softie"],
	wonder: ["wide-eyed", "adventures full of wonder", "wonder seeker"],
	pathos: ["tender", "heartbreakers", "heartbreak collector"],
	melancholy: ["melancholic", "bittersweet stories", "melancholic"],
	uncanny: ["eerie", "uncanny tales", "seeker of the uncanny"],
	catharsis: ["cathartic", "cathartic dramas", "catharsis seeker"],
	nostalgia: ["nostalgic", "nostalgia trips", "nostalgist"],
	situational_comedy: ["sitcom-style", "sitcoms", "sitcom loyalist"],
	wit_wordplay: ["quick-witted", "sharp-tongued comedies", "wordsmith"],
	physical_comedy: ["slapstick", "slapstick comedies", "slapstick fan"],
	cringe_humor: ["cringe-proof", "cringe comedies", "cringe connoisseur"],
	absurdist_humor: ["absurdist", "absurd comedies", "absurdist"],
	satire_parody: ["satirical", "satires", "satirist"],
	dark_humor: ["pitch-black", "pitch-black comedies", "gallows humorist"],
	fantasy: ["myth-minded", "fantasy epics", "fantasist"],
	futuristic: ["future-bound", "visions of the future", "futurist"],
	historical: ["period", "period pieces", "history buff"],
	contemporary_realism: ["grounded", "grounded dramas", "realist"],
	crime: ["crime-soaked", "crime stories", "crime devotee"],
	mystery: ["puzzle-minded", "mysteries", "sleuth"],
	warfare: ["battle-scarred", "war stories", "war chronicler"],
	political: ["political", "political thrillers", "political animal"],
	sports: ["competitive", "sports stories", "sports fan"],
	biographical: ["true-story", "true stories", "biography reader"],
	coming_of_age: ["coming-of-age", "coming-of-age stories", "late bloomer"],
	family_dynamics: ["family-minded", "family sagas", "family chronicler"],
	psychological: ["mind-game", "psychological thrillers", "mind reader"],
	showbiz: ["backstage", "showbiz stories", "showbiz insider"],
	gaming: ["gamer", "game worlds", "gamer"],
	pop_culture: ["pop-savvy", "pop-culture riffs", "pop-culture magpie"],
	social_commentary: ["socially sharp", "social critiques", "social critic"],
	class_and_capitalism: [
		"class-conscious",
		"stories about money and class",
		"class warrior",
	],
	technology_and_humanity: [
		"tech-haunted",
		"stories about tech and us",
		"tech skeptic",
	],
	spiritual: ["spiritual", "spiritual journeys", "seeker"],
	character_depth: ["character-driven", "character studies", "people watcher"],
	slow_burn: ["slow-burning", "slow burns", "slow-burner"],
	fast_pace: ["breakneck", "breakneck thrillers", "speed freak"],
	intrigue: ["scheming", "stories of intrigue", "intrigue hunter"],
	complexity: ["intricate", "complex puzzles", "complexity junkie"],
	hopefulness: ["hopeful", "hopeful stories", "optimist"],
	bleakness: ["bleak", "bleak dramas", "pessimist"],
	ambiguity: ["morally grey", "morally grey stories", "grey-zone dweller"],
	novelty: ["restless", "true originals", "novelty hunter"],
	homage_and_reference: ["referential", "homages", "cinephile"],
	non_linear_narrative: [
		"time-twisting",
		"puzzle-box timelines",
		"puzzle-box fan",
	],
	meta_narrative: ["self-aware", "meta stories", "meta-fiction fan"],
	surrealism: ["dreamlike", "surreal trips", "surrealist"],
	eccentricity: ["eccentric", "stories full of eccentrics", "eccentric"],
	philosophical: ["big-question", "big-idea stories", "philosopher"],
	educational: ["curious", "things that teach you something", "student"],
	world_immersion: ["world-building", "immersive worlds", "world traveler"],
	spectacle: ["big-screen", "spectacles", "spectacle chaser"],
	visual_stylization: ["stylish", "stylized films", "aesthete"],
	pastiche: ["genre-remixing", "pastiches", "genre remixer"],
	psychedelic: ["psychedelic", "psychedelic trips", "tripper"],
	grotesque: ["grotesque-loving", "grotesque tales", "gorehound"],
	camp_and_irony: ["camp", "camp classics", "camp lover"],
	dialogue_centrality: ["talky", "talky dramas", "listener"],
	music_centrality: ["musical", "musicals", "music lover"],
	sound_centrality: ["sound-obsessed", "sound-driven films", "sound seeker"],
}

// How each attribute reads in a sentence about someone's taste: "Show you {phrase}, and you're in."
const PHRASES: Record<FingerprintKey, string> = {
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
	homage_and_reference: "homages",
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

/** Whether the attribute has an adjective, a noun, and a persona (every attribute except the craft ones). */
export const isWorded = (key: string): key is WordedKey =>
	key in WORDS && !CRAFT_KEYS.has(key as FingerprintKey)

const words = (key: string) => (isWorded(key) ? WORDS[key] : null)
const plain = (key: string) =>
	(FINGERPRINT_META[key]?.label ?? key.replace(/_/g, " ")).toLowerCase()

export const adjective = (key: string) => words(key)?.[0] ?? plain(key)
export const noun = (key: string) => words(key)?.[1] ?? plain(key)
export const persona = (key: string) => words(key)?.[2] ?? plain(key)
export const phrase = (key: string) =>
	PHRASES[key as FingerprintKey] ?? plain(key)
export const label = (key: string) =>
	FINGERPRINT_META[key]?.label ?? key.replace(/_/g, " ")
export const meaning = (key: string) => FINGERPRINT_META[key]?.description ?? ""

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "a, b and c" or "a, b or c". */
export function joinWords(items: string[], last: "and" | "or" = "and") {
	if (items.length < 2) return items[0] ?? ""
	return `${items.slice(0, -1).join(", ")} ${last} ${items[items.length - 1]}`
}
