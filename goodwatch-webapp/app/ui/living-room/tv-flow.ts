// The living room TV flow ("Ask, then answer"), shared by the desktop and phone editions.
//
// A pure state machine: `transition(state, action, context)` returns the next state, how the browser history
// changes (`push` for a new TV screen, `replace` for focus moves and in-place changes, `back` to pop), and the
// effects the page must carry out (rate a title, toggle a service, leave the living room). The screen and its
// keys live in the URL search params (`/?tv=picks&mood=cozy`); `readTvState` and `writeTvParams` convert.
// Power, the More menu, and the in-app history depth are not in the URL.

export type TvApp = "watch-now" | "taste" | "discover" | "explorer"
export const TV_APPS: readonly TvApp[] = [
	"watch-now",
	"taste",
	"discover",
	"explorer",
]

/** Where tonight's picks come from. `auto` is the Wishlist for members who have matches, otherwise new titles. */
export type PicksSource = "auto" | "wishlist" | "new"

/** What narrows tonight's picks: a mood (null is Any mood), a source, and a single streaming service. */
export type Night = {
	mood: string | null
	source: PicksSource
	service: string | null
}

export type TvScreen =
	| { name: "home" }
	/** What is GoodWatch? */
	| { name: "about" }
	/** Find my tonight, step 1: where do you watch. */
	| { name: "services" }
	/** Find my tonight, step 2: "Which one, tonight?" pairs. */
	| { name: "this-or-that" }
	/** What kind of night? `refine` means a mood chosen here replaces the picks it came from. */
	| { name: "moods"; night: Night; refine: boolean }
	/** Members: From my Wishlist or Something new. */
	| { name: "source"; night: Night }
	/** Here's tonight: three picks. */
	| { name: "picks"; night: Night }
	| { name: "title"; title: string }
	/** A glimpse of Watch now, Taste, Discover, or Explorer on the TV. */
	| { name: "app"; app: TvApp }
	/** The on-screen keyboard without a query, the results with one. */
	| { name: "search"; query: string | null }

export type TvScreenName = TvScreen["name"]

export type TvPower = "off" | "booting" | "on"

export type TvState = {
	screen: TvScreen
	/** The focused item id, or null for the first item. */
	focus: string | null
	power: TvPower
	menuOpen: boolean
	/** How many TV screens were pushed onto the browser history in this visit. Zero on a deep link. */
	depth: number
}

/** What the page knows about the person and the data on screen. The machine never fetches. */
export type TvContext = {
	member: boolean
	/** Title keys of tonight's picks for the current night, best first. */
	pickKeys: readonly string[]
	/** Title keys on the member's Wishlist (the Watch now glimpse). */
	wishlistKeys: readonly string[]
	/** Streaming service names offered on the services screen. */
	serviceNames: readonly string[]
	moodKeys: readonly string[]
	hasServices: boolean
	/** This-or-that pairs answered with a side (skips do not count). */
	answered: number
	/** This-or-that pairs still unanswered (skips count as answered). */
	pairsLeft: number
}

export type TvEffect =
	| { type: "toggle-service"; service: string }
	| { type: "answer-pair"; side: "a" | "b" | "skip" }
	| { type: "watch"; title: string }
	| { type: "want-to-see"; title: string }
	| { type: "seen"; title: string }
	| { type: "not-for-me"; title: string }
	| {
			type: "leave"
			to: { kind: "title"; title: string } | { kind: "app"; app: TvApp }
	  }

export type TvHistory = "push" | "replace" | "back" | "none"

export type TvAction =
	| { type: "step"; by: 1 | -1 }
	| { type: "focus"; item: string }
	| { type: "ok" }
	/** Activate an item directly (pointer or touch). */
	| { type: "choose"; item: string }
	| { type: "back" }
	| { type: "home" }
	| { type: "toggle-menu" }
	| { type: "open-moods" }
	| { type: "open-app"; app: TvApp }
	| { type: "open-search" }
	| { type: "submit-search"; query: string }
	| { type: "pick-for-me" }
	/** A streaming key on the remote. */
	| { type: "service-key"; service: string }
	| { type: "power"; on: boolean }
	| { type: "boot-done" }

export type TvTransition = {
	state: TvState
	history: TvHistory
	effects: TvEffect[]
}

export const ANY_NIGHT: Night = { mood: null, source: "auto", service: null }
export const MIN_ANSWERS_FOR_PICKS = 3

// ---------------------------------------------------------------------------------------------------------
// URL

const SCREEN_NAMES: readonly TvScreenName[] = [
	"home",
	"about",
	"services",
	"this-or-that",
	"moods",
	"source",
	"picks",
	"title",
	"app",
	"search",
]

function readNight(params: URLSearchParams): Night {
	const from = params.get("from")
	return {
		mood: params.get("mood") || null,
		source: from === "wishlist" || from === "new" ? from : "auto",
		service: params.get("service") || null,
	}
}

function readScreen(params: URLSearchParams): TvScreen {
	const name = params.get("tv") as TvScreenName | null
	if (!name || !SCREEN_NAMES.includes(name)) return { name: "home" }
	switch (name) {
		case "moods":
			return {
				name,
				night: readNight(params),
				refine: params.get("refine") === "1",
			}
		case "source":
		case "picks":
			return { name, night: readNight(params) }
		case "title": {
			const title = params.get("title")
			return title ? { name, title } : { name: "home" }
		}
		case "app": {
			const app = params.get("app") as TvApp | null
			return app && TV_APPS.includes(app) ? { name, app } : { name: "home" }
		}
		case "search":
			return { name, query: params.get("q")?.trim() || null }
		default:
			return { name } as TvScreen
	}
}

/** Reads the TV state from the URL. `depth` comes from the history entry's state (0 when unknown). */
export function readTvState(params: URLSearchParams, depth = 0): TvState {
	return {
		screen: readScreen(params),
		focus: params.get("focus") || null,
		power: "on",
		menuOpen: false,
		depth,
	}
}

const TV_KEYS = [
	"tv",
	"mood",
	"from",
	"service",
	"refine",
	"title",
	"app",
	"q",
	"focus",
]

/** Writes the TV screen and focus into a copy of `params`, keeping unrelated params. Home writes no `tv`. */
export function writeTvParams(
	state: Pick<TvState, "screen" | "focus">,
	params = new URLSearchParams(),
): URLSearchParams {
	const out = new URLSearchParams(params)
	for (const key of TV_KEYS) out.delete(key)
	const s = state.screen
	if (s.name !== "home") out.set("tv", s.name)
	if (s.name === "moods" || s.name === "source" || s.name === "picks") {
		if (s.night.mood) out.set("mood", s.night.mood)
		if (s.night.source !== "auto") out.set("from", s.night.source)
		if (s.night.service) out.set("service", s.night.service)
	}
	if (s.name === "moods" && s.refine) out.set("refine", "1")
	if (s.name === "title") out.set("title", s.title)
	if (s.name === "app") out.set("app", s.app)
	if (s.name === "search" && s.query) out.set("q", s.query)
	if (state.focus) out.set("focus", state.focus)
	return out
}

/**
 * True when two URLs differ only in TV params. The living room route's `shouldRevalidate` uses it so D-pad
 * moves and TV screen changes don't rerun its loader.
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
// Items: what the D-pad moves through on each screen. Ids are stable so focus survives in the URL.

export function tvItems(screen: TvScreen, ctx: TvContext): string[] {
	switch (screen.name) {
		case "home":
			return ctx.member
				? [...moodItems(ctx), ...TV_APPS.map((a) => `app:${a}`)]
				: ["find-my-tonight", "just-show-me", "about"]
		case "about":
			return ["find-my-tonight", "just-show-me"]
		case "services":
			return [...ctx.serviceNames.map((n) => `service:${n}`), "continue"]
		case "this-or-that":
			return [
				"answer:a",
				"answer:b",
				"answer:skip",
				...(ctx.answered >= MIN_ANSWERS_FOR_PICKS ? ["show-picks"] : []),
			]
		case "moods":
			return moodItems(ctx)
		case "source":
			return ["source:wishlist", "source:new"]
		case "picks":
			return [
				...ctx.pickKeys.slice(0, 3).map((k) => `title:${k}`),
				"moods",
				ctx.member
					? "switch-source"
					: ctx.answered
						? "this-or-that"
						: "services",
			]
		case "title":
			return ["watch", "want-to-see", "seen", "not-for-me", "full-page"]
		case "app":
			return screen.app === "watch-now" && ctx.member
				? [
						...ctx.wishlistKeys.slice(0, 6).map((k) => `title:${k}`),
						"full-page",
					]
				: ["full-page"]
		case "search":
			return []
	}
}

function moodItems(ctx: TvContext) {
	return ["mood:any", ...ctx.moodKeys.map((m) => `mood:${m}`)]
}

/** The focused item id, falling back to the first item when the stored focus is gone. */
export function focusedItem(state: TvState, ctx: TvContext): string | null {
	const items = tvItems(state.screen, ctx)
	return state.focus && items.includes(state.focus)
		? state.focus
		: (items[0] ?? null)
}

/** The source the picks actually use once `auto` is resolved. */
export function resolvedSource(
	night: Night,
	ctx: Pick<TvContext, "member" | "wishlistKeys">,
): "wishlist" | "new" {
	if (night.source !== "auto") return night.source
	return ctx.member && ctx.wishlistKeys.length ? "wishlist" : "new"
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
			depth: state.depth + 1,
		},
		history: "push",
		effects,
	}
}

function replace(
	state: TvState,
	screen: TvScreen,
	effects: TvEffect[] = [],
): TvTransition {
	return {
		state: { ...state, screen, focus: null, menuOpen: false },
		history: "replace",
		effects,
	}
}

/** Back: close the menu, pop a screen this visit pushed, or (on a deep link) replace with home. Home stays. */
function back(state: TvState, effects: TvEffect[] = []): TvTransition {
	if (state.menuOpen) return none({ ...state, menuOpen: false }, effects)
	if (state.screen.name === "home") return none(state, effects)
	if (state.depth > 0) return { state, history: "back", effects }
	return replace(state, { name: "home" }, effects)
}

function nightOf(screen: TvScreen): Night {
	return screen.name === "moods" ||
		screen.name === "source" ||
		screen.name === "picks"
		? screen.night
		: ANY_NIGHT
}

function pickForMe(state: TvState, ctx: TvContext): TvTransition {
	if (ctx.member)
		return push(state, { name: "moods", night: ANY_NIGHT, refine: false })
	if (!ctx.hasServices && !ctx.answered)
		return push(state, { name: "services" })
	return push(state, { name: "this-or-that" })
}

function choose(state: TvState, item: string, ctx: TvContext): TvTransition {
	const s = state.screen
	const [kind, ...rest] = item.split(":")
	const arg = rest.join(":")
	switch (kind) {
		case "find-my-tonight":
			return pickForMe(state, ctx)
		case "just-show-me":
			return push(state, {
				name: "picks",
				night: { ...ANY_NIGHT, source: "new" },
			})
		case "about":
			return push(state, { name: "about" })
		case "app":
			return push(state, { name: "app", app: arg as TvApp })
		case "moods":
			return push(state, {
				name: "moods",
				night: nightOf(s),
				refine: s.name === "picks",
			})
		case "services":
			return push(state, { name: "services" })
		case "this-or-that":
		case "continue":
			return push(state, { name: "this-or-that" })
		case "mood": {
			const night = {
				...nightOf(s),
				mood: arg === "any" ? null : arg,
				source: "auto" as const,
			}
			if (s.name === "moods" && s.refine)
				return replace(state, { name: "picks", night })
			if (ctx.member) return push(state, { name: "source", night })
			return push(state, { name: "picks", night })
		}
		case "source":
			return push(state, {
				name: "picks",
				night: { ...nightOf(s), source: arg as "wishlist" | "new" },
			})
		case "switch-source": {
			const night = nightOf(s)
			const next =
				resolvedSource(night, ctx) === "wishlist" ? "new" : "wishlist"
			return replace(state, {
				name: "picks",
				night: { ...night, source: next },
			})
		}
		case "service":
			return none(state, [{ type: "toggle-service", service: arg }])
		case "answer": {
			const side = arg as "a" | "b" | "skip"
			const effects: TvEffect[] = [{ type: "answer-pair", side }]
			if (ctx.pairsLeft <= 1)
				return replace(
					state,
					{ name: "picks", night: { ...ANY_NIGHT, source: "new" } },
					effects,
				)
			return none(state, effects)
		}
		case "show-picks":
			return replace(state, {
				name: "picks",
				night: { ...ANY_NIGHT, source: "new" },
			})
		case "title":
			return push(state, { name: "title", title: arg })
		case "watch":
		case "want-to-see":
			return s.name === "title"
				? none(state, [{ type: kind, title: s.title }])
				: none(state)
		case "seen":
		case "not-for-me":
			return s.name === "title"
				? back(state, [{ type: kind, title: s.title }])
				: none(state)
		case "full-page":
			if (s.name === "title")
				return none(state, [
					{ type: "leave", to: { kind: "title", title: s.title } },
				])
			if (s.name === "app")
				return none(state, [{ type: "leave", to: { kind: "app", app: s.app } }])
			return none(state)
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
		if (!action.on) return none({ ...state, power: "off", menuOpen: false })
		return state.power === "off"
			? none({ ...state, power: "booting" })
			: none(state)
	}
	if (state.power === "off") return none(state)
	// Turning the set on boots again, then shows home.
	if (action.type === "boot-done")
		return state.power === "booting"
			? replace({ ...state, power: "on" }, { name: "home" })
			: none(state)
	if (state.power === "booting") return none(state)

	switch (action.type) {
		case "step": {
			const items = tvItems(state.screen, ctx)
			if (!items.length || state.menuOpen) return none(state)
			const at = Math.max(0, items.indexOf(focusedItem(state, ctx) ?? ""))
			const focus = items[(at + action.by + items.length) % items.length]
			return { state: { ...state, focus }, history: "replace", effects: [] }
		}
		case "focus":
			if (
				!tvItems(state.screen, ctx).includes(action.item) ||
				state.focus === action.item
			)
				return none(state)
			return {
				state: { ...state, focus: action.item },
				history: "replace",
				effects: [],
			}
		case "ok": {
			const item = focusedItem(state, ctx)
			return item ? choose(state, item, ctx) : none(state)
		}
		case "choose":
			return tvItems(state.screen, ctx).includes(action.item)
				? choose(state, action.item, ctx)
				: none(state)
		case "back":
			return back(state)
		case "home":
			if (state.screen.name === "home")
				return none({ ...state, menuOpen: false })
			return {
				state: {
					...state,
					screen: { name: "home" },
					focus: null,
					menuOpen: false,
					depth: 0,
				},
				history: "push",
				effects: [],
			}
		case "toggle-menu":
			return none({ ...state, menuOpen: !state.menuOpen })
		case "open-moods":
			if (state.screen.name === "moods") return back(state)
			return push(state, {
				name: "moods",
				night: nightOf(state.screen),
				refine: state.screen.name === "picks",
			})
		case "open-app":
			return push(state, { name: "app", app: action.app })
		case "open-search":
			return state.screen.name === "search" && !state.screen.query
				? back(state)
				: push(state, { name: "search", query: null })
		case "submit-search": {
			const query = action.query.trim()
			if (query.length < 2) return none(state)
			const screen: TvScreen = { name: "search", query }
			return state.screen.name === "search"
				? replace(state, screen)
				: push(state, screen)
		}
		case "pick-for-me":
			return pickForMe(state, ctx)
		case "service-key": {
			if (state.screen.name === "services")
				return none(state, [
					{ type: "toggle-service", service: action.service },
				])
			const night = nightOf(state.screen)
			const next = {
				...night,
				service: night.service === action.service ? null : action.service,
			}
			return state.screen.name === "picks"
				? replace(state, { name: "picks", night: next })
				: push(state, { name: "picks", night: next })
		}
	}
}
