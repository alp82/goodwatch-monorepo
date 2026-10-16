// A member's Sides of you for the TV's home (#673): the side engine's sides, as the Taste page has them
// (taste-portrait/sides.server.ts, with its rule for which titles are on a side), shaped by home-sides.server.ts.
//
// The portrait is cached per member (taste-portrait/cache.server.ts). A cold one can take a while, so the home waits
// for it only `SIDES_WAIT_MS`; past that, the home is the row of tiles this once, and the portrait still lands in
// the cache for the next visit.
import {
	type PortraitViewer,
	getTastePortrait,
	personalOrderOf,
} from "~/server/taste-portrait/index.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import type { TvHomeSide } from "~/ui/living-room/tv/tv-home"
import { homeSides } from "./home-sides.server"

/** How long the home waits for the portrait. */
const SIDES_WAIT_MS = 1500

/**
 * A member's sides for home, or none when they cannot be had in time. Never fails. `context` is the viewer context
 * the home's loader reads anyway.
 */
export async function loadHomeSides(
	userId: string,
	context: () => Promise<ViewerContext>,
): Promise<TvHomeSide[]> {
	const who: PortraitViewer = {
		viewer: { kind: "member", userId },
		context,
	}
	const work = (async () => {
		const view = await getTastePortrait(who, "sides")
		const snapshot = getTitleSnapshot()
		const order = snapshot ? await personalOrderOf(userId, snapshot) : undefined
		return homeSides(view, order)
	})().catch((error) => {
		console.error("The TV: loading a member's sides failed", error)
		return []
	})
	let timer: ReturnType<typeof setTimeout> | undefined
	const late = new Promise<TvHomeSide[]>((resolve) => {
		timer = setTimeout(() => resolve([]), SIDES_WAIT_MS)
	})
	try {
		return await Promise.race([work, late])
	} finally {
		clearTimeout(timer)
	}
}
