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

// Describe titles and viewing preferences without inferring genres or personality.
const WORDS: Record<FingerprintKey, [adjective: string, noun: string, persona: string]> = {
	adrenaline: ["exciting", "adrenaline rushes", "excitement seeker"],
	tension: ["tense", "suspenseful stories", "suspense fan"],
	scare: ["scary", "stories full of scares", "scare seeker"],
	violence: [
		"violent",
		"stories with brutal conflict",
		"fan of intense conflict",
	],
	romance: ["romantic", "love stories", "romance fan"],
	eroticism: ["sensual", "sensual stories", "fan of sensual storytelling"],
	wholesome: ["heartwarming", "comforting stories", "comfort seeker"],
	wonder: ["wondrous", "stories full of wonder", "wonder seeker"],
	pathos: ["moving", "deeply moving stories", "fan of emotional stories"],
	melancholy: [
		"melancholic",
		"stories tinged with sadness",
		"fan of melancholy",
	],
	uncanny: ["eerie", "unsettling stories", "fan of the uncanny"],
	catharsis: [
		"cathartic",
		"stories with emotional release",
		"fan of emotional payoffs",
	],
	nostalgia: ["nostalgic", "nostalgic stories", "nostalgia lover"],
	situational_comedy: [
		"situationally funny",
		"stories with comic situations",
		"situational comedy fan",
	],
	wit_wordplay: ["witty", "stories with verbal wit", "wordplay fan"],
	physical_comedy: [
		"physically funny",
		"stories with slapstick humor",
		"slapstick fan",
	],
	cringe_humor: [
		"awkwardly funny",
		"stories with awkward humor",
		"awkward comedy fan",
	],
	absurdist_humor: [
		"absurdly funny",
		"stories with absurd humor",
		"absurd humor fan",
	],
	satire_parody: ["satirical", "stories with satire and parody", "satire fan"],
	dark_humor: ["darkly funny", "stories with dark humor", "dark humor fan"],
	fantasy: ["fantastical", "stories of magic and myth", "fantasy fan"],
	futuristic: ["futuristic", "science fiction stories", "science fiction fan"],
	historical: ["historical", "stories set in the past", "history fan"],
	contemporary_realism: [
		"grounded",
		"stories of modern life",
		"fan of everyday realism",
	],
	crime: [
		"crime-focused",
		"stories about crime and justice",
		"crime story fan",
	],
	mystery: ["mysterious", "stories built around a mystery", "mystery fan"],
	warfare: ["war-focused", "stories about war", "war story fan"],
	political: [
		"political",
		"stories about power and politics",
		"political story fan",
	],
	sports: ["sports-focused", "stories about sport", "sports story fan"],
	biographical: [
		"biographical",
		"stories about real people's lives",
		"biography fan",
	],
	coming_of_age: [
		"coming-of-age",
		"stories about growing up",
		"coming-of-age story fan",
	],
	family_dynamics: [
		"family-focused",
		"stories about family relationships",
		"family story fan",
	],
	psychological: [
		"psychological",
		"stories about inner struggles",
		"fan of psychological stories",
	],
	showbiz: [
		"showbiz-focused",
		"stories about the entertainment industry",
		"showbiz story fan",
	],
	gaming: [
		"game-focused",
		"stories about games and virtual worlds",
		"gaming story fan",
	],
	pop_culture: [
		"pop-culture-focused",
		"stories about popular culture",
		"pop culture fan",
	],
	social_commentary: [
		"socially critical",
		"stories that question society",
		"social commentary fan",
	],
	class_and_capitalism: [
		"class-conscious",
		"stories about class and inequality",
		"fan of stories about inequality",
	],
	technology_and_humanity: [
		"technology-focused",
		"stories about technology's human impact",
		"fan of technology stories",
	],
	spiritual: [
		"spiritual",
		"stories about faith and meaning",
		"fan of spiritual questions",
	],
	narrative_structure: [
		"well-constructed",
		"carefully structured stories",
		"fan of well-constructed stories",
	],
	dialogue_quality: [
		"well-written",
		"stories with well-written dialogue",
		"dialogue enthusiast",
	],
	character_depth: [
		"character-rich",
		"stories with nuanced characters",
		"fan of complex characters",
	],
	slow_burn: ["slow-building", "stories that build gradually", "slow-burn fan"],
	fast_pace: [
		"fast-paced",
		"rapidly unfolding stories",
		"fan of fast storytelling",
	],
	intrigue: [
		"gripping",
		"stories that keep you hooked",
		"fan of gripping plots",
	],
	complexity: [
		"intricate",
		"stories with interwoven plots",
		"fan of intricate stories",
	],
	rewatchability: [
		"rewatchable",
		"stories that reward repeat viewing",
		"repeat viewer",
	],
	hopefulness: [
		"hopeful",
		"stories with an optimistic outlook",
		"fan of hopeful stories",
	],
	bleakness: ["bleak", "stories with a grim outlook", "fan of bleak stories"],
	ambiguity: [
		"ambiguous",
		"stories open to interpretation",
		"fan of open interpretations",
	],
	novelty: ["inventive", "stories with original ideas", "originality seeker"],
	homage_and_reference: [
		"referential",
		"stories with tributes to other works",
		"homage enthusiast",
	],
	non_linear_narrative: [
		"nonlinear",
		"stories told out of chronological order",
		"fan of nonlinear storytelling",
	],
	meta_narrative: [
		"self-aware",
		"stories that reflect on storytelling",
		"fan of self-aware stories",
	],
	surrealism: ["surreal", "stories built on dream logic", "surrealism fan"],
	eccentricity: [
		"eccentric",
		"stories full of unconventional characters",
		"fan of eccentric stories",
	],
	philosophical: [
		"philosophical",
		"stories exploring big questions",
		"fan of philosophical stories",
	],
	educational: [
		"informative",
		"stories that teach you something",
		"curious viewer",
	],
	direction: [
		"well-directed",
		"stories with strong direction",
		"direction enthusiast",
	],
	acting: [
		"well-acted",
		"stories with strong performances",
		"performance enthusiast",
	],
	cinematography: [
		"visually striking",
		"stories with striking camera work",
		"cinematography enthusiast",
	],
	editing: [
		"well-edited",
		"stories with skillful editing",
		"editing enthusiast",
	],
	music_composition: [
		"beautifully scored",
		"stories with well-composed scores",
		"film score enthusiast",
	],
	world_immersion: [
		"immersive",
		"stories with convincing worlds",
		"immersion seeker",
	],
	spectacle: ["spectacular", "stories with grand set pieces", "spectacle fan"],
	visual_stylization: [
		"stylized",
		"stories with distinctive visual styles",
		"visual style enthusiast",
	],
	pastiche: [
		"stylistically referential",
		"stories that imitate other styles",
		"pastiche fan",
	],
	psychedelic: [
		"psychedelic",
		"stories with hallucinatory imagery",
		"psychedelic imagery fan",
	],
	grotesque: [
		"grotesque",
		"stories with disturbing bodily imagery",
		"grotesque imagery fan",
	],
	camp_and_irony: ["campy", "stories with theatrical exaggeration", "camp fan"],
	dialogue_centrality: [
		"dialogue-led",
		"stories carried by conversation",
		"fan of dialogue-led stories",
	],
	music_centrality: [
		"soundtrack-led",
		"stories shaped by their soundtrack",
		"soundtrack enthusiast",
	],
	sound_centrality: [
		"sound-led",
		"stories shaped by sound design",
		"sound design enthusiast",
	],
}

// How each attribute reads in a sentence about someone's taste: "Show you {phrase}, and you're in."
const PHRASES: Record<FingerprintKey, string> = {
	adrenaline: "adrenaline",
	tension: "suspense",
	scare: "real scares",
	violence: "hard-edged violence",
	romance: "romance",
	eroticism: "sensuality",
	wholesome: "wholesome warmth",
	wonder: "a sense of wonder",
	pathos: "deeply moving stories",
	melancholy: "melancholy",
	uncanny: "the uncanny",
	catharsis: "a cathartic payoff",
	nostalgia: "nostalgia",
	situational_comedy: "comic situations",
	wit_wordplay: "wit and wordplay",
	physical_comedy: "slapstick",
	cringe_humor: "awkward humor",
	absurdist_humor: "absurd humor",
	satire_parody: "satire and parody",
	dark_humor: "dark humor",
	fantasy: "fantasy worlds",
	futuristic: "science fiction and future societies",
	historical: "period pieces",
	contemporary_realism: "grounded realism",
	crime: "crime",
	mystery: "a mystery to crack",
	warfare: "war stories",
	political: "politics",
	sports: "sports",
	biographical: "real people’s lives",
	coming_of_age: "coming-of-age",
	family_dynamics: "family relationships",
	psychological: "inner struggles and perception",
	showbiz: "showbiz",
	gaming: "games",
	pop_culture: "pop culture",
	social_commentary: "social critique",
	class_and_capitalism: "class and money",
	technology_and_humanity: "tech and what it does to us",
	spiritual: "the spiritual",
	narrative_structure: "well-constructed stories",
	dialogue_quality: "well-written dialogue",
	character_depth: "nuanced characters",
	slow_burn: "a slow burn",
	fast_pace: "breakneck pace",
	intrigue: "intrigue",
	complexity: "complexity",
	rewatchability: "stories that reward repeat viewing",
	hopefulness: "hope",
	bleakness: "a bleak outlook",
	ambiguity: "open interpretations",
	novelty: "the unexpected",
	homage_and_reference: "tributes to other works",
	non_linear_narrative: "nonlinear storytelling",
	meta_narrative: "self-aware storytelling",
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
	visual_stylization: "distinctive visual style",
	pastiche: "imitations of other artistic styles",
	psychedelic: "the psychedelic",
	grotesque: "the grotesque",
	camp_and_irony: "camp",
	dialogue_centrality: "stories carried by conversation",
	music_centrality: "stories shaped by their soundtrack",
	sound_centrality: "stories shaped by sound design",
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
