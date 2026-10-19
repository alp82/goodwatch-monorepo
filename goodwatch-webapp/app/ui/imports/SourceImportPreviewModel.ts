import type { ImportKind, ImportOptions } from "~/domain/imports"
import type { WishlistPreviewUpdate } from "./WishlistImportPreview"

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
