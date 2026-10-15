// What the native and the IMDb imports share to serve a result: the title, year and poster of the titles on the rows
// a page shows, the paging of the sections, and a short-lived cache of finished results, so that paging through a
// long section doesn't map every row of the import again for each page.
import {
	IMPORT_RESULT_FIRST_ROWS,
	type ImportResult,
	type ImportResultPage,
	type ImportResultRow,
	type ImportResultSectionKey,
} from "~/domain/import-result"

type Read = <T extends {}>(sql: string, params: number[]) => Promise<T[]>
interface CatalogRow {
	tmdb_id: number
	title: string | null
	release_year: number | null
	poster_path: string | null
}

/** Fills in the catalog's title, year and poster for the titles on the rows. */
export async function withCatalog(read: Read, rows: ImportResultRow[]) {
	for (const mediaType of ["movie", "show"] as const) {
		const ids = [
			...new Set(
				rows.flatMap((row) =>
					row.title?.mediaType === mediaType ? [row.title.tmdbId] : [],
				),
			),
		]
		const found = new Map<number, CatalogRow>()
		for (let start = 0; start < ids.length; start += 500) {
			const part = ids.slice(start, start + 500)
			const catalog = await read<CatalogRow>(
				`SELECT tmdb_id, title, release_year, poster_path FROM ${mediaType} WHERE tmdb_id IN (${part.map(() => "?").join(",")})`,
				part,
			)
			for (const entry of catalog) found.set(Number(entry.tmdb_id), entry)
		}
		for (const row of rows) {
			const entry =
				row.title?.mediaType === mediaType
					? found.get(row.title.tmdbId)
					: undefined
			if (!row.title || !entry) continue
			row.title = {
				...row.title,
				title: entry.title || row.title.title,
				year:
					entry.release_year === null
						? row.title.year
						: Number(entry.release_year),
				posterPath: entry.poster_path,
			}
		}
	}
	return rows
}

/** The result with the first titles of each section. */
export async function firstRows(
	read: Read,
	result: ImportResult,
): Promise<ImportResult> {
	const sections = result.sections.map((section) => ({
		...section,
		rows: section.rows
			.slice(0, IMPORT_RESULT_FIRST_ROWS)
			.map((row) => ({ ...row })),
	}))
	await withCatalog(
		read,
		sections.flatMap((section) => section.rows),
	)
	return { ...result, sections }
}

/** More titles of one section. */
export async function sectionPage(
	read: Read,
	result: ImportResult,
	section: ImportResultSectionKey,
	offset: number,
	limit: number,
): Promise<ImportResultPage> {
	const rows =
		result.sections.find((found) => found.key === section)?.rows ?? []
	return {
		rows: await withCatalog(
			read,
			rows.slice(offset, offset + limit).map((row) => ({ ...row })),
		),
		total: rows.length,
	}
}

const CACHED = 10
const CACHE_MS = 5 * 60_000
const cache = new Map<string, { at: number; result: Promise<ImportResult> }>()
/** Test-only: forgets the cached results. */
export const clearResultCacheForTest = () => cache.clear()

/**
 * The result API of one source. `load` checks that the import is the member's and names its version, null while it
 * can still change; the rows are mapped once per version and kept for a few minutes.
 */
export function resultApi(
	read: Read,
	load: (
		userId: string,
		id: string,
	) => Promise<{ version: string | null; build: () => Promise<ImportResult> }>,
) {
	const grouped = async (userId: string, id: string) => {
		const { version, build } = await load(userId, id)
		if (!version) return build()
		const key = `${id}:${version}`
		const hit = cache.get(key)
		if (hit && Date.now() - hit.at < CACHE_MS) return hit.result
		const result = build()
		cache.delete(key)
		cache.set(key, { at: Date.now(), result })
		result.catch(() => cache.delete(key))
		for (const old of cache.keys()) {
			if (cache.size <= CACHED) break
			cache.delete(old)
		}
		return result
	}
	return {
		/** The result with the first titles of each section. */
		first: async (userId: string, id: string) =>
			firstRows(read, await grouped(userId, id)),
		/** More titles of one section. */
		page: async (
			userId: string,
			id: string,
			section: ImportResultSectionKey,
			offset: number,
			limit: number,
		) => sectionPage(read, await grouped(userId, id), section, offset, limit),
	}
}
