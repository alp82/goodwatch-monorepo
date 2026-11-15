// The chapters' pixel effects (spots.ts). Nothing plays by itself. A spot's effect plays when the pointer moves onto
// it (desktop) or it is tapped (touch); controls play on their click. On touch, a first tap on a spot inside a link
// to another page plays the effect and holds the link, and a second tap within a few seconds follows it (in-page links
// like the chapter pills never wait). Scrolling only plays teasers: when a spot has sat fully in view for a moment,
// its teaser hints at the effect, once per spot per page view and two at a time at most. One page stage
// (page-stage.ts) plays everything; IntersectionObservers watch for the teasers (no scroll handlers) and one delegated
// listener per event type catches hovers and taps. Nothing touches layout (the canvas is fixed and transparent).
import { createPageStage } from "./page-stage"
import {
	type Box,
	type Ctx,
	PX,
	SPOTS,
	type Spot,
	sideOf,
	toDoc,
} from "./spots"

/** Seconds after an effect ends before the same element plays it again. */
const COOLDOWN = 0.6
/** Seconds a held link waits for its second tap. */
const ARMED = 5
/** How long a spot has to sit fully in view before its teaser plays (ms). */
const SETTLE = 350
/** Teasers playing at once. */
const MAX_TEASE = 2
/** The part of the screen a spot has to be fully inside for its teaser: under the site header and the chapter bar. */
const BAND = "-128px 0px -6% 0px"

const selectorOf = (spot: Spot) => spot.sel ?? `[data-fx-spot="${spot.key}"]`

function visibleBox(el: Element): Box | null {
	const r = el.getBoundingClientRect()
	return r.width || r.height ? toDoc(r) : null
}

/**
 * A text-only element's box is its text's (a number in a stretched flex column is as wide as its digits); a link that
 * wraps is its last line's (where the title ends).
 */
function inkBox(el: Element): Box | null {
	const lines = el.getClientRects()
	if (lines.length > 1 && getComputedStyle(el).display === "inline")
		return toDoc(lines[lines.length - 1])
	if (el.children.length || !el.textContent?.trim()) return visibleBox(el)
	const range = document.createRange()
	range.selectNodeContents(el)
	const r = range.getBoundingClientRect()
	return r.width ? toDoc(r) : visibleBox(el)
}

/** A link that leaves the page (not an in-page anchor). */
function leavingLink(t: Element) {
	const a = t.closest<HTMLAnchorElement>("a[href]")
	return a && !a.getAttribute("href")?.startsWith("#") ? a : null
}

/** Starts the chapters' effects; returns what stops them. */
export function startPageEffects(): () => void {
	const nav = document.querySelector<HTMLElement>('nav[aria-label="Chapters"]')
	const navTop = nav ? Number.parseFloat(getComputedStyle(nav).top) || 64 : 64
	const stage = createPageStage(PX, () => {
		if (!nav) return 0
		const r = nav.getBoundingClientRect()
		return r.top <= navTop + 1 ? r.bottom : navTop
	})
	const plays = new Map<string, number>()
	let groupSeq = 0

	/** Runs a spot's effect or teaser on `el`; returns the group it played under, or null. */
	const run = (
		spot: Spot,
		el: HTMLElement,
		kind: "play" | "tease",
		detail = "",
	) => {
		const recipe = kind === "play" ? spot.play : spot.tease
		const r = inkBox(el)
		if (!recipe || !r) return null
		const group = `${spot.key}#${groupSeq++}`
		const n = plays.get(spot.key) ?? 0
		plays.set(spot.key, n + 1)
		const ctx: Ctx = {
			el,
			r,
			box(sel) {
				if (!sel) return r
				for (const x of el.querySelectorAll(sel)) {
					const b = visibleBox(x)
					if (b) return b
				}
				return null
			},
			all(sel) {
				return [...el.querySelectorAll(sel)]
					.map(visibleBox)
					.filter((b): b is Box => !!b)
			},
			play(id, x, y, opts = {}, how = {}) {
				stage.play(id, x, y, opts, { ...how, group })
			},
			n,
			detail,
		}
		recipe(ctx)
		return group
	}

	// ---- the full effects: one per element at a time, then a short cooldown
	const playing = new WeakMap<Element, string>()
	const endedAt = new WeakMap<Element, number>()
	const groupEl = new Map<string, Element>()
	const now = () => performance.now() / 1000
	const playFull = (
		spot: Spot,
		el: HTMLElement,
		detail = "",
		force = false,
	) => {
		const g = playing.get(el)
		if (g && stage.groups().has(g)) {
			if (!force) return
			stage.stop(g)
		} else if (!force && now() - (endedAt.get(el) ?? -9) < COOLDOWN) return
		teased.add(spot.key)
		const group = run(spot, el, "play", detail)
		if (group) {
			playing.set(el, group)
			groupEl.set(group, el)
		}
	}

	// ---- teasers: a spot fully in view for a moment, once per spot, two at a time, in reading order
	const teased = new Set<string>()
	const full = new Set<HTMLElement>()
	const settle = new Map<Element, number>()
	const queue: HTMLElement[] = []
	const teasing = new Set<string>()
	const byEl = new Map<Element, Spot>()
	const pump = () => {
		const alive = stage.groups()
		for (const g of [...teasing]) if (!alive.has(g)) teasing.delete(g)
		queue.sort((x, y) =>
			x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
		)
		while (queue.length && teasing.size < MAX_TEASE) {
			const el = queue.shift()
			const spot = el && byEl.get(el)
			if (
				!el ||
				!spot ||
				teased.has(spot.key) ||
				!full.has(el) ||
				document.hidden
			)
				continue
			teased.add(spot.key)
			for (const x of document.querySelectorAll(selectorOf(spot)))
				io.unobserve(x)
			const g = run(spot, el, "tease")
			if (g) teasing.add(g)
		}
	}
	stage.onGroupEnd = (g) => {
		const el = groupEl.get(g)
		if (el) {
			endedAt.set(el, now())
			groupEl.delete(g)
		}
		if (teasing.delete(g)) pump()
	}
	const io = new IntersectionObserver(
		(entries) => {
			for (const en of entries) {
				const el = en.target as HTMLElement
				if (!byEl.has(el)) continue
				const rootH = en.rootBounds?.height ?? window.innerHeight
				const isFull =
					en.isIntersecting &&
					(en.intersectionRatio >= 0.98 ||
						en.intersectionRect.height >= rootH * 0.7)
				if (isFull && !full.has(el)) {
					full.add(el)
					settle.set(
						el,
						window.setTimeout(() => {
							settle.delete(el)
							if (full.has(el) && !queue.includes(el)) queue.push(el)
							pump()
						}, SETTLE),
					)
				} else if (!isFull && full.has(el)) {
					full.delete(el)
					window.clearTimeout(settle.get(el))
					settle.delete(el)
					const at = queue.indexOf(el)
					if (at >= 0) queue.splice(at, 1)
				}
			}
		},
		{ rootMargin: BAND, threshold: [0, 0.25, 0.5, 0.75, 0.98, 1] },
	)
	for (const spot of SPOTS) {
		if (!spot.tease) continue
		for (const el of document.querySelectorAll<HTMLElement>(selectorOf(spot))) {
			byEl.set(el, spot)
			io.observe(el)
		}
	}

	// ---- hovers, taps and reveals, delegated
	const hoverSpots = SPOTS.filter(
		(x) => x.trigger === "hover" || x.trigger === "switch",
	)
	const tapSpots = SPOTS.filter((x) => x.trigger === "tap")
	const revealSpots = SPOTS.filter((x) => x.trigger === "reveal")
	const switchSpots = SPOTS.filter((x) => x.trigger === "switch")
	let pointer = ""
	let armed: { link: Element; at: number } | null = null
	// Where the pointer last really moved: when the page scrolls under a resting pointer the browser sends pointerover
	// from the same spot, and that must not count as a hover.
	let mx = Number.NaN
	let my = Number.NaN
	const onDown = (ev: PointerEvent) => {
		pointer = ev.pointerType
	}
	const onMove = (ev: PointerEvent) => {
		mx = ev.clientX
		my = ev.clientY
	}
	const onOver = (ev: PointerEvent) => {
		if (ev.pointerType === "touch") return
		if (Number.isNaN(mx) || (ev.clientX === mx && ev.clientY === my)) return
		const t = ev.target as HTMLElement | null
		if (!t?.closest) return
		for (const spot of hoverSpots) {
			const el = t.closest<HTMLElement>(selectorOf(spot))
			if (!el) continue
			const from = ev.relatedTarget as Node | null
			if (from && el.contains(from)) continue
			playFull(spot, el, spot.trigger === "switch" ? sideOf(el) : "")
		}
	}
	const onClick = (ev: MouseEvent) => {
		const t = ev.target as HTMLElement | null
		if (!t?.closest) return
		const touch = pointer === "touch"
		pointer = ""
		const button = t.closest("button")
		// Controls: the recipe reads the line after React has swapped it.
		for (const spot of tapSpots) {
			const el = t.closest<HTMLElement>(selectorOf(spot))
			if (el)
				requestAnimationFrame(() => playFull(spot, el, el.textContent ?? ""))
		}
		// A trivia card's answer shown, or the first answer picked on a quiz card (after the quiz's own effect).
		for (const spot of revealSpots) {
			const card = button?.closest<HTMLElement>(selectorOf(spot))
			if (!card || !button) continue
			if (button.hasAttribute("data-reveal"))
				window.setTimeout(() => playFull(spot, card, "", true), 220)
			else if (
				button.hasAttribute("data-quiz-answer") &&
				button.getAttribute("aria-disabled") !== "true"
			)
				window.setTimeout(() => playFull(spot, card), 650)
		}
		// The seasonal card's switch plays the side it switched to.
		for (const spot of switchSpots) {
			const card = button?.closest<HTMLElement>(selectorOf(spot))
			if (card)
				requestAnimationFrame(() =>
					requestAnimationFrame(() => playFull(spot, card, sideOf(card), true)),
				)
		}
		// A switch marked data-fx-replay="<key>" replays that spot (the binge count pills).
		const replay =
			button?.closest<HTMLElement>("[data-fx-replay]")?.dataset.fxReplay
		const again = replay && SPOTS.find((x) => x.key === replay)
		const againEl =
			again && document.querySelector<HTMLElement>(selectorOf(again))
		if (again && againEl)
			requestAnimationFrame(() => playFull(again, againEl, "", true))
		if (!touch) return
		// Touch: a tap is the hover.
		for (const spot of hoverSpots) {
			const el = t.closest<HTMLElement>(selectorOf(spot))
			if (!el || (spot.trigger === "switch" && button)) continue
			const link = leavingLink(t)
			if (link) {
				if (armed?.link === link && now() - armed.at < ARMED) {
					armed = null
					continue
				}
				// The first tap plays and holds the link; the second follows it.
				ev.preventDefault()
				ev.stopPropagation()
				armed = { link, at: now() }
			}
			playFull(spot, el, spot.trigger === "switch" ? sideOf(el) : "")
		}
	}
	// Capture: React swaps the tapped line (and drops the reveal button) before a bubbling listener would see it, and a
	// held link has to be stopped before the router sees the click.
	document.addEventListener("pointerdown", onDown, true)
	document.addEventListener("click", onClick, true)
	document.addEventListener("pointerover", onOver)
	document.addEventListener("pointermove", onMove, { passive: true })
	const onVisibility = () => {
		if (document.hidden) stage.clear()
	}
	document.addEventListener("visibilitychange", onVisibility)

	return () => {
		io.disconnect()
		for (const id of settle.values()) window.clearTimeout(id)
		document.removeEventListener("pointerdown", onDown, true)
		document.removeEventListener("click", onClick, true)
		document.removeEventListener("pointerover", onOver)
		document.removeEventListener("pointermove", onMove)
		document.removeEventListener("visibilitychange", onVisibility)
		stage.destroy()
	}
}
