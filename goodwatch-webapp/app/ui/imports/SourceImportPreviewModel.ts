import type { ImportItem, ImportKind } from "~/domain/imports"
import {
	episodeScoreLabel,
	importedScoreTarget,
} from "../../domain/episode-scores.ts"
import type { WishlistPreviewUpdate } from "./WishlistMatching"
import type { Answers } from "./import-flow-model"

/** In-memory member choices kept when a new preview replaces the one on screen: the kinds left in and the answers. */
export type SourceImportChoices = {
	kinds: ImportKind[]
	answers: Answers
}

/** Why a new preview replaced the one on screen: the member's matches, accepted suggestions, or background matching. */
export type PreviewUpdate = WishlistPreviewUpdate & {
	background?: boolean
	acceptedCount?: number
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
