import { rankForYou } from "../../domain/for-you.ts"
import { canonicalTitleId } from "../../utils/title-identity.ts"
import {
	type TitleKey,
	parseTitleKey,
	titleKey,
} from "../../utils/title-key.ts"
import type { RawTitle } from "../../ui/related-map/engine.ts"
import type { CatalogTitle } from "./data.server.ts"
import type { ReadArgs } from "./tools.server.ts"

export function similarTitleView(
	neighbors: RawTitle[],
	source: CatalogTitle,
	args: ReadArgs,
	hidden: Iterable<TitleKey>,
	seen: Iterable<TitleKey>,
	percentile?: (keys: TitleKey[]) => (number | null)[],
) {
	const canonicalKey = (key: TitleKey) => {
		const { mediaType, tmdbId } = parseTitleKey(key)
		return titleKey(mediaType, canonicalTitleId(mediaType, tmdbId))
	}
	const blocked = new Set(
		[...hidden, ...(args.exclude_seen ? seen : [])].map(canonicalKey),
	)
	blocked.add(
		titleKey(
			source.media_type,
			canonicalTitleId(source.media_type, source.tmdb_id),
		),
	)
	const unique = new Map<TitleKey, CatalogTitle & { similarity: number }>()
	for (const [key, name, year, , near] of neighbors) {
		const media_type = key[0] === "m" ? "movie" : "show"
		const tmdb_id = canonicalTitleId(media_type, Number(key.slice(1)))
		const id = titleKey(media_type, tmdb_id)
		if (
			blocked.has(id) ||
			unique.has(id) ||
			(args.kind && args.kind !== "all" && args.kind !== media_type)
		)
			continue
		unique.set(id, {
			media_type,
			tmdb_id,
			title: name,
			release_year: year ? Number(year) : null,
			similarity: near / 1000,
		})
	}
	let items = [...unique.values()].sort(
		(a, b) =>
			b.similarity - a.similarity ||
			a.media_type.localeCompare(b.media_type) ||
			a.tmdb_id - b.tmdb_id,
	)
	const forYou = args.for_you ?? true
	if (forYou && percentile)
		items = rankForYou(
			items,
			percentile(
				items.map((title) => titleKey(title.media_type, title.tmdb_id)),
			),
			"browse",
		).order
	const offset = Number(args.cursor?.slice(7) ?? 0),
		limit = args.limit ?? 40
	return {
		items: items.slice(offset, offset + limit),
		total: items.length,
		next_cursor:
			offset + limit < items.length ? `offset:${offset + limit}` : null,
		for_you: forYou,
		for_you_applied: forYou && !!percentile,
		exclude_seen: args.exclude_seen ?? false,
		kind: args.kind ?? "all",
		availability: "everywhere",
	}
}
