// The new TV on the start page ("apps", in the look "Cinema"), shared by the desktop and phone editions.
//
// A pure state machine: `transition(state, action, context)` returns the next state, how the browser history
// changes (`push` for a new TV screen, `replace` for a change in place, `back` to pop, `none` for a focus move,
// the menu and power), and the effects the page must carry out (expand into a page, rate a title, sign in). It
// never fetches, never measures and never touches the browser.
//
// Home is a row of apps: Tonight, Discover, Explorer, Taste and, for a member, My shows, then a tile for each of
// the person's two streaming services. A member with Sides of you gets home as a guide instead: see "Home's sides"
// below. Each opens on the TV, and nothing on the TV leaves it but the Expand key (`destinationHref` says where it goes) and "Watch on
// <service>". Every screen ends with the Expand key, where it has a page, and the top bar: Back, Search, Menu.
//
// The screen lives in the URL search params (`/?tv=discover&mood=funny`); `readTvState` and `writeTvParams`
// convert, and `readTvState` also reads what the old TV wrote. The focus is not in the URL: a move never changes
// the history. `focus=` is only read on arrival, for links and tests; `focus-memory.ts` gives the focus back on
// Back. Power, the menu and the in-app history depth are not in the URL either.
//
// The focus moves in four directions by where the items sit (`tv-move.ts`): a `move` carries the boxes the hook
// measured. `tvItems` lists a screen's items in reading order; it says which focus and which choice are valid.
//
// Discover's choice screen is three tabs (Moods, Themes, Styles) of six options each: see "Mini Discover" below.
//
// The answers of the quiz and of the rating after Seen it are the rating strip: see "The rating strip" below.
//
// The Remote's two streaming keys stand for the person's own two services. Each opens "On <service>", a list of
// titles to watch there, and home has a tile per service after the apps: see "On a service" below.
import type { Score } from "~/server/scores.server"
import { titlePath } from "../../../utils/helpers.ts"
import { parseTitleKey } from "../../../utils/title-key.ts"
import {
	QUIZ_GOAL,
	RATING_LEVELS,
	levelOf,
} from "../../taste-quiz/quiz-flow.ts"
import { type TvBox, type TvDir, nextInDirection } from "./tv-move.ts"

/** The apps on home, in order. My shows is a member's. */
export type TvApp = "tonight" | "discover" | "explorer" | "taste" | "shows"
export const TV_APPS: readonly TvApp[] = [
	"tonight",
	"discover",
	"explorer",
	"taste",
	"shows",
]

/**
 * The member pages Tonight's pick is the first thing on; My shows expands into the first. The server's Tonight's
 * pick (server/tonight.server.ts) links to them too. The name is the old TV's, whose doors led there.
 */
export type DoorKey = "continue" | "start" | "movie"
export const DOOR_HREF: Record<DoorKey, string> = {
	continue: "/my-shows",
	start: "/my-shows#start",
	movie: "/my-movies",
}

/** How many of each kind a screen shows. */
export const TONIGHT_PICKS = 3
export const LIST_TITLES = 4
export const MAP_ISLANDS = 6
export const ISLAND_HOPS = 2
/** Every side of a taste: the portrait has two to five. */
export const TASTE_SIDES = 5
export const SHOWS_PER_GROUP = 3
/** A service's row pages through this many titles. */
export const SERVICE_TITLES = 12
/** A side's picks on home's guide. */
export const HOME_SIDE_PICKS = 12

/** The search screen's ideas. Four show, three once what is typed has its own key. */
export const SEARCH_IDEAS: readonly string[] = [
	"cozy mystery",
	"space adventure",
	"feel-good comedy",
	"mind-bending thriller",
	"true story",
	"animated for adults",
]
/** The shortest query the search takes (`SEARCH_MIN_CHARS`, domain/discover-search.ts). */
export const MIN_QUERY_LENGTH = 2
/** The key that searches for what is typed on the search screen. */
export const SEARCH_GO = "go"

export type TvScreen =
	| { name: "home" }
	/** One pick at a time; `pick` counts from 0. */
	| { name: "tonight"; pick: number }
	/**
	 * Mini Discover. Without a choice: its three tabs, `tab` open, with that tab's six options. With one (a mood,
	 * a theme or a style of `tab`, by its key): up to four titles of it.
	 */
	| { name: "discover"; tab: TvDiscoverTab; choice: string | null }
	/** The small map without an island, an island's titles with one. */
	| { name: "explorer"; island: string | null }
	/** The sides of the person's taste (or the way to one) without a side, a side's titles with one. */
	| { name: "taste"; side: string | null }
	/** The taste quiz: one title at a time, on the rating strip. */
	| { name: "quiz" }
	/** A member's My shows. */
	| { name: "shows" }
	/** A title as `<media_type>-<tmdb_id>`. */
	| { name: "title"; title: string }
	/** "How was it?" after Seen it. */
	| { name: "rate"; title: string }
	/** "On <service>": titles to watch on one streaming service, by its TMDB provider id. */
	| { name: "service"; service: number }
	/** The question line without a query, the results with one. */
	| { name: "search"; query: string | null }
	/** What is GoodWatch? */
	| { name: "about" }

export type TvScreenName = TvScreen["name"]

export type TvPower = "off" | "booting" | "on"

export type TvState = {
	screen: TvScreen
	/** The focused item id, or null for where the screen's focus starts. */
	focus: string | null
	power: TvPower
	menuOpen: boolean
	/** The focused menu item while the menu is open, or null for its first item. */
	menuFocus: string | null
	/** How many TV screens were pushed onto the browser history in this visit. Zero on a deep link. */
	depth: number
}

/** One of Tonight's picks. `href` is the member page the pick is the first thing on, when it has one. */
export type TvPick = { title: string; href?: string | null }

/**
 * What the page knows about the person and the data on screen. The machine never fetches. Titles are keys
 * (`<media_type>-<tmdb_id>`); every list is best first and may be longer than the screen shows.
 */
export type TvContext = {
	member: boolean
	/** The person has a taste with sides: Taste shows them. */
	taste: boolean
	tonight: readonly TvPick[]
	/**
	 * The titles of the list on screen: Discover's results, an island's or a side's titles, the search results,
	 * and on Taste without sides the quiz's picks. On the quiz, the one title it asks about.
	 */
	titles: readonly string[]
	/** The mini Explorer's islands, in reading order. */
	islands: readonly string[]
	/** The islands next door to the one on screen, nearest first. */
	hops: readonly string[]
	sides: readonly string[]
	/** My shows: the shows with a Next episode, then the shows to start. */
	nextEpisodes: readonly string[]
	toStart: readonly string[]
	/** The name of the title on the title screen, for its page's address. Null until the page knows it. */
	titleName: string | null
	/** What is typed on the search screen. */
	draft: string
	/** Taste quiz scores toward the goal. */
	quizProgress: number
	/** The rating strip shows the ten exact scores under its levels: on the desktop, not on the phone. */
	exactScores: boolean
	/** The person's two streaming services, by TMDB provider id: the Remote's keys and home's tiles after the apps. */
	services: readonly number[]
	/**
	 * A member's Sides of you on home, in the list's order: each side's id, the keys of its picks (personal order)
	 * and the Watch next page it opens. Empty for a guest, a member without sides, and on the phone.
	 */
	homeSides: readonly TvHomeSideRef[]
	// My shows (slice 9).
	/**
	 * The title on the title screen is a show the member is midway through, and its Next episode is known: Seen it
	 * marks that episode watched and stays, in place of asking how the show was.
	 */
	nextEpisode: boolean
}

/** A guest nobody knows anything about, before any data arrived. */
export const EMPTY_CONTEXT: TvContext = {
	member: false,
	taste: false,
	tonight: [],
	titles: [],
	islands: [],
	hops: [],
	sides: [],
	nextEpisodes: [],
	toStart: [],
	titleName: null,
	draft: "",
	quizProgress: 0,
	exactScores: false,
	services: [],
	homeSides: [],
	nextEpisode: false,
}

export type TvEffect =
	/** The Expand key: grow the picture into the page at `href`. */
	| { type: "expand"; href: string }
	/** "Watch on <service>": open the title's page at its streaming block (`watchHref`), which it highlights. */
	| { type: "watch"; title: string }
	/** Toggle Want to See. */
	| { type: "want-to-see"; title: string }
	| { type: "seen"; title: string }
	/** Seen it on a show the member is midway through: mark its Next episode watched. */
	| { type: "seen-episode"; title: string }
	| { type: "rate"; title: string; score: Score }
	/** Taste quiz: score the title on screen. */
	| { type: "quiz-rate"; score: Score }
	/** Taste quiz: "Haven't seen it". */
	| { type: "quiz-skip" }
	/** Continue with Google, back to the same TV screen. */
	| { type: "sign-in" }

export type TvHistory = "push" | "replace" | "back" | "none"

export type TvAction =
	/** A direction, with the boxes of the items on show (the menu's while it is open). See `tv-move.ts`. */
	| { type: "move"; dir: TvDir; boxes: readonly TvBox[]; scale?: number }
	/** The wheel's drag and scroll: one item on or back in reading order. */
	| { type: "step"; by: 1 | -1 }
	| { type: "focus"; item: string }
	| { type: "ok" }
	/** Activate an item directly (pointer or touch). */
	| { type: "choose"; item: string }
	| { type: "back" }
	| { type: "home" }
	| { type: "toggle-menu" }
	| { type: "open-search" }
	| { type: "submit-search"; query: string }
	/** Something was typed into the search screen's line: the focus goes to the key that searches for it. */
	| { type: "typed" }
	/** A streaming key on the Remote, with the service's TMDB provider id. */
	| { type: "service-key"; service: number }
	| { type: "power"; on: boolean }
	| { type: "boot-done" }

export type TvTransition = {
	state: TvState
	history: TvHistory
	effects: TvEffect[]
}

// ---------------------------------------------------------------------------------------------------------
// URL

const HOME: TvScreen = { name: "home" }

/** A title's key on the TV and in its URL: `movie-603`. */
export const TITLE_KEY = /^(movie|show)-([1-9]\d*)$/

/**
 * A title's key from the URL. The old TV wrote the catalog's number (`utils/title-key.ts`), which is converted;
 * anything else is no title.
 */
function readTitleKey(value: string | null): string | null {
	if (!value) return null
	if (TITLE_KEY.test(value)) return value
	if (!/^\d+$/.test(value)) return null
	const { mediaType, tmdbId } = parseTitleKey(Number(value))
	return tmdbId > 0 && tmdbId < 1e12 ? `${mediaType}-${tmdbId}` : null
}

/** A service's TMDB provider id from the URL, as Discover's `services` parameter takes one. Null for anything else. */
function readServiceId(value: string | null): number | null {
	if (!value || !/^[1-9]\d{0,8}$/.test(value)) return null
	return Number(value)
}

function readInt(params: URLSearchParams, key: string) {
	const n = Number.parseInt(params.get(key) ?? "", 10)
	return Number.isSafeInteger(n) && n >= 0 ? n : 0
}

function readScreen(params: URLSearchParams, member: boolean): TvScreen {
	const name = params.get("tv")
	switch (name) {
		case "tonight":
			return { name, pick: readInt(params, "pick") }
		case "discover":
			return readDiscover(params)
		case "explorer":
			return { name, island: params.get("island") || null }
		case "taste":
			return { name, side: params.get("side") || null }
		case "quiz":
		case "about":
			return { name }
		// A guest has no My shows.
		case "shows":
			return member ? { name } : HOME
		case "title":
		case "rate": {
			const title = readTitleKey(params.get("title"))
			return title ? { name, title } : HOME
		}
		case "search":
			return { name, query: params.get("q")?.trim() || null }
		case "service": {
			const service = readServiceId(params.get("service"))
			return service ? { name, service } : HOME
		}
		// What the old TV wrote: its moods and its picks for a mood are Discover, its other picks and the two steps
		// before them are Tonight.
		case "moods":
			return discoverChoice("moods")
		case "picks":
			return params.get("mood")
				? readDiscover(params)
				: { name: "tonight", pick: 0 }
		case "services":
		case "this-or-that":
			return { name: "tonight", pick: 0 }
		default:
			return HOME
	}
}

/**
 * Reads the TV state from the URL. `depth` comes from the history entry's state (0 when unknown). `focus=` is
 * where a link or a test puts the focus; the focus memory, when it knows the entry, goes before it.
 */
export function readTvState(
	params: URLSearchParams,
	who: Pick<TvContext, "member">,
	depth = 0,
): TvState {
	return {
		screen: readScreen(params, who.member),
		focus: params.get("focus") || null,
		power: "on",
		menuOpen: false,
		menuFocus: null,
		depth,
	}
}

/** The TV's params, and the old TV's, which go when a screen is written. */
const TV_KEYS = [
	"tv",
	"tab",
	"mood",
	"theme",
	"style",
	"island",
	"side",
	"pick",
	"title",
	"q",
	"focus",
	"service",
	"from",
	"refine",
	"step",
	"goal",
	"page",
	"more",
]

/** Writes the TV screen into a copy of `params`, keeping unrelated params. Home writes no `tv`; nothing writes the focus. */
export function writeTvParams(
	screen: TvScreen,
	params = new URLSearchParams(),
): URLSearchParams {
	const out = new URLSearchParams(params)
	for (const key of TV_KEYS) out.delete(key)
	if (screen.name !== "home") out.set("tv", screen.name)
	switch (screen.name) {
		case "tonight":
			if (screen.pick) out.set("pick", String(screen.pick))
			break
		case "discover":
			writeDiscover(screen, out)
			break
		case "explorer":
			if (screen.island) out.set("island", screen.island)
			break
		case "taste":
			if (screen.side) out.set("side", screen.side)
			break
		case "title":
		case "rate":
			out.set("title", screen.title)
			break
		case "search":
			if (screen.query) out.set("q", screen.query)
			break
		case "service":
			out.set("service", String(screen.service))
			break
	}
	return out
}

/**
 * True when two URLs differ only in TV params. The start page's `shouldRevalidate` uses it so TV screen changes
 * don't rerun its loader.
 */
export function isTvOnlyChange(current: URL, next: URL): boolean {
	if (current.pathname !== next.pathname) return false
	const strip = (u: URL) => {
		const p = new URLSearchParams(u.search)
		for (const key of TV_KEYS) p.delete(key)
		p.sort()
		return p.toString()
	}
	return strip(current) === strip(next)
}

// ---------------------------------------------------------------------------------------------------------
// The Expand key: the page a screen grows into.

/** The pick Tonight shows: "Another one" steps through the first three and wraps. */
function tonightPick(
	screen: Extract<TvScreen, { name: "tonight" }>,
	ctx: TvContext,
): { at: number; count: number; pick: TvPick | null } {
	const count = Math.min(ctx.tonight.length, TONIGHT_PICKS)
	const at = count ? screen.pick % count : 0
	return { at, count, pick: ctx.tonight[at] ?? null }
}

/**
 * Where the Expand key takes a screen, with what travels (the mood, the island, the query), or null for a screen without a page: home, the quiz, the rating, search before a query, What is
 * GoodWatch?
 */
export function destinationHref(
	screen: TvScreen,
	ctx: TvContext,
): string | null {
	switch (screen.name) {
		case "tonight":
			// A guest's picks are Discover's best. `/watch-next` shows a guest nothing.
			return (ctx.member && tonightPick(screen, ctx).pick?.href) || "/discover"
		case "discover":
			return discoverHref(screen)
		case "explorer": {
			const query = new URLSearchParams({ grouping: "mood" })
			if (screen.island) query.set("island", screen.island)
			return `/explorer?${query}`
		}
		case "taste":
			// A side travels: the Taste page opens on it.
			return screen.side
				? `/taste?side=${encodeURIComponent(screen.side)}`
				: "/taste"
		case "shows":
			return DOOR_HREF.continue
		case "title": {
			const [, mediaType, tmdbId] = TITLE_KEY.exec(screen.title) ?? []
			if (!mediaType) return null
			// Without the name the page moves to its canonical address itself.
			return ctx.titleName
				? titlePath(mediaType, Number(tmdbId), ctx.titleName)
				: `/${mediaType}/${tmdbId}`
		}
		case "search":
			return screen.query
				? `/discover?q=${encodeURIComponent(screen.query)}`
				: null
		// Discover with that one service: its own parameter, which turns On my services off.
		case "service":
			return `/discover?services=${screen.service}`
		default:
			return null
	}
}

/** The pages of `DOOR_HREF`, by name. */
const DOOR_NAME: Record<string, string> = {
	[DOOR_HREF.continue]: "My shows",
	[DOOR_HREF.start]: "My shows",
	[DOOR_HREF.movie]: "My movies",
}

/**
 * The name of the page the Expand key opens, for a screen reader ("Expand: Discover"), or null for a screen
 * without a page. A title's page goes by the title's name once the page knows it.
 */
export function destinationName(
	screen: TvScreen,
	ctx: TvContext,
): string | null {
	if (!destinationHref(screen, ctx)) return null
	switch (screen.name) {
		case "tonight": {
			const href = ctx.member ? tonightPick(screen, ctx).pick?.href : null
			return (href && DOOR_NAME[href]) || "Discover"
		}
		case "explorer":
			return "Explorer"
		case "taste":
			return "Taste"
		case "shows":
			return "My shows"
		case "title":
			return ctx.titleName ?? "Title page"
		default:
			return "Discover"
	}
}

/** The id of the title page's block that says where a title streams (ui/details/hero/WhereToWatch.tsx). */
export const STREAMING_BLOCK = "streaming"

/**
 * Where "Watch on <service>" takes a title: the page the title's Expand key opens, at its streaming block. On
 * GoodWatch, not the service. The fragment is all that travels in the address; the wish to highlight the block
 * goes in the history entry's state, so a shared link scrolls and does not glow.
 */
export function watchHref(
	title: string,
	ctx: Pick<TvContext, "titleName">,
): string | null {
	const href = destinationHref(
		{ name: "title", title },
		{ ...EMPTY_CONTEXT, titleName: ctx.titleName },
	)
	return href && `${href}#${STREAMING_BLOCK}`
}

// ---------------------------------------------------------------------------------------------------------
// Items: what the focus moves through on each screen. Ids are `kind` or `kind:argument`.

const titleItems = (keys: readonly string[], max = LIST_TITLES) =>
	keys.slice(0, max).map((key) => `title:${key}`)

/**
 * Something is typed on the search screen: it has its own key from the first character on, so the focus is on what
 * OK would search for and never on an idea the person did not choose. Until the query is long enough the key does
 * nothing (`submitSearch`).
 */
const typed = (ctx: TvContext) => ctx.draft.trim().length > 0

/** A screen's own items, before the Expand key and the top bar. */
function contentItems(screen: TvScreen, ctx: TvContext): string[] {
	switch (screen.name) {
		case "home": {
			const apps = TV_APPS.filter((app) => app !== "shows" || ctx.member).map(
				(app) => `app:${app}`,
			)
			if (ctx.homeSides.length) return [...apps, ...guideSideItems(ctx)]
			return [...apps, ...ctx.services.map((id) => `service:${id}`)]
		}
		case "tonight": {
			const { count } = tonightPick(screen, ctx)
			return [...(count ? ["details"] : []), ...(count > 1 ? ["another"] : [])]
		}
		case "discover":
			return discoverItems(screen, ctx)
		case "explorer":
			return screen.island
				? [
						...titleItems(ctx.titles),
						...ctx.hops.slice(0, ISLAND_HOPS).map((id) => `hop:${id}`),
					]
				: ctx.islands.slice(0, MAP_ISLANDS).map((id) => `island:${id}`)
		case "taste":
			if (screen.side) return titleItems(ctx.titles)
			// Without sides: the quiz's picks once there are some, and the way into the quiz.
			return [
				...(ctx.taste
					? ctx.sides.slice(0, TASTE_SIDES).map((id) => `side:${id}`)
					: titleItems(ctx.titles)),
				"start-quiz",
			]
		case "quiz":
		case "rate":
			return stripItems(screen, ctx)
		case "shows":
			return [
				...titleItems(ctx.nextEpisodes, SHOWS_PER_GROUP),
				...titleItems(ctx.toStart, SHOWS_PER_GROUP),
			]
		case "title":
			return ["watch", "want-to-see", "seen"]
		case "service":
			return titleItems(ctx.titles, SERVICE_TITLES)
		case "search":
			if (screen.query) return titleItems(ctx.titles)
			return [
				...(typed(ctx) ? [SEARCH_GO] : []),
				...SEARCH_IDEAS.slice(0, typed(ctx) ? 3 : 4).map(
					(idea) => `idea:${idea}`,
				),
			]
		case "about":
			return ["got-it", "rate"]
	}
}

/**
 * Every item of a screen in reading order: its own items, the Expand key where the screen has a page, and the
 * top bar (no Back on home, no Search on the search screens).
 */
export function tvItems(screen: TvScreen, ctx: TvContext): string[] {
	return [
		...contentItems(screen, ctx),
		...(destinationHref(screen, ctx) ? ["expand"] : []),
		...(screen.name === "home" ? [] : ["bar:back"]),
		...(screen.name === "search" ? [] : ["bar:search"]),
		"bar:menu",
	]
}

/** The menu, an overlay on every screen. Sign in is a guest's. */
export function menuItems(ctx: Pick<TvContext, "member">): string[] {
	return [
		"menu:home",
		"menu:search",
		...(ctx.member ? [] : ["menu:sign-in"]),
		"menu:about",
		"menu:off",
	]
}

/** What the focus moves through right now: the menu while it is open, else the screen's items. */
export function activeItems(state: TvState, ctx: TvContext): string[] {
	return state.menuOpen ? menuItems(ctx) : tvItems(state.screen, ctx)
}

/** The screen's focused item under the menu: where the focus starts unless it was moved to an item still there. */
function screenFocus(state: TvState, ctx: TvContext): string {
	const items = tvItems(state.screen, ctx)
	if (state.focus && items.includes(state.focus)) return state.focus
	// The rating strip starts on Good.
	if (items.includes(STRIP_START) && onStrip(state.screen)) return STRIP_START
	// The focus starts on the screen's first own item, never on the Expand key and never on a tab (Discover starts
	// on the open tab's first option); an empty screen starts on the bar.
	return items.find(
		(item) => item !== "expand" && !item.startsWith("tab:"),
	) as string
}

/** The focused item id: the menu's while it is open, else the screen's. */
export function focusedItem(state: TvState, ctx: TvContext): string {
	if (!state.menuOpen) return screenFocus(state, ctx)
	const items = menuItems(ctx)
	return state.menuFocus && items.includes(state.menuFocus)
		? state.menuFocus
		: items[0]
}

/**
 * The focus to remember for the history entry an action leaves (`focus-memory.ts`): the item a pointer chose,
 * else the screen's focused item. The menu's focus is never remembered.
 */
export function focusLeftBehind(
	state: TvState,
	action: TvAction,
	ctx: TvContext,
): string {
	return action.type === "choose" &&
		!state.menuOpen &&
		tvItems(state.screen, ctx).includes(action.item)
		? action.item
		: screenFocus(state, ctx)
}

// ---------------------------------------------------------------------------------------------------------
// Transitions

const none = (state: TvState, effects: TvEffect[] = []): TvTransition => ({
	state,
	history: "none",
	effects,
})

function push(
	state: TvState,
	screen: TvScreen,
	effects: TvEffect[] = [],
): TvTransition {
	return {
		state: {
			...state,
			screen,
			focus: null,
			menuOpen: false,
			menuFocus: null,
			depth: state.depth + 1,
		},
		history: "push",
		effects,
	}
}

/** `focus` stays on that item when the new screen has it; else the focus starts over. */
function replace(
	state: TvState,
	screen: TvScreen,
	effects: TvEffect[] = [],
	focus: string | null = null,
): TvTransition {
	return {
		state: { ...state, screen, focus, menuOpen: false, menuFocus: null },
		history: "replace",
		effects,
	}
}

const closeMenu = (state: TvState): TvState =>
	state.menuOpen ? { ...state, menuOpen: false, menuFocus: null } : state

/** Moves the focus of whatever has it: the menu while it is open, else the screen. */
function focusOn(state: TvState, item: string, ctx: TvContext): TvState {
	if (focusedItem(state, ctx) === item) return state
	return state.menuOpen
		? { ...state, menuFocus: item }
		: { ...state, focus: item }
}

/**
 * One step back in this visit's history. Without history (a deep link), `fallback` takes the screen's place;
 * `fallback` showing already stays.
 */
function leave(
	state: TvState,
	fallback: TvScreen,
	effects: TvEffect[] = [],
): TvTransition {
	if (state.depth > 0) return { state, history: "back", effects }
	if (state.screen.name === "home" && fallback.name === "home")
		return none(state, effects)
	return replace(state, fallback, effects)
}

/** Back: close the menu, else one step back, home included. A deep link falls back to home; home itself stays. */
function back(state: TvState): TvTransition {
	return state.menuOpen ? none(closeMenu(state)) : leave(state, HOME)
}

/** A jump from the menu or the Remote: a new screen, unless that screen is already showing. */
function jump(state: TvState, screen: TvScreen): TvTransition {
	return state.screen.name === screen.name
		? none(closeMenu(state))
		: push(state, screen)
}

/** The Search key: the search screen, or Back from it while nothing is searched yet. */
function openSearch(state: TvState): TvTransition {
	return state.screen.name === "search" && !state.screen.query
		? back(state)
		: push(state, { name: "search", query: null })
}

/**
 * Results take the search screen's place, so Back from them is one step. This is the one way a search starts: OK
 * on what is typed or on an idea. Nothing searches while the person types.
 */
function submitSearch(state: TvState, text: string): TvTransition {
	const query = text.trim()
	if (query.length < MIN_QUERY_LENGTH) return none(state)
	const screen: TvScreen = { name: "search", query }
	return state.screen.name === "search"
		? replace(state, screen)
		: push(state, screen)
}

/**
 * Typing on the search screen puts the focus on the key that searches for what is typed, wherever the focus was.
 * The key is listed once the page's context holds the text; until then the focus falls back to where it starts.
 */
function typedOnSearch(state: TvState): TvTransition {
	const s = state.screen
	return s.name === "search" && !s.query && !state.menuOpen
		? none({ ...state, focus: SEARCH_GO })
		: none(state)
}

// ---------------------------------------------------------------------------------------------------------
// Mini Discover: three tabs (Moods, Themes, Styles) of six options each, and the titles of one choice. Decided
// as prototyped (the plan's "Mini Discover"). One choice leads to its titles; choices never combine on the TV.

export type TvDiscoverTab = "moods" | "themes" | "styles"
type DiscoverScreen = Extract<TvScreen, { name: "discover" }>

/**
 * Which six each tab offers, in order, by the app's own keys: moods of `domain/moods.ts`, themes and styles of
 * `domain/themes-styles.ts` (tv-discover.test.ts checks that each exists there). `kind` names an option in an
 * item id (`theme:crime`) and in the TV's URL (`theme=crime`); `param` is Discover's own parameter for it.
 */
export const DISCOVER_TABS: readonly {
	tab: TvDiscoverTab
	kind: "mood" | "theme" | "style"
	param: "moods" | "themes" | "styles"
	keys: readonly string[]
}[] = [
	{
		tab: "moods",
		kind: "mood",
		param: "moods",
		keys: ["funny", "feelgood", "romance", "action", "scary", "mind"],
	},
	{
		tab: "themes",
		kind: "theme",
		param: "themes",
		keys: ["crime", "mystery", "family", "growing", "future", "fantasy"],
	},
	{
		tab: "styles",
		kind: "style",
		param: "styles",
		keys: ["animated", "spectacle", "slow", "fast", "talky", "nonlinear"],
	},
]

/** A tab with what it offers. */
export const discoverTab = (tab: TvDiscoverTab) =>
	DISCOVER_TABS.find((one) => one.tab === tab) ?? DISCOVER_TABS[0]

const discoverChoice = (tab: TvDiscoverTab): DiscoverScreen => ({
	name: "discover",
	tab,
	choice: null,
})

/**
 * `mood=`, `theme=` or `style=` with one of the TV's own options is that option's titles. An option the TV does
 * not offer (Discover has more of each) is its tab instead. Without one, `tab=` names the open tab; Moods is
 * open by default.
 */
function readDiscover(params: URLSearchParams): DiscoverScreen {
	for (const { tab, kind, keys } of DISCOVER_TABS) {
		const key = params.get(kind)
		if (key)
			return { name: "discover", tab, choice: keys.includes(key) ? key : null }
	}
	const open = params.get("tab")
	return discoverChoice(
		DISCOVER_TABS.find((one) => one.tab === open)?.tab ?? "moods",
	)
}

function writeDiscover(screen: DiscoverScreen, out: URLSearchParams) {
	if (screen.choice) out.set(discoverTab(screen.tab).kind, screen.choice)
	else if (screen.tab !== "moods") out.set("tab", screen.tab)
}

/** Discover's page, with the one mood, theme or style that travels. */
function discoverHref(screen: DiscoverScreen): string {
	return screen.choice
		? `/discover?${discoverTab(screen.tab).param}=${encodeURIComponent(screen.choice)}`
		: "/discover"
}

function discoverItems(screen: DiscoverScreen, ctx: TvContext): string[] {
	if (screen.choice) return [...titleItems(ctx.titles), "change"]
	const { kind, keys } = discoverTab(screen.tab)
	return [
		...DISCOVER_TABS.map(({ tab }) => `tab:${tab}`),
		...keys.map((key) => `${kind}:${key}`),
	]
}

/**
 * Opens a tab in place, so Back from the titles finds the tab that was open. The focus stays on the tab, so
 * Left and Right along the tabs turn the pages.
 */
function openTab(
	state: TvState,
	screen: DiscoverScreen,
	tab: string,
): TvTransition {
	const open = DISCOVER_TABS.find((one) => one.tab === tab)?.tab
	return !open || open === screen.tab || screen.choice
		? none(state)
		: replace(state, discoverChoice(open), [], `tab:${open}`)
}

/**
 * The two moves of the tabs that the direction rule does not give by itself. `to` is where the rule would land.
 * - From outside the tabs (Up from the options, Down from the top bar), a move that would land on any tab lands
 *   on the open one.
 * - Along the tabs, a move that lands on a tab opens it. Only the direction keys do: the pointer over a tab and
 *   the wheel's step give it the focus, and OK or a click opens it.
 * Null for every other move, which the rule decides alone.
 */
function moveInDiscover(
	state: TvState,
	from: string,
	to: string | null,
): TvTransition | null {
	const s = state.screen
	if (s.name !== "discover" || s.choice || state.menuOpen) return null
	if (!to?.startsWith("tab:")) return null
	if (!from.startsWith("tab:")) return none({ ...state, focus: `tab:${s.tab}` })
	return openTab({ ...state, focus: to }, s, to.slice("tab:".length))
}

/**
 * A tab opens. An option opens its titles. Change is one step back to the tabs; a deep link has them take its
 * place, with the choice's tab open.
 */
function chooseInDiscover(
	state: TvState,
	screen: DiscoverScreen,
	kind: string,
	arg: string,
): TvTransition {
	if (kind === "tab") return openTab(state, screen, arg)
	if (kind === "change")
		return screen.choice
			? leave(state, discoverChoice(screen.tab))
			: none(state)
	return screen.choice
		? none(state)
		: push(state, { name: "discover", tab: screen.tab, choice: arg })
}

// ---------------------------------------------------------------------------------------------------------
// The rating strip: the answers of the quiz and of the rating after Seen it (the plan's "The rating strip"). The
// app's four labelled levels from low on the left to high on the right, and under them, on the desktop, the ten
// exact scores. OK on a level gives the level's score; "Haven't seen it" is the quiz's own key.

type StripScreen = Extract<TvScreen, { name: "quiz" | "rate" }>

const onStrip = (screen: TvScreen): screen is StripScreen =>
	screen.name === "quiz" || screen.name === "rate"

/** The scores the strip's levels give, low to high: 3, 5, 7 and 9. */
export const STRIP_LEVELS: readonly Score[] = RATING_LEVELS.map(
	(level) => level.score,
)

/** The exact scores under the levels, low to high. */
export const STRIP_SCORES: readonly Score[] = Array.from(
	{ length: 10 },
	(_, at) => (at + 1) as Score,
)

/** The level a score is under, as its item. */
const levelItem = (score: number) =>
	`level:${RATING_LEVELS[levelOf(score)].score}`

/** Where the strip's focus starts: Good, the level a 7 is in. */
export const STRIP_START = levelItem(7)

/**
 * The strip's items in reading order: the levels, the exact scores where they show, and in the quiz "Haven't seen
 * it". The quiz has them while it has a title to ask about (`titles`); the rating's title is in its address.
 */
function stripItems(screen: StripScreen, ctx: TvContext): string[] {
	if (screen.name === "quiz" && !ctx.titles.length) return []
	return [
		...STRIP_LEVELS.map((score) => `level:${score}`),
		...(ctx.exactScores ? STRIP_SCORES.map((score) => `score:${score}`) : []),
		...(screen.name === "quiz" ? ["skip"] : []),
	]
}

/**
 * The two moves of the strip that the direction rule does not give by itself (a level spans two or four scores,
 * so from it the rule goes to the row's left end or to either score): Down from a level lands on the lowest exact
 * score under it, Up from a score on the level over it. Null for every other move, which is the rule's.
 */
function stripMove(
	state: TvState,
	from: string,
	dir: TvDir,
	items: readonly string[],
): string | null {
	if (state.menuOpen || !onStrip(state.screen)) return null
	const [kind, arg] = from.split(":")
	const score = Number(arg)
	const to =
		kind === "level" && dir === "down"
			? `score:${RATING_LEVELS[levelOf(score)].lo}`
			: kind === "score" && dir === "up"
				? levelItem(score)
				: null
	return to && items.includes(to) ? to : null
}

/** A level's score or an exact score, for the title of the rating or the quiz's title on screen. */
function chooseScore(
	state: TvState,
	screen: StripScreen,
	score: Score,
	ctx: TvContext,
): TvTransition {
	// A rating returns to the title.
	if (screen.name === "rate")
		return leave(state, { name: "title", title: screen.title }, [
			{ type: "rate", title: screen.title, score },
		])
	const effects: TvEffect[] = [{ type: "quiz-rate", score }]
	// The score that reaches the goal ends the quiz. Until then, and when rating more after it, the focus stays
	// where it was, so the next title takes the same press.
	return ctx.quizProgress + 1 === QUIZ_GOAL
		? leave(state, { name: "taste", side: null }, effects)
		: none(state, effects)
}

// ---------------------------------------------------------------------------------------------------------
// On a service (the plan's "On a service"): a streaming key of the Remote, or a service's tile on home, opens "On
// <service>", titles to watch on that one service. The screen is the service's TMDB provider id, so it works for
// any service a link names; the keys and the tiles are the person's own two (`ctx.services`).

/**
 * A streaming key of the Remote. It opens its service's screen, from any screen. On its own screen it leaves, as
 * Back does: one step back, and home on a deep link. On the other service's screen it takes that screen's place,
 * so Back from either is one step.
 */
function serviceKey(state: TvState, service: number): TvTransition {
	const s = state.screen
	const screen: TvScreen = { name: "service", service }
	if (s.name !== "service") return push(state, screen)
	return s.service === service
		? leave(closeMenu(state), HOME)
		: replace(state, screen)
}

// ---------------------------------------------------------------------------------------------------------
// Home's sides (#673): for a member with Sides of you, home is a guide. The apps, then one entry per side, stand
// in a list on the left; Up and Down move along it, and the entry that has the focus shows on the right: an app as
// home shows it, or a side's loved posters, its picks and Watch next. Right (or OK) steps into the side's picks,
// Left from the first pick comes back to its entry. The services' tiles are not in the list: the Remote's keys
// open them.
//
// Items: `home-side:<id>` for a side's entry, `title:<key>` for its picks, `watch-next:<id>` for its key. Every
// side's picks are items, in reading order after its entry, so the wheel's step walks into them; only the picks
// of the side that is on are drawn, so the direction keys reach no other side's.

/** What the machine knows of one of home's sides. */
export type TvHomeSideRef = {
	id: string
	/** Its picks' keys, in personal order. */
	picks: readonly string[]
	/** The Watch next page it opens, with its moods. */
	watchNext: string
}

/** Each side's entry, picks and Watch next key, in reading order. */
function guideSideItems(ctx: Pick<TvContext, "homeSides">): string[] {
	return ctx.homeSides.flatMap((side) => [
		`home-side:${side.id}`,
		...side.picks.slice(0, HOME_SIDE_PICKS).map((key) => `title:${key}`),
		`watch-next:${side.id}`,
	])
}

/** The guide's list: the apps' entries and the sides' entries, top to bottom. */
function guideEntries(items: readonly string[]): string[] {
	return items.filter(
		(item) => item.startsWith("app:") || item.startsWith("home-side:"),
	)
}

/**
 * The side an item of home's guide belongs to: a side's entry, one of its picks or its Watch next key. Null for an
 * app, the bar, and any item off the guide.
 */
export function guideSideOf(
	item: string,
	ctx: Pick<TvContext, "homeSides">,
): TvHomeSideRef | null {
	const [kind, ...rest] = item.split(":")
	const arg = rest.join(":")
	if (kind === "home-side" || kind === "watch-next")
		return ctx.homeSides.find((side) => side.id === arg) ?? null
	if (kind === "title")
		return (
			ctx.homeSides.find((side) =>
				side.picks.slice(0, HOME_SIDE_PICKS).includes(arg),
			) ?? null
		)
	return null
}

/** Where a step into a side lands: its first pick, or its Watch next key when it has none. */
const intoSide = (side: TvHomeSideRef) =>
	side.picks.length ? `title:${side.picks[0]}` : `watch-next:${side.id}`

/**
 * The moves of home's guide that the direction rule does not give by itself: the list is walked in order (it
 * scrolls, so the rule would see only part of it), Right steps into a side, Left from the first pick and from the
 * Watch next key comes back to the side's entry, Down from a pick goes to Watch next and Up from it to the first
 * pick. Returns the item to move to (the item itself to stay), or null for the rule.
 */
function guideMove(
	state: TvState,
	from: string,
	dir: TvDir,
	ctx: TvContext,
): string | null {
	if (state.menuOpen || state.screen.name !== "home" || !ctx.homeSides.length)
		return null
	const entries = guideEntries(tvItems(state.screen, ctx))
	const at = entries.indexOf(from)
	if (at >= 0) {
		// Up from the first entry is the rule's: the top bar.
		if (dir === "up") return at > 0 ? entries[at - 1] : null
		if (dir === "down") return entries[at + 1] ?? from
		const side = guideSideOf(from, ctx)
		return dir === "right" && side ? intoSide(side) : from
	}
	const side = guideSideOf(from, ctx)
	if (!side) return null
	if (from.startsWith("title:")) {
		if (dir === "left" && from === intoSide(side)) return `home-side:${side.id}`
		if (dir === "down") return `watch-next:${side.id}`
		return null
	}
	if (dir === "up")
		return side.picks.length ? intoSide(side) : `home-side:${side.id}`
	if (dir === "left") return `home-side:${side.id}`
	return from
}

/** OK on a side's entry steps into it; OK on its Watch next key opens Watch next with the side's moods. */
function chooseInGuide(
	state: TvState,
	kind: string,
	arg: string,
	ctx: TvContext,
): TvTransition {
	const side = ctx.homeSides.find((one) => one.id === arg)
	if (!side) return none(state)
	if (kind === "home-side") return none(focusOn(state, intoSide(side), ctx))
	return none(state, [{ type: "expand", href: side.watchNext }])
}

// ---------------------------------------------------------------------------------------------------------
// Choosing an item

const APP_SCREEN: Record<TvApp, TvScreen> = {
	tonight: { name: "tonight", pick: 0 },
	discover: discoverChoice("moods"),
	explorer: { name: "explorer", island: null },
	taste: { name: "taste", side: null },
	shows: { name: "shows" },
}

function chooseInMenu(state: TvState, item: string): TvTransition {
	switch (item) {
		case "menu:home":
			return jump(state, HOME)
		case "menu:search":
			return openSearch(state)
		case "menu:sign-in":
			return none(closeMenu(state), [{ type: "sign-in" }])
		case "menu:about":
			return jump(state, { name: "about" })
		case "menu:off":
			return none({ ...closeMenu(state), power: "off" })
		default:
			return none(state)
	}
}

/** Chooses an item of the screen on show. The caller has checked that the screen has it and put the focus on it. */
function choose(state: TvState, item: string, ctx: TvContext): TvTransition {
	const s = state.screen
	const [kind, ...rest] = item.split(":")
	const arg = rest.join(":")
	if (
		kind === "tab" ||
		kind === "mood" ||
		kind === "theme" ||
		kind === "style" ||
		kind === "change"
	)
		return s.name === "discover"
			? chooseInDiscover(state, s, kind, arg)
			: none(state)
	if (kind === "level" || kind === "score")
		return onStrip(s)
			? chooseScore(state, s, Number(arg) as Score, ctx)
			: none(state)
	// "Haven't seen it" goes on to the next title and never ends the quiz.
	if (kind === "skip")
		return s.name === "quiz"
			? none(state, [{ type: "quiz-skip" }])
			: none(state)
	switch (kind) {
		case "app":
			return push(state, APP_SCREEN[arg as TvApp])
		case "details": {
			const pick = s.name === "tonight" ? tonightPick(s, ctx).pick : null
			return pick
				? push(state, { name: "title", title: pick.title })
				: none(state)
		}
		case "another": {
			if (s.name !== "tonight") return none(state)
			const { at, count } = tonightPick(s, ctx)
			// The focus stays on the key, so the next press shows the next pick.
			return replace(
				state,
				{ name: "tonight", pick: (at + 1) % count },
				[],
				item,
			)
		}
		case "island":
			return push(state, { name: "explorer", island: arg })
		// Sail to the island next door: it takes this island's place.
		case "hop":
			return replace(state, { name: "explorer", island: arg })
		case "side":
			return push(state, { name: "taste", side: arg })
		case "home-side":
		case "watch-next":
			return s.name === "home"
				? chooseInGuide(state, kind, arg, ctx)
				: none(state)
		case "start-quiz":
			return push(state, { name: "quiz" })
		// A service's tile on home.
		case "service": {
			const service = readServiceId(arg)
			return service ? push(state, { name: "service", service }) : none(state)
		}
		case "title":
			return push(state, { name: "title", title: arg })
		case "watch":
		case "want-to-see":
			return s.name === "title"
				? none(state, [{ type: kind, title: s.title }])
				: none(state)
		// Seen it asks how it was.
		case "seen":
			if (s.name !== "title") return none(state)
			// My shows (slice 9): on a show the member is midway through it marks the Next episode and stays. The key
			// then names the episode after it, so the next press marks that one.
			if (ctx.nextEpisode)
				return none(state, [{ type: "seen-episode", title: s.title }])
			return push(state, { name: "rate", title: s.title }, [
				{ type: "seen", title: s.title },
			])
		case "go":
			return submitSearch(state, ctx.draft)
		case "idea":
			return submitSearch(state, arg)
		case "got-it":
			return back(state)
		// What is GoodWatch? "Rate what I've seen": the quiz takes its place.
		case "rate":
			return replace(state, { name: "quiz" })
		case "expand": {
			const href = destinationHref(s, ctx)
			return href ? none(state, [{ type: "expand", href }]) : none(state)
		}
		case "bar":
			return arg === "back"
				? back(state)
				: arg === "search"
					? openSearch(state)
					: none({ ...state, menuOpen: true, menuFocus: null })
		default:
			return none(state)
	}
}

export function transition(
	state: TvState,
	action: TvAction,
	ctx: TvContext,
): TvTransition {
	if (action.type === "power") {
		if (!action.on) return none({ ...closeMenu(state), power: "off" })
		return state.power === "off"
			? none({ ...state, power: "booting" })
			: none(state)
	}
	if (state.power === "off") return none(state)
	// Turning the set on boots again, then shows home.
	if (action.type === "boot-done")
		return state.power === "booting"
			? replace({ ...state, power: "on" }, HOME)
			: none(state)
	if (state.power === "booting") return none(state)

	switch (action.type) {
		case "move": {
			const items = activeItems(state, ctx)
			const from = focusedItem(state, ctx)
			// The rating strip and home's guide name some moves themselves, before the rule.
			const to =
				stripMove(state, from, action.dir, items) ??
				guideMove(state, from, action.dir, ctx) ??
				nextInDirection(
					action.boxes.filter((box) => items.includes(box.id)),
					from,
					action.dir,
					action.scale,
				)
			// Discover's tabs name two moves themselves, on what the rule gives.
			const named = moveInDiscover(state, from, to)
			if (named) return named
			return none(to ? focusOn(state, to, ctx) : state)
		}
		case "step": {
			const items = activeItems(state, ctx)
			const at = items.indexOf(focusedItem(state, ctx))
			return none(
				focusOn(
					state,
					items[(at + action.by + items.length) % items.length],
					ctx,
				),
			)
		}
		case "focus":
			return none(
				activeItems(state, ctx).includes(action.item)
					? focusOn(state, action.item, ctx)
					: state,
			)
		case "ok": {
			const item = focusedItem(state, ctx)
			return state.menuOpen
				? chooseInMenu(state, item)
				: choose(state, item, ctx)
		}
		case "choose":
			// With the menu open, pressing anything behind it only closes it.
			if (state.menuOpen)
				return menuItems(ctx).includes(action.item)
					? chooseInMenu(state, action.item)
					: none(closeMenu(state))
			return tvItems(state.screen, ctx).includes(action.item)
				? choose(focusOn(state, action.item, ctx), action.item, ctx)
				: none(state)
		case "back":
			return back(state)
		case "home":
			return jump(state, HOME)
		case "toggle-menu":
			return none({ ...state, menuOpen: !state.menuOpen, menuFocus: null })
		case "open-search":
			return openSearch(state)
		case "submit-search":
			return submitSearch(state, action.query)
		case "typed":
			return typedOnSearch(state)
		case "service-key":
			return serviceKey(state, action.service)
	}
}
