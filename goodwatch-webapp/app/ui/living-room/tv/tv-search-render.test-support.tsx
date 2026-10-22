// Run by tv-search-render.test.ts through vite-node: renders the search screen the way it is drawn once its code
// is there, and prints the HTML with the item ids the machine lists for each screen.
import { renderToStaticMarkup } from "react-dom/server"
import type { TitleCard } from "~/server/title-cards.server"
import { TvScreen } from "./TvScreen"
import { Layer, TvViewProvider, keySize } from "./kit"
import { PHONE_TV_CANVAS, TV_CANVAS } from "./room-layout"
import type { TvCanvas } from "./room-tv"
import Search from "./screens/Search"
import { type TvHomeData, homeApps, tvContextOf, tvTitleKey } from "./tv-home"
import {
	type TvScreen as Screen,
	type TvContext,
	type TvState,
	focusedItem,
	tvItems,
} from "./tv-machine"
import type { TvSearchReport } from "./use-tv-search"

const card = (
	media_type: "movie" | "show",
	tmdb_id: number,
	rest: Partial<TitleCard> = {},
): TitleCard =>
	({
		key: tmdb_id,
		media_type,
		tmdb_id,
		title: `Title ${tmdb_id}`,
		poster_path: `/poster-${tmdb_id}.jpg`,
		backdrop_path: `/backdrop-${tmdb_id}.jpg`,
		release_year: 2001,
		runtime: 116,
		tagline: null,
		goodwatch_overall_score_normalized_percent: 81.6,
		match: null,
		services: [{ id: 8, name: "Netflix", logo_path: "/n.jpg" }],
		seen: false,
		wantToSee: false,
		...rest,
	}) as TitleCard

const guest: TvHomeData = {
	member: false,
	startTitles: [],
	picture: "/first-picture.jpg",
	tonight: [],
	shows: null,
	services: [],
}

const CANVAS: Record<"desktop" | "phone", TvCanvas> = {
	desktop: { edition: "desktop", ...TV_CANVAS, scale: 1 },
	phone: { edition: "phone", ...PHONE_TV_CANVAS, scale: 0.72 },
}
/** The phones of the room's table (docs/implementation/tv-screen-revamp/room), as tv-title-render has them. */
const PHONES = [
	// The smallest phone still in use: a picture of 292 x 159, too short to spare the actions' row.
	{ phone: "320x568", scale: 292 / 500, h: 272 },
	{ phone: "360x740", scale: 332 / 500, h: 417 },
	{ phone: "375x667", scale: 347 / 500, h: 372 },
	{ phone: "390x700", scale: 362 / 500, h: 402 },
	{ phone: "390x844", scale: 362 / 500, h: 417 },
	{ phone: "430x932", scale: 402 / 500, h: 417 },
	{ phone: "844x390", scale: 0.98, h: 373 },
]

const html = (canvas: TvCanvas, focused: string, node: React.ReactNode) =>
	renderToStaticMarkup(
		<TvViewProvider value={{ canvas, focused, dispatch: () => {} }}>
			<Layer>{node}</Layer>
		</TvViewProvider>,
	)
const editions = <T,>(draw: (canvas: TvCanvas) => T) => ({
	desktop: draw(CANVAS.desktop),
	phone: draw(CANVAS.phone),
})

const base = tvContextOf(guest, null)
const cards = [
	card("movie", 161, { title: "Ocean's Eleven" }),
	card("movie", 388, { title: "Inside Man", match: 91 }),
	card("show", 1399, { runtime: 55, services: [] }),
	card("movie", 120, {
		title: "The Lord of the Rings: The Fellowship of the Ring",
	}),
]
const report = (rest: Partial<TvSearchReport> = {}): TvSearchReport => ({
	id: "fixture",
	total: 4,
	pages: 1,
	next: false,
	failed: null,
	retry: () => {},
	hasTaste: false,
	summary: "",
	controls: {},
	cards,
	titles: cards.map(tvTitleKey),
	waiting: false,
	...rest,
})
const none = (rest: Partial<TvSearchReport> = {}) =>
	report({ cards: [], titles: [], ...rest })

type SearchScreen = Extract<Screen, { name: "search" }>
const QUESTION: SearchScreen = { name: "search", query: null }
const HEIST: SearchScreen = { name: "search", query: "heist" }

/** The line with `draft` typed into it. */
function questionOf(draft: string, focused?: string) {
	const ctx: TvContext = { ...base, draft }
	const items = tvItems(QUESTION, ctx)
	return {
		items,
		...editions((canvas) =>
			html(
				canvas,
				focused ?? items[0],
				<Search
					items={items}
					screen={QUESTION}
					draft={draft}
					onDraft={() => {}}
					list={null}
				/>,
			),
		),
	}
}
function resultsOf(
	list: TvSearchReport | null,
	focused?: string,
	screen = HEIST,
) {
	const ctx: TvContext = { ...base, titles: list?.titles ?? [] }
	const items = tvItems(screen, ctx)
	// Where the machine starts the focus: on the first title, and without one on the way back.
	const start = focusedItem(
		{
			screen,
			focus: null,
			power: "on",
			menuOpen: false,
			menuFocus: null,
			depth: 0,
		},
		ctx,
	)
	return {
		items,
		...editions((canvas) =>
			html(
				canvas,
				focused ?? start,
				<Search
					items={items}
					screen={screen}
					draft=""
					onDraft={() => {}}
					list={list}
				/>,
			),
		),
	}
}

/** What the TV draws for a screen before its code is there, as the server does. */
function first(screen: Screen) {
	const state: TvState = {
		screen,
		focus: null,
		power: "on",
		menuOpen: false,
		menuFocus: null,
		depth: 0,
	}
	return renderToStaticMarkup(
		<TvScreen
			tv={{
				state,
				focused: focusedItem(state, base),
				screenFocus: focusedItem(state, base),
				dispatch: () => {},
				ringOff: false,
				byPointer: false,
				unpoint: () => {},
			}}
			canvas={CANVAS.desktop}
			ctx={base}
			apps={homeApps(guest, null)}
			toast={null}
			search={{ draft: "heist", onDraft: () => {}, list: report() }}
		/>,
	)
}

console.log(
	`__TV_SEARCH_RENDER__${JSON.stringify({
		question: {
			empty: questionOf(""),
			one: questionOf("h"),
			typed: questionOf("heist "),
			long: questionOf(
				"a long evening with something slow and strange from the seventies",
			),
			onIdea: questionOf("heist", "idea:space adventure"),
			onBar: questionOf("", "bar:menu"),
		},
		results: {
			found: resultsOf(report()),
			second: resultsOf(report(), `title:${tvTitleKey(cards[1])}`),
			long: resultsOf(report(), `title:${tvTitleKey(cards[3])}`),
			two: resultsOf(
				report({
					cards: cards.slice(0, 2),
					titles: cards.slice(0, 2).map(tvTitleKey),
				}),
			),
			waiting: resultsOf(none({ waiting: true })),
			unreported: resultsOf(null),
			none: resultsOf(none()),
			failed: resultsOf(
				none({ failed: "Search is busy right now. Try again in a moment." }),
			),
			spaced: resultsOf(report(), undefined, {
				name: "search",
				query: "cozy mystery",
			}),
		},
		phones: PHONES.map(({ phone, scale, h }) => {
			const canvas: TvCanvas = {
				edition: "phone",
				w: PHONE_TV_CANVAS.w,
				h,
				scale,
			}
			const typing: TvContext = { ...base, draft: "heist" }
			const found: TvContext = { ...base, titles: report().titles }
			return {
				phone,
				scale,
				h,
				key: keySize(canvas, 52),
				foot: keySize(canvas, 54),
				bar: keySize(canvas, 54),
				question: html(
					canvas,
					"go",
					<Search
						items={tvItems(QUESTION, typing)}
						screen={QUESTION}
						draft="heist"
						onDraft={() => {}}
						list={null}
					/>,
				),
				results: html(
					canvas,
					`title:${tvTitleKey(cards[0])}`,
					<Search
						items={tvItems(HEIST, found)}
						screen={HEIST}
						draft=""
						onDraft={() => {}}
						list={report()}
					/>,
				),
			}
		}),
		first: {
			question: first(QUESTION),
			results: first(HEIST),
		},
	})}`,
)
