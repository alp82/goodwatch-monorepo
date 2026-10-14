// Run by tv-discover-render.test.ts through vite-node: renders mini Discover the way it is drawn once its code is
// there, and prints the HTML with the item ids the machine lists for each screen.
import { renderToStaticMarkup } from "react-dom/server"
import type { TitleCard } from "~/server/title-cards.server"
import { TvScreen } from "./TvScreen"
import { Layer, TvViewProvider, keySize } from "./kit"
import { PHONE_TV_CANVAS, TV_CANVAS } from "./room-layout"
import type { TvCanvas } from "./room-tv"
import Discover from "./screens/Discover"
import { type TvHomeData, homeApps, tvContextOf, tvTitleKey } from "./tv-home"
import {
	DISCOVER_TABS,
	type TvScreen as Screen,
	type TvContext,
	type TvState,
	focusedItem,
	tvItems,
} from "./tv-machine"
import type { TvDiscoverReport } from "./use-tv-discover"

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
const report = (rest: Partial<TvDiscoverReport> = {}): TvDiscoverReport => ({
	cards,
	titles: cards.map(tvTitleKey),
	waiting: false,
	...rest,
})

/** A picture per option, as the pool sends them. */
const art = Object.fromEntries(
	DISCOVER_TABS.flatMap(({ kind, keys }) =>
		keys.map((key) => [`${kind}:${key}`, `/art-${kind}-${key}.jpg`]),
	),
)

type DiscoverScreen = Extract<Screen, { name: "discover" }>
const choice = (tab: DiscoverScreen["tab"]): DiscoverScreen => ({
	name: "discover",
	tab,
	choice: null,
})
function choiceOf(
	tab: DiscoverScreen["tab"],
	pictures: Record<string, string>,
	focused?: string,
) {
	const screen = choice(tab)
	const items = tvItems(screen, base)
	return {
		items,
		...editions((canvas) =>
			html(
				canvas,
				focused ?? items[3],
				<Discover items={items} screen={screen} art={pictures} list={null} />,
			),
		),
	}
}
function listOf(
	screen: DiscoverScreen,
	list: TvDiscoverReport | null,
	focused?: string,
) {
	const ctx: TvContext = { ...base, titles: list?.titles ?? [] }
	const items = tvItems(screen, ctx)
	return {
		items,
		...editions((canvas) =>
			html(
				canvas,
				focused ?? items[0],
				<Discover items={items} screen={screen} art={art} list={list} />,
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
			}}
			canvas={CANVAS.desktop}
			ctx={base}
			apps={homeApps(guest, null)}
			toast={null}
			discover={{ art, list: report() }}
		/>,
	)
}

const CRIME: DiscoverScreen = {
	name: "discover",
	tab: "themes",
	choice: "crime",
}

console.log(
	`__TV_DISCOVER_RENDER__${JSON.stringify({
		choice: {
			moods: choiceOf("moods", art),
			themes: choiceOf("themes", art),
			styles: choiceOf("styles", art),
			// Until the pool is there: the options' colours alone.
			plain: choiceOf("themes", {}),
			// One option without a title.
			partly: choiceOf("themes", { "theme:crime": art["theme:crime"] }),
			// The focus on a tab that is not open, and on the bar.
			onTab: choiceOf("moods", art, "tab:styles"),
			onBar: choiceOf("styles", art, "bar:menu"),
			secondFocused: choiceOf("themes", art, "theme:future"),
		},
		list: {
			mood: listOf(
				{ name: "discover", tab: "moods", choice: "funny" },
				report(),
			),
			theme: listOf(CRIME, report()),
			style: listOf(
				{ name: "discover", tab: "styles", choice: "slow" },
				report(),
			),
			second: listOf(CRIME, report(), `title:${tvTitleKey(cards[1])}`),
			long: listOf(CRIME, report(), `title:${tvTitleKey(cards[3])}`),
			onChange: listOf(CRIME, report(), "change"),
			two: listOf(
				CRIME,
				report({
					cards: cards.slice(0, 2),
					titles: cards.slice(0, 2).map(tvTitleKey),
				}),
			),
			waiting: listOf(CRIME, report({ cards: [], titles: [], waiting: true })),
			unreported: listOf(CRIME, null),
			none: listOf(CRIME, report({ cards: [], titles: [], waiting: false })),
		},
		phones: PHONES.map(({ phone, scale, h }) => {
			const canvas: TvCanvas = {
				edition: "phone",
				w: PHONE_TV_CANVAS.w,
				h,
				scale,
			}
			const themes = choice("themes")
			const ctx: TvContext = { ...base, titles: report().titles }
			return {
				phone,
				scale,
				h,
				tab: keySize(canvas, 52),
				foot: keySize(canvas, 54),
				bar: keySize(canvas, 54),
				choice: html(
					canvas,
					"theme:crime",
					<Discover
						items={tvItems(themes, base)}
						screen={themes}
						art={art}
						list={null}
					/>,
				),
				list: html(
					canvas,
					`title:${tvTitleKey(cards[0])}`,
					<Discover
						items={tvItems(CRIME, ctx)}
						screen={CRIME}
						art={art}
						list={report()}
					/>,
				),
			}
		}),
		first: {
			choice: first(choice("moods")),
			list: first(CRIME),
		},
	})}`,
)
