// The intro's Try it (IntroTheater.tsx): once the theater has closed, bring the guest to the start page's search.
// It reads the stage's markup (stage/StartStage.tsx), not its state: the card shows only its ledge until the guest
// has asked for something (`.start-stage[data-open]` once they have).
// - Nothing asked yet: scroll to the stage (the page's top) and focus the search field.
// - Something asked: center the card on screen, focus its first control, and pulse its ring (how-it-works.css,
//   `data-pulse`).
// The window scrolls itself: scrollIntoView would also scroll the stage's clipped boxes and shift what's in them.

/** How long the card's ring pulses (how-it-works.css). */
export const PULSE_MS = 1500
/** The pulse starts once a smooth scroll has mostly settled. */
const PULSE_AFTER_MS = 420
/** The site header's height: the card centers in the screen under it. */
const HEADER_PX = 64

export type HandOff =
	| { kind: "search"; top: number }
	| { kind: "card"; top: number }

/** Where to scroll and what to do there, from the stage's and the card's boxes in the page (document px). */
export function handOffPlan({
	asked,
	stageTop,
	cardTop,
	cardHeight,
	viewport,
}: {
	asked: boolean
	stageTop: number
	cardTop: number
	cardHeight: number
	viewport: number
}): HandOff {
	// The stage starts under the site header: its top is the page's.
	if (!asked) return { kind: "search", top: Math.max(0, stageTop - HEADER_PX) }
	const room = viewport - HEADER_PX
	const top = cardTop - HEADER_PX - Math.max(16, (room - cardHeight) / 2)
	return { kind: "card", top: Math.max(0, top) }
}

/** Brings the guest to the search, as the plan says. Does nothing on a page without the stage. */
export function bringToSearch(doc: Document = document): void {
	const win = doc.defaultView
	const stage = doc.querySelector<HTMLElement>(".start-stage")
	const card = doc.getElementById("start-card")
	if (!win || !stage || !card) return
	const reduce = win.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	const y = win.scrollY
	const cardBox = card.getBoundingClientRect()
	const plan = handOffPlan({
		asked: stage.hasAttribute("data-open"),
		stageTop: stage.getBoundingClientRect().top + y,
		cardTop: cardBox.top + y,
		cardHeight: cardBox.height,
		viewport: win.innerHeight,
	})
	win.scrollTo({ top: plan.top, behavior: reduce ? "instant" : "smooth" })
	if (plan.kind === "search") {
		stage
			.querySelector<HTMLElement>(".start-search input")
			?.focus({ preventScroll: true })
		return
	}
	// Keyboard users go on from the card's first control.
	card
		.querySelector<HTMLElement>("button:not([disabled]), a[href], input")
		?.focus({ preventScroll: true })
	if (reduce) return
	win.setTimeout(() => {
		card.removeAttribute("data-pulse")
		// A fresh attribute restarts the animation.
		void card.offsetWidth
		card.setAttribute("data-pulse", "")
		win.setTimeout(() => card.removeAttribute("data-pulse"), PULSE_MS + 50)
	}, PULSE_AFTER_MS)
}
