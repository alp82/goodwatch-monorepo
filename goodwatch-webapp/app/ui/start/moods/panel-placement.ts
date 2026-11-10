import { type PanelBox, panelBox } from "./start-picker"

const RESIZE_QUIET_MS = 80
const MAX_SETTLE_MS = 2000

/** Run after a rendering opportunity, so reading geometry or focusing doesn't flush the opening commit's layout. */
export function afterPanelPaint(task: () => void): () => void {
	let timer = 0
	const frame = window.requestAnimationFrame(() => {
		timer = window.setTimeout(task, 0)
	})
	return () => {
		window.cancelAnimationFrame(frame)
		window.clearTimeout(timer)
	}
}

/** Read every placement input together, before the caller updates the panel or starts scrolling. */
function readPanelBox(anchor: HTMLElement): PanelBox {
	const vh = window.visualViewport?.height ?? window.innerHeight
	const dock = document.querySelector<HTMLElement>("[data-mobile-dock]")
	const dockBox = dock?.getBoundingClientRect()
	const dockTop = dockBox?.height ? dockBox.top : vh
	const column = (
		anchor.closest(".start-moods") ?? anchor
	).getBoundingClientRect()
	const row = anchor.getBoundingClientRect()
	const scroller = document.scrollingElement ?? document.documentElement
	return panelBox({
		row,
		column: { left: column.left + window.scrollX, width: column.width },
		bottom: Math.min(vh, dockTop),
		scrollY: window.scrollY,
		room: scroller.scrollHeight - vh - window.scrollY,
	})
}

/**
 * Place once on open and once after a burst of viewport changes. On rotation the search block can still be easing:
 * wait for its animations' completion, with a bounded fallback, rather than reading the whole page every frame.
 * Scrolling needs no measurements: the panel and its anchor both keep their document coordinates.
 */
export function watchPanelPlacement(
	anchor: HTMLElement,
	onPlace: (box: PanelBox) => void,
): () => void {
	let generation = 0
	let disposed = false
	let resizeTimer = 0
	let fallback = 0
	let cancelPaint = () => {}
	const cancelPending = () => {
		generation++
		cancelPaint()
		window.clearTimeout(resizeTimer)
		window.clearTimeout(fallback)
	}
	const place = () => {
		if (!disposed && anchor.isConnected) onPlace(readPanelBox(anchor))
	}
	const schedule = (waitForMotion: boolean) => {
		cancelPending()
		const requested = generation
		cancelPaint = afterPanelPaint(() => {
			if (disposed || requested !== generation) return
			const moving = waitForMotion
				? (anchor.closest(".start-block")?.getAnimations?.() ?? []).filter(
						(animation) =>
							animation.playState === "running" || animation.pending,
					)
				: []
			if (!moving.length) {
				place()
				return
			}
			let waiting = true
			const finished = () => {
				if (!waiting || disposed || requested !== generation) return
				waiting = false
				window.clearTimeout(fallback)
				cancelPaint = afterPanelPaint(place)
			}
			fallback = window.setTimeout(finished, MAX_SETTLE_MS)
			void Promise.allSettled(
				moving.map((animation) => animation.finished),
			).then(finished)
		})
	}
	const onResize = () => {
		cancelPending()
		resizeTimer = window.setTimeout(() => schedule(true), RESIZE_QUIET_MS)
	}
	window.addEventListener("resize", onResize)
	window.visualViewport?.addEventListener("resize", onResize)
	schedule(false)
	return () => {
		disposed = true
		cancelPending()
		window.removeEventListener("resize", onResize)
		window.visualViewport?.removeEventListener("resize", onResize)
	}
}
