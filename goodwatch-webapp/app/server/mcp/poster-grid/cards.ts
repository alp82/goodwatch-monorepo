// What the poster grid shows for one tool result. Pure, so Node tests run it and the widget bundles it.
// Everything here comes from a tool result, which the widget treats as untrusted: a link must lead to
// GoodWatch and a poster must come from TMDB's image host, or the field is left out.

export interface PosterCard {
	name: string
	year: number | null
	url: string
	poster: string | null
	/** The w342 file for screens with a pixel ratio of 2 and above. */
	poster2x: string | null
	/** 50 to 99, or null without a GoodWatch taste match. */
	match: number | null
	matchLabel: string | null
	/** Watch next only: "S2 E3 · Name". */
	episode: string | null
}

export interface PosterView {
	heading: string
	cards: PosterCard[]
	/** A single pick (Watch next) gets a wide card. */
	pick: boolean
	pageUrl: string | null
	/** Shown instead of cards: an error, or why there is nothing to show. */
	message: string | null
}

export const TMDB_IMAGE_ORIGIN = "https://image.tmdb.org"
const POSTER_PATH =
	/^\/t\/p\/w(?:92|154|185|342|500)\/[A-Za-z0-9_-]{1,80}\.(?:jpg|jpeg|png|webp)$/
// The statuses a successful tool answer can carry; any other status string is an error answer.
const OK_STATUSES = new Set([
	"not_started",
	"watching",
	"on_hold",
	"dropped",
	"seen",
])
const MAX_CARDS = 60

const record = (value: unknown): Record<string, unknown> | null =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null
const text = (value: unknown, max = 200): string | null =>
	typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null

/** A GoodWatch page on the given origin, or null. */
export function safePageUrl(value: unknown, origin: string): string | null {
	if (typeof value !== "string") return null
	try {
		const url = new URL(value)
		return url.origin === origin && url.protocol === "https:" ? url.href : null
	} catch {
		return null
	}
}

/** A TMDB poster file, or null. */
export function safePosterUrl(value: unknown): string | null {
	if (typeof value !== "string") return null
	try {
		const url = new URL(value)
		return url.origin === TMDB_IMAGE_ORIGIN &&
			!url.search &&
			!url.hash &&
			POSTER_PATH.test(url.pathname)
			? url.href
			: null
	} catch {
		return null
	}
}

function card(
	value: unknown,
	origin: string,
	extra?: Record<string, unknown> | null,
): PosterCard | null {
	const row = record(value)
	if (!row) return null
	const name = text(row.name)
	const url = safePageUrl(row.url, origin)
	if (!name || !url) return null
	const poster = safePosterUrl(row.poster_url)
	const rawMatch = row.match ?? extra?.match
	const match =
		typeof rawMatch === "number" &&
		Number.isInteger(rawMatch) &&
		rawMatch >= 0 &&
		rawMatch <= 100
			? rawMatch
			: null
	const episode = record(extra?.episode)
	const code = text(episode?.code, 20)
	const episodeName = text(episode?.name, 120)
	return {
		name,
		year:
			typeof row.year === "number" && Number.isInteger(row.year)
				? row.year
				: null,
		url,
		poster,
		poster2x: poster?.includes("/w185/")
			? poster.replace("/w185/", "/w342/")
			: null,
		match,
		matchLabel:
			match === null
				? null
				: (text(row.match_label, 40) ?? `${match}% taste match`),
		episode: code ? (episodeName ? `${code} · ${episodeName}` : code) : null,
	}
}

/** The view for a tool result's structuredContent. `origin` is the GoodWatch site, such as https://goodwatch.app. */
export function posterView(structured: unknown, origin: string): PosterView {
	const data = record(structured) ?? {}
	const pageUrl = safePageUrl(data.page_url, origin)
	const isPick = "pick" in data
	const heading = isPick
		? "Watch next"
		: "ranked" in data
			? "Search results"
			: "sort" in data
				? "My library"
				: "GoodWatch"
	const status = text(data.status)
	if (status && !OK_STATUSES.has(status))
		return {
			heading,
			cards: [],
			pick: false,
			pageUrl,
			message: text(data.message, 300) ?? "GoodWatch could not answer this.",
		}
	if (isPick) {
		const pick = record(data.pick)
		const one = pick ? card(pick.title, origin, pick) : null
		return {
			heading,
			cards: one ? [one] : [],
			pick: true,
			pageUrl,
			message: one ? null : "There is nothing to pick right now.",
		}
	}
	const items = Array.isArray(data.items) ? data.items : []
	const cards = items
		.slice(0, MAX_CARDS)
		.map((item) => card(item, origin))
		.filter((item): item is PosterCard => item !== null)
	return {
		heading,
		cards,
		pick: false,
		pageUrl,
		message: cards.length ? null : "No titles to show.",
	}
}
