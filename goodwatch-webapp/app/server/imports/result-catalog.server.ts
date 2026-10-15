// The catalog side of an import result, shared by the native and the IMDb imports: the title, year and poster of
// the titles on the rows a page shows, and the paging of the sections.
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
		rows: section.rows.slice(0, IMPORT_RESULT_FIRST_ROWS),
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
		rows: await withCatalog(read, rows.slice(offset, offset + limit)),
		total: rows.length,
	}
}
