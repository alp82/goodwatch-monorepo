// Live availability stays supply Newly available dates (#637, owner decision Q59).
// The country index keeps these dates; member requests still use its saved-service rules.
import {
	BACKFILLED,
	type FirstSeen,
	type ServiceStay,
	firstSeenOf,
} from "~/domain/newly-available"
import { type TitleKey, titleKey } from "~/utils/title-key"

const DAY_MS = 86_400_000

/** A statement sent to Crate, answered with rows as arrays: `execute` of utils/crate. */
type Run = (
	sql: string,
	params: (string | number)[],
) => Promise<{ rows?: unknown[][] }>

/**
 * The launch day of "newly available" is the earliest eligible landing day for live stays.
 * Stays with an earlier landing day never count as news; backfilled stays never count regardless of day.
 * `NEWLY_AVAILABLE_SINCE` (an ISO time) overrides the default launch; its UTC day is inclusive.
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
	Math.floor(Math.max(launchTime(), now - KEPT_DAYS * DAY_MS) / DAY_MS) * DAY_MS

const BATCH = 1_000

// Exact stays carry a proved landing day; unknown stays use the UTC day of their opening observation.
export const LANDED_DAY =
	"CASE WHEN appeared_precision = 'exact' THEN appeared_on ELSE date_trunc('day', observed_at) END"

/**
 * Recent live open stays identify candidate titles. Their open and recently closed stays establish continuity
 * across offer types, duplicate ids and saved services. Backfilled stays establish prior watchability without
 * announcing a landing. The day dates the landing; min(created_at) dates when GoodWatch learned of the stay.
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
	const where = `country_code = ? AND streaming_type IN (${marks(types.length).join(", ")})`
	// One candidate statement cannot lose a title when another stay closes between pages.
	const recent = ((
		await run(
			`SELECT DISTINCT media_type, media_tmdb_id
		 FROM availability_history
		 WHERE ${where} AND dropped_on IS NULL AND appeared_source <> 'backfill' AND (${LANDED_DAY}) >= ?
		 ORDER BY media_type, media_tmdb_id
		 LIMIT 1000000`,
			[country, ...types, since],
		)
	).rows ?? []) as [string, number][]
	const rows: ServiceStay[] = []
	for (const type of ["movie", "show"] as const) {
		const ids = recent
			.filter(([mediaType]) => (mediaType === "show") === (type === "show"))
			.map(([, id]) => id)
		for (let i = 0; i < ids.length; i += BATCH) {
			const batch = ids.slice(i, i + BATCH)
			const result = await run(
				`SELECT media_tmdb_id, streaming_service_id, min(CASE WHEN appeared_source <> 'backfill' THEN (${LANDED_DAY}) ELSE ${BACKFILLED} END), dropped_on, min(created_at)
				 FROM availability_history
				 WHERE ${where} AND (dropped_on IS NULL OR dropped_on >= ?) AND media_type = ? AND media_tmdb_id IN (${marks(batch.length).join(", ")})
				 GROUP BY media_tmdb_id, streaming_service_id, dropped_on
				 LIMIT 1000000`,
				[country, ...types, since - DAY_MS, type, ...batch],
			)
			for (const [id, service, at, droppedOn, learnedAt] of (result.rows ??
				[]) as [number, number, number, number | null, number][])
				rows.push([
					titleKey(type, id),
					service,
					Number(at),
					droppedOn,
					Number(learnedAt),
				])
		}
	}
	return firstSeenOf(rows, since)
}
