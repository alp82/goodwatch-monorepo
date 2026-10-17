// What the poster cards show for one tool result. Pure, so Node tests run it and the widget bundles it.
// Everything here comes from a tool result, which the widget treats as untrusted: a title link must lead to
// GoodWatch, every image must come from TMDB's image host, and a provider link must be http(s), or the field
// is left out.

export interface WatchOffer {
	/** "Watch on Netflix" for a direct provider link, "Where to watch" for the site's TMDB fallback. */
	label: string
	url: string
	logo: string | null
}

export interface PosterCard {
	name: string
	year: number | null
	kind: "Movie" | "Show"
	url: string
	poster: string | null
	/** The w342 file for screens with a pixel ratio of 2 and above. */
	poster2x: string | null
	backdrop: string | null
	/** The w1280 file for screens with a pixel ratio of 2 and above. */
	backdrop2x: string | null
	/** 50 to 99, or null without a GoodWatch taste match. */
	match: number | null
	/** GoodWatch score, 0 to 100. */
	score: number | null
	runtime: number | null
	tagline: string | null
}

export interface PosterView {
	/** "pick" is Watch next's single card; "grid" is a banner for the first title and a row of posters. */
	layout: "pick" | "grid" | "message"
	/** The line above the first title, such as "Next episode · S3 E7" or "Best match on your Wishlist". */
	eyebrow: string
	/** The episode name after the eyebrow; narrow cards leave it out. */
	eyebrowDetail: string | null
	cards: PosterCard[]
	watch: WatchOffer | null
	pageUrl: string | null
	message: string | null
}

export const TMDB_IMAGE_ORIGIN = "https://image.tmdb.org"
const IMAGE_PATH =
	/^\/t\/p\/(w45|w92|w154|w185|w300|w342|w500|w780|w1280)\/[A-Za-z0-9_-]{1,80}\.(?:jpg|jpeg|png|webp|svg)$/
// The statuses a successful tool answer can carry; any other status string is an error answer.
const OK_STATUSES = new Set([
	"not_started",
	"watching",
	"on_hold",
	"dropped",
	"seen",
])
const MAX_CARDS = 60
const SORTS: Record<string, string> = {
	match: "Best match",
	added: "Last added",
	waiting: "Waiting longest",
	last: "Last watched",
	score: "Your top score",
	title: "First by title",
	runtime: "Longest",
}
const REASONS: Record<string, string> = {
	startShow: "Start this show",
	landed: "New on your services",
	suggestion: "A pick for you",
	notOnServices: "Closest on your Wishlist",
}

const record = (value: unknown): Record<string, unknown> | null =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null
const text = (value: unknown, max = 200): string | null =>
	typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null
const int = (value: unknown, min: number, max: number): number | null =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value >= min &&
	value <= max
		? value
		: null

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

/** A TMDB image file, or null. `sizes` limits the size steps. */
export function safeImageUrl(
	value: unknown,
	sizes?: readonly string[],
): string | null {
	if (typeof value !== "string") return null
	try {
		const url = new URL(value)
		const match = IMAGE_PATH.exec(url.pathname)
		return url.origin === TMDB_IMAGE_ORIGIN &&
			!url.search &&
			!url.hash &&
			match &&
			(!sizes || sizes.includes(match[1]))
			? url.href
			: null
	} catch {
		return null
	}
}

/** A poster file, or null. */
export const safePosterUrl = (value: unknown) =>
	safeImageUrl(value, ["w92", "w154", "w185", "w342", "w500"])

/** A provider's link: any http(s) address. The host asks before it opens one. */
export function safeExternalUrl(value: unknown): string | null {
	if (typeof value !== "string") return null
	try {
		const url = new URL(value)
		return ["https:", "http:"].includes(url.protocol) && !url.username
			? url.href
			: null
	} catch {
		return null
	}
}

const resized = (url: string | null, from: string, to: string) =>
	url?.includes(`/${from}/`) ? url.replace(`/${from}/`, `/${to}/`) : null

function card(value: unknown, origin: string): PosterCard | null {
	const row = record(value)
	// Titles only: a people search (get_person without an ID) lists people, which have no poster card.
	if (!row || typeof row.id !== "string" || !/^(movie|show):\d+$/.test(row.id))
		return null
	const name = text(row.name)
	const url = safePageUrl(row.url, origin)
	if (!name || !url) return null
	const poster = safePosterUrl(row.poster_url)
	const backdrop = safeImageUrl(row.backdrop_url, ["w300", "w780", "w1280"])
	return {
		name,
		year: int(row.year, 1800, 2200),
		kind:
			typeof row.id === "string" && row.id.startsWith("show:")
				? "Show"
				: "Movie",
		url,
		poster,
		poster2x: resized(poster, "w185", "w342"),
		backdrop,
		backdrop2x: resized(backdrop, "w780", "w1280"),
		match: int(row.match, 0, 100),
		score: int(row.goodwatch_score, 0, 100),
		runtime: int(row.runtime_minutes, 1, 2000),
		tagline: text(row.tagline, 160),
	}
}

function watchOffer(title: Record<string, unknown> | null): WatchOffer | null {
	const offers = record(title?.availability)?.offers
	if (!Array.isArray(offers)) return null
	const usable = offers
		.map(record)
		.filter((offer): offer is Record<string, unknown> =>
			Boolean(offer && safeExternalUrl(offer.url)),
		)
	const offer =
		usable.find((item) => item.link_kind === "provider") ?? usable[0]
	if (!offer) return null
	const name = text(offer.name, 40)
	return {
		label:
			offer.link_kind === "provider" && name
				? `Watch on ${name}`
				: "Where to watch",
		url: safeExternalUrl(offer.url) as string,
		logo: safeImageUrl(offer.logo_url, ["w45", "w92", "w154"]),
	}
}

/**
 * The view for a tool result's structuredContent. `origin` is the GoodWatch site, such as https://goodwatch.app.
 * `args` are the tool call's arguments, when the host sent them: they name the library filter and search query.
 */
export function posterView(
	structured: unknown,
	origin: string,
	args: Record<string, unknown> = {},
): PosterView {
	const data = record(structured) ?? {}
	const pageUrl = safePageUrl(data.page_url, origin)
	const base = {
		eyebrowDetail: null,
		cards: [] as PosterCard[],
		watch: null,
		pageUrl,
	}
	const status = text(data.status)
	if (status && !OK_STATUSES.has(status))
		return {
			...base,
			layout: "message",
			eyebrow: "GoodWatch",
			message: text(data.message, 300) ?? "GoodWatch could not answer this.",
		}
	if ("pick" in data) {
		const pick = record(data.pick)
		const title = record(pick?.title)
		const one = card(title, origin)
		if (!pick || !one)
			return {
				...base,
				layout: "message",
				eyebrow: "Watch next",
				message: "There is nothing to pick right now.",
			}
		const episode = record(pick.episode)
		const code = text(episode?.code, 20)
		return {
			...base,
			layout: "pick",
			eyebrow: code
				? `Next episode · ${code}`
				: (REASONS[String(pick.reason)] ?? "Watch next"),
			eyebrowDetail: code ? text(episode?.name, 120) : null,
			cards: [{ ...one, match: one.match ?? int(pick.match, 0, 100) }],
			watch: watchOffer(title),
			message: null,
		}
	}
	const items = Array.isArray(data.items) ? data.items : []
	const cards = items
		.slice(0, MAX_CARDS)
		.map((item) => card(item, origin))
		.filter((item): item is PosterCard => item !== null)
	const query = text(args.query, 60)
	const source = text(record(data.source)?.name, 80)
	const person = text(record(data.person)?.name, 80)
	const list = text(data.name, 80)
	const eyebrow = source
		? `More like ${source}`
		: person
			? `From ${person}’s titles`
			: "list_id" in data
				? list
					? `On your list “${list}”`
					: "On your list"
				: "sort" in data
					? `${SORTS[String(data.sort)] ?? "First"} ${args.filter === "want_to_see" ? "on your Wishlist" : "in My library"}`
					: "sort_used" in data
						? "Top pick in Discover"
						: query
							? `Top result for “${query}”`
							: "Top result"
	const people =
		!cards.length && items.some((item) => record(item)?.person_id !== undefined)
	return {
		...base,
		layout: cards.length ? "grid" : "message",
		eyebrow: cards.length ? eyebrow : people ? "People" : eyebrow,
		cards,
		message: cards.length
			? null
			: people
				? "Ask for one of these people to see their titles here."
				: "No titles to show.",
	}
}
