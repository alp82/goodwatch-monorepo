import { renderToStaticMarkup } from "react-dom/server"
import { Layer, TvViewProvider } from "./kit"
import { TV_CANVAS, PHONE_TV_CANVAS } from "./room-layout"
import Discover from "./screens/Discover"
import Search from "./screens/Search"
import {
	EMPTY_CONTEXT,
	readTvState,
	transition,
	tvItems,
	writeTvParams,
} from "./tv-machine"

const ctx = { ...EMPTY_CONTEXT, member: true, browseTaste: true }
const rendered = []
for (const name of ["discover", "search"] as const) {
	const base = name === "discover" ? "tv=discover&all=1" : "tv=search&q=2001"
	const read = (query: string) =>
		readTvState(new URLSearchParams(`${base}&filters=1&${query}`), ctx)
	const choose = (state: ReturnType<typeof read>, item: string) =>
		transition(state, { type: "choose", item }, ctx).state
	let entered = choose(read("sort=newest&foryou=0"), "filter:sort")
	if (name === "search") entered = choose(entered, "filter:sort")
	const cases = {
		entered,
		deep: read("sort=match&foryou=0"),
		off: choose(read("sort=match&foryou=1"), "filter:foryou"),
		plain: choose(entered, "filter:sort"),
	}
	for (const [scenario, state] of Object.entries(cases)) {
		const params = writeTvParams(state.screen)
		const list = {
			id: "",
			cards: [],
			titles: [],
			total: 0,
			pages: 1,
			next: false,
			retry: () => {},
			waiting: false,
			failed: null,
			summary: "",
			hasTaste: true,
			controls: { foryou: params.get("foryou")!, sort: params.get("sort")! },
		}
		for (const edition of ["desktop", "phone"] as const) {
			const items = tvItems(state.screen, ctx)
			const screen = state.screen
			const html = renderToStaticMarkup(
				<TvViewProvider
					value={{
						canvas: {
							...(edition === "desktop" ? TV_CANVAS : PHONE_TV_CANVAS),
							edition,
							scale: 1,
						},
						focused: "filter:foryou",
						dispatch: () => {},
					}}
				>
					<Layer>
						{screen.name === "discover" ? (
							<Discover screen={screen} items={items} list={list} art={{}} />
						) : screen.name === "search" ? (
							<Search
								screen={screen}
								items={items}
								list={list}
								draft="2001"
								onDraft={() => {}}
							/>
						) : null}
					</Layer>
				</TvViewProvider>,
			)
			rendered.push({ name, scenario, edition, html })
		}
	}
}
console.log("__TV_BROWSE_RENDER__" + JSON.stringify(rendered))
