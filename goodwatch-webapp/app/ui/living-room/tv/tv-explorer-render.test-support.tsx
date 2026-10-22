// Run by tv-explorer-render.test.ts through vite-node: renders the mini Explorer's map and an island the way they
// are drawn once their code is there, and prints the HTML with the item ids the machine lists for each.
import { renderToStaticMarkup } from "react-dom/server"
import { TvScreen } from "./TvScreen"
import { Layer, TvViewProvider, keySize } from "./kit"
import { PHONE_TV_CANVAS, TV_CANVAS } from "./room-layout"
import type { TvCanvas } from "./room-tv"
import Explorer from "./screens/Explorer"
import {
	type TvExplorerView,
	explorerContext,
	explorerView,
	explorerWaiting,
} from "./tv-explorer"
import { MOOD_ISLANDS, MOOD_MAP, mapTitle } from "./tv-explorer.fixture"
import { type TvHomeData, homeApps, tvContextOf } from "./tv-home"
import {
	type TvScreen as Screen,
	type TvContext,
	type TvState,
	focusedItem,
	tvItems,
} from "./tv-machine"

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
	phone: { edition: "phone", ...PHONE_TV_CANVAS, scale: 0.75 },
}

/** The phones of the room's table (docs/implementation/tv-screen-revamp/room), and landscape. */
const PHONES = [
	// The phone's fixed canvas (480 x 270) at the scale of each phone's 16:9 TV (room-layout.ts, `seatPhone`).
	{ phone: "360x740", scale: 332 / 480, h: 270 },
	{ phone: "375x667", scale: 347 / 480, h: 270 },
	{ phone: "390x700", scale: 362 / 480, h: 270 },
	{ phone: "390x844", scale: 362 / 480, h: 270 },
	{ phone: "430x932", scale: 402 / 480, h: 270 },
	{ phone: "844x390", scale: 507 / 480, h: 270 },
]

type ExplorerScreen = Extract<Screen, { name: "explorer" }>
const MAP: ExplorerScreen = { name: "explorer", island: null }
const island = (id: string): ExplorerScreen => ({
	name: "explorer",
	island: id,
})

const ctxOf = (view: TvExplorerView): TvContext => ({
	...tvContextOf(guest, null),
	...explorerContext(view),
})

/** A screen of the Explorer drawn as it is once its code is there, with the machine's items for it. */
function draw(
	canvas: TvCanvas,
	screen: ExplorerScreen,
	view: TvExplorerView,
	focus: string | null = null,
) {
	// The page hands the phone's screens the phone's items (its header: the G and Menu).
	const ctx = { ...ctxOf(view), phone: canvas.edition === "phone" }
	const items = tvItems(screen, ctx)
	const state: TvState = {
		screen,
		focus,
		power: "on",
		menuOpen: false,
		menuFocus: null,
		depth: 0,
	}
	return {
		items,
		html: renderToStaticMarkup(
			<TvViewProvider
				value={{ canvas, focused: focusedItem(state, ctx), dispatch: () => {} }}
			>
				<Layer>
					<Explorer items={items} view={view} />
				</Layer>
			</TvViewProvider>,
		),
	}
}
const editions = (
	screen: ExplorerScreen,
	view: TvExplorerView,
	focus: string | null = null,
) => ({
	desktop: draw(CANVAS.desktop, screen, view, focus),
	phone: draw(CANVAS.phone, screen, view, focus),
})

/** The whole TV's screen, as the server and the first render draw it: with or without the map's report. */
function tv(screen: Screen, view: TvExplorerView | null) {
	const ctx = view ? ctxOf(view) : tvContextOf(guest, null)
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
				focused: focusedItem(state, ctx),
				screenFocus: focusedItem(state, ctx),
				dispatch: () => {},
				ringOff: false,
				byPointer: false,
				unpoint: () => {},
			}}
			canvas={CANVAS.desktop}
			ctx={ctx}
			apps={homeApps(guest, null)}
			toast={null}
			explorer={view}
		/>,
	)
}

const map = explorerView(MOOD_MAP, null)
const sad = explorerView(MOOD_MAP, "sad")
// A member with services and a taste: a long name, a match and where it streams.
const member = explorerView(
	{
		services: [{ id: 8, name: "Netflix", logo: null, mine: true }],
		islands: MOOD_ISLANDS.map((one) =>
			one.id !== "sad"
				? one
				: {
						...one,
						titles: [
							mapTitle(121, {
								title: "The Lord of the Rings: The Return of the King",
								year: 2003,
								score: 93,
								match: 91,
								services: [8],
							}),
							mapTitle(122, { mediaType: "show" }),
						],
					},
		),
	},
	"sad",
)
// An island with nothing on it for the person.
const empty = explorerView(
	{
		services: [],
		islands: MOOD_ISLANDS.map((one) =>
			one.id === "sad" ? { ...one, titles: [] } : one,
		),
	},
	"sad",
)

console.log(
	`__TV_EXPLORER_RENDER__${JSON.stringify({
		map: editions(MAP, map),
		mapOnFunny: editions(MAP, map, "island:funny"),
		mapOnBar: editions(MAP, map, "bar:menu"),
		island: editions(island("sad"), sad),
		islandOnSecond: editions(island("sad"), sad, "title:movie-702"),
		member: editions(island("sad"), member),
		empty: editions(island("sad"), empty),
		missing: editions(island("atlantis"), explorerView(MOOD_MAP, "atlantis")),
		waiting: editions(MAP, explorerWaiting()),
		failed: editions(MAP, explorerWaiting(true)),
		// The server, and the page until the map's data component has reported: the bar alone.
		first: tv(MAP, null),
		firstIsland: tv(island("sad"), null),
		// Once it has, with the Explorer's code still on its way: the bar alone too.
		reported: tv(MAP, map),
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
				key: keySize(canvas, 54),
				map: draw(canvas, MAP, map).html,
				island: draw(canvas, island("sad"), sad).html,
			}
		}),
	})}`,
)
