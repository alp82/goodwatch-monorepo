// PROTOTYPE (start page lab): search and picks over the fixtures, because the lab runs offline. The real site would
// run /api/combined-search; here a typed query lands on the captured prompt or mood that shares the most words with
// it. Variants show `answeredAs` only if they want to make the stand-in visible.
import type { LabCard, LabData } from "./types"

export type FixtureAnswer = {
	q: string
	/** The captured prompt or mood that answers it. */
	answeredAs: string
	kind: "prompt" | "mood"
	/** Reading chips as captured (prompts only), in the Discover ReadAsChips shape when present. */
	reading: unknown
	titles: LabCard[]
}

const words = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9 ]/g, " ")
		.split(/\s+/)
		.filter((w) => w.length > 2 && !STOP.has(w))

const STOP = new Set(["the", "and", "for", "with", "that", "something", "movie", "movies", "show", "shows", "like", "want", "watch", "some", "but", "about", "from"])

// Words that point at a mood even when they aren't the mood's own label.
const MOOD_WORDS: Record<string, string[]> = {
	funny: ["funny", "comedy", "laugh", "hilarious", "silly", "witty"],
	feelgood: ["feel", "good", "cozy", "cosy", "comfort", "warm", "uplifting", "wholesome", "happy"],
	romance: ["romance", "romantic", "love", "date", "partner", "couple"],
	action: ["action", "explosive", "fight", "chase", "adrenaline", "heist"],
	scary: ["scary", "horror", "creepy", "spooky", "halloween", "terrifying"],
	crime: ["crime", "detective", "murder", "mystery", "mob", "police", "noir"],
	mind: ["mind", "bending", "twist", "puzzle", "trippy", "cerebral", "weird"],
	heavy: ["heavy", "sad", "cry", "tearjerker", "intense", "dark", "bleak"],
	worlds: ["space", "fantasy", "sci", "scifi", "alien", "magic", "dragons", "future", "worlds", "epic"],
	history: ["history", "historical", "period", "war", "true", "biopic"],
	growing: ["growing", "teen", "coming", "age", "school", "kids", "family"],
}

export function fixtureSearch(data: LabData, q: string): FixtureAnswer | null {
	const qw = words(q)
	if (!qw.length) return null
	let best: FixtureAnswer | null = null
	let bestScore = 0
	for (const p of data.guest.prompts) {
		const pw = new Set(words(p.q))
		const score = qw.filter((w) => pw.has(w)).length * 2
		if (score > bestScore) {
			bestScore = score
			best = { q, answeredAs: p.q, kind: "prompt", reading: p.reading, titles: p.titles }
		}
	}
	for (const m of data.guest.moods) {
		const mw = new Set([...(MOOD_WORDS[m.key] ?? []), ...words(m.label)])
		const score = qw.filter((w) => mw.has(w)).length * 1.5
		if (score > bestScore) {
			bestScore = score
			best = { q, answeredAs: m.label, kind: "mood", reading: null, titles: m.titles }
		}
	}
	if (best) return best
	// Nothing in common: the first prompt, so the page never shows an empty search.
	const p = data.guest.prompts[0]
	return p ? { q, answeredAs: p.q, kind: "prompt", reading: p.reading, titles: p.titles } : null
}

export function moodAnswer(data: LabData, key: string): FixtureAnswer | null {
	const m = data.guest.moods.find((x) => x.key === key)
	return m ? { q: m.label, answeredAs: m.label, kind: "mood", reading: null, titles: m.titles } : null
}

/**
 * Round 14: the search bar's presets as short phrases (2-4 words). A preset fills the field with its short phrase and
 * searches that phrase; the lab answers it with the captured prompt it stands for.
 */
export const PRESET_SHORT: Record<string, string> = {
	"a cozy mystery for a rainy Sunday": "Cozy mystery",
	"something like Severance but funnier": "Severance, but funny",
	"a mind-bending sci-fi movie under two hours": "Mind-bending sci-fi",
	"a feel-good show to binge with my partner": "Feel-good binge",
	"a dark thriller with a twist ending": "Twisty thriller",
	"an animated movie adults will love": "Adult animation",
	"a mind-blowing space adventure": "Space adventure",
}

export function promptAnswer(data: LabData, q: string): FixtureAnswer | null {
	const p = data.guest.prompts.find((x) => x.q === q || PRESET_SHORT[x.q] === q)
	return p ? { q: p.q, answeredAs: p.q, kind: "prompt", reading: p.reading, titles: p.titles } : null
}

/**
 * Instant picks from titles a visitor tapped: the neighbors the picks share, strongest first (how many picks lead
 * there, then score), without the picks themselves. Stands in for /api/guest-recommendations.
 */
export function picksFrom(data: LabData, tapped: LabCard[], limit = 12): LabCard[] {
	const tappedKeys = new Set(tapped.map((t) => t.key))
	const tally = new Map<number, { card: LabCard; n: number; rank: number }>()
	for (const t of tapped) {
		const list = data.guest.similar[String(t.key)] ?? []
		list.forEach((card, i) => {
			if (tappedKeys.has(card.key)) return
			const e = tally.get(card.key)
			if (e) {
				e.n += 1
				e.rank = Math.min(e.rank, i)
			} else tally.set(card.key, { card, n: 1, rank: i })
		})
	}
	return [...tally.values()]
		.sort(
			(a, b) =>
				b.n - a.n ||
				a.rank - b.rank ||
				(b.card.goodwatch_overall_score_normalized_percent ?? 0) - (a.card.goodwatch_overall_score_normalized_percent ?? 0),
		)
		.slice(0, limit)
		.map((e) => e.card)
}

/**
 * How long a typed search takes on the site: a paid reading of the query, then ranking (about a second). Mood chips
 * and example prompts are the free path: their answers could ship with the page, so they answer at once.
 */
export const TYPED_SEARCH_MS = 900
/** When the "Read as" line would arrive, before the titles. */
export const TYPED_READING_MS = 380

/** A typed search with the site's timing. Resolves null when aborted or nothing matches. */
export function typedSearch(
	data: LabData,
	q: string,
	{ signal, onReading }: { signal?: AbortSignal; onReading?: (reading: unknown) => void } = {},
): Promise<FixtureAnswer | null> {
	const answer = fixtureSearch(data, q)
	return new Promise((resolve) => {
		const t1 = setTimeout(() => onReading?.(answer?.reading ?? null), TYPED_READING_MS)
		const t2 = setTimeout(() => resolve(answer), TYPED_SEARCH_MS)
		signal?.addEventListener("abort", () => {
			clearTimeout(t1)
			clearTimeout(t2)
			resolve(null)
		})
	})
}
