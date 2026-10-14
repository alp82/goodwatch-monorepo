// "Talked about now" on the start page (#557): the titles whose Wikipedia reading rose most over their own usual,
// and what is said about them. The buzz score (#555) ranks the titles once a day (`doc.buzz_snapshot`, key
// `current`); social discovery (#556) links posts, videos and headlines to them (`doc.social_post`,
// `doc.social_title_link`). This module is the shape the row draws, and the rules that make it from those two reads.
// It is the same for every visitor.

export type SocialSource = "youtube" | "rss" | "bluesky" | "mastodon"

/** One thing said about a title, as stored by social discovery: ids, a link and a short text, nothing else. */
export type TalkedItem = {
	id: string
	source: SocialSource
	/** The post, the video's page or the article. */
	url: string
	/** A post's handle, a video's channel, an article's writer. */
	author: string
	/** An article's publication ("Deadline"); a video's or a post's is its author. */
	publisher: string
	/** ISO time it was published. */
	at: string
	/** A post's text, a video's title, an article's headline. */
	text: string
	/** The source's own id: a YouTube video's id, a Bluesky post's AT URI; what the facade's player loads. */
	sourceId: string | null
	/** A YouTube video's id. */
	video?: string
	/** Whether the text reads as English (`isEnglish`): the start page is in English, so these come first. */
	english: boolean
}

export type TalkedReasonKind =
	| "trailer"
	| "new_season"
	| "new_release"
	| "netflix_top10"

/** A dated hint of why a title may be read about. Context, not a claimed cause (buzz-score.md). */
export type TalkedReason = {
	kind: TalkedReasonKind
	/** ISO day. */
	day: string
	season?: number
}

export type TalkedTitle = {
	/** Optional live presentation; ranking and source-language social prose remain canonical. */
	canonical_title?: string
	presentation?: import("../utils/media-presentation").MediaPresentation
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
	year: number | null
	poster: string | null
	backdrop: string | null
	/** 1 is the most talked about. */
	rank: number
	/** Yesterday's views over the 28 days' mean before: "×9.7 its usual". */
	lift: number
	views: number
	usual: number
	/** Views per day, oldest first; the last is the row's `day`. */
	curve: number[]
	reason: TalkedReason | null
	/** Places up since the day before (down is negative), "new" for a title that wasn't in the top 20; null unknown. */
	move: number | "new" | null
	/** At most three, the video first: what the featured title shows, and the row's preview line. */
	items: TalkedItem[]
}

export type TalkedRow = {
	/** The scored day (ISO), the last of every curve. */
	day: string
	titles: TalkedTitle[]
}

/** The board's length: the prototype's eight, which fill the list beside the featured title on a desktop. */
export const BOARD_SIZE = 8
export const ITEMS_PER_TITLE = 3

// ---------------------------------------------------------------------------------------------------------
// The buzz snapshot
// ---------------------------------------------------------------------------------------------------------

/** A ranked title of the snapshot, before the catalog's fields and the social items are added. */
export type BuzzTitle = Omit<
	TalkedTitle,
	"year" | "backdrop" | "move" | "items"
> & { key: string; releaseDate: string | null }

const REASON_KINDS = new Set<string>([
	"trailer",
	"new_season",
	"new_release",
	"netflix_top10",
])

const num = (value: unknown) =>
	typeof value === "number" && Number.isFinite(value) ? value : null
const str = (value: unknown) =>
	typeof value === "string" && value ? value : null

/** The newest reason within the curve's days; null without one. */
export function reasonOf(
	reasons: unknown,
	firstDay: string,
	lastDay: string,
): TalkedReason | null {
	if (!Array.isArray(reasons)) return null
	let best: TalkedReason | null = null
	for (const raw of reasons) {
		const kind = str(raw?.kind)
		const day = str(raw?.event_day)?.slice(0, 10)
		if (!kind || !REASON_KINDS.has(kind) || !day) continue
		if (day < firstDay || day > lastDay) continue
		if (best && best.day >= day) continue
		const season = num(raw?.season_number)
		best = {
			kind: kind as TalkedReasonKind,
			day,
			...(season ? { season } : {}),
		}
	}
	return best
}

/**
 * The ranked titles of a snapshot's payload (schema version 1), most talked about first: the eligible ones of its
 * top 20 with a complete card. Null when the payload isn't one the row can read.
 */
export function parseSnapshot(
	payload: unknown,
): { day: string; titles: BuzzTitle[] } | null {
	const data = (
		typeof payload === "string" ? safeJson(payload) : payload
	) as Record<string, unknown> | null
	if (!data || data.schema_version !== 1 || !Array.isArray(data.top20))
		return null
	const day = str(data.day)
	if (!day) return null
	const titles: BuzzTitle[] = []
	for (const raw of data.top20 as Record<string, unknown>[]) {
		if (raw?.eligible !== true) continue
		const card = (raw.card ?? {}) as Record<string, unknown>
		const kind = card.kind
		const tmdbId = num(card.tmdb_id)
		const title = str(card.title)
		const lift = num(raw.score)
		const views = num(raw.views)
		const usual = num(raw.mean28)
		if ((kind !== "movie" && kind !== "tv") || !tmdbId || !title) continue
		if (lift === null || views === null || usual === null) continue
		const curve = Array.isArray(raw.curve)
			? (raw.curve as { day?: unknown; views?: unknown }[])
			: []
		const points = curve.flatMap((point) => {
			const value = num(point?.views)
			const at = str(point?.day)
			return value === null || !at ? [] : [{ day: at, views: value }]
		})
		if (points.length < 2) continue
		titles.push({
			key: `${kind}:${tmdbId}`,
			mediaType: kind === "tv" ? "show" : "movie",
			tmdbId,
			title,
			poster: str(card.poster_path),
			releaseDate: str(card.release_date),
			rank: 0,
			lift,
			views,
			usual,
			curve: points.map((point) => point.views),
			reason: reasonOf(raw.reasons, points[0].day, points.at(-1)?.day ?? day),
		})
	}
	titles.sort((a, b) => b.lift - a.lift || b.views - a.views)
	titles.forEach((title, i) => {
		title.rank = i + 1
	})
	return { day, titles }
}

/** The ranks of the day before's eligible titles, by `kind:tmdb_id`, for each title's move. */
export function ranksOf(payload: unknown): Map<string, number> | null {
	const parsed = parseSnapshot(payload)
	if (!parsed) return null
	return new Map(parsed.titles.map((title) => [title.key, title.rank]))
}

export function moveOf(
	key: string,
	rank: number,
	before: Map<string, number> | null,
): TalkedTitle["move"] {
	if (!before) return null
	const was = before.get(key)
	return was === undefined ? "new" : was - rank
}

/** The ISO day before an ISO day. */
export const dayBefore = (day: string) =>
	new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000)
		.toISOString()
		.slice(0, 10)

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text)
	} catch {
		return null
	}
}

// ---------------------------------------------------------------------------------------------------------
// The social items
// ---------------------------------------------------------------------------------------------------------

/** A row of the social read: a visible link of a title to a post (see server/talked-about-now/start-row.server.ts). */
export type SocialRow = {
	media_type: string
	media_tmdb_id: number
	post_id: string
	source: string
	source_id: string | null
	url: string | null
	author: string | null
	published_at: Date | number | string | null
	text: string | null
}

const SOURCES = new Set<string>(["youtube", "rss", "bluesky", "mastodon"])

const PUBLISHERS: Record<string, string> = {
	"deadline.com": "Deadline",
	"indiewire.com": "IndieWire",
	"hollywoodreporter.com": "The Hollywood Reporter",
	"variety.com": "Variety",
	"slashfilm.com": "/Film",
	"filmstarts.de": "Filmstarts",
	"moviepilot.de": "Moviepilot",
	"about.netflix.com": "Netflix",
	"epd-film.de": "epd Film",
	"film-rezensionen.de": "film-rezensionen.de",
	"denofgeek.com": "Den of Geek",
	"collider.com": "Collider",
	"screenrant.com": "Screen Rant",
}

const hostOf = (url: string) => {
	try {
		return new URL(url).hostname.replace(/^www\./, "")
	} catch {
		return ""
	}
}

/** An article's publication, from its address: the known feeds by name, any other by its host. */
export const publisherOf = (url: string) => {
	const host = hostOf(url)
	return PUBLISHERS[host] ?? host
}

const isoOf = (value: SocialRow["published_at"]) => {
	if (value === null) return null
	const time =
		value instanceof Date ? value.getTime() : new Date(value).getTime()
	return Number.isFinite(time) ? new Date(time).toISOString() : null
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/** A row as an item, or null when it lacks what a card needs (a deleted post has no url and no text). */
export function itemOf(row: SocialRow): TalkedItem | null {
	const at = isoOf(row.published_at)
	const text = row.text?.trim()
	if (!SOURCES.has(row.source) || !row.url || !text || !at) return null
	if (!/^https:\/\//.test(row.url)) return null
	const source = row.source as SocialSource
	const author = row.author?.trim() || hostOf(row.url)
	const video =
		source === "youtube" && row.source_id && YOUTUBE_ID.test(row.source_id)
			? row.source_id
			: undefined
	if (source === "youtube" && !video) return null
	return {
		id: row.post_id,
		source,
		url: row.url,
		author,
		publisher: source === "rss" ? publisherOf(row.url) : author,
		at,
		text: text.length > 400 ? `${text.slice(0, 399).trimEnd()}…` : text,
		sourceId: row.source_id || null,
		...(video ? { video } : {}),
		english: isEnglish(text, row.url),
	}
}

// Short words that are common in English and rare in the other languages the sources carry, and the other way round.
// Words both use (a, an, in, do, die as an English verb...) are in neither list where they would mislead.
const ENGLISH_WORDS = new Set(
	"the and of to is are was were on for with this that it its it's at from by be been has have had just but not you your i i'm my we our they their he she his her what who how why about after will can all new first more than so if out up into over now".split(
		" ",
	),
)
const OTHER_WORDS = new Set(
	"der die das und ist nicht mit auf für ein eine einen zu im dem von wie wann auch sich el la los las que y en para por una con del más le les une est et pour dans pas sur qui il di che per è uma não em os dos".split(
		" ",
	),
)
const NON_LATIN =
	/[\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/
const ACCENTS = /[ñãõçáíóúâêôàèìòùäöüß]/i

/**
 * Whether a piece reads as English, by its words: a guess, good enough to put English first. A headline without any
 * of the short words ("Bob Odenkirk Mourns ‘Breaking Bad’ Co-Star") counts as English unless it has accents; an
 * article from a German publication (a `.de` address) never does.
 */
export function isEnglish(text: string, url = ""): boolean {
	if (/\.de$/.test(hostOf(url))) return false
	if (NON_LATIN.test(text)) return false
	const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? []
	let english = 0
	let other = ACCENTS.test(text) ? 1 : 0
	for (const word of words) {
		if (ENGLISH_WORDS.has(word)) english++
		else if (OTHER_WORDS.has(word)) other++
	}
	return english > other || (english === 0 && other === 0)
}

/**
 * A title's best few pieces, from its visible rows newest first: the newest video (one: the official channels post
 * the same trailer more than once), then a voice (a Bluesky or Mastodon post), then a headline, then whatever is
 * newest. The video comes first, as the featured title shows it on top.
 */
export function pickItems(
	rows: SocialRow[],
	limit = ITEMS_PER_TITLE,
): TalkedItem[] {
	const items = rows.flatMap((row) => itemOf(row) ?? [])
	// The start page is in English: a piece in another language comes after every English one.
	const ordered = [
		...items.filter((item) => item.english),
		...items.filter((item) => !item.english),
	]
	const picked: TalkedItem[] = []
	const take = (item: TalkedItem | undefined) => {
		if (item && !picked.includes(item) && picked.length < limit)
			picked.push(item)
	}
	take(ordered.find((item) => item.source === "youtube"))
	take(
		ordered.find(
			(item) => item.source === "bluesky" || item.source === "mastodon",
		),
	)
	take(ordered.find((item) => item.source === "rss"))
	for (const item of ordered)
		if (item.source !== "youtube" || !picked.some((p) => p.video)) take(item)
	return picked.sort(
		(a, b) => Number(b.source === "youtube") - Number(a.source === "youtube"),
	)
}

/** The board row's one line: an English post, else an English headline, else a post or a headline in any language, else the video. */
export function previewOf(items: TalkedItem[]): TalkedItem | null {
	const voice = (item: TalkedItem) =>
		item.source === "bluesky" || item.source === "mastodon"
	const headline = (item: TalkedItem) => item.source === "rss"
	return (
		items.find((item) => voice(item) && item.english) ??
		items.find((item) => headline(item) && item.english) ??
		items.find(voice) ??
		items.find(headline) ??
		items[0] ??
		null
	)
}

// ---------------------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------------------

/** The reason as the chip says it, in two or three words. */
export function reasonLabel(
	reason: TalkedReason,
	mediaType: TalkedTitle["mediaType"],
): string {
	switch (reason.kind) {
		case "trailer":
			return "New trailer"
		case "new_season":
			return reason.season ? `Season ${reason.season}` : "New season"
		case "new_release":
			return mediaType === "movie" ? "Just released" : "Just premiered"
		case "netflix_top10":
			return "Netflix Top 10"
	}
}

/** "×9.7": how far above its usual a title was read. */
export const liftLabel = (lift: number) =>
	`×${lift >= 10 ? Math.round(lift) : lift.toFixed(1)}`

/** "55K", "1.2M": a count in a few characters. */
export function compact(count: number): string {
	if (count >= 1_000_000)
		return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
	if (count >= 10_000) return `${Math.round(count / 1000)}K`
	if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K`
	return String(Math.round(count))
}
