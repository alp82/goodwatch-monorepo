// Run by tv-render.test.ts through vite-node: renders the TV's screens the way the server does and prints the
// HTML with the item ids the machine lists for each, so the test can compare the two.
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import type { TitleCard } from "~/server/title-cards.server"
import type { StartTitle } from "../living-room-data"
import { TvRoom } from "./TvRoom"
import { TvScreen } from "./TvScreen"
import { Layer, TvViewProvider } from "./kit"
import { PHONE_TV_CANVAS, TV_CANVAS } from "./room-layout"
import type { RoomTv, TvCanvas } from "./room-tv"
import About from "./screens/About"
import Menu from "./screens/Menu"
import { type TvHomeData, homeApps, tvContextOf } from "./tv-home"
import {
	type TvScreen as Screen,
	type TvState,
	focusedItem,
	menuItems,
	tvItems,
} from "./tv-machine"

const startTitles: StartTitle[] = Array.from({ length: 16 }, (_, i) => ({
	media_type: i % 4 === 0 ? "movie" : "show",
	tmdb_id: 100 + i,
	title: `Title ${i + 1}`,
	release_year: 1990 + i,
	poster_path: `/poster${i}.jpg`,
}))

const guest: TvHomeData = {
	member: false,
	startTitles,
	picture: "/first-picture.jpg",
	tonight: [],
	shows: null,
	services: [],
}
const show = (id: number) => ({
	id,
	title: `Show ${id}`,
	poster_path: `/show-poster-${id}.jpg`,
	backdrop_path: `/show-backdrop-${id}.jpg`,
})
const member: TvHomeData = {
	...guest,
	member: true,
	tonight: [
		{
			card: {
				media_type: "show",
				tmdb_id: 10,
				title: "Show 10",
				backdrop_path: "/show-backdrop-10.jpg",
				poster_path: "/show-poster-10.jpg",
			} as TitleCard,
			href: "/my-shows",
			episode: { code: "S2 E4", name: "Episode 4" },
		},
	],
	shows: {
		next: [
			{ ...show(10), episode: { code: "S2 E4", name: null, runtime: 48 } },
			{ ...show(11), episode: null },
		],
		start: [],
	},
}

const CANVAS: Record<"desktop" | "phone", TvCanvas> = {
	desktop: { edition: "desktop", ...TV_CANVAS, scale: 1 },
	phone: { edition: "phone", ...PHONE_TV_CANVAS, scale: 0.72 },
}

const stateOf = (screen: Screen, rest: Partial<TvState> = {}): TvState => ({
	screen,
	focus: null,
	power: "on",
	menuOpen: false,
	menuFocus: null,
	depth: 0,
	...rest,
})

function screenHtml(
	data: TvHomeData,
	canvas: TvCanvas,
	state: TvState,
	toast: string | null = null,
) {
	const ctx = tvContextOf(data, null)
	return renderToStaticMarkup(
		<TvScreen
			tv={{
				state,
				focused: focusedItem(state, ctx),
				screenFocus: focusedItem({ ...state, menuOpen: false }, ctx),
				dispatch: () => {},
			}}
			canvas={canvas}
			ctx={ctx}
			apps={homeApps(data, null)}
			toast={toast}
		/>,
	)
}

/** A screen that is a chunk of its own, drawn as it is once its code is there. */
function codeHtml(canvas: TvCanvas, focused: string, node: React.ReactNode) {
	return renderToStaticMarkup(
		<TvViewProvider value={{ canvas, focused, dispatch: () => {} }}>
			<Layer>{node}</Layer>
		</TvViewProvider>,
	)
}

const HOME: Screen = { name: "home" }
const ABOUT: Screen = { name: "about" }
const guestCtx = tvContextOf(guest, null)
const memberCtx = tvContextOf(member, null)

const roomTv: RoomTv = {
	power: "on",
	menuOpen: false,
	searching: false,
	openService: null,
	press: () => {},
	point: () => {},
}
const roomHtml = (data: TvHomeData, power: RoomTv["power"] = "on") =>
	renderToStaticMarkup(
		<MemoryRouter>
			<TvRoom
				tv={{ ...roomTv, power }}
				startTitles={data.startTitles}
				services={data.services}
				renderScreen={(canvas) => (
					<TvScreen
						tv={{
							state: stateOf(HOME, { power }),
							focused: "app:tonight",
							screenFocus: "app:tonight",
							dispatch: () => {},
						}}
						canvas={canvas}
						ctx={tvContextOf(data, null)}
						apps={homeApps(data, null)}
						toast={null}
					/>
				)}
			/>
		</MemoryRouter>,
	)

const editions = <T,>(draw: (canvas: TvCanvas) => T) => ({
	desktop: draw(CANVAS.desktop),
	phone: draw(CANVAS.phone),
})

console.log(
	`__TV_RENDER__${JSON.stringify({
		home: {
			guest: editions((canvas) => screenHtml(guest, canvas, stateOf(HOME))),
			member: editions((canvas) => screenHtml(member, canvas, stateOf(HOME))),
			focusOnBar: screenHtml(
				guest,
				CANVAS.desktop,
				stateOf(HOME, { focus: "bar:menu" }),
			),
		},
		about: editions((canvas) =>
			codeHtml(canvas, "got-it", <About items={tvItems(ABOUT, guestCtx)} />),
		),
		// The server draws the bar alone until the screen's code is there.
		aboutFirst: screenHtml(guest, CANVAS.desktop, stateOf(ABOUT)),
		menu: {
			guest: editions((canvas) =>
				codeHtml(canvas, "menu:home", <Menu items={menuItems(guestCtx)} />),
			),
			member: editions((canvas) =>
				codeHtml(canvas, "menu:home", <Menu items={menuItems(memberCtx)} />),
			),
		},
		menuOpen: screenHtml(
			guest,
			CANVAS.desktop,
			stateOf(HOME, { menuOpen: true }),
		),
		// Every screen but home is a chunk of its own: before its code is there, the server draws its bar alone.
		lazy: {
			search: screenHtml(guest, CANVAS.desktop, stateOf({ name: "search", query: null })),
			results: screenHtml(
				guest,
				CANVAS.desktop,
				stateOf({ name: "search", query: "heist" }),
			),
			shows: screenHtml(member, CANVAS.desktop, stateOf({ name: "shows" })),
		},
		booting: screenHtml(
			guest,
			CANVAS.desktop,
			stateOf(HOME, { power: "booting" }),
		),
		toast: editions((canvas) =>
			screenHtml(guest, canvas, stateOf(HOME), "On your Wishlist"),
		),
		room: {
			guest: roomHtml(guest),
			again: roomHtml(guest),
			member: roomHtml(member),
			off: roomHtml(guest, "off"),
		},
		items: {
			homeGuest: tvItems(HOME, guestCtx),
			homeMember: tvItems(HOME, memberCtx),
			about: tvItems(ABOUT, guestCtx),
			menuGuest: menuItems(guestCtx),
			menuMember: menuItems(memberCtx),
		},
	})}`,
)
