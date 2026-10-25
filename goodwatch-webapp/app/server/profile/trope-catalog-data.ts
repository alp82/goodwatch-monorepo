import { createHash } from "node:crypto"
import type { CatalogRead } from "./tropes-data.ts"

export interface TropeDescription {
	text: string | null
	url: string
}
export type TropeDescriptions = Record<string, TropeDescription>
interface CatalogRow {
	name: string
	url: string | null
	description: string | null
}

/** Exact-name reads from the shared catalog; the per-title `trope.name` full-text index is unrelated. */
export function createTropeCatalogReader(read: CatalogRead) {
	return async (input: string[]): Promise<TropeDescriptions> => {
		const names = [...new Set(input)].sort()
		const entries: [string, TropeDescription][] = []
		let next = 0
		async function worker() {
			while (next < names.length) {
				const batch = names.slice(next, next + 400)
				next += batch.length
				const rows = await read<CatalogRow>(
					`SELECT name, url, description FROM trope_catalog WHERE name IN (${batch.map(() => "?").join(",")}) LIMIT ${batch.length}`,
					batch,
				)
				const allowed = new Set(batch)
				for (const row of rows) {
					if (!allowed.has(row.name)) continue
					entries.push([
						row.name,
						{ text: row.description?.trim() || null, url: row.url ?? "" },
					])
				}
			}
		}
		await Promise.all(
			Array.from(
				{ length: Math.min(4, Math.ceil(names.length / 400)) },
				worker,
			),
		)
		return Object.fromEntries(entries)
	}
}

/** Changes independently of the heavy member pool, so browser revalidation sees new or corrected descriptions. */
export function catalogVersion(descriptions: TropeDescriptions) {
	return createHash("sha256")
		.update(
			JSON.stringify(
				Object.entries(descriptions).sort(([a], [b]) => a.localeCompare(b)),
			),
		)
		.digest("hex")
}

/** Old snapshots may still contain bundled descriptions. Replace, rather than merge, their general text. */
export function withTropeDescriptions<
	T extends {
		descriptions: Record<string, string>
		urls: Record<string, string>
	},
>(pool: T, entries: TropeDescriptions) {
	return {
		...pool,
		descriptions: Object.fromEntries(
			Object.entries(entries).flatMap(([name, row]) =>
				row.text ? [[name, row.text]] : [],
			),
		),
		urls: {
			...pool.urls,
			...Object.fromEntries(
				Object.entries(entries).flatMap(([name, row]) =>
					row.url ? [[name, row.url]] : [],
				),
			),
		},
		catalogVersion: catalogVersion(entries),
	}
}
