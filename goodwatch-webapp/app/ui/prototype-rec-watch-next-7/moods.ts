// PROTOTYPE - throwaway. The reworked mood list for /prototype/rec-watch-next-7 (#176, round 7).
// Eleven moods, each a plain rule over a title's stored data: the 74 fingerprint attribute scores from the
// title analysis, plus genres for one of them. Rules were tuned against the owner's Wishlist and a broad
// pool of 4,500 popular titles so every pair overlaps less than 0.3 (Jaccard of their title sets).
// No imports: the server classifies with it, the page reads names and colours, and the scratch analysis
// script imports it directly.

export type MoodKey = "funny" | "feelgood" | "romance" | "action" | "scary" | "crime" | "mind" | "heavy" | "worlds" | "history" | "growing"

type Fp = Record<string, number | null | undefined>

export type MoodDef = {
	key: MoodKey
	name: string
	line: string
	hue: string
	// The rule in words, for the report and the panel's fine print.
	rule: string
	test: (fp: Fp, genres: string[]) => boolean
}

const s = (fp: Fp, k: string) => fp[k] ?? 0
const humour = (fp: Fp) => Math.max(s(fp, "situational_comedy"), s(fp, "wit_wordplay"), s(fp, "physical_comedy"), s(fp, "absurdist_humor"), s(fp, "satire_parody"))

export const MOODS: MoodDef[] = [
	{
		key: "funny",
		name: "Funny",
		line: "Comedy leads: wit, slapstick or the absurd.",
		hue: "#facc15",
		rule: "Any humour score (situational, wit, physical, absurdist, satire) 8+, bleakness 5 or less",
		test: (fp) => humour(fp) >= 8 && s(fp, "bleakness") <= 5,
	},
	{
		key: "feelgood",
		name: "Feel-good",
		line: "Warm and hopeful, with nothing grim.",
		hue: "#fb923c",
		rule: "Wholesome 7+, hopefulness 7+, bleakness 3 or less",
		test: (fp) => s(fp, "wholesome") >= 7 && s(fp, "hopefulness") >= 7 && s(fp, "bleakness") <= 3,
	},
	{
		key: "romance",
		name: "Romance",
		line: "A love story at the centre.",
		hue: "#f472b6",
		rule: "Romance 7+",
		test: (fp) => s(fp, "romance") >= 7,
	},
	{
		key: "action",
		name: "Action",
		line: "High adrenaline and big set pieces.",
		hue: "#ef4444",
		rule: "Adrenaline 8+ and spectacle 7+",
		test: (fp) => s(fp, "adrenaline") >= 8 && s(fp, "spectacle") >= 7,
	},
	{
		key: "scary",
		name: "Scary",
		line: "Dread, frights and horror.",
		hue: "#a3e635",
		rule: "Scare 7+, or the Horror genre with scare 5+",
		test: (fp, g) => s(fp, "scare") >= 7 || (g.includes("Horror") && s(fp, "scare") >= 5),
	},
	{
		key: "crime",
		name: "Crime & mystery",
		line: "Puzzles, investigations and heists.",
		hue: "#60a5fa",
		rule: "Mystery 8+, or crime 8+ with intrigue 8+ and spectacle 7 or less",
		test: (fp) => s(fp, "mystery") >= 8 || (s(fp, "crime") >= 8 && s(fp, "intrigue") >= 8 && s(fp, "spectacle") <= 7),
	},
	{
		key: "mind",
		name: "Mind-bending",
		line: "Surreal or layered; keeps you thinking.",
		hue: "#c084fc",
		rule: "Surrealism 6+, or complexity 8+ with philosophical 7+ or non-linear narrative 8+",
		test: (fp) => s(fp, "surrealism") >= 6 || (s(fp, "complexity") >= 8 && (s(fp, "philosophical") >= 7 || s(fp, "non_linear_narrative") >= 8)),
	},
	{
		key: "heavy",
		name: "Heavy",
		line: "Grief, melancholy and big emotions.",
		hue: "#94a3b8",
		rule: "Pathos 8+ or melancholy 8+",
		test: (fp) => s(fp, "pathos") >= 8 || s(fp, "melancholy") >= 8,
	},
	{
		key: "worlds",
		name: "Other worlds",
		line: "Fantasy realms and imagined futures.",
		hue: "#2dd4bf",
		rule: "Fantasy 7+ or futuristic 7+",
		test: (fp) => s(fp, "fantasy") >= 7 || s(fp, "futuristic") >= 7,
	},
	{
		key: "history",
		name: "History",
		line: "Real lives and past eras.",
		hue: "#d4a373",
		rule: "Biographical 6+ or historical 8+",
		test: (fp) => s(fp, "biographical") >= 6 || s(fp, "historical") >= 8,
	},
	{
		key: "growing",
		name: "Coming of age",
		line: "Growing up and finding your way.",
		hue: "#f5d0fe",
		rule: "Coming of age 8+",
		test: (fp) => s(fp, "coming_of_age") >= 8,
	},
]

export const MOOD: Record<MoodKey, MoodDef> = Object.fromEntries(MOODS.map((m) => [m.key, m])) as Record<MoodKey, MoodDef>
export const MAX_MOODS = 3

// The moods a title belongs to. A title without a title analysis (no fingerprint) belongs to none.
export function classify(fp: Fp | null | undefined, genres: string[] | null | undefined): MoodKey[] {
	if (!fp || Object.keys(fp).length < 10) return []
	return MOODS.filter((m) => m.test(fp, genres ?? [])).map((m) => m.key)
}

// Black or white text on a colour, by its luminance.
export function inkOn(hex: string) {
	const [r, g, b] = [1, 3, 5].map((j) => {
		const c = Number.parseInt(hex.slice(j, j + 2), 16) / 255
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.2 ? "#030712" : "#ffffff"
}
