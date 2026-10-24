// "New on your services" (#489 Part C): what a page reads from availability_history. Two steps, like the Newly
// available reader (availability-first-seen.server.ts): the titles with a live open stay first seen in the window on
// the page's services, then every stay of those titles on those services, backfilled ones included, so that the
// domain rules (domain/new-on-services.ts) can tell an arrival from an offer that was there before.
import {
	type Arrival,
	type HistoryStay,
	arrivalsOf,
	serviceIdsOf,
	windowStart,
} from "~/domain/new-on-services"
import { LANDED_DAY } from "~/server/availability-first-seen.server"
import { titleKey } from "~/utils/title-key"

const DAY_MS = 86_400_000
const SUBSCRIPTION_TYPES = ["flatrate", "free", "ads"] as const
const BATCH = 1_000

/** A statement sent to Crate, answered with rows as arrays: `execute` of utils/crate. */
export type Run = (
	sql: string,
	params: (string | number)[],
) => Promise<{ rows?: unknown[][] }>

const marks = (count: number) =>
	Array.from({ length: count }, () => "?").join(", ")

/** The stays of the titles first seen on the services in the country since `since` (a UTC day). */
export async function readArrivalStays(
	{
		country,
		services,
		since,
	}: { country: string; services: readonly number[]; since: number },
	run: Run,
): Promise<HistoryStay[]> {
	const ids = serviceIdsOf(services)
	if (!ids.length) return []
	const where = `country_code = ? AND streaming_type IN (?, ?, ?) AND streaming_service_id IN (${marks(ids.length)})`
	const scope = [country, ...SUBSCRIPTION_TYPES, ...ids]
	const candidates = ((
		await run(
			`SELECT DISTINCT media_type, media_tmdb_id
			 FROM availability_history
			 WHERE ${where} AND dropped_on IS NULL AND appeared_source <> 'backfill' AND (${LANDED_DAY}) >= ?
			 ORDER BY media_type, media_tmdb_id
			 LIMIT 1000000`,
			[...scope, since],
		)
	).rows ?? []) as [string, number][]

	const reads: Promise<HistoryStay[]>[] = []
	for (const type of ["movie", "show"] as const) {
		const titles = candidates
			.filter(([mediaType]) => (mediaType === "show") === (type === "show"))
			.map(([, id]) => id)
		for (let i = 0; i < titles.length; i += BATCH) {
			const batch = titles.slice(i, i + BATCH)
			reads.push(
				run(
					`SELECT media_tmdb_id, streaming_service_id, appeared_source, appeared_precision, (${LANDED_DAY}), dropped_on, created_at
					 FROM availability_history
					 WHERE ${where} AND (dropped_on IS NULL OR dropped_on >= ?) AND media_type = ? AND media_tmdb_id IN (${marks(batch.length)})
					 LIMIT 1000000`,
					[...scope, since - DAY_MS, type, ...batch],
				).then(({ rows }) =>
					(
						(rows ?? []) as [
							number,
							number,
							string,
							string,
							number,
							number | null,
							number | null,
						][]
					).map(
						([id, service, source, precision, landedOn, droppedOn, createdAt]) => ({
							key: titleKey(type, id),
							service,
							landedOn: Number(landedOn),
							exact: precision === "exact",
							backfill: source === "backfill",
							droppedOn: droppedOn === null ? null : Number(droppedOn),
							createdAt: Number(createdAt ?? 0),
						}),
					),
				),
			)
		}
	}
	return (await Promise.all(reads)).flat()
}

/** The titles that arrived on the services in the country within the window, newest first. */
export async function readArrivals(
	{
		country,
		services,
		now,
		launch,
	}: {
		country: string
		services: readonly number[]
		now: number
		launch: number
	},
	run: Run,
): Promise<Arrival[]> {
	const since = windowStart(now, launch)
	const stays = await readArrivalStays({ country, services, since }, run)
	return arrivalsOf(stays, { services, since })
}
