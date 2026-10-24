import type { ForYouGuest, ForYouPage } from "~/domain/for-you-page/contract"
import type { PortraitViewer } from "~/server/taste-portrait/index.server"
import type { GuestProgress } from "~/server/viewer.server"
import { getForYouPool } from "./pool.server"
import { getForYouTaste } from "./taste.server"

const defaults = {
	async viewer(request: Request, progress?: GuestProgress) {
		const { portraitViewer } = await import(
			"~/server/taste-portrait/index.server"
		)
		return portraitViewer(request, progress)
	},
	async loadTaste(who: PortraitViewer) {
		const { loadTaste } = await import("~/server/taste/index.server")
		return loadTaste(who.viewer)
	},
	async hasSnapshot() {
		const { getTitleSnapshot } = await import(
			"~/server/title-snapshot/index.server"
		)
		return getTitleSnapshot() !== null
	},
	taste: getForYouTaste,
	pool: getForYouPool,
}

/** Share the viewer read across portrait tabs and pool selection. */
async function viewer(
	request: Request,
	progress: GuestProgress | undefined,
	deps: typeof defaults,
) {
	const who = await deps.viewer(request, progress)
	let context: ReturnType<PortraitViewer["context"]> | undefined
	return {
		viewer: who.viewer,
		context: () => {
			context ??= who.context()
			return context
		},
	}
}

export async function loadForYouPage(
	request: Request,
	deps = defaults,
): Promise<ForYouPage> {
	const started = performance.now()
	const who = await viewer(request, undefined, deps)
	if (who.viewer.kind === "guest") return { kind: "guest" }
	try {
		if (!(await deps.hasSnapshot()))
			return { kind: "member", status: "unavailable" }
		const [ctx, taste, view] = await Promise.all([
			who.context(),
			deps.loadTaste(who),
			deps.taste(who),
		])
		if (!view) return { kind: "member", status: "empty" }
		const pool = await deps.pool(ctx, taste, view)
		return pool.keys.length
			? { kind: "member", status: "ready", pool, taste: view }
			: { kind: "member", status: "unavailable" }
	} catch (error) {
		console.error("For you page unavailable:", error)
		return { kind: "member", status: "unavailable" }
	} finally {
		console.info(
			`For you page computed in ${Math.round(performance.now() - started)} ms`,
		)
	}
}

export async function loadForYouGuest(
	request: Request,
	progress?: GuestProgress,
	deps = defaults,
): Promise<ForYouGuest> {
	const started = performance.now()
	const who = await viewer(request, progress, deps)
	let guestRatings = 0
	try {
		const ctx = await who.context()
		guestRatings = ctx.ratings.size
		if (!(await deps.hasSnapshot()))
			return { taste: null, posters: [], guestRatings }
		const [taste, view] = await Promise.all([
			deps.loadTaste(who),
			deps.taste(who),
		])
		const pool = await deps.pool(ctx, taste, view)
		return { taste: view, posters: pool.posters.slice(0, 12), guestRatings }
	} catch (error) {
		console.error("For you preview unavailable:", error)
		return { taste: null, posters: [], guestRatings }
	} finally {
		console.info(
			`For you preview computed in ${Math.round(performance.now() - started)} ms`,
		)
	}
}
