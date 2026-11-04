// After find picks something: scroll to it and flash an amber ring over it. The ring is its own layer, fixed over the
// page and moved by transform to follow the element while things scroll, so the sections stay untouched.

/** The site header (64 px), the title bar (48 px), and some air. */
const STICKY = 64 + 48 + 16

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()

/** Shown and not faded out (a grid keeps a hidden second layout of the same cells). */
export const visible = (el: HTMLElement) => {
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

let lastRing: { el: HTMLElement; frame: number } | null = null

/** The element find last rang, so the ?hl= marks (marks.ts) can make the match inside it the current one. */
export let lastFlashed: HTMLElement | null = null
export const FLASH_EVENT = "find-flash"

const AMBER = "251 191 36"
/** How long the ring shows, in ms. */
const RING_MS = 2600

/** The element's nearest ancestor that scrolls by itself (a list with its own scroll), or null. */
function scrollBox(el: HTMLElement): HTMLElement | null {
	for (
		let p = el.parentElement;
		p && p !== document.body && p !== document.documentElement;
		p = p.parentElement
	) {
		const o = getComputedStyle(p).overflowY
		if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 1)
			return p
	}
	return null
}

/**
 * Centers `el` (when it is taller than the window, its top) and flashes a ring around it. Inside a box that scrolls
 * by itself (the tropes list) that box scrolls instead of the window. The ring settles in with a soft glow and fades
 * (transform and opacity; with reduced motion only the fades).
 */
export function flash(el: HTMLElement) {
	if (lastRing) {
		cancelAnimationFrame(lastRing.frame)
		lastRing.el.remove()
	}
	const rect = el.getBoundingClientRect()
	const box = scrollBox(el)
	const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
	const behavior: ScrollBehavior = still ? "auto" : "smooth"
	if (box) {
		const b = box.getBoundingClientRect()
		const top = rect.top - b.top + box.scrollTop
		box.scrollTo({
			top: Math.max(
				0,
				rect.height > box.clientHeight
					? top - 16
					: top - (box.clientHeight - rect.height) / 2,
			),
			behavior,
		})
		// The box itself off screen (not a sticky list beside the page): the window brings it in.
		if (b.bottom < STICKY || b.top > window.innerHeight)
			window.scrollTo({
				top: Math.max(0, b.top + window.scrollY - STICKY),
				behavior,
			})
	} else {
		const room = window.innerHeight - STICKY
		const top =
			rect.height > room
				? rect.top + window.scrollY - STICKY
				: rect.top + window.scrollY - STICKY - (room - rect.height) / 2
		window.scrollTo({ top: Math.max(0, top), behavior })
	}
	lastFlashed = el
	window.dispatchEvent(new Event(FLASH_EVENT))
	// The outer box only follows the element (translate); the ring inside it animates.
	const ring = document.createElement("div")
	ring.setAttribute("aria-hidden", "true")
	Object.assign(ring.style, {
		position: "fixed",
		left: "0px",
		top: "0px",
		width: `${rect.width + 12}px`,
		height: `${rect.height + 12}px`,
		pointerEvents: "none",
		zIndex: "35",
		willChange: "transform",
	})
	const place = () => {
		const r = el.getBoundingClientRect()
		ring.style.transform = `translate(${r.left - 6}px, ${r.top - 6}px)`
	}
	place()
	const glow = document.createElement("div")
	Object.assign(glow.style, {
		position: "absolute",
		inset: "0",
		borderRadius: "12px",
		opacity: "0",
		willChange: "transform, opacity",
		boxShadow: `0 0 0 1.5px rgb(${AMBER}), 0 0 28px 4px rgb(${AMBER} / .4), inset 0 0 18px rgb(${AMBER} / .12)`,
	})
	ring.appendChild(glow)
	document.body.appendChild(ring)
	glow.animate(
		still
			? [{ opacity: 0 }, { opacity: 1 }]
			: [
					{ opacity: 0, transform: "scale(1.07)" },
					{ opacity: 1, transform: "scale(1)" },
				],
		{ duration: 460, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" },
	)
	glow.animate([{ opacity: 1 }, { opacity: 0 }], {
		delay: 1500,
		duration: 1000,
		easing: "ease-in",
		fill: "forwards",
	})
	const started = performance.now()
	const state = { el: ring, frame: 0 }
	lastRing = state
	const follow = () => {
		place()
		if (performance.now() - started < RING_MS)
			state.frame = requestAnimationFrame(follow)
	}
	state.frame = requestAnimationFrame(follow)
	window.setTimeout(() => ring.remove(), RING_MS)
}
