// PROTOTYPE (start page lab, round 2): member a + b's candidates for tonight and their ranking, from the fixture.
//
// Candidates: tonight's pick (get_tonight), the shows with a next episode (Continue + Pick up), the Wishlist (movies,
// and shows not started yet), then For you (movies and shows). Each title once, in that order of sources.
//
// How the ranking works (kept simple on purpose, every term is visible in `rank`):
//   base     = taste match (0-100, 70 when unknown) + GoodWatch score / 4 (70 when unknown)
//   source   = tonight's pick +30, a show you're watching +12, on your Wishlist +6, For you 0
//   time     = "Under 30 min": runtime <= 30 +40, longer -40, unknown -10
//              "About an hour" (b): runtime 40-75 +40, unknown 0, else -30
//              "Movie night": a movie of 80+ min +40, a show -40
//   kind     = "Keep watching": a show you're watching +60, anything else -20; "Something new": the reverse (-60)
//   mood (b) = the title's mood (a small hand table below; the fixture has no genres) +25 when it fits, -25 when not
//   type     = "Show" / "Movie" is a filter, not a score: the other kind leaves the queue
// Runtime is the movie's length, or the next episode's (a show's episode length when there's no next episode).
// The queue is the top 15 after ranking.
import { useMemo } from "react"
import { type LabCard, useLab } from "../../lab/types"
import { type ShowCard, episodeCode, episodeName, useMember } from "../member/shared"

export type Source = "tonight" | "continue" | "wishlist" | "forYou"
export type Mood = "light" | "gripping"

export type Candidate = {
	card: LabCard
	source: Source
	runtime: number | null
	/** "S2 E1" and the episode's name, for shows with a next episode. */
	episode: string | null
	episodeName: string | null
	/** The image behind the card: the title's backdrop, or null (the card then uses the poster). */
	backdrop: string | null
	/** Where to watch, when the fixture knows (only tonight's pick). */
	service: { name: string; logo: string | null } | null
	mood: Mood | null
}

export type Time = "u30" | "hour" | "night"
export type Kind = "keep" | "new"
export type Type = "show" | "movie"
export type Ask = { time?: Time; kind?: Kind; type?: Type; mood?: Mood }

// The fixture has no genres or moods, so the prototype tags its own titles by hand. A real build reads the title's
// genres and vibes (the Discover moods) instead.
const LIGHT = new Set(
	[
		"The Apothecary Diaries", "Star Trek: Lower Decks", "The Marvelous Mrs. Maisel", "Doctor Who", "Elling", "Michael",
		"Tadpole and the Whale", "Steven Universe", "The Owl House", "LOL: Last One Laughing", "Upload", "TIGER & BUNNY",
		"I'm a Cyborg, But That's OK", "Guardians of the Galaxy Vol. 3", "Superman", "Batman: The Animated Series",
		"Cowboy Bebop", "The Only Living Pickpocket in New York", "The Grand Budapest Hotel", "Spider-Man: Beyond the Spider-Verse",
		"The Twilight Zone", "Inside No. 9", "Monogatari",
	].map((t) => t.toLowerCase()),
)

const moodOf = (card: LabCard): Mood => (LIGHT.has(card.title.toLowerCase()) ? "light" : "gripping")

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" ? (v as Record<string, unknown>) : null)

function nextRuntime(next: unknown): number | null {
	const r = obj(next)?.runtime
	return typeof r === "number" && r > 0 ? r : null
}

/** Every candidate, each title once, before ranking. */
export function useCandidates(): Candidate[] {
	const { data } = useLab()
	const m = useMember()
	return useMemo(() => {
		const raw = data.member
		const backdrops = new Map<number, string>()
		for (const c of [...(raw?.tonight ?? []), ...(raw?.forYou ?? []), ...(raw?.forYouShows ?? []), ...(raw?.wishlistMovies ?? [])])
			if (c.backdrop_path) backdrops.set(c.key, c.backdrop_path)
		const toStart = (raw?.shows ?? [])
			.filter((s) => s.name.toLowerCase().replace(/[^a-z]/g, "").startsWith("wanttosee"))
			.flatMap((s) => s.titles)

		const out: Candidate[] = []
		const seen = new Set<number>()
		const add = (card: LabCard | undefined, source: Source, extra: Partial<Candidate> = {}) => {
			if (!card || seen.has(card.key) || !card.poster_path) return
			seen.add(card.key)
			const next = (card as ShowCard).next
			out.push({
				card,
				source,
				runtime: nextRuntime(next) ?? (card.runtime && card.runtime > 0 ? card.runtime : null),
				episode: episodeCode(next),
				episodeName: episodeName(next),
				backdrop: card.backdrop_path ?? backdrops.get(card.key) ?? null,
				service: null,
				mood: moodOf(card),
				...extra,
			})
		}
		const t = m.tonight
		if (t) {
			const fromShows = m.continueShows.find((s) => s.key === t.card.key)
			// The tonight card has the backdrop and score; the show list has the next episode and its runtime.
			const card = fromShows ? ({ ...fromShows, ...t.card, next: fromShows.next } as LabCard) : t.card
			add(card, "tonight", { service: t.service })
		}
		for (const c of m.continueShows) add(c, "continue")
		// Wishlist: movies and shows taken in turns, so neither kind hides the other.
		const wl = Math.max(m.movies.length, toStart.length)
		for (let i = 0; i < wl; i++) {
			add(m.movies[i], "wishlist")
			add(toStart[i], "wishlist")
		}
		const fy = Math.max(m.forYou.length, m.forYouShows.length)
		for (let i = 0; i < fy; i++) {
			add(m.forYou[i], "forYou")
			add(m.forYouShows[i], "forYou")
		}
		return out
	}, [data, m.tonight, m.continueShows, m.movies, m.forYou, m.forYouShows])
}

const watching = (c: Candidate) => c.source === "tonight" || c.source === "continue"

/** The score a candidate gets for the current answers. See the comment at the top. */
export function rank(c: Candidate, ask: Ask): number {
	const match = c.card.match ?? 70
	const score = c.card.goodwatch_overall_score_normalized_percent ?? 70
	let s = match + score / 4
	s += { tonight: 30, continue: 12, wishlist: 6, forYou: 0 }[c.source]
	const rt = c.runtime
	if (ask.time === "u30") s += rt == null ? -10 : rt <= 30 ? 40 : -40
	if (ask.time === "hour") s += rt == null ? 0 : rt >= 40 && rt <= 75 ? 40 : -30
	if (ask.time === "night") s += c.card.media_type === "movie" && (rt ?? 0) >= 80 ? 40 : c.card.media_type === "show" ? -40 : 0
	if (ask.kind === "keep") s += watching(c) ? 60 : -20
	if (ask.kind === "new") s += watching(c) ? -60 : 0
	if (ask.mood && c.mood) s += c.mood === ask.mood ? 25 : -25
	return s
}

export const QUEUE_SIZE = 15

/** The ranked queue for these answers: filtered by type, sorted by `rank`, the top 15. */
export function ranked(all: Candidate[], ask: Ask, size = QUEUE_SIZE): Candidate[] {
	return all
		.filter((c) => !ask.type || c.card.media_type === ask.type)
		.map((c, i) => ({ c, s: rank(c, ask), i }))
		.sort((a, b) => b.s - a.s || a.i - b.i)
		.slice(0, size)
		.map((x) => x.c)
}

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" })

/** The one-line reason under a candidate's title. */
export function reasonOf(c: Candidate): string {
	const match = c.card.match ? `${c.card.match}% match` : null
	if (c.source === "tonight" || c.source === "continue") return c.episode ? `Next: ${c.episode}` : "Keep watching"
	if (c.source === "wishlist") {
		const added = (c.card as LabCard & { added_at?: string }).added_at
		return added ? `On your Wishlist since ${DATE.format(new Date(added))}` : ["On your Wishlist", match].filter(Boolean).join(" · ")
	}
	return match ?? "For you"
}

/** Why a candidate fits the answers, for b's pick: short facts, best first. */
export function fitsOf(c: Candidate, ask: Ask): string[] {
	const out: string[] = [reasonOf(c)]
	const rt = c.runtime
	if (ask.time === "u30" && rt != null && rt <= 30) out.push(`${rt} min`)
	else if (ask.time === "hour" && rt != null && rt >= 40 && rt <= 75) out.push(`${rt} min, about an hour`)
	else if (ask.time === "night" && c.card.media_type === "movie" && rt) out.push(`${fmtRuntime(rt)} movie`)
	if (ask.mood && c.mood === ask.mood) out.push(ask.mood === "light" ? "Light" : "Gripping")
	if (c.card.match && !out[0].includes("match")) out.push(`${c.card.match}% match`)
	return [...new Set(out)].slice(0, 3)
}

export const fmtRuntime = (m: number | null) => (m == null ? null : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`)

/** The facts line: Show/Movie · year · runtime. */
export function factsOf(c: Candidate): string {
	return [c.card.media_type === "show" ? "Show" : "Movie", c.card.release_year, c.runtime ? (c.card.media_type === "show" && c.episode ? `${c.runtime} min episode` : fmtRuntime(c.runtime)) : null]
		.filter(Boolean)
		.join(" · ")
}
