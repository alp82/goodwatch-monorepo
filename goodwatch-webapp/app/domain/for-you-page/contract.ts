export type FamilyId = "feel" | "humor" | "world" | "story" | "craft"
export type Tier = -3 | -2 | -1 | 0 | 1 | 2 | 3

/** Stable title analysis column order. */
export const FP_KEYS = [
	"adrenaline",
	"tension",
	"scare",
	"violence",
	"romance",
	"eroticism",
	"wholesome",
	"wonder",
	"pathos",
	"melancholy",
	"uncanny",
	"catharsis",
	"nostalgia",
	"situational_comedy",
	"wit_wordplay",
	"physical_comedy",
	"cringe_humor",
	"absurdist_humor",
	"satire_parody",
	"dark_humor",
	"fantasy",
	"futuristic",
	"historical",
	"contemporary_realism",
	"crime",
	"mystery",
	"warfare",
	"political",
	"sports",
	"biographical",
	"coming_of_age",
	"family_dynamics",
	"psychological",
	"showbiz",
	"gaming",
	"pop_culture",
	"social_commentary",
	"class_and_capitalism",
	"technology_and_humanity",
	"spiritual",
	"narrative_structure",
	"dialogue_quality",
	"character_depth",
	"slow_burn",
	"fast_pace",
	"intrigue",
	"complexity",
	"rewatchability",
	"hopefulness",
	"bleakness",
	"ambiguity",
	"novelty",
	"homage_and_reference",
	"non_linear_narrative",
	"meta_narrative",
	"surrealism",
	"eccentricity",
	"philosophical",
	"educational",
	"direction",
	"acting",
	"cinematography",
	"editing",
	"music_composition",
	"world_immersion",
	"spectacle",
	"visual_stylization",
	"pastiche",
	"psychedelic",
	"grotesque",
	"camp_and_irony",
	"dialogue_centrality",
	"music_centrality",
	"sound_centrality",
] as const
export type FingerprintKey = (typeof FP_KEYS)[number]
export const FAMILY_ORDER: FamilyId[] = [
	"feel",
	"humor",
	"world",
	"story",
	"craft",
]
export const familyOf = (key: string): FamilyId | undefined => {
	const i = FP_KEYS.indexOf(key as FingerprintKey)
	return i < 0
		? undefined
		: i < 13
			? "feel"
			: i < 20
				? "humor"
				: i < 40
					? "world"
					: i < 59
						? "story"
						: "craft"
}

export interface ForYouPool {
	keys: string[]
	names: string[]
	years: (number | null)[]
	posters: string[]
	scores: number[]
	steps: number[]
	moods: number[]
	themes: number[]
	styles: number[]
	fingerprints: string
	scope: "services" | "everywhere"
}

/** Row-major decoded title analysis, in FP_KEYS order; 255 means missing. */
export interface DecodedPool extends Omit<ForYouPool, "fingerprints"> {
	fingerprints: Uint8Array
}

export interface ForYouTaste {
	subject: "member" | "guest" | "sample"
	attributes: {
		key: string
		label: string
		family: FamilyId
		edge: number
		tier: Tier
		carriers: string[]
	}[]
	groups: { id: string; name: string; keys: string[]; count: number }[]
	loved: Record<
		string,
		{ title: string; year: number | null; poster: string | null; score: number }
	>
}

export interface CardService {
	id: number
	name: string
	logo_path: string
}
export interface ForYouDetail {
	runtime: number | null
	backdrop: string | null
	overview: string | null
	tagline: string | null
	services: CardService[] | null
	title: string
	poster: string | null
}

export type ForYouPage =
	| { kind: "member"; status: "ready"; pool: ForYouPool; taste: ForYouTaste }
	| { kind: "member"; status: "empty" | "unavailable" }
	| { kind: "guest" }
export interface ForYouGuest {
	taste: ForYouTaste | null
	posters: string[]
	guestRatings: number
}

export function decodeFingerprints(s: string, n: number): Uint8Array {
	if (!Number.isSafeInteger(n) || n < 0 || s.length !== n * FP_KEYS.length)
		throw new RangeError("Invalid title analysis length")
	const out = new Uint8Array(s.length)
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i)
		if (c >= 48 && c <= 57) out[i] = c - 48
		else if (c === 97) out[i] = 10
		else if (c === 95) out[i] = 255
		else throw new RangeError("Invalid title analysis value")
	}
	return out
}

export function encodeFingerprints(rows: ArrayLike<number>[]): string {
	const chars: string[] = []
	for (const row of rows) {
		if (row.length !== FP_KEYS.length)
			throw new RangeError("Invalid title analysis width")
		for (let k = 0; k < row.length; k++) {
			const v = row[k]
			if (v === 255) chars.push("_")
			else if (Number.isInteger(v) && v >= 0 && v <= 10)
				chars.push(v === 10 ? "a" : String(v))
			else throw new RangeError("Invalid title analysis value")
		}
	}
	return chars.join("")
}
