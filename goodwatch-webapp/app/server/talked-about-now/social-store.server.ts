// Reads the posts linked to a title and writes "wrong title?" reports, over the tables of the social discovery build
// (#556, docs/implementation/talked-about-now/social.md): doc.social_post, doc.social_title_link,
// doc.social_content_quality, doc.social_relevance and doc.social_link_report. The read applies that ticket's reference query
// (`Store.read_title`) as staged lookups, including its content-quality gate, plus the relevance gate (#537: relevant buzz only); the
// report is its reference write (`Store.report`). Report rows are the only thing the webapp writes.
//
// Until discovery has run, the tables are missing or empty: the read then returns no rows and the section stays
// hidden. That includes doc.social_relevance: without it no piece shows, never one that wasn't judged relevant. Locally, SOCIAL_FIXTURE names a JSON file of the same rows (see fixtureSocialStore), so the page can be
// built and driven without touching the production tables.
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { execute, query, type CrateReadOptions } from "~/utils/crate"
import type { Env } from "./flags.server"

/** Social tables name shows "tv", as TMDB does; the webapp says "show". */
export type SocialMediaType = "movie" | "tv"
export type SocialPostSource = "youtube" | "rss" | "bluesky" | "mastodon"

export interface SocialTitle {
	mediaType: SocialMediaType
	tmdbId: number
}

/** One visible post of a title, best-ranked first. Times are ISO strings in UTC. */
export interface SocialPostRow {
	post_id: string
	image: string | null
	source: SocialPostSource
	source_id: string | null
	url: string
	author: string | null
	published_at: string
	text: string | null
	lane: string
	/** The relevance verdict's rank: higher shows first. */
	score: number | null
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
 * The relevance verdicts a read accepts (doc.social_relevance, written by social discovery): a link is shown only when
 * it has a `keep` of this version for the post's current content hash. A new version is judged again before its rows
 * can appear, so this changes with it.
 */
export const RELEVANCE_VERSION = "relevance-1"

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

const scoreOf = (value: unknown): number | null => (value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value))

const iso = (value: unknown): string => new Date(value instanceof Date ? value.getTime() : (value as number | string)).toISOString()

type Select = <T extends {}>(sql: string, params: (string | number)[], options?: CrateReadOptions) => Promise<T[]>
type Execute = (sql: string, params?: (string | number)[]) => Promise<unknown>

/** Read small link sets first so Crate never builds hash joins over the social corpus. */
export async function readSocialTitles(
	titles: SocialTitle[],
	{ schema = "doc", select = query as Select, disabledLanes = [], limit = 400 }: {
		schema?: string; select?: Select; disabledLanes?: readonly string[]; limit?: number
	} = {},
) {
	if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`Invalid schema ${schema}`)
	if (!titles.length) return []
	// One caller deadline covers every stage, without coordinator cooldown on expiry.
	const options = { signal: AbortSignal.timeout(1_000) }
	const where = titles.map(() => "(media_type = ? AND media_tmdb_id = ?)").join(" OR ")
	const lanes = disabledLanes.length ? ` AND lane NOT IN (${disabledLanes.map(() => "?").join(", ")})` : ""
	const links = await select<FixtureLink>(
		`SELECT media_type, media_tmdb_id, post_id, lane, duplicate_group, content_hash FROM ${schema}.social_title_link WHERE (${where}) AND hidden_at IS NULL${lanes} LIMIT 2147483647`,
		[...titles.flatMap(t => [t.mediaType, t.tmdbId]), ...disabledLanes], options,
	)
	if (!links.length) return []
	const ids = [...new Set(links.map(l => l.post_id))]
	async function lookup<T extends {}>(table: string, columns: string, filter = "") {
		const rows: T[] = []
		// Keep parameter lists and each response bounded, without truncating eligible links.
		for (let offset = 0; offset < ids.length; offset += 500) {
			options.signal.throwIfAborted()
			const batch = ids.slice(offset, offset + 500)
			rows.push(...await select<T>(`SELECT ${columns} FROM ${schema}.${table} WHERE post_id IN (${batch.map(() => "?").join(", ")})${filter} LIMIT 2147483647`, batch, options))
		}
		return rows
	}
	const [posts, quality] = await Promise.all([
		lookup<FixturePost>("social_post", "post_id, source, source_id, url, author, published_at, text, content_hash", " AND deleted_at IS NULL AND published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'"),
		lookup<FixtureQuality>("social_content_quality", "post_id, content_hash", ` AND version = '${CONTENT_QUALITY_VERSION}' AND status = 'pass'`),
	])
	const [relevance, reports] = await Promise.all([
		lookup<FixtureRelevance>("social_relevance", "media_type, media_tmdb_id, post_id, content_hash, score, dup_group", ` AND version = '${RELEVANCE_VERSION}' AND status = 'keep'`),
		lookup<FixtureReport>("social_link_report", "media_type, media_tmdb_id, post_id, report_id", " AND status IN ('open', 'confirmed')"),
	])
	const images = new Set((await lookup<{ post_id: string }>("social_image", "post_id", " AND status = 'ok'")).map(i => i.post_id))
	const byPost = new Map(posts.map(p => [p.post_id, p]))
	const linkKey = (l: { media_type: string; media_tmdb_id: number; post_id: string }) => `${l.media_type}:${l.media_tmdb_id}:${l.post_id}`
	const byRelevance = new Map(relevance.map(r => [linkKey(r), r]))
	const byQuality = new Map(quality.map(q => [q.post_id, q]))
	const reported = new Set(reports.filter(r => r.report_id != null).map(linkKey))
	const visible = links.flatMap(l => {
		const p = byPost.get(l.post_id)
		const q = byQuality.get(l.post_id)
		const rel = byRelevance.get(linkKey(l))
		// SQL equality rejects NULL hashes, including NULL = NULL.
		if (!p || p.content_hash == null || l.content_hash !== p.content_hash || q?.content_hash !== p.content_hash || rel?.content_hash !== p.content_hash || reported.has(linkKey(l))) return []
		return [{
			media_type: l.media_type, media_tmdb_id: l.media_tmdb_id,
			post_id: p.post_id, image: images.has(p.post_id) ? `/api/social/image/${p.post_id}` : null,
			source: p.source, source_id: p.source_id ?? null, url: p.url ?? "", author: p.author ?? null,
			published_at: iso(p.published_at), text: p.text ?? null, lane: String(l.lane ?? ""),
			score: scoreOf(rel.score), dup_group: rel.dup_group ?? l.duplicate_group ?? l.post_id,
		}]
	}).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || b.published_at.localeCompare(a.published_at) || b.post_id.localeCompare(a.post_id))
	const groups = new Set<string>()
	return visible.filter(row => {
		const key = `${row.media_type}:${row.media_tmdb_id}:${row.dup_group}`
		if (groups.has(key)) return false
		groups.add(key)
		return true
	}).slice(0, limit)
}

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
				const rows = await readSocialTitles([title], { schema, select, disabledLanes, limit: Math.min(Math.max(Math.trunc(limit), 1), 100) })
				return rows.map(({ media_type, media_tmdb_id, dup_group, ...row }) => row)
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

/** A row of doc.social_relevance: the verdict on one title–post link. */
export interface FixtureRelevance {
	media_type: SocialMediaType
	media_tmdb_id: number
	post_id: string
	version: string
	content_hash?: string | null
	status: "keep" | "drop"
	kind?: "official_video" | "review" | "news" | "interview" | "social"
	score?: number | null
	dup_group?: string | null
	reasons?: string[]
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
	/** The links' relevance verdicts. A link without a `keep` one is never shown, as in the Crate read. */
	relevance?: FixtureRelevance[]
	reports?: FixtureReport[]
}

/**
 * The fixture as a store. Reports are kept in memory for the life of the process; nothing is written anywhere.
 * The filters are the read query's: no passing content-quality verdict for the post's content, no `keep` relevance
 * verdict for the link and the post's content, deleted, hidden, out of the 30 days, changed content, reported, disabled
 * lane. Then one post per duplicate group, best-ranked first, as the read orders them.
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
	const kept = (link: FixtureLink, post: FixturePost) =>
		(fixture.relevance ?? []).find(
			(verdict) =>
				verdict.media_type === link.media_type &&
				verdict.media_tmdb_id === link.media_tmdb_id &&
				verdict.post_id === link.post_id &&
				verdict.status === "keep" &&
				verdict.version === RELEVANCE_VERSION &&
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
					const verdict = post && kept(link, post)
					return post && verdict ? [{ link, post, verdict }] : []
				})
				.filter(({ link, post }) => {
					if (!passed(post)) return false
					if (post.deleted_at || link.hidden_at) return false
					if (Date.parse(post.published_at) < since) return false
					if ((link.content_hash ?? null) !== (post.content_hash ?? null)) return false
					return !reported.has(link.post_id) && !disabledLanes.includes(link.lane)
				})
				.sort(
					(a, b) =>
						(b.verdict.score ?? Number.NEGATIVE_INFINITY) - (a.verdict.score ?? Number.NEGATIVE_INFINITY) ||
						b.post.published_at.localeCompare(a.post.published_at) ||
						b.link.post_id.localeCompare(a.link.post_id),
				)
			const groups = new Set<string>()
			const rows: SocialPostRow[] = []
			for (const { link, post, verdict } of visible) {
				const group = verdict.dup_group ?? link.duplicate_group ?? link.post_id
				if (groups.has(group)) continue
				groups.add(group)
				rows.push({
					post_id: post.post_id,
					image: null,
					source: post.source,
					source_id: post.source_id ?? null,
					url: post.url,
					author: post.author ?? null,
					published_at: post.published_at,
					text: post.text ?? null,
					lane: link.lane,
					score: verdict.score ?? null,
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
