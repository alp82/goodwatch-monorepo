// The facts At a glance's Facts row shows, worked out from a title's details: critics against audiences, the box
// office, the running time against its genre (a show's time to watch it all), its reach, and the plain facts (release,
// genres, language, where it's made). Pure, so the panel (FactsPanel.tsx), its closed row's line and teaser, and find
// read the same facts. Nothing here is invented: a fact is left out when its data is.
import type {
	BaseDetails,
	MovieResult,
	ShowResult,
} from "~/server/types/details-types"
import { countriesWithOffers } from "~/ui/details/hero/countryOffers"
import { languageName } from "~/utils/display-names"
import { letterboxdScore } from "~/utils/letterboxd"

type Media = MovieResult | ShowResult

type Details = BaseDetails & {
	runtime?: number | null
	number_of_seasons?: number
	number_of_episodes?: number
	first_air_date?: string
	last_air_date?: string
	in_production?: boolean
	episode_runtime?: number[] | null
}
const detailsOf = (media: Media) => media.details as Details

// ---------------------------------------------------------------------------------------------------------- formats

/** "1.2 M", "803 K", "466". */
export function count(n: number) {
	if (n >= 1e6)
		return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "")} M`
	if (n >= 1e3) return `${Math.round(n / 1e3)} K`
	return String(n)
}

/** "$190 M", "$1.2 B", "$850 K". */
export function dollars(n: number) {
	if (n >= 1e9) return `$${(n / 1e9).toFixed(1).replace(/\.0$/, "")} B`
	if (n >= 1e6) return `$${Math.round(n / 1e6)} M`
	if (n >= 1e3) return `$${Math.round(n / 1e3)} K`
	return `$${n}`
}

/** "2 h 47 min", "50 min". */
export function minutesWords(m: number) {
	const h = Math.floor(m / 60)
	const r = Math.round(m % 60)
	return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`
}

const positive = (v: number | null | undefined): v is number =>
	typeof v === "number" && v > 0

// --------------------------------------------------------------------------------------------- critics vs audience

export type ScoreSide = "critics" | "audience"
export type ScoreSite = "imdb" | "letterboxd" | "rt" | "mc"

export interface ScoreRow {
	key: string
	site: ScoreSite
	side: ScoreSide
	/** "IMDb", "Rotten Tomatoes". */
	name: string
	/** "Tomatometer", "Users". */
	kind: string
	/** On the shared 0-100 axis. */
	value: number
	/** As the site shows it: "8.4", "92%", "4.4/5". */
	shown: string
	/** "3.8 M ratings", when the site's count is known. */
	votes: string | null
	url: string | null
}

/** Every score the title has, normalised to 0-100: critics first, then audiences, each highest first. */
export function scoreRows(media: Media): ScoreRow[] {
	const d = detailsOf(media)
	const rows: ScoreRow[] = []
	const add = (row: Omit<ScoreRow, "votes"> & { n?: number | null }) => {
		const { n, ...rest } = row
		rows.push({
			...rest,
			value: Math.round(rest.value),
			votes: positive(n) ? `${count(n)} ratings` : null,
		})
	}
	if (positive(d.rotten_tomatoes_tomato_score_original))
		add({
			key: "rt",
			site: "rt",
			side: "critics",
			name: "Rotten Tomatoes",
			kind: "Tomatometer",
			value: d.rotten_tomatoes_tomato_score_original,
			shown: `${Math.floor(d.rotten_tomatoes_tomato_score_original)}%`,
			url: d.rotten_tomatoes_url ?? null,
		})
	if (positive(d.metacritic_meta_score_original))
		add({
			key: "mc",
			site: "mc",
			side: "critics",
			name: "Metacritic",
			kind: "Metascore",
			value: d.metacritic_meta_score_original,
			shown: String(Math.floor(d.metacritic_meta_score_original)),
			url: d.metacritic_url ?? null,
		})
	if (positive(d.imdb_user_score_original))
		add({
			key: "imdb",
			site: "imdb",
			side: "audience",
			name: "IMDb",
			kind: "Users",
			value: d.imdb_user_score_original * 10,
			shown: d.imdb_user_score_original.toFixed(1),
			url: d.imdb_url ?? null,
		})
	const lb = letterboxdScore(media)
	if (lb)
		add({
			key: "lb",
			site: "letterboxd",
			side: "audience",
			name: "Letterboxd",
			kind: "Members",
			value: lb.stars * 20,
			shown: `${lb.stars.toFixed(1)}/5`,
			n: lb.count,
			url: lb.url,
		})
	if (positive(d.rotten_tomatoes_audience_score_original))
		add({
			key: "rtu",
			site: "rt",
			side: "audience",
			name: "Rotten Tomatoes",
			kind: "Audience score",
			value: d.rotten_tomatoes_audience_score_original,
			shown: `${Math.floor(d.rotten_tomatoes_audience_score_original)}%`,
			url: d.rotten_tomatoes_url ?? null,
		})
	if (positive(d.metacritic_user_score_original))
		add({
			key: "mcu",
			site: "mc",
			side: "audience",
			name: "Metacritic",
			kind: "User score",
			value: d.metacritic_user_score_original * 10,
			shown: d.metacritic_user_score_original.toFixed(1),
			url: d.metacritic_url ?? null,
		})
	const order = (r: ScoreRow) => (r.side === "critics" ? 0 : 1)
	return rows.sort((a, b) => order(a) - order(b) || b.value - a.value)
}

export interface Spread {
	rows: ScoreRow[]
	critics: number | null
	audience: number | null
	/** Audiences minus critics, when both sides have a score. */
	gap: number | null
	verdict: string
	/** The closed row's words: "Audiences +14", "Critics and audiences agree". */
	short: string | null
	/** GoodWatch's own score on the same axis, as the header ring shows it. */
	goodwatch: number | null
}

/** Critics and audiences this close (0-100) agree; this far apart is a real lean. */
const AGREE = 5
const LEAN = 10

export function spread(media: Media): Spread | null {
	const rows = scoreRows(media)
	if (!rows.length) return null
	const mean = (side: ScoreSide) => {
		const v = rows.filter((r) => r.side === side).map((r) => r.value)
		return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
	}
	const critics = mean("critics")
	const audience = mean("audience")
	const gap = critics != null && audience != null ? audience - critics : null
	let verdict: string
	let short: string | null = null
	if (gap == null)
		verdict =
			critics == null
				? "Only audience scores so far"
				: "Only critics' scores so far"
	else if (Math.abs(gap) < AGREE) {
		verdict = "Critics and audiences agree"
		short = verdict
	} else {
		const who = gap > 0 ? "Audiences" : "Critics"
		const other = gap > 0 ? "critics" : "audiences"
		const n = Math.abs(gap)
		verdict =
			n >= LEAN
				? `${who} like it more than ${other} (+${n})`
				: `${who} a little warmer than ${other} (+${n})`
		if (n >= LEAN) short = `${who} +${n} over ${other}`
	}
	const d = detailsOf(media)
	const gw = d.goodwatch_overall_score_normalized_percent
	return {
		rows,
		critics,
		audience,
		gap,
		verdict,
		short,
		goodwatch: positive(gw) ? Math.round(gw) : null,
	}
}

// -------------------------------------------------------------------------------------------------------- box office

export interface BoxOffice {
	budget: number
	gross: number
	/** Gross over budget. */
	multiple: number
	/** "3.8× its budget", "52% of its budget back". */
	headline: string
	line: string
}

export function boxOffice(media: Media): BoxOffice | null {
	if (media.mediaType !== "movie") return null
	const { budget, revenue } = media.details
	// TMDB has tiny placeholder values ($1, $100) on some titles.
	if (!budget || !revenue || budget < 1e5 || revenue < 1e5) return null
	const multiple = revenue / budget
	const headline =
		multiple >= 1
			? `${multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1)}×`
			: `${Math.round(multiple * 100)}%`
	const line =
		multiple >= 1
			? `Worldwide it earned ${dollars(revenue - budget)} more than it cost.`
			: `Worldwide it made back ${dollars(revenue)} of the ${dollars(budget)} it cost.`
	return { budget, gross: revenue, multiple, headline, line }
}

// ------------------------------------------------------------------------------------------------ runtime vs genre

/**
 * Movie runtimes by genre: the 10th, 25th, 50th, 75th and 90th percentile in minutes. Measured 2026-11-04 from Crate's
 * movie table, movies of 40 minutes or more with 5,000 IMDb votes or more (Crate's percentile, rounded).
 */
const GENRE_RUNTIME: Record<string, [number, number, number, number, number]> =
	{
		Drama: [90, 98, 109, 125, 144],
		Comedy: [85, 91, 100, 111, 128],
		Thriller: [88, 94, 104, 118, 135],
		Action: [88, 96, 108, 127, 150],
		Romance: [90, 97, 107, 122, 144],
		Crime: [89, 95, 106, 120, 139],
		Horror: [83, 88, 95, 103, 115],
		Adventure: [85, 93, 103, 120, 138],
		"Science Fiction": [82, 90, 99, 112, 129],
		Mystery: [86, 93, 102, 115, 130],
		Fantasy: [83, 91, 100, 114, 131],
		Family: [78, 88, 95, 106, 122],
		History: [97, 108, 122, 138, 165],
		Animation: [72, 80, 89, 99, 109],
		War: [93, 103, 118, 135, 158],
		Documentary: [80, 89, 96, 107, 121],
		Music: [86, 94, 106, 120, 140],
		Western: [89, 97, 107, 122, 138],
	}
const GENRE_PLURAL: Record<string, string> = {
	Drama: "dramas",
	Comedy: "comedies",
	Thriller: "thrillers",
	Action: "action movies",
	Romance: "romances",
	Crime: "crime movies",
	Horror: "horror movies",
	Adventure: "adventure movies",
	"Science Fiction": "sci-fi movies",
	Mystery: "mysteries",
	Fantasy: "fantasy movies",
	Family: "family movies",
	History: "history movies",
	Animation: "animated movies",
	War: "war movies",
	Documentary: "documentaries",
	Music: "music movies",
	Western: "westerns",
}

export interface RuntimeVsGenre {
	runtime: number
	genre: string
	/** "sci-fi movies" */
	genrePlural: string
	quantiles: [number, number, number, number, number]
	/** "Longer than 9 in 10 sci-fi movies", "A typical length for a drama". */
	verdict: string
	/** "+68 min" against the median, or null within 5 minutes of it. */
	delta: string | null
	/** "Long for sci-fi" when outside the middle half; for the closed row. */
	short: string | null
}

export function runtimeVsGenre(media: Media): RuntimeVsGenre | null {
	if (media.mediaType !== "movie") return null
	const runtime = media.details.runtime
	if (!runtime || runtime < 40) return null
	const genre = (media.details.genres ?? []).find((g) => GENRE_RUNTIME[g])
	if (!genre) return null
	const q = GENRE_RUNTIME[genre]
	const plural = GENRE_PLURAL[genre]
	const [p10, p25, p50, p75, p90] = q
	const verdict =
		runtime > p90
			? `Longer than 9 in 10 ${plural}`
			: runtime > p75
				? `Longer than most ${plural}`
				: runtime < p10
					? `Shorter than 9 in 10 ${plural}`
					: runtime < p25
						? `Shorter than most ${plural}`
						: `A typical length for ${plural}`
	const diff = runtime - p50
	const short =
		runtime > p75
			? `Long for ${plural}`
			: runtime < p25
				? `Short for ${plural}`
				: null
	return {
		runtime,
		genre,
		genrePlural: plural,
		quantiles: q,
		verdict,
		delta:
			Math.abs(diff) >= 5
				? `${diff > 0 ? "+" : "−"}${Math.abs(diff)} min`
				: null,
		short,
	}
}

// ------------------------------------------------------------------------------------------------- a show's time

export interface BingeTime {
	minutes: number
	episodes: number
	/** Average episode length in minutes. */
	perEpisode: number
	/** "An episode a night: about 9 weeks." */
	pace: string
}

/** A show's time to watch every episode, from its episode length and count. */
export function bingeTime(media: Media): BingeTime | null {
	if (media.mediaType !== "show") return null
	const d = detailsOf(media)
	const per = d.episode_runtime?.[0]
	if (!per || !d.number_of_episodes) return null
	const episodes = d.number_of_episodes
	const pace =
		episodes <= 10
			? `An episode a night: done in ${episodes} nights.`
			: episodes < 60
				? `An episode a night: about ${Math.round(episodes / 7)} weeks.`
				: `An episode a night: about ${Math.round(episodes / 30.4)} months.`
	return { minutes: per * episodes, episodes, perEpisode: per, pace }
}

// ------------------------------------------------------------------------------------------------------- reach

export interface Reach {
	/** Countries with a streaming offer, most services first. */
	streaming: string[]
	/** Countries with any offer (stream, rent or buy). */
	anywhere: number
}

export function reach(media: Media): Reach | null {
	const streaming = countriesWithOffers(media, "flatrate").map((c) => c.code)
	const anywhere = media.details.streaming_country_codes?.length ?? 0
	if (!streaming.length && !anywhere) return null
	return { streaming, anywhere }
}

// --------------------------------------------------------------------------------------------- the plain facts

/** A movie's release or a show's first air date. */
export interface Released {
	/** "Released" for a movie, "First aired" for a show. */
	label: string
	year: number
	/** "March 1, 2024". */
	date: string
	/** "2 years ago", "Coming up"; a show: "Still running", "Ended 2025". */
	ago: string | null
}

export function released(media: Media, now = new Date()): Released | null {
	const d = detailsOf(media) as Details & { release_date?: string | null }
	const iso = media.mediaType === "movie" ? d.release_date : d.first_air_date
	if (!iso) return null
	const at = new Date(iso)
	if (Number.isNaN(at.getTime())) return null
	const year = at.getUTCFullYear()
	const date = at.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	})
	const years = now.getUTCFullYear() - year
	if (media.mediaType === "show") {
		const last = d.last_air_date
			? new Date(d.last_air_date).getUTCFullYear()
			: null
		const ago = d.in_production
			? "Still running"
			: last
				? `Ended ${last}`
				: null
		return { label: "First aired", year, date, ago }
	}
	const ago =
		at > now
			? "Coming up"
			: years <= 0
				? "This year"
				: years === 1
					? "Last year"
					: `${years} years ago`
	return { label: "Released", year, date, ago }
}

export const genresOf = (media: Media) =>
	(media.details.genres ?? []).filter(Boolean)

export interface Languages {
	original: string
	others: string[]
}

export function languages(media: Media): Languages | null {
	const original = media.details.original_language_code
	if (!original || original === "xx") return null
	const others = (media.details.spoken_language_codes ?? []).filter(
		(c) => c !== original && c !== "xx",
	)
	return { original, others }
}

export const madeIn = (media: Media) =>
	media.details.production_country_codes ?? []

/** The Facts row's closed line: "2024 · Science Fiction, Adventure · English" (a show: "2022–now · …"). */
export function factsLine(media: Media): string | null {
	const d = detailsOf(media)
	const year = (iso?: string | null) =>
		iso ? new Date(iso).getUTCFullYear() : null
	let when: string | null = null
	if (media.mediaType === "movie")
		when = released(media)?.year.toString() ?? null
	else {
		const from = year(d.first_air_date)
		const to = d.in_production ? "now" : year(d.last_air_date)
		when = from
			? to && String(to) !== String(from)
				? `${from}–${to}`
				: String(from)
			: null
	}
	const g = genresOf(media)
	const l = languages(media)
	const parts = [
		when,
		g.length ? g.slice(0, 2).join(", ") : null,
		l ? languageName(l.original) : null,
	].filter(Boolean)
	return parts.length ? parts.join(" · ") : null
}

// ------------------------------------------------------------------------------------------------------ teaser

/** One short line of the most striking numbers, for the Facts row's teaser; null when there's nothing to say. */
export function numbersTeaser(media: Media): string | null {
	const parts: string[] = []
	const b = boxOffice(media)
	if (b)
		parts.push(
			b.multiple >= 1
				? `${b.headline} its budget`
				: `${b.headline} of its budget back`,
		)
	const time = bingeTime(media)
	if (time) parts.push(`${Math.round(time.minutes / 60)} h to binge`)
	const s = spread(media)
	if (s?.short) parts.push(s.short)
	const r = runtimeVsGenre(media)
	if (r?.short) parts.push(r.short)
	const rr = reach(media)
	if (rr && !parts.length && rr.streaming.length)
		parts.push(`Streams in ${rr.streaming.length} countries`)
	return parts.length ? parts.slice(0, 3).join(" · ") : null
}
