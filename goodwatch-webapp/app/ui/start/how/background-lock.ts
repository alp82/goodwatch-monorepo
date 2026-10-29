// The page under the intro theater (IntroTheater.tsx) while the film is open: out of reach and still.
// - Everything in <body> beside the theater's layer is inert, so Tab stays in the theater and nothing behind it takes
//   a click or a screen reader's cursor.
// - The window doesn't scroll (PageDown, Space, arrow keys): the page is where it was when Close brings it back. The
//   scrollbar's gutter stays, so nothing behind moves sideways.
// Both come back exactly as they were, once, whichever of Close or unmounting comes first.

/** Locks the page around `layer` (a child of <body>); the returned function unlocks it, and only the first call does. */
export function lockBackground(layer: HTMLElement): () => void {
	const doc = layer.ownerDocument
	const html = doc.documentElement
	const made: Element[] = []
	for (const el of Array.from(doc.body.children)) {
		if (el === layer || el.hasAttribute("inert")) continue
		el.setAttribute("inert", "")
		made.push(el)
	}

	const before = {
		overflow: html.style.overflow,
		gutter: html.style.getPropertyValue("scrollbar-gutter"),
		paddingRight: html.style.paddingRight,
	}
	const width = html.clientWidth
	const bar = (doc.defaultView?.innerWidth ?? width) - width
	if (bar > 0) html.style.setProperty("scrollbar-gutter", "stable")
	html.style.overflow = "hidden"
	// A browser without scrollbar-gutter widens the page as the bar goes: pad it back.
	const grew = html.clientWidth - width
	if (bar > 0 && grew > 0) html.style.paddingRight = `${grew}px`

	let locked = true
	return () => {
		if (!locked) return
		locked = false
		for (const el of made) el.removeAttribute("inert")
		html.style.overflow = before.overflow
		if (before.gutter) html.style.setProperty("scrollbar-gutter", before.gutter)
		else html.style.removeProperty("scrollbar-gutter")
		html.style.paddingRight = before.paddingRight
	}
}
