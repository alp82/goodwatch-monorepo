// The title page's small words about a title: its years, length, age rating, the title bar's meta line, the site
// scores, and the facts list. Pure, so the server and the browser say the same.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { money } from "~/ui/details/titleQuestions"
import type * as F from "~/ui/fingerprint/fingerprintText"
import { goodwatchScoreDisplay, hasGoodwatchScore } from "~/utils/ratings"

type Media = MovieResult | ShowResult
/** Movie and show fields, read without narrowing. */
type AnyDetails = Media["details"] &
	Partial<MovieResult["details"]> &
	Partial<ShowResult["details"]>

const plural = (count: number, one: string, many = `${one}s`) =>
	`${count} ${count === 1 ? one : many}`

/** The fingerprint words' input, or null for a title without a fingerprint. */
export function fingerprintInput(media: Media): F.TitleInput | null {
	if (!media.fingerprint) return null
	return {
		title: media.details.title,
		titleLang: media.details.presentation?.title.language,
		mediaType: media.mediaType,
		year: media.details.release_year,
		genres: media.details.genres,
		fingerprint: media.fingerprint,
	}
}

/** The country's age rating ("12", "TV-MA"), else the US one, else null. */
export function ageRating(media: Media, country: string): string | null {
	const all = media.details.age_certifications || []
	const hit =
		all.find((c) => c.startsWith(`${country}_`)) ||
		all.find((c) => c.startsWith("US_"))
	return hit ? hit.split("_")[1] || null : null
}

/** "12+" for a number, the rating itself otherwise. */
export const ageWord = (age: string | null) =>
	age ? (/^\d+$/.test(age) ? `${age}+` : age) : null

/** "2 h 46 min" for a movie, "2 seasons · 19 episodes" for a show. */
export function lengthWords(media: Media): string | null {
	if (media.mediaType === "movie") {
		const m = media.details.runtime
		if (!m) return null
		const h = Math.floor(m / 60)
		return h ? `${h} h ${m % 60} min` : `${m} min`
	}
	const { number_of_seasons: s, number_of_episodes: e } = media.details
	if (!s || !e) return null
	return `${plural(s, "season")} · ${plural(e, "episode")}`
}

const yearOf = (date: string | number | null | undefined) =>
	date ? new Date(date).getUTCFullYear() : null

/** "2022 – now" for a running show, "2008 – 2013" for an ended one, the year for a movie. */
export function yearsWords(media: Media): string | null {
	const d = media.details as AnyDetails
	if (media.mediaType === "movie")
		return d.release_year ? String(d.release_year) : null
	const first = yearOf(d.first_air_date) ?? d.release_year
	const last = yearOf(d.last_air_date)
	if (!first) return null
	if (d.in_production) return `${first} – now`
	return last && last !== first ? `${first} – ${last}` : String(first)
}

/** The opener's meta line as separate items ("2024", "Movie", "2 h 46 min"), without the age rating. */
export function metaItems(media: Media): string[] {
	const d = media.details as AnyDetails
	const out: (string | null)[] = [
		yearsWords(media),
		media.mediaType === "movie" ? "Movie" : "Show",
	]
	if (media.mediaType === "movie") out.push(lengthWords(media))
	else {
		if (d.number_of_seasons) out.push(plural(d.number_of_seasons, "season"))
		if (d.number_of_episodes) out.push(plural(d.number_of_episodes, "episode"))
	}
	return out.filter((x): x is string => Boolean(x))
}

/**
 * The title bar's meta line in decreasing length: each version drops or shortens one more thing, so the bar can show
 * the longest that fits and never cuts a word. The type goes first, then long words, then the age, then episodes.
 */
export function fitMeta(media: Media, country: string): string[] {
	const d = media.details as AnyDetails
	const years = yearsWords(media)
	const firstYear = years?.split(" ")[0] ?? null
	const age = ageWord(ageRating(media, country))
	const join = (xs: (string | null | undefined)[]) =>
		xs.filter(Boolean).join(" · ")
	if (media.mediaType === "movie") {
		const m = d.runtime ?? 0
		const h = Math.floor(m / 60)
		const long = m ? (h ? `${h} h ${m % 60} min` : `${m} min`) : null
		const short = m ? (h ? `${h}h ${m % 60}m` : `${m}m`) : null
		return [
			...new Set([
				join([years, "Movie", long, age]),
				join([years, long, age]),
				join([years, short, age]),
				join([years, short]),
				join([years]),
			]),
		]
	}
	const s = d.number_of_seasons
	const e = d.number_of_episodes
	const seasons = s ? plural(s, "season") : null
	const episodes = e ? plural(e, "episode") : null
	const eps = e ? `${e} ep${e === 1 ? "" : "s"}` : null
	return [
		...new Set([
			join([years, "Show", seasons, episodes, age]),
			join([years, seasons, episodes, age]),
			join([years, seasons, eps, age]),
			join([firstYear, seasons, eps, age]),
			join([years, seasons, eps]),
			join([firstYear, seasons, eps]),
			join([firstYear, seasons]),
			join([firstYear]),
		]),
	]
}

export interface ScoreLine {
	label: string
	value: string
}

/** The site scores as words, in the score chips' order. */
export function scoreLines(media: Media): ScoreLine[] {
	const d = media.details
	const out: ScoreLine[] = []
	if (hasGoodwatchScore(d.goodwatch_overall_score_normalized_percent))
		out.push({
			label: "GoodWatch",
			value: String(
				goodwatchScoreDisplay(d.goodwatch_overall_score_normalized_percent),
			),
		})
	if (d.imdb_user_score_original)
		out.push({ label: "IMDb", value: d.imdb_user_score_original.toFixed(1) })
	if (d.metacritic_meta_score_original)
		out.push({
			label: "Metacritic",
			value: String(Math.round(d.metacritic_meta_score_original)),
		})
	if (d.rotten_tomatoes_tomato_score_original)
		out.push({
			label: "Rotten Tomatoes",
			value: `${Math.round(d.rotten_tomatoes_tomato_score_original)}%`,
		})
	return out
}

const displayNames = (type: "region" | "language") =>
	typeof Intl !== "undefined" && "DisplayNames" in Intl
		? new Intl.DisplayNames(["en"], { type })
		: null
const regionNames = displayNames("region")
const languageNames = displayNames("language")
const named = (names: Intl.DisplayNames | null, code: string) => {
	try {
		return names?.of(code) ?? code
	} catch {
		return code
	}
}
export const countryName = (code: string) => named(regionNames, code)
export const languageName = (code: string) => named(languageNames, code)

const dateWords = (date: number | string | null | undefined) =>
	date
		? new Date(date).toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
				timeZone: "UTC",
			})
		: null

/** A short list: the first `max`, then "+N". */
export const shortList = (items: string[], max: number) =>
	items.length <= max
		? items.join(", ")
		: `${items.slice(0, max).join(", ")} +${items.length - max}`

export interface Fact {
	label: string
	value: string
}

/** Every plain fact the page has about the title, in reading order. Empty facts are left out. */
export function titleFacts(media: Media, country: string): Fact[] {
	const d = media.details as AnyDetails
	const facts: { label: string; value: string | null | undefined }[] = []
	const add = (label: string, value: string | null | undefined) =>
		facts.push({ label, value })
	if (media.mediaType === "movie") {
		add("Released", dateWords(d.release_date))
		add("Runtime", d.runtime ? lengthWords(media) : null)
	} else {
		add("First aired", dateWords(d.first_air_date))
		add(
			d.in_production ? "Latest episode" : "Last aired",
			dateWords(d.last_air_date),
		)
		add("Status", d.in_production ? "Still running" : "Ended")
		add("Length", lengthWords(media))
	}
	add("Age rating", ageWord(ageRating(media, country)))
	add("Content", d.content_advisories?.join(", "))
	add("Genres", d.genres?.join(", "))
	add(
		"Original language",
		d.original_language_code ? languageName(d.original_language_code) : null,
	)
	const spoken = (d.spoken_language_codes || []).filter(
		(c) => c !== d.original_language_code,
	)
	add("Also spoken", spoken.map(languageName).join(", "))
	add("Made in", d.production_country_codes?.map(countryName).join(", "))
	add("Budget", d.budget ? money(d.budget) : null)
	add("Box office", d.revenue ? money(d.revenue) : null)
	add(
		"Available in",
		d.streaming_country_codes?.length
			? plural(d.streaming_country_codes.length, "country", "countries")
			: null,
	)
	add("Keywords", d.keywords?.join(", "))
	return facts.filter((f): f is Fact => Boolean(f.value))
}

/** The trope names the page has (the first dozen) and how many the title has in all. */
export function tropeNames(media: Media): { names: string[]; total: number } {
	const { tropes = [], tropes_count } = media.details as {
		tropes?: (string | { name: string })[] | null
		tropes_count?: number
	}
	const names = (tropes ?? []).map((t) => (typeof t === "string" ? t : t.name))
	return { names, total: Math.max(tropes_count ?? 0, names.length) }
}
