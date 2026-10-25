import { noteMediaReadFailure } from "~/server/media-read-health.server"
import { query } from "~/utils/crate"
import { createTropeCatalogReader } from "./trope-catalog-data"

const read = createTropeCatalogReader((sql, params) =>
	query(sql, params, { timeoutMs: 400 }),
)

/** Optional text must not hold up a profile when the catalog is unavailable. A later request retries. */
export async function readTropeDescriptions(names: string[]) {
	try {
		return await read(names)
	} catch (error) {
		noteMediaReadFailure()
		console.error(
			"Profile tropes: reading the shared description catalog failed:",
			error,
		)
		return {}
	}
}
