// What opens over a surface that is itself an overlay (the quick view, For you's drawers): where it goes in the
// document, and the mark that tells the surface underneath to leave it alone.
//
// - Where: a portal goes into the surface's own root when it has given one (OverlayRoot), so that it shows over the
//   surface even when that is inside an element in full screen (the related map's), else into the element in full
//   screen, else into the body.
// - The mark: an overlay opened from inside the surface (the score picker, the not-seen question, a status menu, the
//   episode picker, the watch log, the date dialog) carries `data-nested-overlay` while it is open. The surface's
//   focus scope, Escape, arrows and taps on its dim then yield to it (ui/for-you/focus.ts, ui/quick-view).
import { createContext, useContext } from "react"

/** The element a surface's nested overlays portal into; null leaves it to the page. */
export const OverlayRoot = createContext<Element | null>(null)

/** Where to portal an overlay; null before there is a document (the server's render). */
export function useOverlayRoot(): Element | null {
	const root = useContext(OverlayRoot)
	if (root) return root
	if (typeof document === "undefined") return null
	return document.fullscreenElement ?? document.body
}

/** Spread on an overlay's root while it is open: `{...NESTED_OVERLAY}`. */
export const NESTED_OVERLAY = { "data-nested-overlay": "" } as const

/** Every open nested overlay: the mark, and the score picker, which predates it. */
export const NESTED_OVERLAY_SELECTOR =
	"[data-nested-overlay],[data-score-dialog]"

/** The node is inside a nested overlay. */
export const inNestedOverlay = (node: EventTarget | null) =>
	node instanceof Element && !!node.closest(NESTED_OVERLAY_SELECTOR)

/** A nested overlay is open: anywhere in the document, or a menu of the surface's own (`within`). */
export const nestedOverlayOpen = (within?: Element | null) =>
	!!document.querySelector(NESTED_OVERLAY_SELECTOR) ||
	!!within?.querySelector('[aria-expanded="true"]')
