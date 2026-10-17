import { canonicalTitleId } from "../../utils/title-identity.ts"
import type { CatalogTitle } from "./data.server.ts"

/** Identity, never title/year: a short and a feature can legitimately share both. */
export function canonicalTitles(
	titles: readonly CatalogTitle[],
): CatalogTitle[] {
	const unique = new Map<string, CatalogTitle>()
	for (const title of titles) {
		const id = canonicalTitleId(title.media_type, title.tmdb_id)
		const key = `${title.media_type}:${id}`
		if (!unique.has(key) || id === title.tmdb_id)
			unique.set(key, { ...title, tmdb_id: id })
	}
	return [...unique.values()]
}
