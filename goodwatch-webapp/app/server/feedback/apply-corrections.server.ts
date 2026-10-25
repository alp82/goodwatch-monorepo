import {
	applyCorrectionRows,
	type CorrectionEntity,
} from "./apply-corrections.ts"
import type { Correction } from "./corrections.ts"
import type { Sql } from "./correction-store.server.ts"
export function createCorrectionReader(run: Sql, now = Date.now) {
	const cache = new Map<string, { at: number; rows: Promise<Correction[]> }>()
	let unavailableUntil = 0
	return {
		clear() {
			cache.clear()
			unavailableUntil = 0
		},
		async apply<T>(entity: CorrectionEntity, rows: T): Promise<T> {
			if (now() < unavailableUntil) return rows
			const key = `${entity.kind}:${entity.id}`
			let hit = cache.get(key)
			if (!hit || now() - hit.at > 5000) {
				const load = run(
					`SELECT c.*, s.name AS provider_name, s.logo_path AS provider_logo FROM doc.catalog_correction c LEFT JOIN doc.streaming_service s ON c.target['providerId'] = s.tmdb_id WHERE c.status = 'live' AND
     ((c.entity_kind = ? AND c.tmdb_id = ?) OR
      (c.entity_kind = 'person' AND c.target['creditTmdbId'] = ? AND c.target['creditMediaType'] = ?) OR
      (c.target['personId'] = ? AND ? = 'person'))`,
					[
						entity.kind,
						entity.id,
						entity.id,
						entity.kind === "show" ? "tv" : entity.kind,
						entity.id,
						entity.kind,
					],
				)
					.then((r) =>
						(r.json ?? []).map((row) => {
							const c = row as Correction
							return {
								...c,
								value: JSON.parse(String(c.value)),
								old_value: JSON.parse(String(c.old_value)),
							}
						}),
					)
					.catch(() => {
						unavailableUntil = now() + 30000
						return []
					})
				if (cache.size >= 512) cache.delete(cache.keys().next().value!)
				hit = { at: now(), rows: load }
				cache.set(key, hit)
			}
			const corrections = await hit.rows
			if (!corrections.length) return rows
			try {
				return applyCorrectionRows(entity, rows, corrections)
			} catch (error) {
				// A shape the overlay can't handle shows the source value; it never breaks the page.
				console.error("[feedback] correction overlay failed", {
					entity: key,
					error: error instanceof Error ? error.message : String(error),
				})
				return rows
			}
		},
	}
}
const reader = createCorrectionReader(async (sql, params) => {
	const { execute } = await import("~/utils/crate")
	return (execute as Sql)(sql, params)
})
export const applyCorrections = reader.apply
export const resetCorrectionReader = reader.clear
