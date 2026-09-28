// PROTOTYPE - throwaway. Describe the fingerprint, without inferring a genre,
// format, or the viewer's personality. Nouns denote plural groups of titles;
// adjectives describe titles, while personas describe viewing preferences.
import type { CoreScores } from "~/server/utils/fingerprint"

type TasteWords = [adj: string, noun: string, persona: string]

export const WORDS: Record<string, TasteWords> = {
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
} satisfies Record<keyof CoreScores, TasteWords>

export const adj = (k: string) => WORDS[k]?.[0] ?? k.replace(/_/g, " ")
export const noun = (k: string) => WORDS[k]?.[1] ?? k.replace(/_/g, " ")
export const persona = (k: string) => WORDS[k]?.[2] ?? k.replace(/_/g, " ")
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const CONTEXTS: { id: string; name: string; line: string }[] = [
	{
		id: "thought_provoking",
		name: "Something to think about",
		line: "Titles that stay with you after the credits",
	},
	{
		id: "comfort_watch",
		name: "Comfort watch",
		line: "Familiar, warm, easy to return to",
	},
	{
		id: "pure_escapism",
		name: "Pure escapism",
		line: "Other worlds, no homework",
	},
	{
		id: "binge_friendly",
		name: "A long binge",
		line: "Hard to stop after one",
	},
	{
		id: "drop_in_friendly",
		name: "Drop in anytime",
		line: "Pick it up anywhere",
	},
	{
		id: "background_friendly",
		name: "On in the background",
		line: "Fine while you do something else",
	},
]

/** Two demo friends to compare against. Real friends would need consent and a follow model. */
export const FRIENDS: {
	id: string
	name: string
	blurb: string
	ratings: Record<string, number>
}[] = [
	{
		id: "mia",
		name: "Mia",
		blurb: "Demo friend: animation, fantasy, and comfort sitcoms",
		ratings: {
			"movie-120": 9,
			"movie-121": 9,
			"movie-862": 9,
			"movie-585": 8,
			"movie-671": 8,
			"movie-11": 8,
			"movie-105": 9,
			"movie-329": 8,
			"movie-194": 9,
			"movie-129": 10,
			"movie-4935": 9,
			"movie-120467": 8,
			"movie-546554": 8,
			"movie-8363": 7,
			"movie-22538": 8,
			"movie-14160": 9,
			"movie-10681": 9,
			"movie-150540": 9,
			"movie-354912": 9,
			"movie-13": 8,
			"movie-299534": 7,
			"movie-95": 4,
			"movie-106646": 4,
			"movie-769": 5,
			"movie-64690": 5,
			"movie-603": 8,
			"movie-27205": 8,
			"movie-155": 7,
			"show-1399": 7,
			"show-66732": 8,
			"show-1668": 9,
			"show-2316": 8,
			"show-97546": 10,
			"show-48891": 9,
			"show-1421": 8,
			"show-94605": 9,
			"show-70785": 9,
			"show-73586": 3,
			"show-60625": 6,
			"show-1396": 7,
		},
	},
	{
		id: "jonas",
		name: "Jonas",
		blurb: "Demo friend: slow arthouse, melancholy, and romance",
		ratings: {
			"movie-843": 10,
			"movie-18148": 9,
			"movie-11216": 9,
			"movie-426": 9,
			"movie-467244": 9,
			"movie-398818": 8,
			"movie-76": 9,
			"movie-38": 9,
			"movie-152601": 8,
			"movie-194662": 8,
			"movie-64690": 8,
			"movie-313369": 7,
			"movie-1417": 9,
			"movie-11621": 8,
			"movie-4922": 6,
			"movie-19995": 4,
			"movie-299534": 3,
			"movie-95": 2,
			"movie-284054": 4,
			"movie-8363": 3,
			"movie-155": 6,
			"movie-603": 7,
			"movie-27205": 6,
			"movie-550": 7,
			"movie-680": 8,
			"show-136315": 9,
			"show-42009": 8,
			"show-100088": 8,
			"show-1400": 7,
			"show-93405": 6,
			"show-82856": 4,
			"show-71912": 4,
			"show-1668": 5,
			"show-1396": 8,
		},
	},
]
