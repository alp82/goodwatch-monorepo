// After find picks something: scroll to it and flash an amber ring over it. The ring is its own layer (opacity only),
// so the sections stay untouched.

/** The site header (64 px), the title bar (48 px), and some air. */
const STICKY = 64 + 48 + 16

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()

/** Shown and not faded out (a grid keeps a hidden second layout of the same cells). */
const visible = (el: HTMLElement) => {
	const r = el.getBoundingClientRect()
	if (!r.width || !r.height) return false
	const check = (
		el as HTMLElement & { checkVisibility?: (o: object) => boolean }
	).checkVisibility
	return check
		? check.call(el, { opacityProperty: true, visibilityProperty: true })
		: true
}

/** The first visible element in `root` whose label, title or text holds `needle`. */
export function locate(root: HTMLElement, needle: string): HTMLElement | null {
	const n = norm(needle)
	if (!n) return null
	const labelled = Array.from(
		root.querySelectorAll<HTMLElement>("[aria-label], [title]"),
	).find(
		(el) =>
			norm(
				`${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`,
			).includes(n) && visible(el),
	)
	if (labelled) return labelled
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
	let best: HTMLElement | null = null
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (!norm(node.textContent ?? "").includes(n)) continue
		const el = node.parentElement
		if (el && visible(el)) {
			best = el
			break
		}
	}
	// A text node holds part of a name split over elements: take the closest element that holds all of it.
	if (!best) {
		const all = Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
			(el) => norm(el.textContent ?? "").includes(n),
		)
		best = all.length ? all[all.length - 1] : null
	}
	// Grow a bare text line to its row (a link, a list item, a card) so the ring frames something whole.
	return (
		(best?.closest(
			"a, button, li, dt, dd, h3, summary",
		) as HTMLElement | null) ?? best
	)
}

let lastRing: HTMLElement | null = null

/** Centers `el` (when it is taller than the window, its top) and flashes a ring around it. */
export function flash(el: HTMLElement) {
	lastRing?.remove()
	const rect = el.getBoundingClientRect()
	const room = window.innerHeight - STICKY
	const top =
		rect.height > room
			? rect.top + window.scrollY - STICKY
			: rect.top + window.scrollY - STICKY - (room - rect.height) / 2
	window.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
	const ring = document.createElement("div")
	ring.setAttribute("aria-hidden", "true")
	Object.assign(ring.style, {
		position: "absolute",
		left: `${rect.left + window.scrollX - 6}px`,
		top: `${rect.top + window.scrollY - 6}px`,
		width: `${rect.width + 12}px`,
		height: `${rect.height + 12}px`,
		borderRadius: "12px",
		boxShadow: "0 0 0 2px rgb(251 191 36), 0 0 24px 2px rgb(251 191 36 / 0.35)",
		pointerEvents: "none",
		zIndex: "35",
		opacity: "0",
		transition: "opacity 220ms ease-out",
	})
	document.body.appendChild(ring)
	lastRing = ring
	requestAnimationFrame(() => {
		ring.style.opacity = "1"
		window.setTimeout(() => {
			ring.style.transition = "opacity 900ms ease-in"
			ring.style.opacity = "0"
		}, 1300)
		window.setTimeout(() => ring.remove(), 2400)
	})
}
