import { z } from "zod"

/** A tracker entry is a cour, never an assertion that the whole TMDB show is Seen. */
export interface AnimeEntry {
	source: "anidb" | "myanimelist" | "anilist" | "kitsu"
	id: number
	/** Adapters repeat the full reported progress on every expanded episode row. */
	progress?: number
	/** Completed cours must include episodeCount; completion never means whole-show Seen. */
	completed?: boolean
	/** Entry-level dates are evidence, not dates to copy onto each episode. */
	startedAt?: string | null
	finishedAt?: string | null
	/** The source's total when known; never guessed from the TMDB season. */
	episodeCount?: number
}
/** Placement: Anime-Lists/anime-lists; tracker identity crosswalk: Fribb/anime-lists. */
const integer = z.number().int().safe()
const id = integer.positive()
export const animeMappingSchema = z.object({
	anidbId: id,
	showId: id,
	season: z.union([integer.nonnegative(), z.literal("a")]).nullable(),
	offset: integer,
	ranges: z.array(
		z.object({
			start: id,
			end: id,
			season: integer.nonnegative(),
			offset: integer,
		}),
	),
	ids: z.object({
		myanimelist: z.array(id),
		anilist: z.array(id),
		kitsu: z.array(id),
	}),
	unsupportedReason: z.string().optional(),
})

export type AnimeMapping = z.infer<typeof animeMappingSchema>

/** Durable receipt evidence for an entry score; never a whole-show rating. */
export interface AnimeScorePlacement {
	mapping?: AnimeMapping
	ranges: { season: number; firstEpisode: number; lastEpisode: number }[] | null
	/** Why a complete range could not be established; raw entry evidence is still retained. */
	reason?: string
}
