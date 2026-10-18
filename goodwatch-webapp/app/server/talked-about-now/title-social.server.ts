// The "Talked about now" section of a title page (#558): the posts linked to the title, as the facades of
// ui/social-embed show them, and the title's Wikipedia lift when it is in the day's buzz top 20 (#555).
//
// The read is cached per title for a few minutes, and a "wrong title?" report resets that title's entry before it
// answers, so the reported post is gone from every later read (docs/adr/0006-reset-markers-for-the-data-cache.md).
// A surface that caches posts of its own (the start page's row) adds its reset to `afterReport`.
import type { SocialEmbedItem, SocialSource } from "~/ui/social-embed/target"
import type { TitleBuzz, TitleSocial } from "~/ui/talked-about-now/query"
import { cached, declareResettableCache, resetCacheConfirmed } from "~/utils/cache"
import { query } from "~/utils/crate"
import {
	type SocialMediaType,
	type SocialPostRow,
	type SocialStore,
	type SocialTitle,
	getSocialStore,
	isMissingTable,
} from "./social-store.server"
import { forgetTalkedAboutNow } from "./start-row.server"
import type { Env } from "./flags.server"

export type TitleMediaType = "movie" | "show"

export const EMPTY: TitleSocial = { items: [], buzz: null }

const TITLE_CACHE = { name: "talked-about-now-title-v1", ttlMinutes: 5, staleMinutes: 5 }
declareResettableCache(TITLE_CACHE)
const BUZZ_CACHE = { name: "talked-about-now-buzz-v1", ttlMinutes: 30, staleMinutes: 30 }

const LIMIT = 50

export const socialMediaType = (mediaType: TitleMediaType): SocialMediaType => (mediaType === "show" ? "tv" : "movie")

/** Lanes switched off without rematching, from SOCIAL_DISABLED_LANES (comma separated). */
export function disabledLanes(env: Env = process.env): string[] {
	return [...new Set((env.SOCIAL_DISABLED_LANES ?? "").split(/[\s,]+/).filter(Boolean))].sort()
}

/** Whether a development store is in use: its rows must never reach the shared cache. */
const developmentStore = (env: Env = process.env) =>
	env.NODE_ENV !== "production" && Boolean(env.SOCIAL_FIXTURE?.trim() || env.SOCIAL_REPORTS?.trim())

const SOURCES: Record<SocialPostRow["source"], SocialSource> = {
	youtube: "youtube",
	rss: "news",
	bluesky: "bluesky",
	mastodon: "mastodon",
}

const hostOf = (url: string) => {
	try {
		return new URL(url).hostname.replace(/^www\./, "")
	} catch {
		return ""
	}
}

/** A stored row as a facade's item. Rows whose text or address was purged (a deletion) are left out. */
export function toItem(row: SocialPostRow): SocialEmbedItem | null {
	const source = SOURCES[row.source]
	const text = row.text?.trim()
	if (!source || !text || !row.url) return null
	return {
		id: row.post_id,
		image: row.image ?? null,
		source,
		url: row.url,
		sourceId: row.source_id,
		author: row.author?.trim() || hostOf(row.url),
		publishedAt: row.published_at,
		text: text.length > 400 ? `${text.slice(0, 399)}…` : text,
	}
}

export async function readTitleItems(store: SocialStore, title: SocialTitle, lanes: readonly string[]): Promise<SocialEmbedItem[]> {
	const rows = await store.readTitle(title, { limit: LIMIT, disabledLanes: lanes })
	return rows.map(toItem).filter((item): item is SocialEmbedItem => item !== null)
}

type BuzzTop = Record<string, TitleBuzz>

/** The current buzz snapshot's top 20 by title key (`movie:<id>`, `tv:<id>`). Empty without a snapshot. */
export async function readBuzzTop(select: typeof query = query): Promise<BuzzTop> {
	try {
		const [row] = await select<{ day: string; payload: string }>(
			"SELECT day, payload FROM doc.buzz_snapshot WHERE snapshot_key = 'current'",
		)
		if (!row) return {}
		const payload = JSON.parse(row.payload) as {
			top20?: { title_key?: string; eligible?: boolean; score?: number; views?: number; day?: string }[]
		}
		const top: BuzzTop = {}
		for (const entry of payload.top20 ?? []) {
			if (!entry.title_key || !entry.eligible || !(Number(entry.score) > 0)) continue
			top[entry.title_key] = { lift: Number(entry.score), views: Number(entry.views), day: String(entry.day ?? row.day) }
		}
		return top
	} catch (error) {
		if (isMissingTable(error)) return {}
		throw error
	}
}

/** Everything the section shows for one title. Empty when nothing is linked: the section stays hidden. */
export async function getTitleSocial({
	mediaType,
	tmdbId,
}: {
	mediaType: TitleMediaType
	tmdbId: number
}): Promise<TitleSocial> {
	const title: SocialTitle = { mediaType: socialMediaType(mediaType), tmdbId }
	const lanes = disabledLanes()
	const development = developmentStore()
	const items = await cached({
		...TITLE_CACHE,
		ttlMinutes: development ? 0 : TITLE_CACHE.ttlMinutes,
		params: { mediaType: title.mediaType, tmdbId, lanes: lanes.join(",") },
		target: async () => ({ items: await readTitleItems(getSocialStore(), title, lanes) }),
	})
	if (!items.items.length) return EMPTY
	// The lift is context, not a reason to show the section: a failed read leaves it out.
	const buzzTop = await cached({ ...BUZZ_CACHE, params: {}, target: () => readBuzzTop() }).catch((error) => {
		console.error("Buzz snapshot read failed", error)
		return {} as BuzzTop
	})
	return { items: items.items as unknown as SocialEmbedItem[], buzz: buzzTop[`${title.mediaType}:${tmdbId}`] ?? null }
}

/** Resets of caches that hold a title's posts. The start page's row adds its own. */
export const afterReport: ((title: SocialTitle, postId: string) => Promise<void>)[] = [
	async (title) => {
		if (developmentStore()) return
		const confirmed = await resetCacheConfirmed({
			name: TITLE_CACHE.name,
			params: { mediaType: title.mediaType, tmdbId: title.tmdbId, lanes: disabledLanes().join(",") },
		})
		// An unconfirmed reset keeps retrying in this process, which reads around the cache meanwhile.
		if (!confirmed) console.warn(`Talked about now: cache reset for ${title.mediaType}:${title.tmdbId} not confirmed yet`)
	},
	// The start page's row (#557) keeps one answer for every visitor in this process: the next request reads again.
	async () => forgetTalkedAboutNow(),
]

export type ReportOutcome = { status: "hidden"; reportId: string } | { status: "unknown-link" }

/** Records a "wrong title?" report: the link must exist; the report is visible to the read before this returns. */
export async function reportWrongTitle(
	store: SocialStore,
	title: SocialTitle,
	postId: string,
	reason: string,
): Promise<ReportOutcome> {
	if (!(await store.linkExists(title, postId))) return { status: "unknown-link" }
	const { reportId } = await store.report(title, postId, reason)
	for (const reset of afterReport) {
		await reset(title, postId).catch((error) => console.error("Talked about now: cache reset failed", error))
	}
	return { status: "hidden", reportId }
}
