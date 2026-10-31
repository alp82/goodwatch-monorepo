import type { ExplorerTitle } from "~/domain/explorer"
import { titleToDashed } from "~/utils/helpers"
import { canonicalMediaTitle } from "~/utils/media-presentation"

/** A title's own page. */
export const titlePath = (t: ExplorerTitle) =>
	`/${t.mediaType}/${t.tmdbId}-${titleToDashed(canonicalMediaTitle(t))}`
