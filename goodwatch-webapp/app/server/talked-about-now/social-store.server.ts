// Reads the posts linked to a title and writes "wrong title?" reports, over the tables of the social discovery build
// (#556, docs/implementation/talked-about-now/social.md): doc.social_post, doc.social_title_link,
// doc.social_content_quality and doc.social_link_report. The read is that ticket's reference query (`Store.read_title`),
// including its content-quality gate; the report is its reference write (`Store.report`). Report rows are the only thing
// the webapp writes.
//
// Until discovery has run, the tables are missing or empty: the read then returns no rows and the section stays
// hidden. Locally, SOCIAL_FIXTURE names a JSON file of the same rows (see fixtureSocialStore), so the page can be
// built and driven without touching the production tables.
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { execute, query } from "~/utils/crate"
import type { Env } from "./flags.server"

/** Social tables name shows "tv", as TMDB does; the webapp says "show". */
export type SocialMediaType = "movie" | "tv"
export type SocialPostSource = "youtube" | "rss" | "bluesky" | "mastodon"

export interface SocialTitle {
	mediaType: SocialMediaType
	tmdbId: number
}

/** One visible post of a title, newest first. Times are ISO strings in UTC. */
export interface SocialPostRow {
	post_id: string
	source: SocialPostSource
	source_id: string | null
	url: string
	author: string | null
	published_at: string
	text: string | null
	lane: string
}

export interface ReadOptions {
	/** 1 to 100. */
	limit: number
	/** Matcher lanes switched off (SOCIAL_DISABLED_LANES). */
	disabledLanes: readonly string[]
}

export interface SocialStore {
	readTitle(title: SocialTitle, options: ReadOptions): Promise<SocialPostRow[]>
	/** Whether the post is linked to the title at all, visible or not. */
	linkExists(title: SocialTitle, postId: string): Promise<boolean>
	/** Records the report and makes it visible to the read before returning. Retries reuse the same report. */
	report(title: SocialTitle, postId: string, reason: string): Promise<{ reportId: string }>
}

export const POST_ID = /^[a-f0-9]{64}$/

/**
 * The content-quality verdicts a read accepts (social.md, "Content quality before publication"): a link is shown only
 * when its post has a `pass` of this version for its current content hash. `quality.py`'s VERSION; a new version is
 * re-screened before its rows can appear, so this changes with it.
 */
export const CONTENT_QUALITY_VERSION = "content-quality-1"

/**
 * The read rule every read of links copies: an inner join to the post's passing verdict for its current content. A
 * post without one (not screened yet, rejected, screened by an older version, or changed since) isn't shown.
 */
export const contentQualityJoin = (schema: string) =>
	`JOIN ${schema}.social_content_quality q ON q.post_id = p.post_id AND q.content_hash = p.content_hash
    AND q.version = '${CONTENT_QUALITY_VERSION}' AND q.status = 'pass'`
export const MAX_REASON = 500

/** The report's id and idempotency key: SHA256 of `media_type:tmdb_id:post_id`, as #556's store computes it. */
export function reportId({ mediaType, tmdbId }: SocialTitle, postId: string): string {
	return createHash("sha256").update(`${mediaType}:${tmdbId}:${postId}`).digest("hex")
}

/** Crate's answer for a table or schema that doesn't exist (yet). */
export function isMissingTable(error: unknown): boolean {
	const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown }
	return code === 4041 || code === 4045 || (typeof message === "string" && /^(RelationUnknown|SchemaUnknown)/.test(message))
}

const iso = (value: unknown): string => new Date(value instanceof Date ? value.getTime() : (value as number | string)).toISOString()

/** The read: visible links of one title, one per duplicate group (the newest), newest first. */
export function readTitleSql(schema: string, disabledLanes: readonly string[]): string {
	const lanes = disabledLanes.length ? ` AND l.lane NOT IN (${disabledLanes.map(() => "?").join(", ")})` : ""
	return `SELECT post_id, source, source_id, url, author, published_at, text, lane FROM (
  SELECT p.post_id, p.source, p.source_id, p.url, p.author, p.published_at, p.text, l.lane,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(l.duplicate_group, l.post_id) ORDER BY p.published_at DESC, p.post_id DESC) AS duplicate_rank
  FROM ${schema}.social_title_link l JOIN ${schema}.social_post p ON p.post_id = l.post_id
  ${contentQualityJoin(schema)}
  LEFT JOIN ${schema}.social_link_report r ON r.media_type = l.media_type AND r.media_tmdb_id = l.media_tmdb_id
    AND r.post_id = l.post_id AND r.status IN ('open', 'confirmed')
  WHERE l.media_type = ? AND l.media_tmdb_id = ? AND l.hidden_at IS NULL AND p.deleted_at IS NULL
    AND p.published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND l.content_hash = p.content_hash AND r.report_id IS NULL${lanes}
) visible WHERE duplicate_rank = 1 ORDER BY published_at DESC, post_id DESC LIMIT ?`
}

type Select = <T extends {}>(sql: string, params: (string | number)[]) => Promise<T[]>
type Execute = (sql: string, params?: (string | number)[]) => Promise<unknown>

/**
 * The production store. `schema` is "doc"; a scratch schema lets the queries run against copies of the tables.
 * A read of missing tables is empty; every other failure is thrown.
 */
export function crateSocialStore({
	schema = "doc",
	select = query as Select,
	run = execute as Execute,
	now = () => new Date(),
}: { schema?: string; select?: Select; run?: Execute; now?: () => Date } = {}): SocialStore {
	if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`Invalid schema ${schema}`)
	return {
		async readTitle(title, { limit, disabledLanes }) {
			try {
				const rows = await select<Record<string, unknown>>(readTitleSql(schema, disabledLanes), [
					title.mediaType,
					title.tmdbId,
					...disabledLanes,
					Math.min(Math.max(Math.trunc(limit), 1), 100),
				])
				return rows.map((row) => ({
					post_id: String(row.post_id),
					source: row.source as SocialPostSource,
					source_id: (row.source_id as string | null) ?? null,
					url: String(row.url ?? ""),
					author: (row.author as string | null) ?? null,
					published_at: iso(row.published_at),
					text: (row.text as string | null) ?? null,
					lane: String(row.lane ?? ""),
				}))
			} catch (error) {
				if (isMissingTable(error)) return []
				throw error
			}
		},
		async linkExists(title, postId) {
			try {
				const rows = await select<{ post_id: string }>(
					`SELECT post_id FROM ${schema}.social_title_link WHERE media_type = ? AND media_tmdb_id = ? AND post_id = ? LIMIT 1`,
					[title.mediaType, title.tmdbId, postId],
				)
				return rows.length > 0
			} catch (error) {
				if (isMissingTable(error)) return false
				throw error
			}
		},
		async report(title, postId, reason) {
			const id = reportId(title, postId)
			// A new report reopens a dismissed one; the first report's time stays.
			await run(
				`INSERT INTO ${schema}.social_link_report (report_id, media_type, media_tmdb_id, post_id, reason, status, created_at)
VALUES (?, ?, ?, ?, ?, 'open', ?) ON CONFLICT (report_id) DO UPDATE SET status = 'open', reason = excluded.reason`,
				[id, title.mediaType, title.tmdbId, postId, reason.slice(0, MAX_REASON), now().toISOString()],
			)
			// The read sees the report only after a refresh; nothing is acknowledged before that.
			await run(`REFRESH TABLE ${schema}.social_link_report`)
			return { reportId: id }
		},
	}
}

// --- Fixture store: the same rows from a JSON file, the same filters in memory ---

export interface FixturePost {
	post_id: string
	source: SocialPostSource
	source_id?: string | null
	url: string
	author?: string | null
	published_at: string
	text?: string | null
	content_hash?: string | null
	deleted_at?: string | null
}

export interface FixtureLink {
	media_type: SocialMediaType
	media_tmdb_id: number
	post_id: string
	lane: string
	duplicate_group?: string | null
	content_hash?: string | null
	hidden_at?: string | null
}

export interface FixtureReport {
	report_id: string
	media_type: SocialMediaType
	media_tmdb_id: number
	post_id: string
	reason: string
	status: "open" | "confirmed" | "dismissed"
	created_at: string
}

/** A row of doc.social_content_quality. */
export interface FixtureQuality {
	post_id: string
	content_hash?: string | null
	version: string
	status: "pass" | "reject"
}

export interface SocialFixture {
	/** What the fixture is and where it came from. */
	note?: string
	/** Times are shifted so that the newest post is this many hours old when the store loads. Off when absent. */
	shiftToHoursAgo?: number
	posts: FixturePost[]
	links: FixtureLink[]
	/** The posts' content-quality verdicts. A post without a passing one is never shown, as in the Crate read. */
	quality?: FixtureQuality[]
	reports?: FixtureReport[]
}

/**
 * The fixture as a store. Reports are kept in memory for the life of the process; nothing is written anywhere.
 * The filters are the read query's: no passing content-quality verdict for the post's content, deleted, hidden, out of
 * the 30 days, changed content, reported, disabled lane, and one post per duplicate group.
 */
export function fixtureSocialStore(fixture: SocialFixture, now: () => Date = () => new Date()): SocialStore {
	let shift = 0
	if (fixture.shiftToHoursAgo !== undefined && fixture.posts.length) {
		const newest = Math.max(...fixture.posts.map((post) => Date.parse(post.published_at)))
		shift = now().getTime() - fixture.shiftToHoursAgo * 3_600_000 - newest
	}
	const posts = new Map(fixture.posts.map((post) => [post.post_id, { ...post, published_at: new Date(Date.parse(post.published_at) + shift).toISOString() }]))
	const reports = new Map((fixture.reports ?? []).map((report) => [report.report_id, { ...report }]))
	const passed = (post: FixturePost) =>
		(fixture.quality ?? []).some(
			(verdict) =>
				verdict.post_id === post.post_id &&
				verdict.status === "pass" &&
				verdict.version === CONTENT_QUALITY_VERSION &&
				(verdict.content_hash ?? null) === (post.content_hash ?? null),
		)
	const linked = (title: SocialTitle) =>
		fixture.links.filter((link) => link.media_type === title.mediaType && link.media_tmdb_id === title.tmdbId)
	return {
		async readTitle(title, { limit, disabledLanes }) {
			const since = now().getTime() - 30 * 86_400_000
			const reported = new Set(
				[...reports.values()]
					.filter((report) => report.status !== "dismissed")
					.filter((report) => report.media_type === title.mediaType && report.media_tmdb_id === title.tmdbId)
					.map((report) => report.post_id),
			)
			const visible = linked(title)
				.flatMap((link) => {
					const post = posts.get(link.post_id)
					return post ? [{ link, post }] : []
				})
				.filter(({ link, post }) => {
					if (!passed(post)) return false
					if (post.deleted_at || link.hidden_at) return false
					if (Date.parse(post.published_at) < since) return false
					if ((link.content_hash ?? null) !== (post.content_hash ?? null)) return false
					return !reported.has(link.post_id) && !disabledLanes.includes(link.lane)
				})
				.sort((a, b) => b.post.published_at.localeCompare(a.post.published_at) || b.link.post_id.localeCompare(a.link.post_id))
			const groups = new Set<string>()
			const rows: SocialPostRow[] = []
			for (const { link, post } of visible) {
				const group = link.duplicate_group ?? link.post_id
				if (groups.has(group)) continue
				groups.add(group)
				rows.push({
					post_id: post.post_id,
					source: post.source,
					source_id: post.source_id ?? null,
					url: post.url,
					author: post.author ?? null,
					published_at: post.published_at,
					text: post.text ?? null,
					lane: link.lane,
				})
			}
			return rows.slice(0, Math.min(Math.max(Math.trunc(limit), 1), 100))
		},
		async linkExists(title, postId) {
			return linked(title).some((link) => link.post_id === postId)
		},
		async report(title, postId, reason) {
			const id = reportId(title, postId)
			const existing = reports.get(id)
			reports.set(id, {
				report_id: id,
				media_type: title.mediaType,
				media_tmdb_id: title.tmdbId,
				post_id: postId,
				reason: reason.slice(0, MAX_REASON),
				status: "open",
				created_at: existing?.created_at ?? now().toISOString(),
			})
			return { reportId: id }
		},
	}
}

/**
 * Keeps reports in this process and hides them from the reads, and passes everything else to `store`. For a dev
 * server that reads the production tables and must not write to them.
 */
export function withMemoryReports(store: SocialStore): SocialStore {
	const reported = new Set<string>()
	const key = (title: SocialTitle, postId: string) => `${title.mediaType}:${title.tmdbId}:${postId}`
	return {
		async readTitle(title, options) {
			const rows = await store.readTitle(title, options)
			return rows.filter((row) => !reported.has(key(title, row.post_id)))
		},
		linkExists: (title, postId) => store.linkExists(title, postId),
		async report(title, postId) {
			reported.add(key(title, postId))
			return { reportId: reportId(title, postId) }
		},
	}
}

let fixtureStore: { path: string; store: SocialStore } | null = null
let memoryReports: SocialStore | null = null
let warnedDevelopment = false

/**
 * The store the app uses: Crate. Two settings for development only, ignored in production:
 * - SOCIAL_FIXTURE=<path of a JSON file>: the rows come from that file (see SocialFixture).
 * - SOCIAL_REPORTS=memory: reports stay in the process instead of going to doc.social_link_report.
 */
export function getSocialStore(env: Env = process.env): SocialStore {
	const path = env.SOCIAL_FIXTURE?.trim()
	const memory = env.SOCIAL_REPORTS?.trim() === "memory"
	if (env.NODE_ENV === "production") {
		if ((path || memory) && !warnedDevelopment) console.warn("SOCIAL_FIXTURE and SOCIAL_REPORTS are for development only. Using Crate.")
		warnedDevelopment = true
		return crateSocialStore()
	}
	if (path) {
		if (fixtureStore?.path !== path) {
			fixtureStore = { path, store: fixtureSocialStore(JSON.parse(readFileSync(path, "utf8")) as SocialFixture) }
		}
		return fixtureStore.store
	}
	if (memory) {
		memoryReports ??= withMemoryReports(crateSocialStore())
		return memoryReports
	}
	return crateSocialStore()
}
