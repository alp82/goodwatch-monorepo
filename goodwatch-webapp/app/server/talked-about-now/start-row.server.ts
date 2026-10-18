// The "Talked about now" row's read (#557; shapes and rules in domain/talked-about-now.ts). The same for every
// visitor, so one answer is kept in this process for a few minutes and every visitor shares it.
//
// - The ranking: one primary-key read of `doc.buzz_snapshot` (`current`), the read buzz-score.md hands the start
//   page, and one of the day before's dated snapshot for each title's move. No snapshot: no row.
// - The catalog's fields (backdrop, year) for the board's titles, as every card reads them (getDisplayFields).
// - What is said: one read of the visible links of the board's titles to their posts (`doc.social_title_link`,
//   `doc.social_post`), with the filters of social discovery's reference read (`Store.read_title` of #556): a
//   passing content-quality verdict for the post's current content (`social_content_quality`) and a `keep` relevance
//   verdict for the link (`social_relevance`), the same joins as the title section's read; no reported, hidden,
//   deleted, outdated or expired link, no switched-off lane, one of each duplicate group, best-ranked first. Missing or
//   empty tables (the relevance table too) answer nothing, and the row shows its titles without what is said.
//
// Nothing here writes: no Crate table, no Valkey key of its own.
import {
	BOARD_SIZE,
	ITEMS_PER_TITLE,
	PAGE_BOARD_SIZE,
	PAGE_ITEMS_PER_TITLE,
	type BuzzTitle,
	type SocialRow,
	type TalkedRow,
	dayBefore,
	moveOf,
	parseSnapshot,
	pickItems,
	ranksOf,
} from "~/domain/talked-about-now"
import type { TitleDisplay } from "~/server/title-cards.server"
import { query } from "~/utils/crate"
import { titleKey } from "~/utils/title-key"
import {
	contentQualityJoin,
	getSocialStore,
	relevanceJoin,
} from "./social-store.server"

/** How long one answer is shared: the score changes once a day, discovery runs hourly. */
export const TALKED_TTL_MS = 10 * 60 * 1000
const FAILED_TTL_MS = 60 * 1000

export const SNAPSHOT_QUERY =
	"SELECT day, payload FROM doc.buzz_snapshot WHERE snapshot_key = ?"

/** Lanes switched off without rematching (social.md recommends this setting): `SOCIAL_DISABLED_LANES=a,b`. */
export const disabledLanes = () =>
	(process.env.SOCIAL_DISABLED_LANES ?? "")
		.split(/[\s,]+/)
		.filter((lane) => lane)

/** The relevant visible links of these titles to their posts, best-ranked first, one of each duplicate group per title. */
export function socialQuery(
	titles: Pick<BuzzTitle, "mediaType" | "tmdbId">[],
	lanes: string[] = disabledLanes(),
): { sql: string; params: (string | number)[] } {
	const params: (string | number)[] = []
	const which = titles
		.map((title) => {
			params.push(title.mediaType === "show" ? "tv" : "movie", title.tmdbId)
			return "(l.media_type = ? AND l.media_tmdb_id = ?)"
		})
		.join(" OR ")
	const lane = lanes.length
		? ` AND l.lane NOT IN (${lanes.map(() => "?").join(", ")})`
		: ""
	params.push(...lanes)
	const sql = `SELECT media_type, media_tmdb_id, post_id, source, source_id, url, author, published_at, text, image, score, dup_group FROM (
  SELECT l.media_type, l.media_tmdb_id, p.post_id, p.source, p.source_id, p.url, p.author, p.published_at, p.text, CASE WHEN i.post_id IS NOT NULL THEN '/api/social/image/' || p.post_id ELSE NULL END AS image,
    rel.score, COALESCE(rel.dup_group, l.duplicate_group, p.post_id) AS dup_group,
    ROW_NUMBER() OVER (PARTITION BY l.media_type, l.media_tmdb_id, COALESCE(rel.dup_group, l.duplicate_group, p.post_id)
      ORDER BY rel.score DESC NULLS LAST, p.published_at DESC, p.post_id DESC) AS duplicate_rank
  FROM doc.social_title_link l JOIN doc.social_post p ON p.post_id = l.post_id
  LEFT JOIN doc.social_image i ON i.post_id = p.post_id AND i.status = 'ok'
  ${contentQualityJoin("doc")}
  ${relevanceJoin("doc")}
  LEFT JOIN doc.social_link_report r ON r.media_type = l.media_type AND r.media_tmdb_id = l.media_tmdb_id
    AND r.post_id = l.post_id AND r.status IN ('open', 'confirmed')
  WHERE (${which}) AND l.hidden_at IS NULL AND p.deleted_at IS NULL
    AND p.published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND l.content_hash = p.content_hash AND r.report_id IS NULL${lane}
) visible WHERE duplicate_rank = 1 ORDER BY score DESC NULLS LAST, published_at DESC, post_id DESC LIMIT 400`
	return { sql, params }
}

/** Whether SOCIAL_FIXTURE (development only, see social-store.server.ts) stands in for the social tables. */
const fixtureInUse = (env = process.env) =>
	env.NODE_ENV !== "production" && Boolean(env.SOCIAL_FIXTURE?.trim())

/** The board's rows from the fixture, through the same filters as the title section's read of it. */
export async function fixtureRows(titles: BuzzTitle[]): Promise<SocialRow[]> {
	const store = getSocialStore()
	const lanes = disabledLanes()
	const rows = await Promise.all(
		titles.map(async (title) => {
			const media_type = title.mediaType === "show" ? "tv" : "movie"
			const posts = await store.readTitle(
				{ mediaType: media_type, tmdbId: title.tmdbId },
				{ limit: 100, disabledLanes: lanes },
			)
			return posts.map(
				({ lane, ...post }): SocialRow => ({
					...post,
					media_type,
					media_tmdb_id: title.tmdbId,
					dup_group: null,
				}),
			)
		}),
	)
	return rows.flat()
}

type Reads = {
	snapshot: (key: string) => Promise<{ day: string; payload: unknown } | null>
	social: (titles: BuzzTitle[]) => Promise<SocialRow[]>
	displays: (keys: number[]) => Promise<Map<number, TitleDisplay>>
}

const crateReads: Reads = {
	snapshot: async (key) =>
		(
			await query<{ day: string; payload: unknown }>(SNAPSHOT_QUERY, [key])
		)[0] ?? null,
	social: async (titles) => {
		if (fixtureInUse()) return fixtureRows(titles)
		const { sql, params } = socialQuery(titles)
		return query<SocialRow>(sql, params)
	},
	// Imported when asked: the cards' module pulls in the title snapshot and Valkey, which the tests of this one leave out.
	displays: async (keys) =>
		(await import("~/server/title-cards.server")).getDisplayFields(keys),
}

/** The row, or null without a ranking. Throws only when the ranking itself can't be read. */
export async function readTalkedAboutNow(
	reads: Reads = crateReads,
	/** The start row's eight and three; the Hot on socials page asks for the whole ranking and more posts. */
	size: { board: number; items: number; oneVideo: boolean } = { board: BOARD_SIZE, items: ITEMS_PER_TITLE, oneVideo: true },
): Promise<TalkedRow | null> {
	const current = await reads.snapshot("current")
	const parsed = current ? parseSnapshot(current.payload) : null
	if (!parsed || !parsed.titles.length) return null
	const board = parsed.titles.slice(0, size.board)

	const [before, displays, rows] = await Promise.all([
		reads
			.snapshot(dayBefore(parsed.day))
			.then((row) => (row ? ranksOf(row.payload) : null))
			.catch(() => null),
		reads
			.displays(board.map((title) => titleKey(title.mediaType, title.tmdbId)))
			.catch((error) => {
				console.error(
					"Talked about now: reading the titles' fields failed",
					error,
				)
				return new Map()
			}),
		reads.social(board).catch((error) => {
			// Before social discovery has made its tables, and while Crate refuses the read: the titles without posts.
			console.warn(
				"Talked about now: no posts,",
				error instanceof Error ? error.message : error,
			)
			return [] as SocialRow[]
		}),
	])

	const byTitle = new Map<string, SocialRow[]>()
	for (const row of rows) {
		const key = `${row.media_type}:${row.media_tmdb_id}`
		byTitle.set(key, [...(byTitle.get(key) ?? []), row])
	}
	return {
		day: parsed.day,
		source: parsed.source,
		...(parsed.sources_used ? { sources_used: parsed.sources_used } : {}),
		titles: board.map(({ key, releaseDate, ...title }) => {
			const display = displays.get(titleKey(title.mediaType, title.tmdbId))
			return {
				...title,
				poster: display?.poster_path ?? title.poster,
				backdrop: display?.backdrop_path ?? null,
				year:
					display?.release_year ??
					(releaseDate ? Number(releaseDate.slice(0, 4)) || null : null),
				move: moveOf(key, title.rank, before),
				items: pickItems(byTitle.get(key) ?? [], size.items, size.oneVideo),
			}
		}),
	}
}

let kept: { at: number; ttl: number; row: Promise<TalkedRow | null> } | null =
	null

/** The shared answer: read at most once per TALKED_TTL_MS (a failure is asked again after a minute). */
export function getTalkedAboutNow(
	now = Date.now(),
	reads: Reads = crateReads,
): Promise<TalkedRow | null> {
	if (kept && now - kept.at < kept.ttl) return kept.row
	const entry = {
		at: now,
		ttl: TALKED_TTL_MS,
		row: readTalkedAboutNow(reads).catch((error) => {
			console.error("Talked about now: reading the ranking failed", error)
			entry.ttl = FAILED_TTL_MS
			return null
		}),
	}
	kept = entry
	return entry.row
}

let keptPage: { at: number; ttl: number; row: Promise<TalkedRow | null> } | null = null

/** The Hot on socials page's read, shared like the row's. */
export function getHotOnSocials(now = Date.now(), reads: Reads = crateReads): Promise<TalkedRow | null> {
	if (keptPage && now - keptPage.at < keptPage.ttl) return keptPage.row
	const entry = {
		at: now,
		ttl: TALKED_TTL_MS,
		row: readTalkedAboutNow(reads, { board: PAGE_BOARD_SIZE, items: PAGE_ITEMS_PER_TITLE, oneVideo: false }).catch((error) => {
			console.error("Hot on socials: reading the ranking failed", error)
			entry.ttl = FAILED_TTL_MS
			return null
		}),
	}
	keptPage = entry
	return entry.row
}

/** Drops the shared answer, so the next request reads again: a "wrong title?" report calls this (`afterReport`). */
export function forgetTalkedAboutNow() {
	kept = null
	keptPage = null
}
