// PROTOTYPE (start page lab): small helpers the variants share.
import type { LabCard } from "./types"

/** The title page's path, like the poster cards build it. */
export const titleHref = (card: Pick<LabCard, "media_type" | "tmdb_id" | "title">) =>
	`/${card.media_type}/${card.tmdb_id}-${card.title
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")}`

export const tmdbImage = (path: string | null | undefined, size: "w185" | "w342" | "w500" | "w780" | "w1280" | "original" = "w342") =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : ""
