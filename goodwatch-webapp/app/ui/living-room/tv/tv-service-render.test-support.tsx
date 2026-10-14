// Run by tv-service-render.test.ts through vite-node: renders home with its service tiles, "On <service>" the
// way it is drawn once its code is there, and both Remotes' streaming keys, and prints the HTML with the item ids
// the machine lists for each screen.
import { renderToStaticMarkup } from "react-dom/server"
import type { TitleCard } from "~/server/title-cards.server"
import { Remote } from "../Remote"
import { PhoneRemote } from "./PhoneRemote"
import { TvScreen } from "./TvScreen"
import { Layer, TvViewProvider } from "./kit"
import { PHONE_TV_CANVAS, TV_CANVAS } from "./room-layout"
import type { RoomTv, TvCanvas } from "./room-tv"
import Service from "./screens/Service"
import {
	type TvHomeData,
	type TvPool,
	type TvService,
	homeApps,
	homeServices,
	tvContextOf,
	tvTitleKey,
} from "./tv-home"
import {
	type TvScreen as Screen,
	type TvContext,
	type TvState,
	focusedItem,
	tvItems,
} from "./tv-machine"
import type { TvServiceReport } from "./use-tv-service"

const NETFLIX: TvService = { id: 8, name: "Netflix", logo_path: "/netflix.jpg" }
const PRIME: TvService = { id: 9, name: "Prime", logo_path: "/prime.jpg" }
const DISNEY: TvService = { id: 337, name: "Disney+", logo_path: "/disney.jpg" }
/** A service the catalog has no logo for. */
const PLAIN: TvService = { id: 99, name: "Kanopy", logo_path: null }

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

const home = (services: TvService[], member = false): TvHomeData => ({
	member,
	startTitles: [],
	picture: "/first-picture.jpg",
	tonight: [],
	shows: member ? { next: [], start: [] } : null,
	services,
})

const CANVAS: Record<"desktop" | "phone", TvCanvas> = {
	desktop: { edition: "desktop", ...TV_CANVAS, scale: 1 },
	phone: { edition: "phone", ...PHONE_TV_CANVAS, scale: 0.72 },
}
/** The phones of the room's table (docs/implementation/tv-screen-revamp/room), as tv-title-render has them. */
const PHONES = [
	{ phone: "360x740", scale: 332 / 500, h: 417 },
	{ phone: "375x667", scale: 347 / 500, h: 372 },
	{ phone: "390x700", scale: 362 / 500, h: 402 },
	{ phone: "390x844", scale: 362 / 500, h: 417 },
	{ phone: "430x932", scale: 402 / 500, h: 417 },
	{ phone: "844x390", scale: 0.98, h: 373 },
]

const stateOf = (screen: Screen, rest: Partial<TvState> = {}): TvState => ({
	screen,
	focus: null,
	power: "on",
	menuOpen: false,
	menuFocus: null,
	depth: 0,
	...rest,
})
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

// ---- Home, with a tile per service after the apps.

const HOME: Screen = { name: "home" }
/** The pool: its second title streams on Netflix and on Disney+, its third on Disney+ alone. */
const pool: TvPool = {
	suggestions: [
		card("movie", 1, { services: [] }),
		card("movie", 2, {
			services: [
				{ id: 8, name: "Netflix", logo_path: "/n.jpg" },
				{ id: 337, name: "Disney Plus", logo_path: "/d.jpg" },
			],
		}),
		card("movie", 3, {
			services: [{ id: 337, name: "Disney Plus", logo_path: "/d.jpg" }],
		}),
	],
}
function homeOf(data: TvHomeData, p: TvPool | null, focus: string | null) {
	const ctx = tvContextOf(data, p)
	const state = stateOf(HOME, { focus })
	return {
		items: tvItems(HOME, ctx),
		...editions((canvas) =>
			renderToStaticMarkup(
				<TvScreen
					tv={{
						state,
						focused: focusedItem(state, ctx),
						screenFocus: focusedItem(state, ctx),
						dispatch: () => {},
					}}
					canvas={canvas}
					ctx={ctx}
					apps={homeApps(data, p)}
					toast={null}
					services={{ tiles: homeServices(data, p), list: null }}
				/>,
			),
		),
	}
}

// ---- "On <service>".

type ServiceScreen = Extract<Screen, { name: "service" }>
const cards = [
	card("movie", 161, { title: "Ocean's Eleven" }),
	card("movie", 388, { title: "Inside Man", match: 91 }),
	card("show", 1399, { runtime: 55 }),
	card("movie", 120, {
		title: "The Lord of the Rings: The Fellowship of the Ring",
	}),
	...Array.from({ length: 10 }, (_, at) => card("movie", 500 + at)),
]
const report = (
	id: number,
	rest: Partial<TvServiceReport> = {},
): TvServiceReport => ({
	id,
	cards: cards.slice(0, 12),
	titles: cards.slice(0, 12).map(tvTitleKey),
	total: 4812,
	waiting: false,
	...rest,
})
const base = tvContextOf(home([NETFLIX, DISNEY]), null)
function serviceOf(
	id: number,
	own: TvService[],
	list: TvServiceReport | null,
	focused?: string,
	canvases = CANVAS,
) {
	const screen: ServiceScreen = { name: "service", service: id }
	// The machine's context holds the titles of the list on screen, as the scene sets them.
	const ctx: TvContext = {
		...base,
		titles: list?.id === id ? list.titles : [],
	}
	const items = tvItems(screen, ctx)
	const draw = (canvas: TvCanvas) =>
		html(
			canvas,
			focused ?? focusedItem(stateOf(screen), ctx),
			<Service items={items} screen={screen} own={own} list={list} />,
		)
	return { items, desktop: draw(canvases.desktop), phone: draw(canvases.phone) }
}
/** The cards of a service a link names: they say where they stream. */
const hulu = cards.slice(0, 4).map((one) => ({
	...one,
	services: [
		{ id: 8, name: "Netflix", logo_path: "/n.jpg" },
		{ id: 15, name: "Hulu", logo_path: "/hulu.jpg" },
	],
}))

/** What the TV draws for a screen before its code is there, as the server does. */
function first(screen: Screen) {
	const state = stateOf(screen)
	return renderToStaticMarkup(
		<TvScreen
			tv={{
				state,
				focused: focusedItem(state, base),
				screenFocus: focusedItem(state, base),
				dispatch: () => {},
			}}
			canvas={CANVAS.desktop}
			ctx={base}
			apps={homeApps(home([NETFLIX, DISNEY]), null)}
			toast={null}
			services={{
				tiles: homeServices(home([NETFLIX, DISNEY]), null),
				list: report(8),
			}}
		/>,
	)
}

// ---- The Remotes' streaming keys.

const roomTv: RoomTv = {
	power: "on",
	menuOpen: false,
	searching: false,
	openService: null,
	press: () => {},
	point: () => {},
}
const desktopRemote = (services: TvService[], open: number | null) =>
	renderToStaticMarkup(
		<Remote
			screen={{ name: "home" }}
			power="on"
			menuOpen={false}
			services={services}
			openService={open}
			onService={() => {}}
			dispatch={() => {}}
			onOk={() => {}}
			onDirection={() => {}}
		/>,
	)
const phoneRemote = (
	form: "hand" | "table",
	services: TvService[],
	open: number | null,
) =>
	renderToStaticMarkup(
		<PhoneRemote
			tv={{ ...roomTv, openService: open }}
			services={services}
			form={form}
			at={{ left: 0, top: 400, u: 1, width: 300 }}
			bottom={700}
		/>,
	)
const remotes = (services: TvService[], open: number | null = null) => ({
	desktop: desktopRemote(services, open),
	hand: phoneRemote("hand", services, open),
	table: phoneRemote("table", services, open),
})

console.log(
	`__TV_SERVICE_RENDER__${JSON.stringify({
		home: {
			// A guest before the pool: the server's HTML.
			guest: homeOf(home([NETFLIX, DISNEY]), null, null),
			member: homeOf(home([DISNEY, PLAIN], true), null, null),
			withPool: homeOf(home([NETFLIX, DISNEY]), pool, null),
			onNetflix: homeOf(home([NETFLIX, DISNEY]), pool, "service:8"),
			onDisney: homeOf(home([NETFLIX, DISNEY]), null, "service:337"),
			onPlain: homeOf(home([DISNEY, PLAIN], true), null, "service:99"),
			none: homeOf(home([]), null, null),
		},
		service: {
			netflix: serviceOf(8, [NETFLIX, DISNEY], report(8)),
			prime: serviceOf(9, [NETFLIX, PRIME], report(9)),
			disney: serviceOf(337, [NETFLIX, DISNEY], report(337)),
			plain: serviceOf(99, [DISNEY, PLAIN], report(99)),
			// A service a link names, which is none of the person's own: its titles name it.
			linked: serviceOf(
				15,
				[NETFLIX, DISNEY],
				report(15, { cards: hulu, titles: hulu.map(tvTitleKey), total: 4 }),
			),
			// Nobody knows it: no title names it.
			unknown: serviceOf(
				4242,
				[NETFLIX, DISNEY],
				report(4242, { cards: [], titles: [], total: 0 }),
			),
			second: serviceOf(8, [NETFLIX, DISNEY], report(8), "title:movie-388"),
			long: serviceOf(8, [NETFLIX, DISNEY], report(8), "title:movie-120"),
			last: serviceOf(8, [NETFLIX, DISNEY], report(8), "title:movie-507"),
			one: serviceOf(
				8,
				[NETFLIX, DISNEY],
				report(8, { cards: [cards[0]], titles: ["movie-161"], total: 1 }),
			),
			waiting: serviceOf(
				8,
				[NETFLIX, DISNEY],
				report(8, { cards: [], titles: [], total: null, waiting: true }),
			),
			unreported: serviceOf(8, [NETFLIX, DISNEY], null),
			// The other service's titles are still reported while this one's are asked for.
			stale: serviceOf(337, [NETFLIX, DISNEY], report(8)),
			none: serviceOf(
				8,
				[NETFLIX, DISNEY],
				report(8, { cards: [], titles: [], total: 0 }),
			),
		},
		phones: PHONES.map(({ phone, scale, h }) => {
			const canvas: TvCanvas = {
				edition: "phone",
				w: PHONE_TV_CANVAS.w,
				h,
				scale,
			}
			const canvases = { desktop: CANVAS.desktop, phone: canvas }
			return {
				phone,
				scale,
				h,
				list: serviceOf(8, [NETFLIX, DISNEY], report(8), undefined, canvases)
					.phone,
				logo: serviceOf(
					337,
					[NETFLIX, DISNEY],
					report(337),
					undefined,
					canvases,
				).phone,
			}
		}),
		first: first({ name: "service", service: 8 }),
		remotes: {
			drawn: remotes([NETFLIX, PRIME]),
			logos: remotes([DISNEY, PLAIN]),
			open: remotes([NETFLIX, DISNEY], 337),
			// A service that is none of the keys' is open: no key is lit.
			other: remotes([NETFLIX, DISNEY], 15),
			one: remotes([NETFLIX]),
			// The old TV's Remote, without the person's services: its fixed pair.
			old: renderToStaticMarkup(
				<Remote
					screen={{ name: "home" }}
					power="on"
					menuOpen={false}
					serviceName={(key) => (key === "netflix" ? "Netflix" : "Prime")}
					activeService="Netflix"
					dispatch={() => {}}
					onOk={() => {}}
				/>,
			),
		},
	})}`,
)
