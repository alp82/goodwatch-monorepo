// The data of the awards pages (domain/award-pages.ts): `doc.tvdb_award_display` grouped into ceremonies, and the
// display fields of every title a published page can show. Both are read once and kept in memory, so a page view
// reads no Crate; the page cache in front keeps the pages themselves. The award rows change only when the TVDB crawl
// runs, and scores move daily at most.
import {
	type AwardIndex,
	type AwardMediaKind,
	type AwardRow,
	type TitleRef,
	bodyBySlug,
	bodyPage,
	buildAwardIndex,
	categoryPage,
	ceremonyPage,
	hubPage,
	publishedTitleRefs,
	refKey,
} from "~/domain/award-pages"
import { rowServices } from "~/server/row-services.server"
import { query } from "~/utils/crate"
import { titlePath } from "~/utils/helpers"

/** What a poster card on the awards pages needs. The loader's title overlay adds the viewer's language. */
export interface AwardTitle {
	tmdb_id: number
	media_type: AwardMediaKind
	title: string
	release_year: number | null
	poster_path: string | null
	goodwatch_overall_score_normalized_percent: number | null
	path: string
}

interface TitleRow {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	goodwatch_overall_score_normalized_percent: number | null
}

interface AwardData {
	index: AwardIndex
	titles: Map<string, AwardTitle>
}

const LIFETIME_MS = 6 * 60 * 60 * 1000
/** After a failed refresh the old data stays, and the next refresh waits this long instead of running per request. */
const RETRY_MS = 60 * 1000

async function readTitles(kind: AwardMediaKind, ids: number[]) {
	if (!ids.length) return []
	return query<TitleRow>(
		`SELECT tmdb_id, title, release_year, poster_path, goodwatch_overall_score_normalized_percent
		   FROM ${kind} WHERE tmdb_id = ANY(?)`,
		// node-crate sends arrays as JSON arrays; its parameter type only names scalars.
		[ids as never],
	)
}

async function readAwardData(): Promise<AwardData> {
	const rows = await query<AwardRow>(
		`SELECT media_type, media_tmdb_id, award_id, category_id, category_name, ceremony_year, has_win, has_nomination
		   FROM doc.tvdb_award_display LIMIT 200000`,
	)
	// An empty view (a crawl that hasn't run, a view being rebuilt) is a failure, not a result to keep for 6 hours.
	if (!rows.length) throw new Error("doc.tvdb_award_display is empty")
	const index = buildAwardIndex(rows)
	const ids = { movie: [] as number[], show: [] as number[] }
	for (const ref of publishedTitleRefs(index))
		ids[ref.media_type].push(ref.tmdb_id)
	const [movies, shows] = await Promise.all([
		readTitles("movie", ids.movie),
		readTitles("show", ids.show),
	])
	const titles = new Map<string, AwardTitle>()
	for (const [kind, list] of [
		["movie", movies],
		["show", shows],
	] as const)
		for (const row of list)
			titles.set(refKey({ media_type: kind, tmdb_id: row.tmdb_id }), {
				tmdb_id: row.tmdb_id,
				media_type: kind,
				title: row.title,
				release_year: row.release_year,
				poster_path: row.poster_path,
				goodwatch_overall_score_normalized_percent:
					row.goodwatch_overall_score_normalized_percent,
				path: titlePath(kind, row.tmdb_id, row.title),
			})
	return { index, titles }
}

let current: { at: number; value: Promise<AwardData> } | null = null
let refreshing = false

/**
 * The kept data. The first read is shared by every request that arrives while it runs; a failed first read is tried
 * again on the next request. Past its lifetime, pages keep the old data while one read in the background replaces it;
 * when that read fails the old data stays and the next try waits RETRY_MS.
 */
function awardData() {
	if (!current) {
		const value = readAwardData()
		current = { at: Date.now(), value }
		value.catch(() => {
			if (current?.value === value) current = null
		})
		return value
	}
	if (Date.now() - current.at > LIFETIME_MS && !refreshing) {
		refreshing = true
		const kept = current
		readAwardData()
			.then((data) => {
				current = { at: Date.now(), value: Promise.resolve(data) }
			})
			.catch((error) => {
				console.error("[award-pages] refresh failed", error)
				if (current === kept) kept.at = Date.now() - LIFETIME_MS + RETRY_MS
			})
			.finally(() => {
				refreshing = false
			})
	}
	return current.value
}

const lookup =
	(titles: Map<string, AwardTitle>) =>
	(ref: TitleRef): AwardTitle | undefined =>
		titles.get(refKey(ref))

export async function getAwardsHub() {
	const { index, titles } = await awardData()
	return hubPage(index, lookup(titles), new Date().getUTCFullYear())
}

export async function getAwardBody(slug: string) {
	if (!bodyBySlug(slug)) return null
	const { index, titles } = await awardData()
	return bodyPage(index, lookup(titles), slug)
}

export async function getAwardCeremony(slug: string, year: string) {
	if (!bodyBySlug(slug)) return null
	const { index, titles } = await awardData()
	return ceremonyPage(index, lookup(titles), slug, year)
}

export async function getAwardCategory(slug: string, categorySlug: string) {
	if (!bodyBySlug(slug)) return null
	const { index, titles } = await awardData()
	return categoryPage(index, lookup(titles), slug, categorySlug)
}

/** The member's own services for the titles of a page, for the card logos; null for a guest, whose page is shared. */
export const awardServices = (
	request: Request,
	titles: readonly AwardTitle[],
) =>
	rowServices(
		request,
		titles.map((t) => ({ mediaType: t.media_type, tmdbId: t.tmdb_id })),
	)
