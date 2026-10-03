// The living room TV flow ("Ask, then answer"), shared by the desktop and phone editions.
//
// A pure state machine: `transition(state, action, context)` returns the next state, how the browser history
// changes (`push` for a new TV screen, `replace` for focus moves and in-place changes, `back` to pop), and the
// effects the page must carry out (rate a title, toggle a service, leave the living room). The screen and its
// keys live in the URL search params (`/?tv=picks&mood=cozy`); `readTvState` and `writeTvParams` convert.
// Power, the menu, and the in-app history depth are not in the URL.
//
// Home is a selection: guests choose Watch next, the taste quiz, or a mood; members choose Watch next (their
// Wishlist) or Something new. The menu is the same on every screen and jumps to any place. Back is one step back
// in the browser history; only a deep link without history falls back to home.
//
// The taste quiz (#226) is one TV screen whose step (rate, keep, picks), goal, and picks page follow the shared
// quiz flow (`quiz-flow.ts`) and live in the URL too, so Back and "Back to my picks" land on the same picks page.
import type { Score } from "~/server/scores.server"
import {
	QUIZ_GOAL,
	type QuizState,
	RATING_LEVELS,
	initialQuizState,
	pickPages,
	picksOnPage,
	quizTransition,
} from "../taste-quiz/quiz-flow.ts"

/** The places outside the TV. Opening one leaves the living room for its page. */
export type TvApp = "watch-next" | "discover" | "taste" | "explorer"
export const TV_APPS: readonly TvApp[] = [
	"watch-next",
	"discover",
	"taste",
	"explorer",
]

/** The menu, the same on every screen: home, the places, the moods, the taste quiz, What is GoodWatch?, off. */
export const MENU_ITEMS: readonly string[] = [
	"menu:home",
	...TV_APPS.map((a) => `menu:${a}`),
	"menu:moods",
	"menu:taste-quiz",
	"menu:about",
	"menu:off",
]

/** Where tonight's picks come from. `auto` is the Wishlist when it has titles for the night, otherwise new titles. */
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
	/** A guest's Watch next, step 1: where do you watch. */
	| { name: "services" }
	/** A guest's Watch next, step 2: "Which one, tonight?" pairs. */
	| { name: "this-or-that" }
	/** What kind of night? `refine` means a mood chosen here replaces the picks it came from. */
	| { name: "moods"; night: Night; refine: boolean }
	/** Here's tonight: three picks. */
	| { name: "picks"; night: Night }
	| { name: "title"; title: string }
	/** The on-screen keyboard without a query, the results with one. */
	| { name: "search"; query: string | null }
	/** The taste quiz: rate one title at a time, "Keep these 5?", then picks three at a time. */
	| { name: "quiz"; quiz: QuizState }

export type TvScreenName = TvScreen["name"]

export type TvPower = "off" | "booting" | "on"

export type TvState = {
	screen: TvScreen
	/** The focused item id, or null for the first item. */
	focus: string | null
	power: TvPower
	menuOpen: boolean
	/** The focused menu item while the menu is open, or null for its first item. */
	menuFocus: string | null
	/** How many TV screens were pushed onto the browser history in this visit. Zero on a deep link. */
	depth: number
}

/** What the page knows about the person and the data on screen. The machine never fetches. */
export type TvContext = {
	member: boolean
	/** Title keys of tonight's picks for the current night, best first. */
	pickKeys: readonly string[]
	/** Title keys on the member's Wishlist. */
	wishlistKeys: readonly string[]
	/** Where the picks on screen come from, with `auto` resolved for their night. */
	source: "wishlist" | "new"
	/** Streaming service names offered on the services screen. */
	serviceNames: readonly string[]
	moodKeys: readonly string[]
	hasServices: boolean
	/** This-or-that pairs answered with a side (skips do not count). */
	answered: number
	/** This-or-that pairs still unanswered (skips count as answered). */
	pairsLeft: number
	/** Taste quiz scores toward the goal: all guest scores, or a member's scores in this visit. */
	quizProgress: number
	/** Taste quiz picks as `<media_type>-<tmdb_id>`, best first. */
	quizPicks: readonly string[]
}

export type TvEffect =
	| { type: "toggle-service"; service: string }
	| { type: "answer-pair"; side: "a" | "b" | "skip" }
	/** Every pair is answered and the person asks for them again: forget the answers. */
	| { type: "restart-pairs" }
	| { type: "watch"; title: string }
	| { type: "want-to-see"; title: string }
	| { type: "seen"; title: string }
	| { type: "not-for-me"; title: string }
	| {
			type: "leave"
			to:
				| { kind: "title"; title: string }
				| { kind: "app"; app: TvApp }
				/** A page the machine doesn't know, such as a quiz pick's title page. The living room sends it. */
				| { kind: "page"; href: string }
	  }
	/** Taste quiz: score the title on screen. */
	| { type: "quiz-rate"; score: Score }
	/** Taste quiz: "Haven't seen it". */
	| { type: "quiz-skip" }
	/** Taste quiz: "+ Want to see". */
	| { type: "quiz-want" }
	/** Taste quiz: Continue with Google, back to the quiz's picks. */
	| { type: "quiz-save" }
	/** Taste quiz: open a pick's title page (`<media_type>-<tmdb_id>`). */
	| { type: "quiz-pick"; pick: string }

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
	"picks",
	"title",
	"search",
	"quiz",
]

function readInt(params: URLSearchParams, key: string, fallback: number) {
	const n = Number.parseInt(params.get(key) ?? "", 10)
	return Number.isFinite(n) && n >= 0 ? n : fallback
}

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
		case "picks":
			return { name, night: readNight(params) }
		case "title": {
			const title = params.get("title")
			return title ? { name, title } : { name: "home" }
		}
		case "search":
			return { name, query: params.get("q")?.trim() || null }
		case "quiz": {
			const step = params.get("step")
			return {
				name,
				quiz: {
					screen: step === "keep" || step === "picks" ? step : "quiz",
					goal: Math.max(QUIZ_GOAL, readInt(params, "goal", QUIZ_GOAL)),
					page: readInt(params, "page", 0),
					pickedBefore: step === "picks" || params.get("more") === "1",
				},
			}
		}
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
		menuFocus: null,
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
	"q",
	"step",
	"goal",
	"page",
	"more",
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
	if (s.name === "moods" || s.name === "picks") {
		if (s.night.mood) out.set("mood", s.night.mood)
		if (s.night.source !== "auto") out.set("from", s.night.source)
		if (s.night.service) out.set("service", s.night.service)
	}
	if (s.name === "moods" && s.refine) out.set("refine", "1")
	if (s.name === "title") out.set("title", s.title)
	if (s.name === "search" && s.query) out.set("q", s.query)
	if (s.name === "quiz") {
		if (s.quiz.screen !== "quiz") out.set("step", s.quiz.screen)
		if (s.quiz.goal !== QUIZ_GOAL) out.set("goal", String(s.quiz.goal))
		if (s.quiz.page) out.set("page", String(s.quiz.page))
		if (s.quiz.pickedBefore && s.quiz.screen !== "picks") out.set("more", "1")
	}
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
				? ["watch-next", "something-new"]
				: ["watch-next", "taste-quiz", "moods"]
		case "about":
			return ["watch-next", "just-show-me"]
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
			// Any mood comes last: it clears the mood of the picks.
			return [...ctx.moodKeys.map((m) => `mood:${m}`), "mood:any"]
		case "picks":
			return [
				...ctx.pickKeys.slice(0, 3).map((k) => `title:${k}`),
				"moods",
				ctx.member
					? "switch-source"
					: ctx.answered
						? "this-or-that"
						: "services",
				"full-page",
			]
		case "title":
			return ["watch", "want-to-see", "seen", "not-for-me", "full-page"]
		case "search":
			return []
		case "quiz":
			return quizItems(screen.quiz, ctx)
	}
}

/** The rating: the four levels (`level:dislike`, ...), then the exact 1-10 strip (`score:1` ... `score:10`). */
export const QUIZ_RATING_ITEMS = [
	...RATING_LEVELS.map((l) => `level:${l.name.toLowerCase()}`),
	...Array.from({ length: 10 }, (_, i) => `score:${i + 1}`),
]

function quizItems(q: QuizState, ctx: TvContext): string[] {
	const save = ctx.member ? [] : ["quiz-save"]
	switch (q.screen) {
		case "quiz":
			return [
				...QUIZ_RATING_ITEMS,
				"quiz-skip",
				"quiz-want",
				// Rate more: after the picks, and always for members (their picks come from the account).
				...(q.pickedBefore || ctx.member ? [...save, "back-to-picks"] : []),
			]
		case "keep":
			return [...save, "quiz-picks", "rate-more"]
		case "picks": {
			const pages = pickPages(ctx.quizPicks.length)
			const page = Math.min(q.page, pages - 1)
			return [
				...(page > 0 ? ["picks-prev"] : []),
				...picksOnPage(ctx.quizPicks, page).map((k) => `pick:${k}`),
				...(page < pages - 1 ? ["picks-next"] : []),
				...save,
				"rate-more",
			]
		}
	}
}

/** The score a rating item stores: a level's score (3, 5, 7, 9) or the exact number. */
export function quizScoreOf(item: string): Score | null {
	const [kind, arg] = item.split(":")
	if (kind === "score") {
		const n = Number(arg)
		return Number.isInteger(n) && n >= 1 && n <= 10 ? (n as Score) : null
	}
	if (kind === "level")
		return (
			RATING_LEVELS.find((l) => l.name.toLowerCase() === arg)?.score ?? null
		)
	return null
}

/** What the wheel moves through right now: the menu while it is open, else the screen's items. */
function activeItems(state: TvState, ctx: TvContext): readonly string[] {
	return state.menuOpen ? MENU_ITEMS : tvItems(state.screen, ctx)
}

/** Where the focus starts on a screen: the guest home's middle card, a member's Wishlist if any, the mood in use. */
function defaultItem(
	screen: TvScreen,
	items: readonly string[],
	ctx: TvContext,
): string | null {
	const preferred =
		screen.name === "home"
			? ctx.member
				? ctx.wishlistKeys.length
					? "watch-next"
					: "something-new"
				: "taste-quiz"
			: screen.name === "moods" && screen.night.mood
				? `mood:${screen.night.mood}`
				: null
	return preferred && items.includes(preferred) ? preferred : (items[0] ?? null)
}

/** The focused item id: the menu's while it is open, else the screen's, falling back to where the focus starts. */
export function focusedItem(state: TvState, ctx: TvContext): string | null {
	if (state.menuOpen)
		return state.menuFocus && MENU_ITEMS.includes(state.menuFocus)
			? state.menuFocus
			: MENU_ITEMS[0]
	const items = tvItems(state.screen, ctx)
	return state.focus && items.includes(state.focus)
		? state.focus
		: defaultItem(state.screen, items, ctx)
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

function replace(
	state: TvState,
	screen: TvScreen,
	effects: TvEffect[] = [],
): TvTransition {
	return {
		state: { ...state, screen, focus: null, menuOpen: false, menuFocus: null },
		history: "replace",
		effects,
	}
}

const closeMenu = (state: TvState): TvState => ({
	...state,
	menuOpen: false,
	menuFocus: null,
})

/**
 * Back: close the menu, else go one step back in this visit's history, home included. Without history (a deep
 * link), replace the screen with home; home itself stays.
 */
function back(state: TvState, effects: TvEffect[] = []): TvTransition {
	if (state.menuOpen) return none(closeMenu(state), effects)
	// Back from Rate more returns to the same picks page.
	const s = state.screen
	if (s.name === "quiz" && s.quiz.screen === "quiz" && s.quiz.pickedBefore)
		return replace(
			state,
			{ name: "quiz", quiz: quizTransition(s.quiz, { type: "show-picks" }) },
			effects,
		)
	if (state.depth > 0) return { state, history: "back", effects }
	if (state.screen.name === "home") return none(state, effects)
	return replace(state, { name: "home" }, effects)
}

function nightOf(screen: TvScreen): Night {
	return screen.name === "moods" || screen.name === "picks"
		? screen.night
		: ANY_NIGHT
}

/** A jump from the menu or the Remote: a new screen, unless that screen is already showing. */
function jump(state: TvState, screen: TvScreen): TvTransition {
	return state.screen.name === screen.name
		? none(closeMenu(state))
		: push(state, screen)
}

function thisOrThat(state: TvState, ctx: TvContext): TvTransition {
	return push(
		state,
		{ name: "this-or-that" },
		ctx.pairsLeft === 0 ? [{ type: "restart-pairs" }] : [],
	)
}

/**
 * Watch next: a member's picks from their Wishlist. A guest has no Wishlist to pick from, so theirs are new
 * titles: straight away once they answered enough pairs, else after the services and the pairs.
 */
function watchNext(state: TvState, ctx: TvContext): TvTransition {
	if (ctx.member)
		return push(state, {
			name: "picks",
			night: { ...ANY_NIGHT, source: "wishlist" },
		})
	if (ctx.answered >= MIN_ANSWERS_FOR_PICKS)
		return push(state, {
			name: "picks",
			night: { ...ANY_NIGHT, source: "new" },
		})
	if (!ctx.hasServices && !ctx.answered)
		return jump(state, { name: "services" })
	return state.screen.name === "this-or-that"
		? none(closeMenu(state))
		: thisOrThat(state, ctx)
}

/** Opens a place's page. A guest's Watch next is their flow on the TV, since the page needs a Wishlist. */
function openApp(state: TvState, app: TvApp, ctx: TvContext): TvTransition {
	if (app === "watch-next" && !ctx.member) return watchNext(state, ctx)
	return none(closeMenu(state), [{ type: "leave", to: { kind: "app", app } }])
}

function openQuiz(state: TvState, ctx: TvContext): TvTransition {
	return jump(state, {
		name: "quiz",
		quiz: initialQuizState({ progress: ctx.quizProgress, member: ctx.member }),
	})
}

function goHome(state: TvState): TvTransition {
	return jump(state, { name: "home" })
}

function chooseInMenu(
	state: TvState,
	item: string,
	ctx: TvContext,
): TvTransition {
	const to = item.slice("menu:".length)
	switch (to) {
		case "home":
			return goHome(state)
		case "moods":
			return jump(state, {
				name: "moods",
				night: nightOf(state.screen),
				refine: state.screen.name === "picks",
			})
		case "taste-quiz":
			return openQuiz(state, ctx)
		case "about":
			return jump(state, { name: "about" })
		case "off":
			return none({ ...closeMenu(state), power: "off" })
		default:
			return openApp(state, to as TvApp, ctx)
	}
}

function chooseInQuiz(
	state: TvState,
	q: QuizState,
	item: string,
	ctx: TvContext,
): TvTransition {
	const score = quizScoreOf(item)
	const toQuiz = (next: QuizState, effects: TvEffect[] = []) =>
		replace(state, { name: "quiz", quiz: next }, effects)
	if (score != null) {
		const effects: TvEffect[] = [{ type: "quiz-rate", score }]
		const next = quizTransition(q, {
			type: "scored",
			progress: ctx.quizProgress + 1,
		})
		// The focus stays on the rating, so the next title takes the same press.
		return next === q ? none(state, effects) : toQuiz(next, effects)
	}
	const [kind, ...rest] = item.split(":")
	switch (kind) {
		case "quiz-skip":
			return none(state, [{ type: "quiz-skip" }])
		case "quiz-want":
			return none(state, [{ type: "quiz-want" }])
		case "quiz-save":
			return none(state, [{ type: "quiz-save" }])
		case "quiz-picks":
		case "back-to-picks":
			return toQuiz(quizTransition(q, { type: "show-picks" }))
		case "rate-more":
			return toQuiz(
				quizTransition(q, { type: "rate-more", progress: ctx.quizProgress }),
			)
		case "picks-prev":
		case "picks-next": {
			const next = quizTransition(q, {
				type: "turn",
				by: kind === "picks-next" ? 1 : -1,
				pages: pickPages(ctx.quizPicks.length),
			})
			// Each further press on an arrow turns another page; past the last page the focus falls to the first item.
			const screen: TvScreen = { name: "quiz", quiz: next }
			return {
				state: {
					...state,
					screen,
					focus: tvItems(screen, ctx).includes(item) ? item : null,
				},
				history: "replace",
				effects: [],
			}
		}
		case "pick":
			return none(state, [{ type: "quiz-pick", pick: rest.join(":") }])
		default:
			return none(state)
	}
}

function choose(state: TvState, item: string, ctx: TvContext): TvTransition {
	const s = state.screen
	if (s.name === "quiz") return chooseInQuiz(state, s.quiz, item, ctx)
	const [kind, ...rest] = item.split(":")
	const arg = rest.join(":")
	switch (kind) {
		case "watch-next":
			return watchNext(state, ctx)
		case "something-new":
		case "just-show-me":
			return push(state, {
				name: "picks",
				night: { ...ANY_NIGHT, source: "new" },
			})
		case "taste-quiz":
			return openQuiz(state, ctx)
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
			return thisOrThat(state, ctx)
		case "mood": {
			// The mood changes; where the picks come from stays.
			const night = { ...nightOf(s), mood: arg === "any" ? null : arg }
			return s.name === "moods" && s.refine
				? replace(state, { name: "picks", night })
				: push(state, { name: "picks", night })
		}
		case "switch-source":
			return replace(state, {
				name: "picks",
				night: {
					...nightOf(s),
					source: ctx.source === "wishlist" ? "new" : "wishlist",
				},
			})
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
			if (s.name === "picks")
				return openApp(
					state,
					ctx.source === "wishlist" ? "watch-next" : "discover",
					ctx,
				)
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
		if (!action.on) return none({ ...closeMenu(state), power: "off" })
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
			const items = activeItems(state, ctx)
			if (!items.length) return none(state)
			const at = Math.max(0, items.indexOf(focusedItem(state, ctx) ?? ""))
			const focus = items[(at + action.by + items.length) % items.length]
			// The menu's focus is not in the URL, so the screen keeps its own focus underneath.
			if (state.menuOpen) return none({ ...state, menuFocus: focus })
			return { state: { ...state, focus }, history: "replace", effects: [] }
		}
		case "focus":
			if (state.menuOpen)
				return MENU_ITEMS.includes(action.item)
					? none({ ...state, menuFocus: action.item })
					: none(state)
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
			if (!item) return none(state)
			return state.menuOpen
				? chooseInMenu(state, item, ctx)
				: choose(state, item, ctx)
		}
		case "choose":
			// With the menu open, pressing anything behind it only closes it.
			if (state.menuOpen)
				return MENU_ITEMS.includes(action.item)
					? chooseInMenu(state, action.item, ctx)
					: none(closeMenu(state))
			return tvItems(state.screen, ctx).includes(action.item)
				? choose(state, action.item, ctx)
				: none(state)
		case "back":
			return back(state)
		case "home":
			return goHome(state)
		case "toggle-menu":
			return none({ ...state, menuOpen: !state.menuOpen, menuFocus: null })
		case "open-moods":
			if (state.screen.name === "moods") return back(closeMenu(state))
			return push(state, {
				name: "moods",
				night: nightOf(state.screen),
				refine: state.screen.name === "picks",
			})
		case "open-app":
			return openApp(state, action.app, ctx)
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
