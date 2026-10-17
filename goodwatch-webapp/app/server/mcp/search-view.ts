import { rankForYou } from "../../domain/for-you.ts"
import { canonicalTitleId } from "../../utils/title-identity.ts"
import {
	type TitleKey,
	parseTitleKey,
	titleKey,
} from "../../utils/title-key.ts"
import { canonicalTitles } from "./catalog.ts"
import type { CatalogTitle } from "./data.server.ts"

export interface SearchView {
	for_you: boolean
	exclude_seen: boolean
	for_you_applied: boolean
	availability: "everywhere"
}

/** The same Not seen yet and bounded For you rules as Discover, over the complete result batch. */
export function searchView(
	titles: readonly CatalogTitle[],
	flags: { for_you?: boolean; exclude_seen?: boolean },
	seen: Iterable<TitleKey> = [],
	percentile?: (keys: TitleKey[]) => (number | null)[],
): { titles: CatalogTitle[]; view: SearchView } {
	const blocked = new Set(
		[...seen].map((key) => {
			const { mediaType, tmdbId } = parseTitleKey(key)
			return titleKey(mediaType, canonicalTitleId(mediaType, tmdbId))
		}),
	)
	let found = canonicalTitles(titles).filter(
		(title) =>
			!flags.exclude_seen ||
			!blocked.has(titleKey(title.media_type, title.tmdb_id)),
	)
	const forYou = flags.for_you ?? true
	if (forYou && percentile)
		found = rankForYou(
			found,
			percentile(
				found.map((title) => titleKey(title.media_type, title.tmdb_id)),
			),
			"search",
		).order
	return {
		titles: found,
		view: {
			for_you: forYou,
			exclude_seen: flags.exclude_seen ?? false,
			for_you_applied: forYou && !!percentile,
			availability: "everywhere",
		},
	}
}
