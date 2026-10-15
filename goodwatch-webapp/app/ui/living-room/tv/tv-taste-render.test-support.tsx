// Run by tv-taste-render.test.ts through vite-node: renders Taste in its three states, a side's screen, the taste
// quiz and the rating the way they are drawn once their code is there, and prints the HTML with the item ids the
// machine lists for each.
import { renderToStaticMarkup } from "react-dom/server"
import type { TvListTitle } from "./TitleList"
import { TvScreen } from "./TvScreen"
import { Layer, TvViewProvider } from "./kit"
import { PHONE_TV_CANVAS, TV_CANVAS } from "./room-layout"
import type { TvCanvas } from "./room-tv"
import Quiz from "./screens/Quiz"
import Rate from "./screens/Rate"
import Taste from "./screens/Taste"
import {
	EMPTY_CONTEXT,
	type TvScreen as Screen,
	type TvContext,
	type TvState,
	focusedItem,
	tvItems,
} from "./tv-machine"
import {
	type TvQuizOnScreen,
	type TvSide,
	type TvTasteOnScreen,
	type TvTasteScreens,
	tasteContext,
} from "./tv-taste"
import type { TvTitleOnScreen } from "./tv-title"

const CANVAS: Record<"desktop" | "phone", TvCanvas> = {
	desktop: { edition: "desktop", ...TV_CANVAS, scale: 1 },
	phone: { edition: "phone", ...PHONE_TV_CANVAS, scale: 0.72 },
}

/**
 * The phones of the room's table (docs/implementation/tv-screen-revamp/room): the window, how large the canvas is
 * shown and how much of its height. The Remote is in the hand on the tall ones and on the table on the short.
 */
const PHONES = [
	{ phone: "360x740", scale: 332 / 500, h: 417 },
	{ phone: "375x667", scale: 347 / 500, h: 372 },
	{ phone: "390x700", scale: 362 / 500, h: 402 },
	{ phone: "390x844", scale: 362 / 500, h: 417 },
	{ phone: "430x932", scale: 402 / 500, h: 417 },
	// Landscape: the canvas is shown at about its own size.
	{ phone: "844x390", scale: 0.98, h: 373 },
]

const listTitle = (key: string, n: number): TvListTitle => ({
	key,
	title: `Title ${n}`,
	poster: `/poster-${n}.jpg`,
	backdrop: `/backdrop-${n}.jpg`,
	facts: `2019 · Movie · 8${n} score · You gave it ${n}`,
})
const side = (id: string, name: string, n: number, count = 4): TvSide => ({
	id,
	name,
	line: `Line of ${id}.`,
	backdrop: `/side-${id}.jpg`,
	titles: Array.from({ length: count }, (_, at) =>
		listTitle(`movie-${n * 10 + at}`, n * 10 + at),
	),
})
const SIDES = [
	side("dark-crime", "Slow-burning crime stories", 1),
	side("gentle-comedy", "Warm comedies", 2, 2),
	side("big-ideas", "Mind-bending futures", 3),
	side("true-stories", "Quiet true stories", 4),
	side("odd-comedy", "Physically and situationally funny stories", 5),
]
const PICKS = [1, 2, 3, 4, 5].map((n) => listTitle(`show-${900 + n}`, n))
const ASKED = {
	key: "show-2316",
	title: "The Office",
	backdrop: "/office.jpg",
	facts: "2005 · Show",
}

const screensOf = (
	taste: TvTasteOnScreen,
	quiz: Partial<TvQuizOnScreen> = {},
): TvTasteScreens => ({
	taste,
	quiz: { title: null, waiting: false, rated: 0, ...quiz },
})
/** The machine's context as the scene builds it: Taste's part, and whether the edition has exact scores. */
const ctxOf = (
	screen: Screen,
	shown: TvTasteScreens,
	canvas: TvCanvas,
): TvContext => ({
	...EMPTY_CONTEXT,
	...tasteContext(screen, shown),
	exactScores: canvas.edition === "desktop",
})

/** A screen drawn as it is once its code is there. */
const html = (canvas: TvCanvas, focused: string, node: React.ReactNode) =>
	renderToStaticMarkup(
		<TvViewProvider value={{ canvas, focused, dispatch: () => {} }}>
			<Layer>{node}</Layer>
		</TvViewProvider>,
	)

type Drawn = { items: string[]; focus: string; html: string }
/** A screen in both editions, each with the items the machine gives that edition and where its focus starts. */
function editions(
	draw: (canvas: TvCanvas) => {
		items: string[]
		ctx: TvContext
		screen: Screen
		node: (focused: string) => React.ReactNode
	},
	focus?: string,
): Record<"desktop" | "phone", Drawn> {
	const one = (canvas: TvCanvas): Drawn => {
		const { items, ctx, screen, node } = draw(canvas)
		const state: TvState = {
			screen,
			focus: focus ?? null,
			power: "on",
			menuOpen: false,
			menuFocus: null,
			depth: 1,
		}
		const focused = focusedItem(state, ctx)
		return { items, focus: focused, html: html(canvas, focused, node(focused)) }
	}
	return { desktop: one(CANVAS.desktop), phone: one(CANVAS.phone) }
}

const TASTE: Screen = { name: "taste", side: null }
const QUIZ: Screen = { name: "quiz" }
const RATE: Screen = { name: "rate", title: "movie-603" }

const tasteOf = (
	taste: TvTasteOnScreen,
	screen: Screen = TASTE,
	focus?: string,
) =>
	editions((canvas) => {
		const shown = screensOf(taste)
		const ctx = ctxOf(screen, shown, canvas)
		const items = tvItems(screen, ctx)
		return {
			items,
			ctx,
			screen,
			node: () => (
				<Taste
					items={items}
					taste={taste}
					side={screen.name === "taste" ? screen.side : null}
				/>
			),
		}
	}, focus)

const quizOf = (quiz: Partial<TvQuizOnScreen>, focus?: string) =>
	editions((canvas) => {
		const shown = screensOf({ state: "start", rated: 0, backdrop: null }, quiz)
		const ctx = ctxOf(QUIZ, shown, canvas)
		const items = tvItems(QUIZ, ctx)
		return {
			items,
			ctx,
			screen: QUIZ,
			node: () => <Quiz items={items} quiz={shown.quiz} />,
		}
	}, focus)

const rated = (rest: Partial<TvTitleOnScreen> = {}): TvTitleOnScreen => ({
	key: "movie-603",
	title: {
		media_type: "movie",
		tmdb_id: 603,
		title: "The Matrix",
		backdrop_path: "/matrix.jpg",
	},
	missing: false,
	mine: [],
	want: false,
	seen: false,
	score: null,
	...rest,
})
const rateOf = (title: TvTitleOnScreen, focus?: string) =>
	editions((canvas) => {
		const ctx: TvContext = {
			...EMPTY_CONTEXT,
			exactScores: canvas.edition === "desktop",
		}
		const items = tvItems(RATE, ctx)
		return {
			items,
			ctx,
			screen: RATE,
			node: () => <Rate items={items} title={title} />,
		}
	}, focus)

/** What the TV draws for a screen before its code is there, as the server does. */
function first(screen: Screen, taste?: TvTasteScreens) {
	const state: TvState = {
		screen,
		focus: null,
		power: "on",
		menuOpen: false,
		menuFocus: null,
		depth: 0,
	}
	const ctx = EMPTY_CONTEXT
	const focused = focusedItem(state, ctx)
	return renderToStaticMarkup(
		<TvScreen
			tv={{ state, focused, screenFocus: focused, dispatch: () => {} }}
			canvas={CANVAS.desktop}
			ctx={ctx}
			apps={[]}
			toast={null}
			taste={taste}
		/>,
	)
}

const start: TvTasteOnScreen = { state: "start", rated: 0, backdrop: null }
const sidesOf = (count: number): TvTasteOnScreen => ({
	state: "sides",
	sides: SIDES.slice(0, count),
})
const picks: TvTasteOnScreen = { state: "picks", picks: PICKS, waiting: false }
const SIDE: Screen = { name: "taste", side: "dark-crime" }

console.log(
	`__TV_TASTE_RENDER__${JSON.stringify({
		taste: {
			start: tasteOf(start),
			started: tasteOf({ state: "start", rated: 3, backdrop: "/next.jpg" }),
			reading: tasteOf({ state: "reading" }),
			two: tasteOf(sidesOf(2)),
			three: tasteOf(sidesOf(3)),
			four: tasteOf(sidesOf(4)),
			five: tasteOf(sidesOf(5)),
			threeSecond: tasteOf(sidesOf(3), TASTE, "side:gentle-comedy"),
			threeOnBar: tasteOf(sidesOf(3), TASTE, "bar:menu"),
			picks: tasteOf(picks),
			picksSecond: tasteOf(picks, TASTE, "title:show-902"),
			picksWaiting: tasteOf({ state: "picks", picks: [], waiting: true }),
			picksNone: tasteOf({ state: "picks", picks: [], waiting: false }),
			side: tasteOf(sidesOf(3), SIDE),
			sideShort: tasteOf(sidesOf(3), { name: "taste", side: "gentle-comedy" }),
			sideGone: tasteOf(sidesOf(3), { name: "taste", side: "no-such" }),
		},
		quiz: {
			asking: quizOf({ title: ASKED, rated: 2 }),
			onScore: quizOf({ title: ASKED, rated: 2 }, "score:8"),
			onLevel: quizOf({ title: ASKED, rated: 2 }, "level:3"),
			onSkip: quizOf({ title: ASKED, rated: 2 }, "skip"),
			more: quizOf({ title: ASKED, rated: 7 }),
			long: quizOf({
				title: {
					...ASKED,
					title: "The Lord of the Rings: The Fellowship of the Ring",
				},
			}),
			waiting: quizOf({ waiting: true }),
			none: quizOf({}),
		},
		rate: {
			fresh: rateOf(rated()),
			again: rateOf(rated({ score: 8, seen: true })),
			againOnIt: rateOf(rated({ score: 8, seen: true }), "score:8"),
			againOnLevel: rateOf(rated({ score: 8, seen: true }), "level:7"),
		},
		phones: PHONES.map(({ phone, scale, h }) => {
			const canvas: TvCanvas = {
				edition: "phone",
				w: PHONE_TV_CANVAS.w,
				h,
				scale,
			}
			const drawn = (
				screen: Screen,
				shown: TvTasteScreens,
				node: (items: string[]) => React.ReactNode,
			) => {
				const items = tvItems(screen, ctxOf(screen, shown, canvas))
				return { items, html: html(canvas, items[0], node(items)) }
			}
			const asking = screensOf(start, { title: ASKED })
			return {
				phone,
				scale,
				start: drawn(TASTE, screensOf(start), (items) => (
					<Taste items={items} taste={start} side={null} />
				)),
				sides: drawn(TASTE, screensOf(sidesOf(4)), (items) => (
					<Taste items={items} taste={sidesOf(4)} side={null} />
				)),
				picks: drawn(TASTE, screensOf(picks), (items) => (
					<Taste items={items} taste={picks} side={null} />
				)),
				quiz: drawn(QUIZ, asking, (items) => (
					<Quiz items={items} quiz={asking.quiz} />
				)),
				rate: drawn(RATE, screensOf(start), (items) => (
					<Rate items={items} title={rated()} />
				)),
			}
		}),
		first: {
			taste: first(TASTE),
			side: first(SIDE),
			quiz: first(QUIZ),
			// With its data and without its code the screen is still its bar alone.
			tasteWithData: first(TASTE, screensOf(start)),
		},
	})}`,
)
