// Run by tv-home-sides-render.test.ts through vite-node: draws home's guide for a member with Sides of you (#673)
// the way the server does, in both editions and with the focus in a few places, and prints the HTML with the items
// the machine lists, so the test can compare the two.
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
	watchNext: "/watch-next?moods=heavy",
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
	sides: [side("a", [11], { name: "Dark, tense crime", moods: ["Heavy"] })],
}

const CANVAS: Record<"desktop" | "phone", TvCanvas> = {
	desktop: { edition: "desktop", ...TV_CANVAS, scale: 1 },
	phone: { edition: "phone", ...PHONE_TV_CANVAS, scale: 0.72 },
}

function draw(
	data: TvHomeData,
	edition: "desktop" | "phone",
	focus: string | null,
) {
	const ctx = {
		...tvContextOf(data, null),
		...(edition === "phone" && { homeSides: [] }),
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
			}}
			canvas={CANVAS[edition]}
			ctx={ctx}
			apps={homeApps(data, null, true)}
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

console.log(
	`__TV_HOME_SIDES__${JSON.stringify({
		onApp: draw(member, "desktop", null),
		onSide: draw(member, "desktop", "home-side:b"),
		onPick: draw(member, "desktop", "title:movie-12"),
		onEmpty: draw(member, "desktop", "watch-next:c"),
		phone: draw(member, "phone", null),
		named: draw(named, "desktop", "home-side:a"),
	})}`,
)
