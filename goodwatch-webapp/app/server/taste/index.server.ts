// Taste: one module owns the taste formula, the stored vectors, their rebuild, calibration, and the guest path. Every
// surface calls loadTaste and then match, reasons, or leanings; write paths call markTasteChanged.
//
// Member taste reads one Redis key (see member.server.ts); guest taste is built from the guest progress in the request
// (see guest.server.ts). Both need the title snapshot: until it has loaded, everyone has no taste.
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { Viewer } from "~/server/viewer.server"
import { loadGuestTaste } from "./guest.server"
import { loadMemberTaste } from "./member.server"
import { NO_TASTE, type Taste } from "./taste.server"

export { markTasteChanged, stopTasteStore } from "./member.server"
export { type RecommendedList, logRecommendedOverlap } from "./shadow.server"
export { CRAFT_KEYS, type FingerprintKey, type Taste } from "./taste.server"

export async function loadTaste(viewer: Viewer): Promise<Taste> {
	if (viewer.kind === "member") return loadMemberTaste(viewer.userId)
	const snapshot = getTitleSnapshot()
	return snapshot ? loadGuestTaste(viewer.progress, snapshot) : NO_TASTE
}
