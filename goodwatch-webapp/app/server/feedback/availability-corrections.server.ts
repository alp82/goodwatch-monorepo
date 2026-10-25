import { applyCorrectionRows } from "./apply-corrections.ts"
import type { Correction } from "./corrections.ts"
import type { Sql } from "./correction-store.server.ts"
/** Rebuild only corrected titles from their offer types before regrouping country membership. */
export async function correctedAvailability(
	country: string,
	rows: [string, number, number[]][],
	run: Sql,
) {
	try {
		const result = await run(
			"SELECT * FROM doc.catalog_correction WHERE status = 'live' AND field = 'offer' AND target['country'] = ?",
			[country],
		)
		const corrections = (result.json ?? []) as Correction[]
		if (!corrections.length) return rows
		const ids = [...new Set(corrections.map((c) => c.tmdb_id))]
		const source = await run(
			"SELECT media_type, media_tmdb_id, streaming_service_id, streaming_type FROM doc.streaming_availability WHERE country_code = ? AND media_tmdb_id = ANY(?)",
			[country, ids],
		)
		const changed = new Set(
			corrections.map((c) => `${c.entity_kind}:${c.tmdb_id}`),
		)
		const output = rows.filter(([kind, id]) => !changed.has(`${kind}:${id}`))
		for (const key of changed) {
			const [kind, id] = key.split(":")
			const offers = (source.json ?? []).filter(
				(r: any) => r.media_type === kind && r.media_tmdb_id === Number(id),
			)
			const effective = applyCorrectionRows(
				{ kind: kind as "movie" | "show", id: Number(id), country },
				{ streaming_availabilities: offers },
				corrections,
			).streaming_availabilities as {
				streaming_service_id: number
				streaming_type: string
			}[]
			output.push([
				kind,
				Number(id),
				[
					...new Set(
						effective
							.filter((o) =>
								["flatrate", "free", "ads"].includes(o.streaming_type),
							)
							.map((o) => o.streaming_service_id),
					),
				],
			])
		}
		return output
	} catch {
		return rows
	}
}
