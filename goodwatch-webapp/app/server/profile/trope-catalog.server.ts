import { noteMediaReadFailure } from "~/server/media-read-health.server"
import { query } from "~/utils/crate"
import {
	type DescriptionReadOptions,
	createTropeCatalogReader,
} from "./trope-catalog-data"
import {
	createTropePageReader,
	createTropeReferenceReader,
} from "./trope-pages"

const read = createTropeCatalogReader((sql, params) =>
	query(sql, params, { timeoutMs: 400 }),
)
const pages = createTropePageReader((sql, params) =>
	query(sql, params, { timeoutMs: 400 }),
)
/** A failed identity read must fail the background build, never persist a degraded grouping. */
export const resolveTropeReferences = createTropeReferenceReader(
	(sql, params) => query(sql, params, { timeoutMs: 800 }),
)

/** Optional text must not hold up a profile when the catalog is unavailable. A later request retries. */
export async function readTropeDescriptions(
	names: string[],
	options: { strict?: boolean } & DescriptionReadOptions = {},
) {
	try {
		// The old reader remains for callers holding the legacy name contract during rollout.
		const reader = names.some(
			(name) => name.startsWith("https://") || name.startsWith("label:"),
		)
			? pages
			: read
		try {
			return await reader(names, options)
		} catch (error) {
			// Before the document column exists, keep the plain text; the page splits it into paragraphs itself.
			if (options.openings === false || !/description_doc/i.test(String(error)))
				throw error
			return await reader(names, { openings: false })
		}
	} catch (error) {
		noteMediaReadFailure()
		console.error(
			"Profile tropes: reading the shared description catalog failed:",
			error,
		)
		if (options.strict) throw error
		return {}
	}
}
