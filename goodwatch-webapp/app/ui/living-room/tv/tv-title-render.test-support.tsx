// Run by tv-title-render.test.ts through vite-node: renders Tonight, the title screen and the rating the way they
// are drawn once their code is there, and prints the HTML with the item ids the machine lists for each.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup as renderMarkup } from "react-dom/server"
import type { CardService, TitleCard } from "~/server/title-cards.server"
import { TvScreen } from "./TvScreen"
import { Layer, TvViewProvider, keySize } from "./kit"
import {
	PHONE_TV_CANVAS,
	TV_CANVAS,
	layoutPhoneLandscape,
	layoutPhoneRoom,
} from "./room-layout"
import type { TvCanvas } from "./room-tv"
import Rate from "./screens/Rate"
import Title from "./screens/Title"
import Tonight from "./screens/Tonight"
import {
	type TvHomeData,
	type TvPool,
	type TvTonightPick,
	homeApps,
	tonightPicks,
	tvContextOf,
} from "./tv-home"
import {
	type TvScreen as Screen,
	type TvContext,
	type TvState,
	focusedItem,
	tvItems,
} from "./tv-machine"
import type { TvTitleOnScreen, TvTitleScreens } from "./tv-title"

const netflix: CardService = { id: 8, name: "Netflix", logo_path: "/n.jpg" }
const disney: CardService = {
	id: 337,
	name: "Disney Plus",
	logo_path: "/d.jpg",
}

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
		release_year: 2019,
		runtime: 130,
		tagline: `Line ${tmdb_id}.`,
		goodwatch_overall_score_normalized_percent: 86.4,
		match: null,
		services: [netflix, disney],
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
const pool: TvPool = {
	suggestions: [
		card("movie", 1),
		card("show", 2),
		card("movie", 3),
		card("movie", 4),
	],
}
const member: TvHomeData = {
	...guest,
	member: true,
	tonight: [
		{
			card: card("show", 10, { match: 92 }),
			href: "/watch",
			episode: { code: "S2 E4", name: "Cicada", runtime: 50 },
		},
		{ card: card("movie", 11, { match: 88 }), href: "/watch/movies" },
	],
	shows: { next: [], start: [] },
}

/**
 * The phones of the room's table (docs/implementation/tv-screen-revamp/room): the window and how large the phone's
 * fixed canvas of 480 x 270 is shown there, from the room's layouts (2026-10-22: a 16:9 TV on every phone). The
 * page's header (64) and dock (72) and the lip (60) upright; the whole window on its side, the lip a tab.
 */
const upright = (w: number, h: number) =>
	layoutPhoneRoom(w, h - 136, 60).canvas.scale
const PHONES = [
	{ phone: "360x740", scale: upright(360, 740), h: PHONE_TV_CANVAS.h },
	{ phone: "375x667", scale: upright(375, 667), h: PHONE_TV_CANVAS.h },
	{ phone: "390x700", scale: upright(390, 700), h: PHONE_TV_CANVAS.h },
	{ phone: "390x844", scale: upright(390, 844), h: PHONE_TV_CANVAS.h },
	{ phone: "430x932", scale: upright(430, 932), h: PHONE_TV_CANVAS.h },
	{
		phone: "844x390",
		scale: layoutPhoneLandscape(844, 390, 0).canvas.scale,
		h: PHONE_TV_CANVAS.h,
	},
]

const CANVAS: Record<"desktop" | "phone" | "short", TvCanvas> = {
	desktop: { edition: "desktop", ...TV_CANVAS, scale: 1 },
	phone: { edition: "phone", ...PHONE_TV_CANVAS, scale: upright(390, 844) },
	// The shortest phone of the table: the same canvas, shown smaller.
	short: { edition: "phone", ...PHONE_TV_CANVAS, scale: upright(375, 667) },
}

/** The page's query client: Watch next asks for the pick's offers, as the title screen does. Nothing is fetched here. */
const renderToStaticMarkup = (node: React.ReactNode) =>
	renderMarkup(
		<QueryClientProvider client={new QueryClient()}>
			{node}
		</QueryClientProvider>,
	)

/** A screen drawn as it is once its code is there. */
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

const tonightOf = (
	data: TvHomeData,
	from: TvPool | null,
	at: number,
	wished: TitleCard | null = null,
) => {
	const ctx = tvContextOf(data, from, wished)
	const screen: Screen = { name: "tonight", pick: at }
	const items = tvItems(screen, ctx)
	// The page hands the phone's screens the phone's items (its arrows and its header).
	const phoneItems = tvItems(screen, { ...ctx, phone: true })
	const picks: TvTonightPick[] = tonightPicks(data, from, wished)
	return {
		items,
		phoneItems,
		...editions((canvas) => {
			const own = canvas.edition === "phone" ? phoneItems : items
			// Where the machine starts the focus: on Watch, not on the phone's arrows over it.
			const start: TvState = { screen, focus: null, power: "on", menuOpen: false, menuFocus: null, depth: 0 }
			return html(
				canvas,
				focusedItem(start, canvas.edition === "phone" ? { ...ctx, phone: true } : ctx),
				<Tonight items={own} picks={picks} pick={at} waiting={!from} />,
			)
		}),
	}
}

const on = (rest: Partial<TvTitleOnScreen> = {}): TvTitleOnScreen => ({
	key: "movie-603",
	title: card("movie", 603, {
		title: "The Matrix",
		tagline: "Free your mind.",
	}),
	missing: false,
	mine: [netflix],
	want: false,
	seen: false,
	score: null,
	...rest,
})
const titleCtx: TvContext = {
	...tvContextOf(guest, pool),
	titleName: "The Matrix",
}
const TITLE: Screen = { name: "title", title: "movie-603" }
const RATE: Screen = { name: "rate", title: "movie-603" }
const titleItems = tvItems(TITLE, titleCtx)
const rateItems = tvItems(RATE, titleCtx)
const phoneCtx: TvContext = { ...titleCtx, phone: true }
const titlePhoneItems = tvItems(TITLE, phoneCtx)
const ratePhoneItems = tvItems(RATE, phoneCtx)
const WATCH: Screen = { name: "title", title: "movie-603", panel: "watch" }
const PRINT: Screen = {
	name: "title",
	title: "movie-603",
	panel: "fingerprint",
}
const watchPhoneItems = tvItems(WATCH, phoneCtx)
const printPhoneItems = tvItems(PRINT, phoneCtx)
const titleOf = (title: TvTitleOnScreen, focused = "watch") =>
	editions((canvas) =>
		html(
			canvas,
			focused,
			<Title
				items={canvas.edition === "phone" ? titlePhoneItems : titleItems}
				title={title}
			/>,
		),
	)

/** What the TV draws for a screen before its code is there, as the server does. */
function first(screen: Screen, titles: TvTitleScreens, canvas = CANVAS.desktop) {
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
				focused: focusedItem(state, titleCtx),
				screenFocus: focusedItem(state, titleCtx),
				dispatch: () => {},
				ringOff: false,
				byPointer: false,
				unpoint: () => {},
			}}
			canvas={canvas}
			ctx={titleCtx}
			apps={homeApps(guest, pool)}
			toast={null}
			titles={titles}
		/>,
	)
}
const titles: TvTitleScreens = {
	tonight: tonightPicks(guest, pool),
	waiting: false,
	title: on(),
}

const picksOf = tonightPicks(guest, pool)
const state = (screen: Screen, menuOpen = false): TvState => ({
	screen,
	focus: null,
	power: "on",
	menuOpen,
	menuFocus: null,
	depth: 0,
})
/** The TV with a toast, as the server draws it. */
const toastHtml = (screen: Screen, canvas: TvCanvas, menuOpen = false) => {
	const tv = state(screen, menuOpen)
	const ctx = canvas.edition === "phone" ? phoneCtx : titleCtx
	return renderToStaticMarkup(
		<TvScreen
			tv={{
				state: tv,
				focused: focusedItem(tv, ctx),
				screenFocus: focusedItem({ ...tv, menuOpen: false }, ctx),
				dispatch: () => {},
				ringOff: false,
				byPointer: false,
				unpoint: () => {},
			}}
			canvas={canvas}
			ctx={ctx}
			apps={homeApps(guest, pool)}
			toast="Rated 10 · Masterpiece"
		/>,
	)
}

console.log(
	`__TV_TITLE_RENDER__${JSON.stringify({
		// Every screen of the slice on every phone of the room's table.
		phones: PHONES.map(({ phone, scale, h }) => {
			const canvas: TvCanvas = {
				edition: "phone",
				w: PHONE_TV_CANVAS.w,
				h,
				scale,
			}
			return {
				phone,
				scale,
				key: keySize(canvas, 52),
				title: html(
					canvas,
					"watch",
					<Title items={titlePhoneItems} title={on()} />,
				),
				watch: html(
					canvas,
					"section:watch",
					<Title items={watchPhoneItems} title={on({ panel: "watch" })} />,
				),
				print: html(
					canvas,
					"group:-1",
					<Title
						items={printPhoneItems}
						title={on({ panel: "fingerprint" })}
					/>,
				),
				tonight: html(
					canvas,
					"details",
					<Tonight
						items={tvItems(
							{ name: "tonight", pick: 0 },
							{ ...tvContextOf(guest, pool), phone: true },
						)}
						picks={picksOf}
						pick={0}
						waiting={false}
					/>,
				),
				rate: html(
					canvas,
					"level:9",
					<Rate items={ratePhoneItems} title={on()} />,
				),
				toast: toastHtml(TITLE, canvas),
			}
		}),
		keySizes: {
			desktop: keySize(CANVAS.desktop, 74),
			// Before the window is measured nobody knows the scale.
			first: keySize({ ...CANVAS.phone, scale: 1, first: true }, 52),
		},
		toast: {
			desktop: toastHtml(TITLE, CANVAS.desktop),
			phone: toastHtml(TITLE, CANVAS.phone),
			menuOpen: toastHtml(TITLE, CANVAS.desktop, true),
		},
		tonight: {
			guest: tonightOf(guest, pool, 0),
			second: tonightOf(guest, pool, 1),
			// The URL counts on; the screen wraps.
			wrapped: tonightOf(guest, pool, 5),
			wished: tonightOf(guest, pool, 0, card("movie", 9)),
			one: tonightOf(guest, { suggestions: [card("movie", 1)] }, 0),
			member: tonightOf(member, null, 0),
			memberSecond: tonightOf(member, null, 1),
			waiting: tonightOf(guest, null, 0),
			none: tonightOf(guest, { suggestions: [] }, 0),
		},
		title: {
			items: titleItems,
			phoneItems: titlePhoneItems,
			watchItems: watchPhoneItems,
			printItems: printPhoneItems,
			known: titleOf(on()),
			short: html(
				CANVAS.short,
				"watch",
				<Title items={titlePhoneItems} title={on()} />,
			),
			another: titleOf(on({ mine: [] })),
			nowhere: titleOf(on({ title: card("movie", 603, { services: [] }) })),
			nowhereFocusedElsewhere: titleOf(
				on({ title: card("movie", 603, { services: [] }) }),
				"seen",
			),
			unknown: titleOf(on({ title: card("movie", 603, { services: null }) })),
			marked: titleOf(on({ want: true, seen: true, score: 8 })),
			seen: titleOf(on({ seen: true })),
			show: titleOf(
				on({
					key: "show-1399",
					title: card("show", 1399, { runtime: 55, match: 91, tagline: null }),
				}),
			),
			// A link straight to a title: its key alone, until the card is there.
			waiting: titleOf(on({ title: null, mine: [] })),
			missing: titleOf(on({ title: null, missing: true, mine: [] })),
			fromList: titleOf(
				on({
					title: {
						media_type: "movie",
						tmdb_id: 603,
						title: "The Matrix",
						poster_path: "/p.jpg",
					},
					mine: [],
				}),
			),
		},
		rate: {
			items: rateItems,
			phoneItems: ratePhoneItems,
			...editions((canvas) =>
				html(
					canvas,
					"level:9",
					<Rate
						items={canvas.edition === "phone" ? ratePhoneItems : rateItems}
						title={on()}
					/>,
				),
			),
			waiting: html(
				CANVAS.desktop,
				"level:9",
				<Rate items={rateItems} title={on({ title: null })} />,
			),
		},
		first: {
			tonight: first({ name: "tonight", pick: 0 }, titles),
			title: first(TITLE, titles),
			titlePhone: first(TITLE, titles, CANVAS.phone),
			rate: first(RATE, titles),
		},
	})}`,
)
