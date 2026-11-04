// Find in this title across the title page and its sub-pages: where a match lives, and getting there.
// - A match on a sub-page (Fingerprint, Tropes, At a glance) carries a Go: what to point at there (a fingerprint
//   line, a section or a scale; a trope to open) and what to ring (an element, or the words in a part).
// - Picking one goes in through the sub-page navigation (a click on a real link, so the title page's way in takes it
//   and Back lands where you were) and leaves the Go behind (sessionStorage, by the sub-page's path); the sub-page
//   takes it once it is up and lands on it: points, waits for the thing to be laid out (and the transition to end),
//   rings it.
// - A match on the title page picked on a sub-page goes back (a step back in the history when it opened from there)
//   and leaves a PageGo, which the title page takes the same way (TitlePage.tsx).
import { openedFromTitlePage } from "~/ui/details/sub-page/way-back"
import { writeJump } from "~/ui/details/sub-page/way-in"
import { flash, locate, visible } from "./highlight"
import { carryHl, withHl } from "./marks"

export type FingerprintPoint = {
	kind: "section" | "effect" | "scale"
	id: string
}

export interface Go {
	/** An element id the match sits in (searched for `needle`). */
	scope?: string
	/** The element to ring, before `needle` is tried. */
	selector?: string
	/** Words the page shows for the match, rung where they are. */
	needle?: string
	/** The fingerprint's explanation to show first. */
	fp?: FingerprintPoint
	/** The trope to open first (its id). */
	trope?: string
}

/** A match on the title page, picked elsewhere: its section and words, or someone from the cast or crew. */
export interface PageGo {
	section: string
	needle?: string
	selector?: string
	person?: { kind: "cast" | "crew"; id: number; name: string }
	castSearch?: string
}

// --- What the sub-pages answer to ----------------------------------------------------------------------------------

/** Set by the mounted sub-page parts: the fingerprint's explanation, the tropes page's open trope. */
export const bridges: {
	fp: ((p: FingerprintPoint) => void) | null
	/** Opens a trope; false while the tropes haven't loaded. */
	trope: ((id: string) => boolean) | null
} = { fp: null, trope: null }

// --- What is left behind for the next page ----------------------------------------------------------------------

const KEY = "find-landing"

function leave(path: string, go: Go | PageGo, kind: "sub" | "page") {
	try {
		sessionStorage.setItem(
			KEY,
			JSON.stringify({ path, go, kind, at: Date.now() }),
		)
	} catch {}
}

function take<T>(path: string, kind: "sub" | "page"): T | null {
	try {
		const raw = sessionStorage.getItem(KEY)
		if (!raw) return null
		const x = JSON.parse(raw) as {
			path: string
			go: T
			kind: string
			at: number
		}
		if (x.path !== path || x.kind !== kind) return null
		sessionStorage.removeItem(KEY)
		return Date.now() - x.at < 15_000 ? x.go : null
	} catch {
		return null
	}
}

export const takeSubGo = (path: string) => take<Go>(path, "sub")
export const takePageGo = (path: string) => take<PageGo>(path, "page")

// --- Going --------------------------------------------------------------------------------------------------------

/**
 * Goes into a sub-page at `to` and lands on `go` there. From the title page the way in is a click on a link: its
 * way in takes any click on a link to a sub-page (sub-page/SubPageLinks.tsx); `from` is where the link sits (the
 * rail, so the way back keeps the page's place; its section otherwise). From a sub-page, pass the router's navigate.
 */
export function goSub(
	to: string,
	go: Go,
	from: Element | null,
	navigate?: (to: string) => void,
) {
	const href = withHl(to)
	const path = new URL(href, window.location.href).pathname
	leave(path, go, "sub")
	if (navigate) return navigate(href)
	const a = document.createElement("a")
	a.href = href
	a.hidden = true
	;(from ?? document.body).appendChild(a)
	a.click()
	a.remove()
}

/** From a sub-page: back to the title page at `pagePath`, landing on `go` there. */
export function goPage(
	pagePath: string,
	go: PageGo,
	navigate: (to: string) => void,
) {
	const path = pagePath.split(/[?#]/)[0]
	leave(path, go, "page")
	carryHl(path)
	// The title page lands on the section at once (its rail entries do the same), then rings the words.
	writeJump(path, go.section)
	if (openedFromTitlePage()) window.history.back()
	else navigate(pagePath)
}

// --- Landing ------------------------------------------------------------------------------------------------------

const transitionRuns = () =>
	document
		.getAnimations()
		.some((a) =>
			((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith(
				"::view-transition",
			),
		)

/**
 * On the sub-page: points at the Go's thing and rings it once it is there (data loads, parts lay out, the way in
 * animates), trying for a few seconds. Returns a stop.
 */
export function land(go: Go, root: () => HTMLElement | null): () => void {
	let pointed = !go.fp && !go.trope
	let n = 0
	let t = 0
	const started = performance.now()
	const tick = () => {
		n++
		if (performance.now() - started > 6000) return
		if (!pointed) {
			if (go.fp && bridges.fp) {
				bridges.fp(go.fp)
				pointed = true
			} else if (go.trope && bridges.trope?.(go.trope)) pointed = true
		}
		const base = root()
		if (pointed && base && !transitionRuns()) {
			const scope = (go.scope && document.getElementById(go.scope)) || base
			const bySelector = go.selector
				? scope.querySelector<HTMLElement>(go.selector)
				: null
			const el =
				(bySelector && visible(bySelector) ? bySelector : null) ??
				(go.needle ? locate(scope, go.needle) : null)
			// A part that is there without the words (they are drawn, not written): the part itself.
			const fallback =
				!el && n > 25 && go.scope ? document.getElementById(go.scope) : null
			if (el || fallback) {
				// One more frame for whatever the pointing changed.
				requestAnimationFrame(() =>
					requestAnimationFrame(() => flash((el ?? fallback) as HTMLElement)),
				)
				return
			}
		}
		t = window.setTimeout(tick, 120)
	}
	t = window.setTimeout(tick, 60)
	return () => window.clearTimeout(t)
}
