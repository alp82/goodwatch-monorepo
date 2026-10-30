// Run by tv-render.test.ts through vite-node: renders the TV's screens the way the server does and prints the
// HTML with the item ids the machine lists for each, so the test can compare the two.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
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
	goodwatch_overall_score_normalized_percent: 70 + i,
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
			href: "/watch/shows",
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
	// The phone edition is drawn with the phone's items, as the page does once it knows the window.
	const ctx = { ...tvContextOf(data, null), phone: canvas.edition === "phone" }
	return renderToStaticMarkup(
		<TvScreen
			tv={{
				state,
				focused: focusedItem(state, ctx),
				screenFocus: focusedItem({ ...state, menuOpen: false }, ctx),
				dispatch: () => {},
				ringOff: false,
				byPointer: false,
				unpoint: () => {},
			}}
			canvas={canvas}
			ctx={ctx}
			apps={homeApps(data, null)}
			home={data}
			toast={toast}
		/>,
	)
}

/** A screen that is a chunk of its own, drawn as it is once its code is there. */
function codeHtml(
	canvas: TvCanvas,
	focused: string,
	node: React.ReactNode,
	member = false,
) {
	return renderToStaticMarkup(
		<TvViewProvider value={{ canvas, focused, dispatch: () => {}, member }}>
			<Layer>{node}</Layer>
		</TvViewProvider>,
	)
}

const HOME: Screen = { name: "home" }
const ABOUT: Screen = { name: "about" }
const guestCtx = tvContextOf(guest, null)
const memberCtx = tvContextOf(member, null)
const guestPhone = { ...guestCtx, phone: true }
const memberPhone = { ...memberCtx, phone: true }

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
		// The section below the room has poster cards, which read the viewer's marks through React Query.
		<QueryClientProvider client={new QueryClient()}>
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
								ringOff: false,
								byPointer: false,
								unpoint: () => {},
							}}
							canvas={canvas}
							ctx={tvContextOf(data, null)}
							apps={homeApps(data, null)}
							home={data}
							toast={null}
						/>
					)}
				/>
			</MemoryRouter>
		</QueryClientProvider>,
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
			codeHtml(
				canvas,
				"got-it",
				<About
					items={tvItems(
						ABOUT,
						canvas.edition === "phone" ? guestPhone : guestCtx,
					)}
				/>,
			),
		),
		// The server draws the bar alone until the screen's code is there.
		aboutFirst: screenHtml(guest, CANVAS.desktop, stateOf(ABOUT)),
		menu: {
			guest: editions((canvas) =>
				codeHtml(canvas, "menu:home", <Menu items={menuItems(guestCtx)} />),
			),
			member: editions((canvas) =>
				codeHtml(
					canvas,
					"menu:home",
					<Menu items={menuItems(memberCtx)} />,
					true,
				),
			),
		},
		menuOpen: screenHtml(
			guest,
			CANVAS.desktop,
			stateOf(HOME, { menuOpen: true }),
		),
		// Every screen but home is a chunk of its own: before its code is there, the server draws its bar alone.
		lazy: {
			search: screenHtml(
				guest,
				CANVAS.desktop,
				stateOf({ name: "search", query: null }),
			),
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
			phone: {
				homeGuest: tvItems(HOME, guestPhone),
				homeMember: tvItems(HOME, memberPhone),
				about: tvItems(ABOUT, guestPhone),
			},
			menuGuest: menuItems(guestCtx),
			menuMember: menuItems(memberCtx),
		},
	})}`,
)
