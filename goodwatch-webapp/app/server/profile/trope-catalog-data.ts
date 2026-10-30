import { createHash } from "node:crypto"
import { type TropeOpening, tropeOpening } from "../../utils/trope-opening.ts"
import type { CatalogRead } from "./tropes-data.ts"

export interface TropeDescription {
	text: string | null
	url: string
	/** Actual page heading; legacy name-keyed rows cannot supply this proof. */
	title?: string | null
	/** What the Tropes tab shows. Absent where only the plain text was read. */
	opening?: TropeOpening | null
}
export type TropeDescriptions = Record<string, TropeDescription>
interface CatalogRow {
	name: string
	url: string | null
	description: string | null
	description_doc?: string | null
}

export interface DescriptionReadOptions {
	/** Read the stored document and cut the opening; off for callers that only need the plain text. */
	openings?: boolean
}

/** The plain text plus, when asked for, the opening from the stored document (or the text when it has none). */
export function describeRow(
	text: string | null | undefined,
	doc: string | null | undefined,
	options: DescriptionReadOptions,
): Pick<TropeDescription, "text" | "opening"> {
	const plain = text?.trim() || null
	return options.openings === false
		? { text: plain }
		: { text: plain, opening: plain ? tropeOpening(doc, plain) : null }
}

/** What crosses to the page: the opening replaces the whole plain text, which can run to 24,000 characters. */
export function pageDescriptions(
	entries: TropeDescriptions,
): TropeDescriptions {
	return Object.fromEntries(
		Object.entries(entries).map(([id, entry]) => [
			id,
			entry.opening ? { ...entry, text: null } : entry,
		]),
	)
}

/** Exact-name reads from the shared catalog; the per-title `trope.name` full-text index is unrelated. */
export function createTropeCatalogReader(read: CatalogRead) {
	return async (
		input: string[],
		options: DescriptionReadOptions = {},
	): Promise<TropeDescriptions> => {
		const columns =
			options.openings === false
				? "name, url, description"
				: "name, url, description, description_doc"
		const names = [...new Set(input)].sort()
		const entries: [string, TropeDescription][] = []
		let next = 0
		async function worker() {
			while (next < names.length) {
				const batch = names.slice(next, next + 400)
				next += batch.length
				const rows = await read<CatalogRow>(
					`SELECT ${columns} FROM trope_catalog WHERE name IN (${batch.map(() => "?").join(",")}) LIMIT ${batch.length}`,
					batch,
				)
				const allowed = new Set(batch)
				for (const row of rows) {
					if (!allowed.has(row.name)) continue
					entries.push([
						row.name,
						{
							...describeRow(row.description, row.description_doc, options),
							url: row.url ?? "",
						},
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
		names?: Record<string, string>
	},
>(pool: T, entries: TropeDescriptions) {
	return {
		...pool,
		names: {
			...pool.names,
			...Object.fromEntries(
				Object.entries(entries).flatMap(([id, row]) =>
					row.title ? [[id, row.title]] : [],
				),
			),
		},
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
