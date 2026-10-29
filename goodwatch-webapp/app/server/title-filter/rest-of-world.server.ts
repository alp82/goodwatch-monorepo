import { BIG_EIGHT } from "~/domain/film-industries"
import type { TitleSnapshot } from "~/server/title-snapshot/snapshot.server"

// Only the current version is retained; the next snapshot replaces this column.
let cached: { version: string; rows: Uint8Array | null } | undefined

/** Any of the sidecar's first four production countries outside the big eight. */
export function restOfWorldColumn(
	snapshot: Pick<TitleSnapshot, "version" | "count" | "columns">,
): Uint8Array | null {
	if (cached?.version === snapshot.version) return cached.rows
	const facts = snapshot.columns.facts
	if (!facts) {
		console.warn(
			`Title snapshot ${snapshot.version}: Rest of the world unavailable without facts`,
		)
		cached = { version: snapshot.version, rows: null }
		return null
	}
	const outside = Uint8Array.from(facts.countries, (code) =>
		BIG_EIGHT.includes(code) ? 0 : 1,
	)
	const rows = new Uint8Array(snapshot.count)
	for (let slot = 0; slot < 4; slot++) {
		for (let row = 0; row < snapshot.count; row++) {
			if (outside[facts.countryIndexes[slot * snapshot.count + row]] === 1)
				rows[row] = 1
		}
	}
	cached = { version: snapshot.version, rows }
	return rows
}
