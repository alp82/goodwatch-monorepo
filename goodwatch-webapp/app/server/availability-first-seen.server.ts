// Live availability stays supply Newly available dates (#637, owner decision Q59).
// The country index keeps these dates; member requests still use its saved-service rules.
import { type FirstSeen, firstSeenOf } from "~/domain/newly-available"
import { type TitleKey, titleKey } from "~/utils/title-key"

const DAY_MS = 86_400_000

/** A statement sent to Crate, answered with rows as arrays: `execute` of utils/crate. */
type Run = (
	sql: string,
	params: (string | number)[],
) => Promise<{ rows?: unknown[][] }>

/**
 * The launch of "newly available": an offer that appeared before it is never news. It is after the catch-up of
 * late September 2026, which wrote 4.5 million offers with a new `created_at` between September 21 and October 1.
 * `NEWLY_AVAILABLE_SINCE` (an ISO time) moves it, for a launch on another day.
 */
const LAUNCH = Date.parse("2026-10-12T00:00:00Z")

export function launchTime(): number {
	const set = Date.parse(process.env.NEWLY_AVAILABLE_SINCE ?? "")
	return Number.isNaN(set) ? LAUNCH : set
}

/** How long the index keeps the time an offer appeared. A landing older than this is not news any more. */
export const KEPT_DAYS = 90

/** From when on the index keeps first-seen times: the launch, and later the last `KEPT_DAYS` days. */
export const keptSince = (now = Date.now()) =>
	Math.max(launchTime(), now - KEPT_DAYS * DAY_MS)

const BATCH = 1_000

// Exact stays carry a proved day; unknown stays count from the UTC day we opened them.
const ARRIVED =
	"CASE WHEN appeared_precision = 'exact' THEN appeared_on ELSE date_trunc('day', observed_at) END"

/**
 * Read recent live arrivals, then all open stays of those titles. Backfilled stays cannot announce an arrival,
 * but must suppress a later offer on the same service (including duplicate ids and other offer types).
 * Closed stays do not date the current offer: a return opens a new stay.
 */
export async function readFirstSeen(
	{
		country,
		types,
		since,
	}: { country: string; types: readonly string[]; since: number },
	run: Run,
): Promise<Map<TitleKey, FirstSeen>> {
	const marks = (count: number) => Array.from({ length: count }, () => "?")
	const where = `country_code = ? AND streaming_type IN (${marks(types.length).join(", ")}) AND dropped_on IS NULL`
	const recent: [string, number][] = []
	// Explicit pages avoid both Crate's default result limit and a country-wide title ceiling.
	for (let offset = 0; ; offset += BATCH) {
		const page = ((
			await run(
				`SELECT DISTINCT media_type, media_tmdb_id
				 FROM availability_history
				 WHERE ${where} AND appeared_source <> 'backfill' AND (${ARRIVED}) > ?
				 ORDER BY media_type, media_tmdb_id
				 LIMIT ${BATCH} OFFSET ?`,
				[country, ...types, since, offset],
			)
		).rows ?? []) as [string, number][]
		recent.push(...page)
		if (page.length < BATCH) break
	}
	const rows: [TitleKey, number, number][] = []
	for (const type of ["movie", "show"] as const) {
		const ids = recent
			.filter(([mediaType]) => (mediaType === "show") === (type === "show"))
			.map(([, id]) => id)
		for (let i = 0; i < ids.length; i += BATCH) {
			const batch = ids.slice(i, i + BATCH)
			const result = await run(
				`SELECT media_tmdb_id, streaming_service_id, min(CASE WHEN appeared_source <> 'backfill' THEN (${ARRIVED}) ELSE 0 END)
				 FROM availability_history
				 WHERE ${where} AND media_type = ? AND media_tmdb_id IN (${marks(batch.length).join(", ")})
				 GROUP BY media_tmdb_id, streaming_service_id
				 LIMIT 1000000`,
				[country, ...types, type, ...batch],
			)
			for (const [id, service, at] of (result.rows ?? []) as [
				number,
				number,
				number,
			][])
				rows.push([titleKey(type, id), service, Number(at)])
		}
	}
	return firstSeenOf(rows, since)
}
