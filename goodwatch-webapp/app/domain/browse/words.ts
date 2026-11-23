// How places are said out loud. Pure: loader and browser.
import { type Kind, kindNoun } from "./address"
import type { PlaceRef } from "./types"

/** A genre as a plural noun a person would say; null falls back to "<genre> movies". */
const GENRE_PLURAL: Record<string, string> = {
	comedy: "comedies",
	drama: "dramas",
	thriller: "thrillers",
	western: "westerns",
	documentary: "documentaries",
	mystery: "mysteries",
	romance: "romances",
	musical: "musicals",
	soap: "soaps",
}
/** A genre as an adjective before "movies". */
const GENRE_ADJ: Record<string, string> = {
	animation: "animated",
	"science-fiction": "sci-fi",
	"sci-fi-fantasy": "sci-fi & fantasy",
	"action-adventure": "action & adventure",
	"war-politics": "war & politics",
	"tv-movie": "TV",
}

/**
 * Movies and shows together: the genres only one kind has. A blend with one of them holds that kind alone, so its
 * honest name is the shorter one: "Horror movies set in other worlds", not "Horror movies and shows set in other
 * worlds".
 */
const ONE_KIND_GENRE: Record<string, "movies" | "shows"> = {
	thriller: "movies",
	romance: "movies",
	horror: "movies",
	"tv-movie": "movies",
	history: "movies",
	music: "movies",
	reality: "shows",
	kids: "shows",
	soap: "shows",
	talk: "shows",
	news: "shows",
}
/** Movies and shows together: a genre that stands as a noun of its own ("Japanese animation"). */
const GENRE_NOUN: Record<string, string> = {
	animation: "animation",
	crime: "crime stories",
	"action-adventure": "action & adventure",
	"sci-fi-fantasy": "sci-fi & fantasy",
	"war-politics": "war & politics stories",
}

const DEMONYM: Record<string, string> = {
	US: "American",
	GB: "British",
	FR: "French",
	DE: "German",
	IT: "Italian",
	ES: "Spanish",
	JP: "Japanese",
	KR: "Korean",
	CN: "Chinese",
	HK: "Hong Kong",
	IN: "Indian",
	CA: "Canadian",
	AU: "Australian",
	MX: "Mexican",
	BR: "Brazilian",
	AR: "Argentine",
	SE: "Swedish",
	DK: "Danish",
	NO: "Norwegian",
	RU: "Russian",
	TR: "Turkish",
	IE: "Irish",
	BE: "Belgian",
	NL: "Dutch",
	PL: "Polish",
	TH: "Thai",
	TW: "Taiwanese",
	NZ: "New Zealand",
	AT: "Austrian",
	CH: "Swiss",
	FI: "Finnish",
	IR: "Iranian",
}
export const demonym = (code: string | undefined) => (code ? (DEMONYM[code] ?? null) : null)

/** Moods and themes whose name works as an adjective before the noun; the others go after it ("about …"). */
const MOOD_AFTER: Record<string, string> = {
	"growing-up": "about growing up",
}
const THEME_AFTER = (label: string) => `about ${label.toLowerCase()}`
const STYLE_ADJ: Record<string, string> = {
	animated: "animated",
	documentary: "documentary",
	spectacle: "big-spectacle",
	stylized: "stylized",
	music: "music-driven",
	"slow-burn": "slow-burn",
	"fast-paced": "fast-paced",
	talky: "talky",
	nonlinear: "nonlinear",
	graphic: "graphic",
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const list = (xs: string[]) =>
	xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`

/**
 * A blend the way a person would say it: "Cozy comedies", "Dark Korean thrillers", "90s action movies on Netflix".
 * `top` puts "Top" in front and "of all time" behind when nothing else dates it.
 */
export function blendName(
	kind: Kind,
	parts: PlaceRef[],
	opts: { top?: boolean; year?: number } = {},
) {
	let noun = kindNoun(kind)
	const by = (f: PlaceRef["family"]) => parts.filter((p) => p.family === f)
	if (kind === "all") {
		const held = new Set<string>(by("genre").map((g) => ONE_KIND_GENRE[g.slug] ?? "both"))
		if (held.size === 1 && !held.has("both")) noun = [...held][0] as string
	}
	const mixed = noun === kindNoun("all")
	// Before the noun: feelings joined by "and", then how it's made, then where it's from: "Dark and funny animated
	// Korean thrillers".
	const feel: string[] = []
	const made: string[] = []
	const from: string[] = []
	const after: string[] = []
	for (const m of by("mood")) {
		if (MOOD_AFTER[m.slug]) after.push(MOOD_AFTER[m.slug])
		else feel.push(m.label.toLowerCase())
	}
	for (const t of by("trait")) feel.push((t.adj ?? t.label).toLowerCase())
	for (const s of by("style")) made.push(STYLE_ADJ[s.slug] ?? s.label.toLowerCase())
	for (const c of by("country")) {
		const d = demonym(c.code)
		if (d) from.push(d)
		else after.push(`from ${c.label}`)
	}
	const before = [list(feel), made.join(" "), from.join("-")].filter(Boolean)
	const decades = by("decade")
	// "90s" reads better up front when a genre follows; otherwise it goes behind.
	const genres = by("genre")
	let head: string
	// "Comedies" covers both kinds; "comedy shows" is said for shows alone.
	if (genres.length === 1 && GENRE_PLURAL[genres[0].slug] && kind !== "show")
		head = GENRE_PLURAL[genres[0].slug]
	else if (genres.length === 1 && mixed && GENRE_NOUN[genres[0].slug])
		head = GENRE_NOUN[genres[0].slug]
	else if (genres.length)
		head = `${list(genres.map((g) => GENRE_ADJ[g.slug] ?? g.label.toLowerCase()))} ${noun}`
	else head = noun
	for (const t of by("theme")) after.push(THEME_AFTER(t.label))
	for (const t of by("trope")) after.push(t.say ?? `with ${t.label}`)
	for (const d of decades) after.push(`from the ${d.label}`)
	for (const s of by("service")) after.push(`on ${s.label}`)
	if (opts.year) after.push(`of ${opts.year}`)
	const core = [...before, head].join(" ")
	const tail = after.join(" ")
	let text = [core, tail].filter(Boolean).join(" ")
	if (opts.top) text = `top ${text}${!decades.length && !opts.year ? " of all time" : ""}`
	// Demonyms and services keep their capitals.
	return cap(text)
}

/** Intensity band names and one line each, filled with the trait's adjective. */
export const BAND_WORDS = {
	touch: {
		name: "A touch",
		blurb: (adj: string) => `A little ${adj}. It's in there, but it doesn't run the show.`,
	},
	plenty: {
		name: "Plenty",
		blurb: (adj: string) => `Properly ${adj}. You'll feel it the whole way through.`,
	},
	full: { name: "All the way", blurb: (adj: string) => `As ${adj} as it gets.` },
} as const

/** A trait as a comparative: how a neighbor differs. */
const COMPARATIVE: Record<string, string> = {
	bleakness: "darker",
	hopefulness: "more hopeful",
	wholesome: "warmer",
	adrenaline: "more thrilling",
	tension: "tenser",
	scare: "scarier",
	violence: "more violent",
	romance: "more romantic",
	eroticism: "steamier",
	wonder: "more wondrous",
	pathos: "more moving",
	melancholy: "sadder",
	uncanny: "eerier",
	nostalgia: "more nostalgic",
	situational_comedy: "funnier",
	wit_wordplay: "wittier",
	physical_comedy: "sillier",
	absurdist_humor: "more absurd",
	satire_parody: "more satirical",
	dark_humor: "more darkly funny",
	fantasy: "more fantastical",
	futuristic: "more futuristic",
	historical: "more historical",
	contemporary_realism: "more down-to-earth",
	crime: "more crime-driven",
	mystery: "more mysterious",
	warfare: "more about war",
	political: "more political",
	biographical: "truer to life",
	coming_of_age: "more about growing up",
	family_dynamics: "more about family",
	psychological: "more psychological",
	slow_burn: "slower",
	fast_pace: "faster",
	complexity: "more demanding",
	ambiguity: "more ambiguous",
	surrealism: "more surreal",
	eccentricity: "quirkier",
	philosophical: "deeper",
	spectacle: "bigger",
	visual_stylization: "more stylized",
	music_centrality: "more musical",
	camp_and_irony: "campier",
	grotesque: "more grotesque",
	social_commentary: "more pointed",
}
export const comparative = (key: string, adj: string) => COMPARATIVE[key] ?? `more ${adj}`
