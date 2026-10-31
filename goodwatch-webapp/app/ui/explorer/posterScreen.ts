// The poster that becomes the screen, the engine's side. Posters grow until `largestPoster`, then stop and stay whole
// while the map moves on behind them. Zooming on in at one that is already that big (its unclamped size past
// `SCREEN_AT` times it) makes it the screen. Only while zooming in, and only the poster at the zoom's point, so panning
// over big posters or a quick spin from far out doesn't open one by accident.
import type { ExplorerTitle } from "~/domain/explorer"
import type { MapIsland } from "./island"

/** The width (CSS px) where posters used to fade out, as they'd fill the view. Kept as the ceiling of `largestPoster`. */
export const fillWidth = (w: number, h: number, phone: boolean) =>
	Math.max(phone ? 300 : 440, Math.min(w, h) * 0.62)

/**
 * The widest a poster grows (CSS px): about 0.41 of the stage's height (the screen's own poster size, so the hand-off
 * to the screen doesn't shrink it much), never above `fillWidth`, never below 300 (220 on phones).
 */
export const largestPoster = (w: number, h: number, phone: boolean) =>
	Math.max(
		phone ? 220 : 300,
		Math.min(fillWidth(w, h, phone), (h * 0.62) / 1.5),
	)

/** Whether a poster this big before the clamp (`raw`, CSS px) has been zoomed on far enough to become the screen. */
export const becomesScreen = (raw: number, largest: number) =>
	raw >= largest * SCREEN_AT

/** The unclamped size, in `largestPoster`s, where a poster being zoomed at becomes the screen: about half a notch past the clamp. */
export const SCREEN_AT = 1.1
/** From this size (in `largestPoster`s) up, a zoom in holds on the poster under the pointer: it holds still and grows. */
export const MAGNET_AT = 0.5
/** Zoom input counts as zooming in for this long after it arrives (ms). */
export const IN_MS = 260

export interface ScreenCandidate {
	island: MapIsland
	i: number
	title: ExplorerTitle
	cx: number
	cy: number
	/** As drawn (clamped at `largestPoster`). */
	w: number
}

/** Watches the posters at the zoom's point grow; one fires once, then waits until nothing there is big any more. */
export function createScreenWatch() {
	let armed = true
	let max = 0
	let best: ScreenCandidate | null = null
	let bd = Number.POSITIVE_INFINITY
	let mx = 0
	let my = 0
	const pool: ScreenCandidate = {
		island: null as unknown as MapIsland,
		i: 0,
		title: null as unknown as ExplorerTitle,
		cx: 0,
		cy: 0,
		w: 0,
	}
	return {
		begin(x: number, y: number) {
			max = 0
			best = null
			bd = Number.POSITIVE_INFINITY
			mx = x
			my = y
		},
		/** A poster as laid out this frame: `w` as drawn, `raw` before the clamp. */
		see(
			island: MapIsland,
			i: number,
			title: ExplorerTitle,
			cx: number,
			cy: number,
			w: number,
			raw: number,
			largest: number,
		) {
			// Only what's at the point counts toward re-arming: big posters elsewhere don't hold it.
			const out = Math.hypot(
				Math.max(0, Math.abs(mx - cx) - w * 0.5),
				Math.max(0, Math.abs(my - cy) - w * 0.75),
			)
			if (out > w * 0.15) return
			if (raw > max) max = raw
			if (!becomesScreen(raw, largest)) return
			const d = Math.hypot(cx - mx, cy - my)
			if (d >= bd) return
			bd = d
			pool.island = island
			pool.i = i
			pool.title = title
			pool.cx = cx
			pool.cy = cy
			pool.w = w
			best = pool
		},
		/** The poster that becomes the screen now, or null. */
		end(
			largest: number,
			locked: boolean,
			zoomingIn: boolean,
		): ScreenCandidate | null {
			if (max < largest * 0.8) armed = true
			if (!best || locked || !armed || !zoomingIn) return null
			armed = false
			return { ...best }
		},
	}
}

/** What a wheel turn needs of an element to tell whether it scrolls it. */
export interface Scroller {
	scrollTop: number
	scrollHeight: number
	clientHeight: number
}

/**
 * Whether a wheel turn of `dy` (down is positive) scrolls one of these scrollable areas (innermost first) rather than
 * reaching the screen behind them: the details band scrolls while it has room in that direction, and only past its
 * end does the wheel let the screen go.
 */
export function wheelScrolls(chain: readonly Scroller[], dy: number): boolean {
	if (!dy) return false
	return chain.some((s) => {
		const room = s.scrollHeight - s.clientHeight
		if (room <= 1) return false
		return dy > 0 ? s.scrollTop < room - 1 : s.scrollTop > 1
	})
}
