// PROTOTYPE - throwaway. "How should the TV hand over to a real page, and how does the person get back?"
// Seven transitions from the start page's TV into the real page behind its Expand key, switchable on
// /prototype/tv-expand, and three ways back. This file is the part that outlives the room: it runs while the real
// page is on screen, so it is plain DOM code with no React in it.
//
// A "trip" is one leave through the Expand key: which transition, where the TV's picture and the key stood, and
// which history entry the TV is. It is kept in sessionStorage, so the way back survives a reload of the real page.
//
// Two browser functions are wrapped while the prototype is loaded (development only, see host.tsx):
// - `document.startViewTransition`: the router starts the transition once the next page's data is there. The
//   wrapper marks <html> just before the old picture is captured and measures the new one after the update.
// - `fetch`: a navigation's data request is held until the room's own lead-in has finished (and for 1.5 s more
//   when "slow" is on), so the transition never starts in the middle of the lead-in. Production would get the same
//   with a prefetch at press time and the navigation at the end of the lead-in.
// Notes: docs/prototypes/tv-expand-transitions/README.md.

export type TransitionKey = "today" | "grow" | "frame" | "morph" | "camera" | "live" | "wipe"
export type BackKey = "key" | "bar" | "esc"
export type Box = { left: number; top: number; width: number; height: number }

export const TRANSITIONS: { key: TransitionKey; name: string; bet: string }[] = [
	{ key: "today", name: "Today", bet: "What the start page does now: the real page is revealed from the TV's box by a growing clip. It starts when the page's data is there, and until then nothing moves." },
	{ key: "grow", name: "New", bet: "The approved prototype's run: the brackets travel to the picture's edge, the picture itself grows to the window, the page fades in. Bets on instant feedback; the price is one swap from the mini picture to the page." },
	{ key: "frame", name: "Frame", bet: "The plan's section 4: today's growing clip, with the brackets riding its edge out to the window and then folding into the Back to TV key. Bets on the motif carrying the whole way, there and back." },
	{ key: "morph", name: "Morph", bet: "Shared elements: the TV's posters, its title and its backdrop fly to their places on the real page. Bets on the content being the thread; it needs the same content on both sides." },
	{ key: "camera", name: "Camera", bet: "The room zooms into the TV until the screen is the window, with the real page already on the screen. Bets on the room staying a place you can lean back out of." },
	{ key: "live", name: "Live page", bet: "The real page is loaded inside the TV picture at scale while the key has the focus, and then only scales up. Bets on nothing swapping at all; the price is a second copy of the app." },
	{ key: "wipe", name: "Wipe", bet: "The page opens as a circle from the Expand key itself. Bets on the eye being on the key that was pressed, and on the cheapest possible build." },
]
export const BACKS: { key: BackKey; name: string }[] = [
	{ key: "key", name: "Corner key" },
	{ key: "bar", name: "Scroll-up bar" },
	{ key: "esc", name: "Escape only" },
]

export const TV_PATH = "/prototype/tv-expand"
export const ARM_MS = 420
export const GROW_MS = 850
export const SLOW_MS = 1500
export const EASE = "cubic-bezier(0.65, 0, 0.35, 1)"
/** How long each transition's own animation runs, out of the TV and back into it. */
export const MS: Record<TransitionKey, { out: number; in: number }> = {
	today: { out: 600, in: 450 },
	grow: { out: 260, in: 260 },
	frame: { out: 850, in: 450 },
	morph: { out: 650, in: 500 },
	camera: { out: 900, in: 600 },
	live: { out: 0, in: 450 },
	wipe: { out: 700, in: 450 },
}
/** Cinema's frame while the Expand key has the focus (prototype-tv-design/scene.tsx). */
export const FRAME = { stroke: 3, arm: 0.22, inset: 14, back: 0.94 }
export const AMBER = "#fbbf24"

export type Trip = {
	t: TransitionKey
	back: BackKey
	slow: boolean
	/** Reduced motion, asked for by the system or by the prototype's switch. */
	calm: boolean
	/** The TV's history entry, and its address with the screen and the focus. */
	tvIdx: number
	tvUrl: string
	/** In viewport pixels at the moment of leaving. */
	box: Box
	key: Box
	dest: { name: string; href: string }
	/** The TV item that had the focus. */
	focus: string
	/** What the Back to TV control names: "Discover › Funny". */
	screen: string
}

const STORE = "tvx:trip"
export function readTrip(): Trip | null {
	try {
		const raw = sessionStorage.getItem(STORE)
		return raw ? (JSON.parse(raw) as Trip) : null
	} catch {
		return null
	}
}
export function writeTrip(trip: Trip | null) {
	try {
		if (trip) sessionStorage.setItem(STORE, JSON.stringify(trip))
		else sessionStorage.removeItem(STORE)
	} catch {
		// Without storage the transition still runs; only the way back is lost.
	}
	emit()
}

type Running = { dir: "out" | "in" }
const rt = {
	installed: false,
	/** Holds a navigation's data request. */
	gate: null as Promise<unknown> | null,
	/** The room has asked to leave, and the router has not swapped the page yet. */
	leaving: false,
	/** Back has just popped to the TV's entry (set on popstate; a reload does not set it). */
	returning: false,
	vt: null as Running | null,
	listeners: new Set<() => void>(),
}
const emit = () => {
	for (const f of rt.listeners) f()
}
export function subscribe(f: () => void) {
	rt.listeners.add(f)
	return () => {
		rt.listeners.delete(f)
	}
}
export const transitionRunning = () => rt.vt !== null
/** Back has just popped to the TV: the room reads it when it mounts, and clears it once it stands. */
export const isReturning = () => rt.returning
export function clearReturning() {
	rt.returning = false
}
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
export const idx = () => (typeof window === "undefined" ? 0 : ((window.history.state as { idx?: number } | null)?.idx ?? 0))
export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
export const canTransition = () => typeof document !== "undefined" && typeof document.startViewTransition === "function"

/** The room asks to leave: the data request waits for `gate`, and the next transition is the way out. */
export function beginLeave(gate: Promise<unknown> | null) {
	rt.gate = gate
	rt.leaving = true
}
export function cancelLeave() {
	rt.gate = null
	rt.leaving = false
}

/** How many pages the person is from the TV's entry; 0 on the TV or when the trip is not this history's. */
export function depthFromTv(trip: Trip | null, pathname: string) {
	if (!trip || pathname === TV_PATH) return 0
	const d = idx() - trip.tvIdx
	// One step from the TV must be the page the Expand key opened; anything else is another way out of the room.
	if (d === 1 && pathname !== trip.dest.href.split("?")[0]) return 0
	return Math.max(0, d)
}
/** Back to the TV from any depth: one history move, so the router replays the transition into the TV. */
export function backToTv() {
	const trip = readTrip()
	if (!trip) return
	const d = idx() - trip.tvIdx
	if (d > 0) window.history.go(-d)
}

// ---- Measuring, and the variables the transitions' CSS reads (host.tsx).

const viewport = () => ({ w: document.documentElement.clientWidth, h: window.innerHeight })
const inset = (b: Box, by: number): Box => ({ left: b.left + by, top: b.top + by, width: b.width - 2 * by, height: b.height - 2 * by })
export function measureTv(): Box | null {
	const el = document.querySelector("[data-tv-screen]")
	if (!el) return null
	const b = el.getBoundingClientRect()
	return b.width > 0 && b.height > 0 ? { left: b.left, top: b.top, width: b.width, height: b.height } : null
}
const VARS = ["--tvx-inset", "--tvx-room", "--tvx-page", "--tvx-page-clip", "--tvx-wipe-at", "--tvx-wipe-r", "--tvx-wipe-r0"]
function setVars(box: Box, trip: Trip) {
	const { w, h } = viewport()
	const html = document.documentElement.style
	const px = (n: number) => `${Math.max(0, Math.round(n))}px`
	html.setProperty("--tvx-inset", `inset(${px(box.top)} ${px(w - box.left - box.width)} ${px(h - box.top - box.height)} ${px(box.left)} round 4px)`)
	// The camera: the room scaled until the TV's picture is as wide as the window, and the page scaled into the picture.
	const k = w / box.width
	html.setProperty("--tvx-room", `translate(${-box.left * k}px, ${-box.top * k}px) scale(${k})`)
	html.setProperty("--tvx-page", `translate(${box.left}px, ${box.top}px) scale(${1 / k})`)
	html.setProperty("--tvx-page-clip", `inset(0 0 ${px(h - box.height * k)} 0)`)
	// The wipe: a circle around the Expand key that reaches the farthest corner.
	const x = trip.key.left + trip.key.width / 2
	const y = trip.key.top + trip.key.height / 2
	html.setProperty("--tvx-wipe-at", `${Math.round(x)}px ${Math.round(y)}px`)
	html.setProperty("--tvx-wipe-r", `${Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y)))}px`)
	html.setProperty("--tvx-wipe-r0", `${Math.round(trip.key.height / 2)}px`)
}

// ---- Shared elements (Morph), and the header that the Camera leaves alone.

const tagged: HTMLElement[] = []
function tag(el: Element | null | undefined, name: string) {
	if (!(el instanceof HTMLElement)) return
	// A name may stand on one element only, or the browser skips the whole transition.
	if (tagged.some((e) => e.isConnected && e.style.viewTransitionName === name)) return
	el.style.viewTransitionName = name
	tagged.push(el)
}
function untagAll() {
	for (const el of tagged.splice(0)) el.style.viewTransitionName = ""
}
const leafWithText = (root: Element, text: string) =>
	Array.from(root.querySelectorAll<HTMLElement>("div, span, h1, h2"))
		.filter((el) => el.childElementCount === 0 && el.textContent?.trim() === text)
		.sort((a, b) => Number.parseFloat(getComputedStyle(b).fontSize) - Number.parseFloat(getComputedStyle(a).fontSize))[0]
const isTitlePage = (href: string) => /^\/(movie|show)\//.test(href)
function tagTv(trip: Trip) {
	const layers = document.querySelectorAll("[data-tv-screen] [data-tv-layer]")
	const layer = layers[layers.length - 1]
	if (!layer) return
	Array.from(layer.querySelectorAll('[data-tv-item^="t-"]'))
		.slice(0, 4)
		.forEach((el, i) => tag(el, `tvx-m${i}`))
	tag(leafWithText(layer, trip.dest.name), "tvx-title")
	if (isTitlePage(trip.dest.href)) tag(layer.querySelector("img"), "tvx-art")
}
const pageCards = () => Array.from(document.querySelectorAll('a[href^="/movie/"] img[class*="aspect-[2/3]"], a[href^="/show/"] img[class*="aspect-[2/3]"]')).map((img) => img.parentElement)
function tagPage(trip: Trip) {
	pageCards()
		.slice(0, 4)
		.forEach((el, i) => tag(el, `tvx-m${i}`))
	tag(document.querySelector("h1"), "tvx-title")
	if (isTitlePage(trip.dest.href)) tag(document.querySelector('img[class*="object-[center_22%]"]'), "tvx-art")
}
/** The site's header and the phone's dock are the same on both sides: named, they stand still while the room moves. */
function pinChrome() {
	tag(document.querySelector("body div.fixed.top-0[class*='z-[1000]']"), "tvx-header")
}
async function waitFor<T>(read: () => T | null | false, ms: number): Promise<T | null> {
	const until = performance.now() + ms
	for (;;) {
		const value = read()
		if (value) return value
		if (performance.now() > until) return null
		await sleep(30)
	}
}

// ---- The brackets (Frame): four corners of their own, so each only moves and none is stretched.

let corners: HTMLElement[] | null = null
let folds = 0
function placeCorners(box: Box, len: number) {
	folds++
	if (!corners) {
		corners = [0, 1, 2, 3].map((i) => {
			const el = document.createElement("div")
			const edge = `${FRAME.stroke}px solid ${AMBER}`
			Object.assign(el.style, { position: "fixed", zIndex: "2147483000", pointerEvents: "none", boxSizing: "border-box", viewTransitionName: `tvx-c${i}` })
			el.style[i < 2 ? "borderTop" : "borderBottom"] = edge
			el.style[i % 2 === 0 ? "borderLeft" : "borderRight"] = edge
			document.body.appendChild(el)
			return el
		})
	}
	corners.forEach((el, i) => {
		// They may be folding away from an earlier arrival: back to full strength, without a transition of their own.
		Object.assign(el.style, { transition: "none", opacity: "1", viewTransitionName: `tvx-c${i}` })
		el.style.width = el.style.height = `${len}px`
		el.style.left = `${i % 2 === 0 ? box.left : box.left + box.width - len}px`
		el.style.top = `${i < 2 ? box.top : box.top + box.height - len}px`
	})
}
function removeCorners() {
	for (const el of corners ?? []) el.remove()
	corners = null
}
/** On the real page the brackets fold into the Back to TV control, or fade where there is none. */
function foldCorners() {
	const els = corners
	if (!els) return
	const fold = ++folds
	const to = document.querySelector("[data-tvx-back]")?.getBoundingClientRect()
	for (const [i, el] of els.entries()) {
		el.style.viewTransitionName = ""
		el.style.transition = `left .45s ${EASE}, top .45s ${EASE}, width .45s ${EASE}, height .45s ${EASE}, opacity .3s linear ${to ? ".3s" : "0s"}`
		if (to && to.width > 0) {
			const len = 9
			el.style.width = el.style.height = `${len}px`
			el.style.left = `${i % 2 === 0 ? to.left - 3 : to.right + 3 - len}px`
			el.style.top = `${i < 2 ? to.top - 3 : to.bottom + 3 - len}px`
		}
		el.style.opacity = "0"
	}
	setTimeout(() => {
		if (corners === els && folds === fold) removeCorners()
	}, 700)
}
export const bracketLength = (box: Box) => Math.max(14, Math.min(120, Math.min(box.width, box.height) * FRAME.arm))

// ---- The transition's three moments.

function before(trip: Trip, dir: "out" | "in") {
	const html = document.documentElement
	const box = (dir === "out" && measureTv()) || trip.box
	setVars(box, trip)
	html.dataset.tvx = trip.calm ? "none" : `${trip.t}-${dir}`
	if (trip.calm) return
	if (trip.t === "camera") pinChrome()
	if (trip.t === "morph") dir === "out" ? tagTv(trip) : tagPage(trip)
	if (trip.t === "frame") {
		const { w, h } = viewport()
		// The room's own brackets step aside: these four take over from exactly where they stand.
		html.dataset.tvxOwn = "hidden"
		const frame = inset(box, FRAME.inset)
		placeCorners(dir === "out" ? frame : inset({ left: 0, top: 0, width: w, height: h }, FRAME.inset), bracketLength(frame))
	}
}

async function after(trip: Trip, dir: "out" | "in") {
	const { w, h } = viewport()
	if (dir === "out") {
		rt.leaving = false
		rt.gate = null
		if (trip.calm) return
		if (trip.t === "morph") {
			// Discover draws its results after the page is there. The posters have nowhere to fly until then, so the
			// transition waits here, with the old picture frozen on screen.
			if (!isTitlePage(trip.dest.href)) await waitFor(() => pageCards().length > 0, 2000)
			untagAll()
			tagPage(trip)
		}
		if (trip.t === "frame") placeCorners(inset({ left: 0, top: 0, width: w, height: h }, FRAME.inset), bracketLength(inset(trip.box, FRAME.inset)))
		return
	}
	// Back in the room: it is laid out by now, and its TV may stand elsewhere than when the person left.
	const box = (await waitFor(measureTv, 600)) ?? trip.box
	setVars(box, trip)
	if (trip.calm) return
	if (trip.t === "morph") {
		untagAll()
		tagTv(trip)
	}
	if (trip.t === "frame") placeCorners(inset(box, FRAME.inset), bracketLength(inset(box, FRAME.inset)))
}

function finished(trip: Trip, dir: "out" | "in", mine: Running) {
	// A newer transition owns the marks now.
	if (rt.vt && rt.vt !== mine) return
	if (rt.vt === mine) rt.vt = null
	const html = document.documentElement
	delete html.dataset.tvx
	for (const name of VARS) html.style.removeProperty(name)
	untagAll()
	if (dir === "out") foldCorners()
	else {
		removeCorners()
		delete html.dataset.tvxOwn
	}
	emit()
}

/** Wraps the two browser functions. Once, in the top window only: the Live page's copy in the TV must not. */
export function install() {
	if (rt.installed || typeof window === "undefined" || window.self !== window.top) return
	rt.installed = true

	const realFetch = window.fetch.bind(window)
	window.fetch = async (input, init) => {
		const gate = rt.gate
		if (!gate) return realFetch(input, init)
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
		// The router's request for the next page's data, in either of Remix's two forms.
		if (!url.includes("_data=") && !/\.data(\?|$)/.test(url)) return realFetch(input, init)
		const [response] = await Promise.all([realFetch(input, init), gate])
		return response
	}

	window.addEventListener("popstate", () => {
		const trip = readTrip()
		if (trip && idx() === trip.tvIdx) rt.returning = true
	})

	if (!canTransition()) return
	const real = document.startViewTransition.bind(document)
	type Arg = Parameters<typeof real>[0]
	document.startViewTransition = ((arg?: Arg) => {
		const update = typeof arg === "function" ? arg : (arg as { update?: () => unknown } | undefined)?.update
		const trip = readTrip()
		const at = idx()
		// Out: the room asked, or the browser's Forward repeats it. In: history stands on the TV's entry again.
		const dir = !trip ? null : rt.leaving || (at === trip.tvIdx + 1 && measureTv()) ? "out" : at === trip.tvIdx && !measureTv() ? "in" : null
		// Today's transition marks itself (ui/living-room/tv-transition.ts); it is left exactly as it is.
		if (!trip || !dir || trip.t === "today") {
			rt.leaving = false
			rt.gate = null
			return real(arg as Arg)
		}
		// Back while the way out is still animating: the router skips the running transition (the page stands whole
		// at once) and starts the way in from there. A view transition cannot be turned around.
		before(trip, dir)
		const mine: Running = { dir }
		rt.vt = mine
		const transition = real(async () => {
			await update?.()
			await after(trip, dir)
		})
		transition.finished.finally(() => finished(trip, dir, mine))
		emit()
		return transition
	}) as typeof document.startViewTransition
}

// ---- Live page: the real page in a frame of the window's size, shown in the TV's picture at scale.

type Live = { href: string; wrap: HTMLDivElement; frame: HTMLIFrameElement; ready: Promise<void>; move?: Animation; gone: boolean }
let live: Live | null = null
const settled = (doc: Document | null, href: string) => {
	if (!doc?.querySelector("h1")) return false
	// Discover is not whole until its first posters are there.
	return isTitlePage(href) || !href.startsWith("/discover") || doc.querySelectorAll('img[class*="aspect-[2/3]"]').length > 3
}
/** Starts loading the page while the Expand key has the focus. Nothing shows yet. */
export function livePreload(href: string, slow: boolean) {
	if (live?.href === href) return
	liveDrop()
	const { h } = viewport()
	const wrap = document.createElement("div")
	// As wide as the window with its scrollbar, as the real page will be.
	Object.assign(wrap.style, { position: "fixed", left: "0", top: "0", width: `${window.innerWidth}px`, height: `${h}px`, zIndex: "2147482000", transformOrigin: "0 0", opacity: "0", pointerEvents: "none", background: "#030712" })
	const frame = document.createElement("iframe")
	frame.title = "The real page"
	frame.tabIndex = -1
	Object.assign(frame.style, { width: "100%", height: "100%", border: "0", display: "block" })
	wrap.appendChild(frame)
	document.body.appendChild(wrap)
	const mine: Live = { href, wrap, frame, gone: false, ready: Promise.resolve() }
	mine.ready = (async () => {
		if (slow) await sleep(SLOW_MS)
		if (mine.gone) return
		frame.src = href
		await waitFor(() => mine.gone || settled(frame.contentDocument, href), 20_000)
		// One more beat for the posters' pictures.
		await sleep(250)
	})()
	live = mine
}
export function liveDrop() {
	if (!live) return
	live.gone = true
	live.move?.cancel()
	live.wrap.remove()
	live = null
	emit()
}
const liveAt = (box: Box) => {
	const k = window.innerWidth / box.width
	return { transform: `translate(${box.left}px, ${box.top}px) scale(${1 / k})`, clipPath: `inset(0 0 ${Math.max(0, window.innerHeight - box.height * k)}px 0)` }
}
/**
 * The key was pressed: the page shows in the picture, scales up to the window, and `arrive` makes the real
 * navigation under it. Resolves false when the person cancelled before the frame was let go.
 */
export async function liveGo(box: Box, arrive: () => void): Promise<boolean> {
	const mine = live
	if (!mine) return false
	await mine.ready
	if (mine.gone) return false
	const from = liveAt(box)
	Object.assign(mine.wrap.style, from)
	await mine.wrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: "forwards" }).finished
	if (mine.gone) return false
	mine.move = mine.wrap.animate([from, { transform: "none", clipPath: "inset(0 0 0 0)" }], { duration: 700, easing: EASE, fill: "forwards" })
	await mine.move.finished.catch(() => {})
	if (mine.gone) return false
	arrive()
	// The frame covers the window until the real page under it shows the same picture.
	await waitFor(() => window.location.pathname !== TV_PATH && settled(document, mine.href), 8000)
	await sleep(120)
	liveDrop()
	return true
}
export const liveShowing = () => Boolean(live?.move)
