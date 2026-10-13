// The new TV on the start page ("apps", in the look "Cinema"), shared by the desktop and phone editions.
//
// A pure state machine: `transition(state, action, context)` returns the next state, how the browser history
// changes (`push` for a new TV screen, `replace` for a change in place, `back` to pop, `none` for a focus move,
// the menu and power), and the effects the page must carry out (expand into a page, rate a title, sign in). It
// never fetches, never measures and never touches the browser.
//
// Home is a row of apps: Tonight, Discover, Explorer, Taste and, for a member, My shows. Each opens on the TV,
// and nothing on the TV leaves it but the Expand key (`destinationHref` says where it goes) and "Watch on
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
// Three parts are being designed again and are each kept in one place, under "Waiting for a prototype" below:
// Discover's choice screen, the answers of the quiz and of the rating, and the Remote's streaming keys.
import type { Score } from "~/server/scores.server"
import { titlePath } from "../../../utils/helpers.ts"
import { parseTitleKey } from "../../../utils/title-key.ts"
import { QUIZ_GOAL, RATING_LEVELS } from "../../taste-quiz/quiz-flow.ts"
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
 * The member pages Tonight's pick is the first thing on; My shows expands into the first. The old TV's
 * `DOOR_HREF` (`tv-flow.ts`), kept under its name so the server can take it from here once the old TV is gone.
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
export const TASTE_SIDES = 4
export const SHOWS_PER_GROUP = 3

/** The search screen's ideas. Four show, three once the typed query has its own key. */
export const SEARCH_IDEAS: readonly string[] = [
	"cozy mystery",
	"space adventure",
	"feel-good comedy",
	"mind-bending thriller",
	"true story",
	"animated for adults",
]
export const MIN_QUERY_LENGTH = 2

export type TvScreen =
	| { name: "home" }
	/** One pick at a time; `pick` counts from 0. */
	| { name: "tonight"; pick: number }
	/** What kind of night? without a mood, up to four titles with one (`ANY_MOOD` included). */
	| { name: "discover"; mood: string | null }
	/** The small map without an island, an island's titles with one. */
	| { name: "explorer"; island: string | null }
	/** The sides of the person's taste (or the way to one) without a side, a side's titles with one. */
	| { name: "taste"; side: string | null }
	/** The taste quiz: one title, four answers. */
	| { name: "quiz" }
	/** A member's My shows. */
	| { name: "shows" }
	/** A title as `<media_type>-<tmdb_id>`. */
	| { name: "title"; title: string }
	/** "How was it?" after Seen it. */
	| { name: "rate"; title: string }
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
	/** Discover's moods, without Any mood. */
	moods: readonly string[]
	/**
	 * The titles of the list on screen: Discover's results, an island's or a side's titles, the search results,
	 * and on Taste without sides the quiz's picks.
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
}

/** A guest nobody knows anything about, before any data arrived. */
export const EMPTY_CONTEXT: TvContext = {
	member: false,
	taste: false,
	tonight: [],
	moods: [],
	titles: [],
	islands: [],
	hops: [],
	sides: [],
	nextEpisodes: [],
	toStart: [],
	titleName: null,
	draft: "",
	quizProgress: 0,
}

export type TvEffect =
	/** The Expand key: grow the picture into the page at `href`. */
	| { type: "expand"; href: string }
	/** "Watch on <service>": open the title's page at its streaming block (`watchHref`), which it highlights. */
	| { type: "watch"; title: string }
	/** Toggle Want to See. */
	| { type: "want-to-see"; title: string }
	| { type: "seen"; title: string }
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
	/** A streaming key on the Remote, with the service's name. */
	| { type: "service-key"; service: string }
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

const TITLE_KEY = /^(movie|show)-([1-9]\d*)$/

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
		// What the old TV wrote: its moods and its picks for a mood are Discover, its other picks and the two steps
		// before them are Tonight.
		case "moods":
			return DISCOVER_CHOICE
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
	"mood",
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
 * GoodWatch? The addresses are the pages' with every REC_* flag on.
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
			return "/taste"
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
		default:
			return null
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

const typed = (ctx: TvContext) => ctx.draft.trim().length >= MIN_QUERY_LENGTH

/** A screen's own items, before the Expand key and the top bar. */
function contentItems(screen: TvScreen, ctx: TvContext): string[] {
	switch (screen.name) {
		case "home":
			return TV_APPS.filter((app) => app !== "shows" || ctx.member).map(
				(app) => `app:${app}`,
			)
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
			return answerItems(screen)
		case "shows":
			return [
				...titleItems(ctx.nextEpisodes, SHOWS_PER_GROUP),
				...titleItems(ctx.toStart, SHOWS_PER_GROUP),
			]
		case "title":
			return ["watch", "want-to-see", "seen"]
		case "search":
			if (screen.query) return titleItems(ctx.titles)
			return [
				...(typed(ctx) ? ["go"] : []),
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
	// The focus starts on the screen's first own item, never on the Expand key; an empty screen starts on the bar.
	return items.find((item) => item !== "expand") as string
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

/** Results take the search screen's place, so Back from them is one step. */
function submitSearch(state: TvState, text: string): TvTransition {
	const query = text.trim()
	if (query.length < MIN_QUERY_LENGTH) return none(state)
	const screen: TvScreen = { name: "search", query }
	return state.screen.name === "search"
		? replace(state, screen)
		: push(state, screen)
}

// ---------------------------------------------------------------------------------------------------------
// Waiting for a prototype. Three parts of the TV are being designed again (the plan's "What waits for a
// prototype"). What each does today is the first prototype's, and all of it is here, so a result changes this
// section and its tests.

// 1. Discover's choice screen. Today: one grid of moods with Any mood last, then up to four titles for the mood.
// To come: three tabs (Moods, Themes, Styles) of six options each.

type DiscoverScreen = Extract<TvScreen, { name: "discover" }>

/** Discover's "Any mood", as a mood in the URL and in `mood:any`. */
export const ANY_MOOD = "any"

const DISCOVER_CHOICE: DiscoverScreen = { name: "discover", mood: null }

function readDiscover(params: URLSearchParams): DiscoverScreen {
	return { name: "discover", mood: params.get("mood") || null }
}

function writeDiscover(screen: DiscoverScreen, out: URLSearchParams) {
	if (screen.mood) out.set("mood", screen.mood)
}

/** Discover's page, with the mood that travels. */
function discoverHref(screen: DiscoverScreen): string {
	return screen.mood && screen.mood !== ANY_MOOD
		? `/discover?moods=${encodeURIComponent(screen.mood)}`
		: "/discover"
}

function discoverItems(screen: DiscoverScreen, ctx: TvContext): string[] {
	return screen.mood
		? [...titleItems(ctx.titles), "change-mood"]
		: [...ctx.moods.map((mood) => `mood:${mood}`), `mood:${ANY_MOOD}`]
}

/** A mood opens its titles. Change mood is one step back to the moods; a deep link has them take its place. */
function chooseInDiscover(
	state: TvState,
	kind: string,
	arg: string,
): TvTransition {
	return kind === "mood"
		? push(state, { name: "discover", mood: arg })
		: leave(state, DISCOVER_CHOICE)
}

// 2. The answers of the quiz and of the rating after Seen it. Today: four answers each. To come: a strip from
// low to high with labels and the ten exact scores.

type AnswerScreen = Extract<TvScreen, { name: "quiz" | "rate" }>

/** The quiz's answers that store a score. `answer:skip` ("Haven't seen it") stores none. */
export const QUIZ_ANSWER_SCORES = {
	loved: 9,
	liked: 7,
	disliked: 3,
} as const satisfies Record<string, Score>

/** The scores of "How was it?" after Seen it, best first: the four rating levels. */
export const RATE_SCORES: readonly Score[] = RATING_LEVELS.map(
	(level) => level.score,
).reverse()

function answerItems(screen: AnswerScreen): string[] {
	return screen.name === "quiz"
		? [...Object.keys(QUIZ_ANSWER_SCORES), "skip"].map(
				(answer) => `answer:${answer}`,
			)
		: RATE_SCORES.map((score) => `level:${score}`)
}

/** `answer` is what follows the colon in the item: a quiz answer's name, or a rating level's score. */
function chooseAnswer(
	state: TvState,
	screen: AnswerScreen,
	answer: string,
	ctx: TvContext,
): TvTransition {
	// A rating returns to the title.
	if (screen.name === "rate")
		return leave(state, { name: "title", title: screen.title }, [
			{ type: "rate", title: screen.title, score: Number(answer) as Score },
		])
	if (answer === "skip") return none(state, [{ type: "quiz-skip" }])
	const score = QUIZ_ANSWER_SCORES[answer as keyof typeof QUIZ_ANSWER_SCORES]
	const effects: TvEffect[] = [{ type: "quiz-rate", score }]
	// The answer that reaches the goal ends the quiz. Until then, and when rating more after it, the focus stays
	// on the answer, so the next title takes the same press.
	return ctx.quizProgress + 1 === QUIZ_GOAL
		? leave(state, { name: "taste", side: null }, effects)
		: none(state, effects)
}

// 3. The Remote's streaming keys. To come: a key opens a "watch on this service" screen. Until then a press does
// nothing: no narrowing, no toast, nothing in the URL.

function serviceKey(state: TvState, _service: string): TvTransition {
	return none(state)
}

// ---------------------------------------------------------------------------------------------------------
// Choosing an item

const APP_SCREEN: Record<TvApp, TvScreen> = {
	tonight: { name: "tonight", pick: 0 },
	discover: DISCOVER_CHOICE,
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
	if (kind === "mood" || kind === "change-mood")
		return s.name === "discover"
			? chooseInDiscover(state, kind, arg)
			: none(state)
	if (kind === "answer" || kind === "level")
		return s.name === "quiz" || s.name === "rate"
			? chooseAnswer(state, s, arg, ctx)
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
		case "start-quiz":
			return push(state, { name: "quiz" })
		case "title":
			return push(state, { name: "title", title: arg })
		case "watch":
		case "want-to-see":
			return s.name === "title"
				? none(state, [{ type: kind, title: s.title }])
				: none(state)
		// Seen it asks how it was.
		case "seen":
			return s.name === "title"
				? push(state, { name: "rate", title: s.title }, [
						{ type: "seen", title: s.title },
					])
				: none(state)
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
			const to = nextInDirection(
				action.boxes.filter((box) => items.includes(box.id)),
				focusedItem(state, ctx),
				action.dir,
				action.scale,
			)
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
		case "service-key":
			return serviceKey(state, action.service)
	}
}
