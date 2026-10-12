// When a service first carried a title, for "newly available on your services" (#456). A row of
// `streaming_availability` keeps the time it first appeared (`created_at`), and the availability index reads those
// times with each load of a country, so that no request asks Crate for them.
//
// Only the offers that first appeared lately are read. Measured on production on October 12, 2026
// (scripts/measure-newly-available.mjs): carrying a time for every offer would take the answer the index loads for
// the United States from 6.1 MB to 16.6 MB and triple the time parsing it holds the event loop (54 to 155 ms
// against 154 to 506 ms), while the titles with an offer of the last seven days are 545, read in three statements
// of about 100 ms together. Everything older has been there for longer than anyone is told about.
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

// In an ordinary week about 80 titles a day get a new offer in the United States, some 7,000 in the days kept. Far
// more than this is a catch-up, offers that look new and are not: then no time is kept, and nothing is announced.
const MAX_TITLES = 20_000
const BATCH = 1_000

/**
 * The time each service first carried each title of a country, for the services that started after `since`, by
 * title and base service. Two kinds of statement: the titles with an offer that first appeared since, then every
 * subscription offer of those titles, since a service that started lately is only new for a title when no
 * duplicate of it and no other kind of offer on it was there before.
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
	const recent = ((
		await run(
			`SELECT DISTINCT media_type, media_tmdb_id
			 FROM streaming_availability
			 WHERE ${where} AND created_at > ?
			 LIMIT ${MAX_TITLES + 1}`,
			[country, ...types, since],
		)
	).rows ?? []) as [string, number][]
	if (recent.length > MAX_TITLES) {
		console.warn(
			`Availability index: more than ${MAX_TITLES} titles of ${country} have an offer that first appeared since ` +
				`${new Date(since).toISOString()}. That is a catch-up, so nothing is newly available.`,
		)
		return new Map()
	}
	const rows: [TitleKey, number, number][] = []
	for (const type of ["movie", "show"] as const) {
		const ids = recent
			.filter(([mediaType]) => (mediaType === "show") === (type === "show"))
			.map(([, id]) => id)
		for (let i = 0; i < ids.length; i += BATCH) {
			const batch = ids.slice(i, i + BATCH)
			const result = await run(
				`SELECT media_tmdb_id, streaming_service_id, min(created_at)
				 FROM streaming_availability
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
