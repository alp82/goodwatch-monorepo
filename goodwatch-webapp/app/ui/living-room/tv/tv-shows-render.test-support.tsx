// Run by tv-shows-render.test.ts through vite-node: renders My shows, the title screen of a show the member is
// midway through, home's My shows tile, the menu and What is GoodWatch? the way they are drawn once their code is
// there, and prints the HTML with the item ids the machine lists for each.
import { renderToStaticMarkup } from "react-dom/server"
import { TvScreen } from "./TvScreen"
import { Layer, TvViewProvider, keySize } from "./kit"
import { PHONE_TV_CANVAS, TV_CANVAS } from "./room-layout"
import type { TvCanvas } from "./room-tv"
import About from "./screens/About"
import { Home } from "./screens/Home"
import Menu, { menuLayout } from "./screens/Menu"
import Shows from "./screens/Shows"
import Title from "./screens/Title"
import { type TvHomeData, homeApps, tvContextOf } from "./tv-home"
import {
	type TvContext,
	type TvScreen as Screen,
	type TvState,
	focusedItem,
	menuItems,
	tvItems,
} from "./tv-machine"
import type { TvShows, TvShowsSignal } from "./tv-shows"
import type { TvTitleOnScreen } from "./tv-title"

const show = (id: number, title: string) => ({
	id,
	title,
	poster_path: `/poster-${id}.jpg`,
	backdrop_path: `/backdrop-${id}.jpg`,
})
const shows: TvShows = {
	next: [
		{
			...show(10, "Severance"),
			episode: { code: "S2 E4", name: "Woe's Hollow", runtime: 50 },
			left: 6,
		},
		{
			...show(11, "Slow Horses"),
			episode: { code: "S3 E2", name: "Hard Lessons", runtime: 44 },
			left: 5,
		},
		{ ...show(12, "The Bear"), episode: null, left: 3 },
	],
	start: [
		{ ...show(20, "Andor"), match: 96, service: "Disney Plus", seasons: 2 },
		{
			...show(21, "Only Murders in the Building"),
			match: 88,
			service: null,
			seasons: 4,
		},
		{ ...show(22, "Russian Doll"), match: null, service: "Netflix" },
	],
}
const member: TvHomeData = {
	member: true,
	startTitles: [],
	picture: "/first-picture.jpg",
	tonight: [],
	shows,
}
const signal: TvShowsSignal = {
	words: {
		badge: "2",
		tile: "New in 2 shows",
		door: "2 shows have something new",
	},
	aired: [11],
	landed: [20],
}

const CANVAS: Record<"desktop" | "phone", TvCanvas> = {
	desktop: { edition: "desktop", ...TV_CANVAS, scale: 1 },
	phone: { edition: "phone", ...PHONE_TV_CANVAS, scale: 0.72 },
}

/**
 * The phones of the room's table (docs/implementation/tv-screen-revamp/room): the window, how large the canvas is
 * shown and how much of its height.
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

const SHOWS: Screen = { name: "shows" }
const ctx: TvContext = tvContextOf(member, null)
const items = tvItems(SHOWS, ctx)
const showsOf = (
	list: TvShows | null,
	news: TvShowsSignal | null,
	focused = items[0],
	own: readonly string[] = items,
) =>
	editions((canvas) =>
		html(canvas, focused, <Shows items={own} shows={list} signal={news} />),
	)
const empty: TvHomeData = { ...member, shows: { next: [], start: [] } }
const emptyItems = tvItems(SHOWS, tvContextOf(empty, null))

// The title screen of a show the member is midway through.
const TITLE: Screen = { name: "title", title: "show-10" }
const midway: TvContext = { ...ctx, titleName: "Severance", nextEpisode: true }
const titleItems = tvItems(TITLE, midway)
const on = (rest: Partial<TvTitleOnScreen> = {}): TvTitleOnScreen => ({
	key: "show-10",
	title: { media_type: "show", tmdb_id: 10, title: "Severance" },
	missing: false,
	mine: [],
	want: false,
	seen: false,
	score: null,
	...rest,
})

/** What the TV draws for My shows before its code is there, as the server does; `menuOpen`: with the menu over it. */
function first(menuOpen = false) {
	const state: TvState = {
		screen: SHOWS,
		focus: null,
		power: "on",
		menuOpen,
		menuFocus: null,
		depth: 0,
	}
	return renderToStaticMarkup(
		<TvScreen
			tv={{
				state,
				focused: focusedItem(state, ctx),
				screenFocus: focusedItem(state, ctx),
				dispatch: () => {},
			}}
			canvas={CANVAS.desktop}
			ctx={ctx}
			apps={homeApps(member, null)}
			toast={null}
			shows={{ list: shows, signal }}
		/>,
	)
}

const guestMenu = menuItems({ member: false })
const memberMenu = menuItems({ member: true })
const aboutItems = tvItems({ name: "about" }, ctx)
const homeItems = tvItems({ name: "home" }, ctx)

console.log(
	`__TV_SHOWS_RENDER__${JSON.stringify({
		items,
		emptyItems,
		titleItems,
		guestMenu,
		memberMenu,
		aboutItems,
		shows: {
			plain: showsOf(shows, null),
			signal: showsOf(shows, signal),
			// The focus on the fifth show, a name of two lines.
			long: showsOf(shows, signal, "title:show-21"),
			onBar: showsOf(shows, signal, "bar:back"),
			empty: showsOf(empty.shows, null, "bar:back", emptyItems),
		},
		title: {
			episode: editions((canvas) =>
				html(
					canvas,
					"seen",
					<Title items={titleItems} title={on({ episode: "S2 E4" })} />,
				),
			),
			// Rated and midway: the key still names the episode.
			rated: html(
				CANVAS.desktop,
				"seen",
				<Title
					items={titleItems}
					title={on({ episode: "S2 E5", score: 8, seen: true })}
				/>,
			),
			plain: html(
				CANVAS.desktop,
				"seen",
				<Title items={titleItems} title={on({ score: 8, seen: true })} />,
			),
		},
		home: {
			plain: editions((canvas) =>
				html(
					canvas,
					"app:shows",
					<Home apps={homeApps(member, null)} items={homeItems} />,
				),
			),
			signal: editions((canvas) =>
				html(
					canvas,
					"app:shows",
					<Home
						apps={homeApps(member, null, false, null, signal.words)}
						items={homeItems}
					/>,
				),
			),
		},
		menu: editions((canvas) =>
			html(canvas, guestMenu[0], <Menu items={guestMenu} />),
		),
		about: editions((canvas) =>
			html(canvas, aboutItems[0], <About items={aboutItems} />),
		),
		first: first(),
		underMenu: first(true),
		// Every screen of the slice, the menu and What is GoodWatch? on every phone of the room's table.
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
				h,
				key: keySize(canvas, 48),
				shows: html(
					canvas,
					items[0],
					<Shows items={items} shows={shows} signal={signal} />,
				),
				title: html(
					canvas,
					"seen",
					<Title items={titleItems} title={on({ episode: "S2 E4" })} />,
				),
				menu: html(canvas, guestMenu[0], <Menu items={guestMenu} />),
				memberMenu: html(canvas, memberMenu[0], <Menu items={memberMenu} />),
				menuLayout: menuLayout(canvas, guestMenu.length),
				memberMenuLayout: menuLayout(canvas, memberMenu.length),
				about: html(canvas, aboutItems[0], <About items={aboutItems} />),
			}
		}),
		// Before the window is measured nobody knows the scale, and nothing is painted.
		firstMenu: menuLayout(
			{ ...CANVAS.phone, scale: 1, first: true },
			guestMenu.length,
		),
	})}`,
)
