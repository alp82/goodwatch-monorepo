import { useEffect } from "react"
import { type TapElement, claimTap } from "~/utils/replay-tap"

/** Whether the control is within a screen of what the visitor is looking at, and displayed. */
function near(el: TapElement): boolean {
	if (!(el instanceof Element)) return false
	const rect = el.getBoundingClientRect()
	if (rect.width === 0 && rect.height === 0) return false
	// A section that skips its layout (ui/details/below-fold.tsx) has no place for its content.
	if (
		typeof el.checkVisibility === "function" &&
		!el.checkVisibility({ contentVisibilityAuto: true })
	)
		return false
	const screen = window.innerHeight
	return rect.bottom > -screen && rect.top < 2 * screen
}

/**
 * Does the tap that a visitor made on one of this component's controls before the app's script was there (see
 * replay-tap.ts). Mark each control with `data-replay-tap` and call this in the component that owns the handlers.
 * The tap becomes a click on the tapped element, so it goes through the control's own handler.
 *
 * `accept` says whether an element is this component's own, for a group that several components on a page share.
 */
export function useReplayedTap(
	group: string,
	accept?: (el: Element) => boolean,
): void {
	// Once, when the component is mounted: its handlers and those of its children are in place then.
	useEffect(() => {
		const el = claimTap(window, group, {
			now: Date.now(),
			path: window.location.pathname,
			accept:
				accept && ((tapped) => tapped instanceof Element && accept(tapped)),
			near,
		})
		el?.click()
	}, [])
}
