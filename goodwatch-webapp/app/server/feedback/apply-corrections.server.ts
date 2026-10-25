import {
	applyCorrectionRows,
	type CorrectionEntity,
} from "./apply-corrections.ts"
import type { Correction } from "./corrections.ts"
import type { Sql } from "./correction-store.server.ts"
/** Live corrections that touch one entity's page: its own rows, a person's credit on it, or its cast member. */
export function correctionsFor(
	entity: CorrectionEntity,
	all: Correction[],
): Correction[] {
	const mediaType = entity.kind === "show" ? "tv" : entity.kind
	return all.filter((c) => {
		const t = (c.target ?? {}) as Record<string, unknown>
		return (
			(c.entity_kind === entity.kind && Number(c.tmdb_id) === entity.id) ||
			(c.entity_kind === "person" &&
				Number(t.creditTmdbId) === entity.id &&
				t.creditMediaType === mediaType) ||
			(entity.kind === "person" && Number(t.personId) === entity.id)
		)
	})
}

/**
 * Every live correction, loaded in one query per process at most every 5 seconds and shared by all pages. Live
 * corrections are few, so a page load never waits on its own query, and crawler bursts add no database load.
 */
export function createCorrectionReader(run: Sql, now = Date.now) {
	let snapshot: { at: number; rows: Promise<Correction[]> } | null = null
	let unavailableUntil = 0
	const load = () =>
		run(
			`SELECT c.*, s.name AS provider_name, s.logo_path AS provider_logo FROM doc.catalog_correction c LEFT JOIN doc.streaming_service s ON c.target['providerId'] = s.tmdb_id WHERE c.status = 'live' LIMIT 20000`,
			[],
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
				return [] as Correction[]
			})
	return {
		clear() {
			snapshot = null
			unavailableUntil = 0
		},
		async apply<T>(entity: CorrectionEntity, rows: T): Promise<T> {
			if (now() < unavailableUntil) return rows
			if (!snapshot || now() - snapshot.at > 5000)
				snapshot = { at: now(), rows: load() }
			const corrections = correctionsFor(entity, await snapshot.rows)
			if (!corrections.length) return rows
			try {
				return applyCorrectionRows(entity, rows, corrections)
			} catch (error) {
				// A shape the overlay can't handle shows the source value; it never breaks the page.
				console.error("[feedback] correction overlay failed", {
					entity: `${entity.kind}:${entity.id}`,
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
