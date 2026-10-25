// Focus for the page's drawers and the quick view (ui/quick-view), without a dialog library (their motion stays their own, and the
// taste bar stays usable beside its drawers):
// - on opening, focus moves into the scope (unless it is already there);
// - while open, Tab and Shift+Tab cycle through the scope's elements only, and focus that lands outside goes back in;
// - on closing, focus returns to where it came from (or to `returnTo`), unless it has moved somewhere else since.
// Escape stays with each surface, which closes itself.
import { useEffect, useRef } from "react"
import { inNestedOverlay } from "~/ui/overlay"

const FOCUSABLE =
	'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function tabbable(roots: HTMLElement[]): HTMLElement[] {
	const out: HTMLElement[] = []
	for (const root of roots)
		for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
			if (el.closest('[aria-hidden="true"],[inert]')) continue
			if (!el.getClientRects().length) continue
			if (getComputedStyle(el).visibility === "hidden") continue
			out.push(el)
		}
	return out.sort((a, b) =>
		a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
	)
}

/**
 * An overlay opened from inside a drawer or the card (the score picker, the not-seen question, a status menu, the
 * episode picker, the watch log; ui/overlay.ts) has its own keys: the surface's Escape, arrows and Tab leave them
 * alone while focus is there, and focus in it isn't pulled back.
 */
export const inNestedDialog = inNestedOverlay

/** Focus in another dialog (the site's hub or search) is that dialog's own. */
const elsewhere = (n: Element) =>
	!!n.closest('[role="dialog"],#headlessui-portal-root')

export function useFocusScope({
	active,
	scope,
	initial,
	returnTo,
}: {
	active: boolean
	/** The elements focus stays within (in document order). */
	scope: () => (HTMLElement | null | undefined)[]
	/** Where focus goes on opening: usually the dialog itself (tabIndex -1). */
	initial: () => HTMLElement | null | undefined
	/** Where focus goes on closing; the element focused before opening when this gives nothing. */
	returnTo?: () => HTMLElement | null | undefined
}) {
	const latest = useRef({ scope, initial, returnTo })
	latest.current = { scope, initial, returnTo }
	const trigger = useRef<HTMLElement | null>(null)
	const pending = useRef(false)

	useEffect(() => {
		if (!active) return
		const roots = () =>
			latest.current.scope().filter((r): r is HTMLElement => !!r)
		const inside = (n: EventTarget | null) =>
			n instanceof Node && roots().some((r) => r.contains(n))
		// The opener may sit in the scope too (the taste bar): focus still moves into the dialog itself.
		const was = document.activeElement
		const inDialog = !!was && !!latest.current.initial()?.contains(was)
		trigger.current =
			was instanceof HTMLElement && was !== document.body && !inDialog
				? was
				: null
		const enter = () => latest.current.initial()?.focus({ preventScroll: true })
		if (!inDialog) enter()

		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Tab" || e.defaultPrevented) return
			// An overlay outside the scope keeps its own Tab; a menu inside it goes round with the rest.
			const at = document.activeElement
			if (inNestedDialog(at) && !inside(at)) return
			const list = tabbable(roots())
			e.preventDefault()
			if (!list.length) return enter()
			const index = list.indexOf(at as HTMLElement)
			const step = e.shiftKey ? -1 : 1
			const next =
				index < 0
					? list[e.shiftKey ? list.length - 1 : 0]
					: list[(index + step + list.length) % list.length]
			next.focus()
		}
		const onFocusIn = (e: FocusEvent) => {
			const t = e.target
			if (
				inside(t) ||
				inNestedDialog(t) ||
				(t instanceof Element && elsewhere(t))
			)
				return
			enter()
		}
		document.addEventListener("keydown", onKey, true)
		document.addEventListener("focusin", onFocusIn)
		return () => {
			document.removeEventListener("keydown", onKey, true)
			document.removeEventListener("focusin", onFocusIn)
			pending.current = true
		}
	}, [active])

	// Declared after the caller's own effects, so it runs once they have (e.g. a hidden poster shown again).
	useEffect(() => {
		if (active || !pending.current) return
		pending.current = false
		const to = latest.current.returnTo?.() ?? trigger.current
		trigger.current = null
		const now = document.activeElement
		const scoped = latest.current
			.scope()
			.some((r) => !!r && !!now && r.contains(now))
		if (
			to?.isConnected &&
			(!now || now === document.body || scoped || !now.isConnected)
		)
			to.focus({ preventScroll: true })
	}, [active])
}
