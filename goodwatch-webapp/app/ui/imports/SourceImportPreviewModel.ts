import type { ImportItem, ImportKind, ImportOptions } from "~/domain/imports"
import {
	episodeScoreLabel,
	importedScoreTarget,
} from "../../domain/episode-scores.ts"
import type { WishlistPreviewUpdate } from "./WishlistImportPreview"

/** In-memory member choices shared only by replacements of the same TV Time preview. */
export type SourceImportChoices = {
	wishlistRewatch?: boolean
	kinds: ImportKind[]
	conflictChoice: ImportOptions["conflictChoice"]
	watchDates: ImportOptions["watchDates"] | null
}

/** Why a new preview replaced the one on screen: the member's matches, accepted suggestions, or background matching. */
export type PreviewUpdate = WishlistPreviewUpdate & {
	background?: boolean
	acceptedCount?: number
}

export function sourceImportRequirements(
	availableWatches: number,
	kinds: ImportKind[],
	watchDates: ImportOptions["watchDates"] | null,
) {
	const importsWatches = availableWatches > 0 && kinds.includes("watch")
	return {
		importsWatches,
		canImport: kinds.length > 0 && (!importsWatches || watchDates !== null),
		watchDates: watchDates ?? "preserve",
	}
}

export const sourceImportNeedsPolling = (
	summary: { status: string; resolution?: { state: string } } | undefined,
) =>
	summary?.status === "running" ||
	(!!summary?.resolution &&
		["queued", "running", "editing"].includes(summary.resolution.state))

/** Where in its title a preview row lands: "Movie", "Show", "S1 E3", "Season 2", or a part's range "S1 E1–12". */
export function sourceItemLocation(item: ImportItem, wishlist: boolean) {
	if (item.kind === "episode_rating") {
		const target = importedScoreTarget(item)
		if (target)
			return target.scope === "season"
				? `Season ${target.season}`
				: episodeScoreLabel(target)
		if (item.scoreScope === "season")
			return item.season != null ? `Season ${item.season}` : "Season"
		if (item.scoreScope === "part") return "Part"
	}
	return (wishlist && item.wishlistEvidence?.mediaType === "season") ||
		(item.season != null && item.episode == null)
		? `S${item.season ?? "?"}`
		: item.episode != null
			? `S${item.season ?? "?"} E${item.episode}`
			: wishlist && item.wishlistEvidence?.mediaType === "unknown"
				? "Type unknown"
				: item.mediaType === "show"
					? "Show"
					: "Movie"
}
