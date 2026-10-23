import { z } from "zod"

const guid = z.object({ id: z.string().max(500) })
export const plexMetadata = z.object({
	type: z.string(),
	title: z.string().max(500),
	year: z.number().int().optional(),
	Guid: z.array(guid).default([]),
	guid: z.string().max(500).optional(),
	grandparentRatingKey: z.string().optional(),
	parentRatingKey: z.string().optional(),
	parentIndex: z.number().int().nonnegative().optional(),
	index: z.number().int().nonnegative().optional(),
})

export const plexIds = (item: z.infer<typeof plexMetadata>) => {
	const guids = item.Guid.map((g) => g.id)
	// Older agents store a single GUID, optionally with a language query.
	const legacy = item.guid?.match(
		/^com\.plexapp\.agents\.(imdb|themoviedb):\/\/(tt\d+|[1-9]\d*)(?:\?[^#]*)?$/,
	)
	if (legacy)
		guids.push(`${legacy[1] === "themoviedb" ? "tmdb" : "imdb"}://${legacy[2]}`)
	return {
		tmdbId:
			Number(guids.find((g) => /^tmdb:\/\/[1-9]\d*$/.test(g))?.slice(7)) ||
			null,
		imdbId: guids.find((g) => /^imdb:\/\/tt\d+$/.test(g))?.slice(7) ?? null,
		tvdbId:
			Number(guids.find((g) => /^tvdb:\/\/[1-9]\d*$/.test(g))?.slice(7)) ||
			null,
	}
}
