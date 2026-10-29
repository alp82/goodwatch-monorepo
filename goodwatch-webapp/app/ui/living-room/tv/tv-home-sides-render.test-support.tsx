// Run by tv-home-sides-render.test.ts through vite-node: draws home's guide for a member with Sides of you (#673)
// the way the server does, in both editions and with the focus in a few places, and prints the HTML with the items
// the machine lists, so the test can compare the two.
import type { TitleCard } from "~/server/title-cards.server"
import { renderToStaticMarkup } from "react-dom/server"
import { TvScreen } from "./TvScreen"
import { PHONE_TV_CANVAS, TV_CANVAS } from "./room-layout"
import type { TvCanvas } from "./room-tv"
import {
	type TvHomeData,
	type TvHomeSide,
	homeApps,
	homeServices,
	tvContextOf,
} from "./tv-home"
import { type TvState, focusedItem, tvItems } from "./tv-machine"

const pick = (id: number) => ({
	key: `movie-${id}`,
	title: `Pick ${id}`,
	poster: `/pick-poster-${id}.jpg`,
	backdrop: `/pick-backdrop-${id}.jpg`,
	facts: "2019 · Movie · 81% match",
})
const side = (
	id: string,
	picks: number[],
	words: TvHomeSide["words"] = null,
): TvHomeSide => ({
	id,
	loved: [1, 2, 3].map((n) => ({
		key: `movie-${id.length * 100 + n}`,
		title: `Loved ${id} ${n}`,
		poster: `/loved-${id}-${n}.jpg`,
	})),
	picks: picks.map(pick),
	fewOnServices: id === "b",
	watchNext: "/watch/movies?moods=heavy",
	words,
})

const member: TvHomeData = {
	member: true,
	startTitles: [],
	picture: null,
	tonight: [],
	shows: { next: [], start: [] },
	services: [
		{ id: 8, name: "Netflix", logo_path: null },
		{ id: 337, name: "Disney+", logo_path: null },
	],
	sides: [side("a", [11, 12, 13]), side("b", [21, 22]), side("c", [])],
}
const named: TvHomeData = {
	...member,
	sides: [side("a", [11], { name: "Dark, tense crime", moods: ["Sad"] })],
}

const CANVAS: Record<"desktop" | "phone", TvCanvas> = {
	desktop: { edition: "desktop", ...TV_CANVAS, scale: 1 },
	phone: { edition: "phone", ...PHONE_TV_CANVAS, scale: 0.72 },
}

function draw(
	data: TvHomeData,
	edition: "desktop" | "phone",
	focus: string | null,
	waiting = false,
) {
	const ctx = {
		...tvContextOf(data, null),
		...(edition === "phone" && { homeSides: [], phone: true }),
	}
	const state: TvState = {
		screen: { name: "home" },
		focus,
		power: "on",
		menuOpen: false,
		menuFocus: null,
		depth: 0,
	}
	const html = renderToStaticMarkup(
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
			canvas={CANVAS[edition]}
			ctx={ctx}
			apps={homeApps(data, null, true)}
			home={data}
			titles={{ tonight: data.tonight, waiting, title: null }}
			sides={data.sides}
			services={{ tiles: homeServices(data, null), list: null }}
			toast={null}
		/>,
	)
	return {
		html,
		items: tvItems(state.screen, ctx),
		focus: focusedItem(state, ctx),
	}
}

const movie = {
	key: 1000000001946,
	tmdb_id: 1946,
	media_type: "movie",
	title: "eXistenZ",
	poster_path: "/poster.jpg",
	backdrop_path: "/backdrop.jpg",
	runtime: 97,
	match: 92,
	wantToSee: true,
	services: [{ id: 8, name: "Netflix", logo_path: "" }],
} as TitleCard
const ready: TvHomeData = {
	...member,
	tonight: [{ card: movie, href: "/watch/movies" }],
	popular: {
		titles: [
			{
				...movie,
				key: 1000000000001,
				tmdb_id: 1,
				title: "Up",
				wantToSee: false,
			},
		],
		scope: "mixed",
		country: "DE",
	},
}

console.log(
	`__TV_HOME_SIDES__${JSON.stringify({
		movie: draw(ready, "desktop", null),
		showToStart: draw(
			{
				...ready,
				tonight: [
					{
						card: { ...movie, media_type: "show", runtime: 55 },
						href: "/watch/not-started",
					},
				],
			},
			"phone",
			null,
		),
		episode: draw(
			{
				...ready,
				tonight: [
					{
						card: { ...movie, media_type: "show", runtime: 99 },
						href: "/watch",
						episode: { code: "S2 E4", name: "The next episode", runtime: 48 },
					},
				],
			},
			"phone",
			null,
		),
		failed: draw(
			{
				...member,
				homeFailed: true,
				popular: { titles: [], country: "DE", scope: "unknown", failed: true },
			},
			"phone",
			null,
		),
		loading: draw(member, "phone", null, true),
		noServices: draw(
			{
				...ready,
				tonight: [
					{ card: { ...movie, match: null, services: [] }, href: "/watch/movies" },
				],
				popular: { ...ready.popular!, scope: "all" },
			},
			"phone",
			null,
		),
		onApp: draw(member, "desktop", null),
		onSide: draw(member, "desktop", "home-side:b"),
		onPick: draw(member, "desktop", "title:movie-12"),
		onEmpty: draw(member, "desktop", "watch-next:c"),
		phone: draw(member, "phone", null),
		named: draw(named, "desktop", "home-side:a"),
	})}`,
)
