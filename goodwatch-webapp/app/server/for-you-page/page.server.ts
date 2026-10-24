import { createHash } from "node:crypto"
import type { ForYouGuest, ForYouPage } from "~/domain/for-you-page/contract"
import type { PortraitViewer } from "~/server/taste-portrait/index.server"
import type { GuestProgress } from "~/server/viewer.server"
import { getForYouPool, getForYouPreview } from "./pool.server"
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
	async snapshotVersion() {
		const { getTitleSnapshot } = await import(
			"~/server/title-snapshot/index.server"
		)
		return getTitleSnapshot()?.version ?? null
	},
	taste: getForYouTaste,
	pool: getForYouPool,
	preview: getForYouPreview,
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
		if (!(await deps.snapshotVersion()))
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

const previews = new Map<
	string,
	{ until: number; value: Promise<ForYouGuest> }
>()
const PREVIEW_MAX = 128
const PREVIEW_TTL = 10 * 60_000

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
		const version = await deps.snapshotVersion()
		if (!version) return { taste: null, posters: [], guestRatings }
		// Sample posters also exclude progress titles, so include all eligibility sets.
		const id = createHash("sha256")
			.update(
				JSON.stringify([
					version,
					ctx.viewer.kind === "member" ? ctx.viewer.userId : "guest",
					ctx.country,
					[...ctx.services].sort(),
					[...ctx.ratings].sort((a, b) => a[0] - b[0]),
					[...ctx.seen].sort(),
					[...ctx.hidden].sort(),
					[...ctx.skipped].sort(),
					[...ctx.wishlist.keys()].sort(),
				]),
			)
			.digest("base64url")
		const now = Date.now()
		const hit = previews.get(id)
		if (hit && hit.until > now) return await hit.value
		const value = (async () => {
			const [taste, view] = await Promise.all([
				deps.loadTaste(who),
				deps.taste(who),
			])
			const posters = await deps.preview(ctx, taste, view)
			return { taste: view, posters, guestRatings }
		})()
		previews.delete(id)
		previews.set(id, { until: now + PREVIEW_TTL, value })
		for (const [key, entry] of previews) {
			if (entry.until > now && previews.size <= PREVIEW_MAX) break
			previews.delete(key)
		}
		try {
			return await value
		} catch (error) {
			if (previews.get(id)?.value === value) previews.delete(id)
			throw error
		}
	} catch (error) {
		console.error("For you preview unavailable:", error)
		return { taste: null, posters: [], guestRatings }
	} finally {
		console.info(
			`For you preview computed in ${Math.round(performance.now() - started)} ms`,
		)
	}
}
