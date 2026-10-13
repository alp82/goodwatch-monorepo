// Run by tv-title-render.test.ts through vite-node: renders Tonight, the title screen and the rating the way they
// are drawn once their code is there, and prints the HTML with the item ids the machine lists for each.
import { renderToStaticMarkup } from "react-dom/server"
import type { CardService, TitleCard } from "~/server/title-cards.server"
import { TvScreen } from "./TvScreen"
import { Layer, TvViewProvider, keySize } from "./kit"
import { PHONE_TV_CANVAS, TV_CANVAS } from "./room-layout"
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
	type TvContext,
	type TvScreen as Screen,
	type TvState,
	focusedItem,
	tvItems,
} from "./tv-machine"
import type { TvTitleOnScreen, TvTitleScreens } from "./tv-title"

const netflix: CardService = { id: 8, name: "Netflix", logo_path: "/n.jpg" }
const disney: CardService = { id: 337, name: "Disney Plus", logo_path: "/d.jpg" }

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
}
const pool: TvPool = {
	suggestions: [card("movie", 1), card("show", 2), card("movie", 3), card("movie", 4)],
}
const member: TvHomeData = {
	...guest,
	member: true,
	tonight: [
		{
			card: card("show", 10, { match: 92 }),
			href: "/my-shows",
			episode: { code: "S2 E4", name: "Cicada" },
		},
		{ card: card("movie", 11, { match: 88 }), href: "/my-movies" },
	],
	shows: { next: [], start: [] },
}

const CANVAS: Record<"desktop" | "phone" | "short", TvCanvas> = {
	desktop: { edition: "desktop", ...TV_CANVAS, scale: 1 },
	phone: { edition: "phone", ...PHONE_TV_CANVAS, scale: 0.72 },
	// A short phone shows less of the canvas's height.
	short: { edition: "phone", w: PHONE_TV_CANVAS.w, h: 372, scale: 0.69 },
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
	const picks: TvTonightPick[] = tonightPicks(data, from, wished)
	return {
		items,
		...editions((canvas) =>
			html(
				canvas,
				items[0],
				<Tonight items={items} picks={picks} pick={at} waiting={!from} />,
			),
		),
	}
}

const on = (rest: Partial<TvTitleOnScreen> = {}): TvTitleOnScreen => ({
	key: "movie-603",
	title: card("movie", 603, { title: "The Matrix", tagline: "Free your mind." }),
	missing: false,
	mine: [netflix],
	want: false,
	seen: false,
	score: null,
	...rest,
})
const titleCtx: TvContext = { ...tvContextOf(guest, pool), titleName: "The Matrix" }
const TITLE: Screen = { name: "title", title: "movie-603" }
const RATE: Screen = { name: "rate", title: "movie-603" }
const titleItems = tvItems(TITLE, titleCtx)
const rateItems = tvItems(RATE, titleCtx)
const titleOf = (title: TvTitleOnScreen, focused = "watch") =>
	editions((canvas) => html(canvas, focused, <Title items={titleItems} title={title} />))

/** What the TV draws for a screen before its code is there, as the server does. */
function first(screen: Screen, titles: TvTitleScreens) {
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
			}}
			canvas={CANVAS.desktop}
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
	return renderToStaticMarkup(
		<TvScreen
			tv={{
				state: tv,
				focused: focusedItem(tv, titleCtx),
				screenFocus: focusedItem({ ...tv, menuOpen: false }, titleCtx),
				dispatch: () => {},
			}}
			canvas={canvas}
			ctx={titleCtx}
			apps={homeApps(guest, pool)}
			toast="Rated 10 · Masterpiece"
		/>,
	)
}

console.log(
	`__TV_TITLE_RENDER__${JSON.stringify({
		// Every screen of the slice on every phone of the room's table.
		phones: PHONES.map(({ phone, scale, h }) => {
			const canvas: TvCanvas = { edition: "phone", w: PHONE_TV_CANVAS.w, h, scale }
			return {
				phone,
				scale,
				key: keySize(canvas, 52),
				title: html(canvas, "watch", <Title items={titleItems} title={on()} />),
				tonight: html(
					canvas,
					"details",
					<Tonight
						items={tvItems({ name: "tonight", pick: 0 }, tvContextOf(guest, pool))}
						picks={picksOf}
						pick={0}
						waiting={false}
					/>,
				),
				rate: html(canvas, "level:9", <Rate items={rateItems} title={on()} />),
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
			wrapped: tonightOf(guest, pool, 4),
			wished: tonightOf(guest, pool, 0, card("movie", 9)),
			one: tonightOf(guest, { suggestions: [card("movie", 1)] }, 0),
			member: tonightOf(member, null, 0),
			memberSecond: tonightOf(member, null, 1),
			waiting: tonightOf(guest, null, 0),
			none: tonightOf(guest, { suggestions: [] }, 0),
		},
		title: {
			items: titleItems,
			known: titleOf(on()),
			short: html(CANVAS.short, "watch", <Title items={titleItems} title={on()} />),
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
			...editions((canvas) =>
				html(canvas, "level:9", <Rate items={rateItems} title={on()} />),
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
			rate: first(RATE, titles),
		},
	})}`,
)
