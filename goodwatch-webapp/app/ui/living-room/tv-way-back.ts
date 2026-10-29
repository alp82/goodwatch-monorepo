// What the app remembers when a person leaves the living room through its TV (tv-transition.ts), and for how long
// the TV button shows them the way back (TvWayBack.tsx). No DOM and no React in here: the app shell reads it on
// every page, and the tests run it as it is.
//
// A "trip" is one leave through the TV. It is kept in sessionStorage, so the way back survives a reload of the
// page the TV opened, and it stays after the person has come back, so the browser's Forward finds it again.

/**
 * The TV button lives only on the page the TV opened. After one navigation the TV is no longer where the
 * person is coming from. The browser's Back is not touched by this.
 */
export const WAY_BACK_LIVES = 1

export const TRIP_KEY = "living-room:left-through-tv"
/** Marks the TV button on a page reached through the TV: the brackets fold into it. */
export const TV_BACK_ATTR = "data-tv-back"
/** Marks the four brackets, 0 to 3 from the top left. `main.css` places them by it. */
export const TV_BRACKET_ATTR = "data-tv-bracket"
/** Marks <html> while the transition's CSS (main.css) runs, with its direction. */
export const TV_TRANSITION_ATTR = "data-tv-transition"

/** In window pixels. */
export type TvBox = { left: number; top: number; width: number; height: number }

export type TvTrip = {
	/** The TV's entry in this tab's history (the router's `idx`). */
	idx: number
	/** The path of the page the TV opened. */
	to: string
	/** The path of the TV's own page. Missing in a trip an older build stored, from when the TV was the start page. */
	from?: string
	/** The TV's picture and the window at the moment of leaving; `null` when the page changed without motion. */
	box: TvBox | null
	w: number
	h: number
	/** The picture the TV showed, small: the TV button shows it. */
	art: string | null
	/** The person is on a page reached through the TV. The room clears it when they are back. */
	out: boolean
	/** How far the room was scrolled, where it is taller than the window. Missing in a trip an older build stored. */
	scroll?: number
	/** How far each of the screen's columns (`data-tv-scroll`) was scrolled, in the page's order. */
	columns?: number[]
	/** The router's key of the TV's entry: a new visit at the same place in history is another entry. */
	key?: string
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

/** Reads a stored trip. Anything else, such as what an older build stored under the same key, is no trip. */
export function parseTrip(raw: string | null | undefined): TvTrip | null {
	if (!raw) return null
	let value: unknown
	try {
		value = JSON.parse(raw)
	} catch {
		return null
	}
	if (typeof value !== "object" || value === null) return null
	const trip = value as Partial<TvTrip>
	if (!isNumber(trip.idx) || typeof trip.to !== "string" || !isNumber(trip.w) || !isNumber(trip.h)) return null
	const box = trip.box
	if (box != null && !(isNumber(box.left) && isNumber(box.top) && isNumber(box.width) && isNumber(box.height) && box.width > 0 && box.height > 0)) return null
	const scroll = isNumber(trip.scroll) && trip.scroll >= 0 ? { scroll: trip.scroll } : {}
	const columns = Array.isArray(trip.columns) && trip.columns.length <= 8 && trip.columns.every((top) => isNumber(top) && top >= 0) ? { columns: trip.columns } : {}
	const key = typeof trip.key === "string" ? { key: trip.key } : {}
	const from = typeof trip.from === "string" ? { from: trip.from } : {}
	return { idx: trip.idx, to: trip.to, ...from, box: box ?? null, w: trip.w, h: trip.h, art: typeof trip.art === "string" ? trip.art : null, out: trip.out === true, ...scroll, ...columns, ...key }
}

/**
 * The start page lost its TV (docs/implementation/start-page-redesign.md): a trip that left from it, or one an older
 * build stored without its page (the TV was the start page then), leads to no TV.
 */
export const FORMER_TV_PAGE = "/"

export const tripLeadsToTv = (trip: TvTrip) => trip.from !== undefined && trip.from !== FORMER_TV_PAGE

/** Where a trip is kept: sessionStorage in the browser. */
export type TripStorage = Pick<Storage, "getItem" | "removeItem">
/** What the way back leaves in the document: the brackets, and the mark and properties on <html>. */
export type TransitionDocument = {
	documentElement: { removeAttribute(name: string): void; style: { removeProperty(name: string): unknown } }
	querySelectorAll(selectors: string): ArrayLike<{ remove(): void }>
}

/**
 * The stored trip while it still leads to a TV, and null otherwise. A trip that leads to no TV is dropped, with
 * whatever an earlier visit's way back left in the document for it, so Back neither shows the brackets nor marks
 * the start page for a transition into a TV that isn't there.
 */
export function readLiveTrip(storage: TripStorage, document: TransitionDocument): TvTrip | null {
	const trip = parseTrip(storage.getItem(TRIP_KEY))
	if (!trip || tripLeadsToTv(trip)) return trip
	storage.removeItem(TRIP_KEY)
	const brackets = document.querySelectorAll(`[${TV_BRACKET_ATTR}]`)
	for (let i = 0; i < brackets.length; i++) brackets[i].remove()
	document.documentElement.removeAttribute(TV_TRANSITION_ATTR)
	for (const name of TV_PROPERTIES) document.documentElement.style.removeProperty(name)
	return null
}

/**
 * How many pages the person is from the TV: 1 on the page the TV opened, 2 one step further, and so on. 0 on the
 * TV's own entry, before it, and one step from it on another page than the one the TV opened (the header's links
 * lead out of the room too).
 */
export function pagesFromTv(trip: TvTrip | null, idx: number, pathname: string): number {
	if (!trip) return 0
	const pages = idx - trip.idx
	if (pages < 1) return 0
	if (pages === 1 && pathname !== trip.to) return 0
	return pages
}

export const wayBackShows = (pages: number) => pages >= 1 && pages <= WAY_BACK_LIVES

/**
 * The page the TV has just opened, on its own history entry (the one after the TV's): it starts at its top, where
 * its Back to TV key is, whatever an earlier visit of the same address left it at (ui/DiscoveryContinuity.tsx).
 * False on the way back (`out` is cleared) and on every other page.
 */
export const openedByTv = (trip: TvTrip | null, idx: number, pathname: string) =>
	Boolean(trip?.out && trip.to === pathname && idx === trip.idx + 1)

/** How far the brackets stand inside the picture's edge, and inside the window's. */
export const BRACKET_INSET = 14

/** The length of a bracket's arms for a picture of this size. */
export const bracketArm = (box: TvBox) => Math.round(Math.max(14, Math.min(120, Math.min(box.width - 2 * BRACKET_INSET, box.height - 2 * BRACKET_INSET) * 0.22)))

const px = (n: number) => `${Math.round(n * 100) / 100}px`

/** The custom properties on <html> through which the transition's CSS (main.css) gets the TV's box. */
export const TV_PROPERTIES = ["--tv-room", "--tv-page", "--tv-page-clip", "--tv-l", "--tv-t", "--tv-w", "--tv-h", "--tv-arm"] as const

/**
 * The transition's geometry, as the values of those properties. The room is scaled from the window's own corner
 * until the TV's picture is as wide as the window, and moved so that the picture's corner lands on the window's.
 * The page starts scaled into the picture and ends as it is. Both move by the same share at every moment, so the
 * page stays exactly on the screen. `--tv-page-clip` hides what of the page hangs out under the picture while the
 * window is taller than the picture's proportion. The rest places the brackets at the picture's edge.
 */
export function tvProperties(box: TvBox, window: { w: number; h: number }): Record<(typeof TV_PROPERTIES)[number], string> {
	const k = window.w / box.width
	return {
		"--tv-room": `translate(${px(-box.left * k)}, ${px(-box.top * k)}) scale(${Math.round(k * 10000) / 10000})`,
		"--tv-page": `translate(${px(box.left)}, ${px(box.top)}) scale(${Math.round((1 / k) * 10000) / 10000})`,
		"--tv-page-clip": `inset(0 0 ${px(Math.max(0, window.h - box.height * k))} 0)`,
		"--tv-l": px(box.left),
		"--tv-t": px(box.top),
		"--tv-w": px(box.width),
		"--tv-h": px(box.height),
		"--tv-arm": px(bracketArm(box)),
	}
}
