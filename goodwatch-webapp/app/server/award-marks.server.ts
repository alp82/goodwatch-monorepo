// Every title's award mark and notable results, held in this process's memory. One SELECT reads the whole view
// doc.tvdb_award_display (about 22,000 rows) when first asked and again after REFRESH_MS; until a refresh lands, the
// previous index keeps answering, and a failed read keeps it too and is retried after RETRY_MS. So a page, a card or a
// quick view never waits on Crate once the index is loaded: best-of rows, the one-per-session marks payload
// (/api/award-marks) and the quick view's results (/api/title-awards) are lookups in memory.
// Rules for what shows: domain/award-marks.ts.
import {
	type AwardMarkRow,
	type AwardMarksPayload,
	type AwardMediaType,
	type NotableAward,
	awardKey,
	encodeAwardMarks,
	notableAwards,
	topWin,
} from "../domain/award-marks.ts"

const REFRESH_MS = 6 * 60 * 60 * 1000
const RETRY_MS = 60 * 1000
/** How long a loader waits for the first read of a cold process before it renders without marks. */
const COLD_WAIT_MS = 1500

export interface AwardIndexRow extends AwardMarkRow {
	media_type: string
	media_tmdb_id: number
}

export interface AwardIndex {
	/** The short name of the top body won, by `awardKey`; only titles with a win. */
	marks: Map<string, string>
	/** The quick view's results, by `awardKey`; titles with rows. */
	notable: Map<string, NotableAward[]>
	/** What /api/award-marks sends, serialized once per load. */
	payload: string
}

export function buildAwardIndex(rows: readonly AwardIndexRow[]): AwardIndex {
	const byTitle = new Map<string, AwardIndexRow[]>()
	for (const r of rows) {
		if (r.media_type !== "movie" && r.media_type !== "show") continue
		if (!Number.isSafeInteger(r.media_tmdb_id)) continue
		const key = awardKey(r.media_type, r.media_tmdb_id)
		const list = byTitle.get(key)
		if (list) list.push(r)
		else byTitle.set(key, [r])
	}
	const marks = new Map<string, string>()
	const notable = new Map<string, NotableAward[]>()
	const entries: [AwardMediaType, number, string][] = []
	for (const [key, list] of byTitle) {
		const results = notableAwards(list)
		if (results.length) notable.set(key, results)
		const top = topWin(list)
		if (!top) continue
		marks.set(key, top)
		entries.push([
			list[0].media_type as AwardMediaType,
			list[0].media_tmdb_id,
			top,
		])
	}
	const payload: AwardMarksPayload = encodeAwardMarks(entries)
	return { marks, notable, payload: JSON.stringify(payload) }
}

export function createAwardIndexCache(
	read: () => Promise<AwardIndexRow[]>,
	now: () => number = Date.now,
) {
	let index: AwardIndex | null = null
	let freshUntil = 0
	let loading: Promise<AwardIndex | null> | null = null

	const load = () => {
		loading ??= read()
			.then((rows) => {
				index = buildAwardIndex(rows)
				freshUntil = now() + REFRESH_MS
				return index
			})
			.catch((error) => {
				console.error("Award marks: index read failed", error)
				freshUntil = now() + RETRY_MS
				return index
			})
			.finally(() => {
				loading = null
			})
		return loading
	}

	/** The index; the first call waits for the first read. Null while no read has succeeded. */
	return async function awardIndex(): Promise<AwardIndex | null> {
		if (now() >= freshUntil) {
			const pending = load()
			if (!index) return pending
		}
		return index
	}
}

const readAll = async () => {
	const { query } = await import("~/utils/crate")
	return query<AwardIndexRow>(
		`SELECT media_type, media_tmdb_id, award_name, category_name, ceremony_year, has_win, has_nomination
		FROM doc.tvdb_award_display LIMIT 200000`,
		[],
		{ timeoutMs: 20_000 },
	)
}

export const awardIndex = createAwardIndexCache(readAll)

/** The top body won of each listed title that has one, for loader data: `{ "movie:1": "Oscar" }`. */
export async function awardMarksOf(
	titles: readonly { mediaType: AwardMediaType; tmdbId: number }[],
): Promise<Record<string, string>> {
	const index = await Promise.race([
		awardIndex(),
		new Promise<null>((resolve) =>
			setTimeout(resolve, COLD_WAIT_MS, null).unref(),
		),
	])
	const marks: Record<string, string> = {}
	if (!index) return marks
	for (const t of titles) {
		const key = awardKey(t.mediaType, t.tmdbId)
		const mark = index.marks.get(key)
		if (mark) marks[key] = mark
	}
	return marks
}
