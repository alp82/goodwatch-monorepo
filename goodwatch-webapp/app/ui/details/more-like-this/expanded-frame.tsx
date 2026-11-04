// The pieces of the title page's own frame that More like this's expanded view uses, so it reads as the same page
// zoomed into one section:
// - FrameBar: the header every sub-page of the title page has (sub-page/SubPageHeader.tsx): the title bar with a back
//   chevron, the whole row one button back.
// - takePage: the section takes over the main column: everything else in the page column (the opener, the trailer,
//   the other sections) is hidden, the rail stays (on a phone, where the rail is only "You" above the sections, it
//   goes too). Returns the undo. The page is a React tree this code doesn't own, so it marks elements with data
//   attributes that a style of its own hides, and React never sees a change.
import type { ReactNode } from "react"
import { SubPageHeader } from "~/ui/details/sub-page/SubPageHeader"

export const FRAME_STYLE = `
[data-shelves-hidden] { display: none !important; }
@media (max-width: 1023px) { [data-shelves-hidden-phone] { display: none !important; } }
@media (min-width: 1024px) { [data-shelves-rows] { grid-row: 1 / span 2 !important; } }
`

/** The title page's section that holds More like this. */
export const moreSection = (from: Element | null) =>
	(from?.closest("section#more-like-this") ??
		from?.closest("section")) as HTMLElement | null

/**
 * The bottom of the title bar: the site header's 64 px and the bar's own height, which on a phone holds the page's
 * section nav too (TitleBar's children); without the bar 52 px on a phone, 48 px from lg.
 */
export const barBottom = () => {
	const bar = document.querySelector<HTMLElement>("[data-title-bar]")
	return (
		64 +
		(bar?.offsetHeight ||
			(window.matchMedia("(min-width: 1024px)").matches ? 48 : 52))
	)
}

export function takePage(from: HTMLElement): () => void {
	const marked: [HTMLElement, string][] = []
	const mark = (el: Element, attr: string) => {
		if (!(el instanceof HTMLElement) || el.hasAttribute(attr)) return
		el.setAttribute(attr, "")
		marked.push([el, attr])
	}
	const top = from.closest("#overview")
	let at: HTMLElement | null = from
	while (at && at !== top && at.parentElement) {
		// The page column in the page's grid: from its first row, so the rail beside it (two rows tall) never pushes it
		// down while the section's content is still short.
		if (getComputedStyle(at.parentElement).display === "grid")
			mark(at, "data-shelves-rows")
		for (const sib of at.parentElement.children) {
			if (sib === at || sib.hasAttribute("data-title-bar")) continue
			const pos = getComputedStyle(sib).position
			if (pos === "fixed" || pos === "absolute") continue
			mark(
				sib,
				sib.tagName === "ASIDE"
					? "data-shelves-hidden-phone"
					: "data-shelves-hidden",
			)
		}
		at = at.parentElement
	}
	// The section's top under the title bar, even when what was above it was short.
	const overview = top as HTMLElement | null
	const prevPad = overview?.style.paddingTop ?? ""
	if (overview) {
		const pt = Number.parseFloat(getComputedStyle(from).paddingTop) || 0
		const docTop = from.getBoundingClientRect().top + window.scrollY
		const need = barBottom() + 20 - pt - docTop
		if (need > 0) overview.style.paddingTop = `${need}px`
	}
	return () => {
		for (const [el, attr] of marked) el.removeAttribute(attr)
		if (overview) overview.style.paddingTop = prevPad
	}
}

/** Scrolls (instantly) so the section's header sits just under the title bar. */
export function scrollSectionUnderBar(section: HTMLElement) {
	const pt = Number.parseFloat(getComputedStyle(section).paddingTop) || 0
	const y =
		window.scrollY + section.getBoundingClientRect().top + pt - barBottom() - 20
	window.scrollTo({
		top: Math.max(0, y),
		left: window.scrollX,
		behavior: "instant" as ScrollBehavior,
	})
}

/** The expanded view's header: the title page's bar with the way back. */
export function FrameBar({
	poster,
	title,
	trail,
	onBack,
	end,
}: {
	poster: string | null
	title: string
	/** After the title, for screen readers: "More like this", then the block being read. */
	trail: string[]
	onBack: () => void
	end?: ReactNode
}) {
	return (
		<SubPageHeader
			poster={poster}
			title={title}
			crumbs={trail}
			back={{ onBack }}
			end={end}
		/>
	)
}

/** A shelf as the expanded view and the rail list it. */
export interface Tab {
	id: string
	kind: string
	title: string
	count: number
	posters: (string | null)[]
	head: DOMRect | null
}
