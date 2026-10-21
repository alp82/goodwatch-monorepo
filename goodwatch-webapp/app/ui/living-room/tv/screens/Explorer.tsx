// The mini Explorer: a small map of six islands of the real mood map, and an island with its first four titles
// and "Sail to" its two nearest islands (tv-explorer.ts says which six, where each sits and what is next door).
// A chunk the TV asks for on first use (screen-code.tsx).
//
// The map reads as a map: flat islands in their own colours with their names inside, joined by dotted bridges,
// on the picture of the island that has the focus. The focused island comes forward, the others sit back in the
// dark, as every tile of the TV does. On the desktop the islands lie where `MAP_PLACES` puts them; on the phone
// they are three by two, each a touch target. An island's screen is the TV's list: the focused title's name and
// facts over a row of posters.
//
// The Expand key's place is the picture's bottom right corner (the `Frame` keeps it; slice 11 draws the key). The
// map keeps clear of it; on the phone the row beside it says what sets the focused island apart, and on an
// island holds the two islands to sail to.
import { useRef } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { TitleList } from "../TitleList"
import {
	Frame,
	Item,
	PhoneFoot,
	backdropSize,
	keySize,
	useReport,
	useTvView,
} from "../kit"
import {
	MAP_PLACES,
	type TvExplorerView,
	type TvIsland,
	inkOn,
	islandCount,
} from "../tv-explorer"
import { type TvExplorerReport, useTvExplorer } from "../use-tv-explorer"

/**
 * The map's data (use-tv-explorer.ts). Draws nothing. The scene mounts it once, from the moment the Explorer's
 * tile first has the focus, and gets what it holds through `report`. It is in this chunk, so the map costs no
 * request for code of its own and nothing in the page's first view.
 */
export function ExplorerData({
	report,
	...explorer
}: Parameters<typeof useTvExplorer>[0] & {
	report: (explorer: TvExplorerReport | null) => void
}) {
	useReport(report, useTvExplorer(explorer))
	return null
}

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six"]

/** The backdrop behind a screen, in the size its edition draws. */
function useArt(path: string | null | undefined) {
	const { canvas } = useTvView()
	return path ? tmdbImageUrl(path, backdropSize(canvas)) : undefined
}

/** What the focus was on last among `ids`, so the screen keeps showing it while the focus is on the bar. */
function useShown(ids: readonly string[], kind: string): string | undefined {
	const { focused } = useTvView()
	const last = useRef(ids[0])
	const at = ids.find((id) => `${kind}:${id}` === focused)
	if (at) last.current = at
	return ids.includes(last.current) ? last.current : ids[0]
}

/** A screen of the Explorer that has nothing to show: one line under the bar. */
function Note({
	items,
	children,
}: { items: readonly string[]; children: string }) {
	const P = useTvView().canvas.edition === "phone"
	return (
		<Frame name="Explorer" items={items} dim={0.82}>
			<div
				className={`flex min-h-full flex-col justify-center text-white/70 ${P ? "text-[22px]" : "text-[26px]"}`}
			>
				{children}
			</div>
		</Frame>
	)
}

/** An island on the map: a flat shape in its colour with its name inside. */
function Island({
	island,
	place,
	phone,
}: { island: TvIsland; place: number; phone: boolean }) {
	const at = MAP_PLACES[place]
	const on = useTvView().focused === `island:${island.id}`
	return (
		<Item
			id={`island:${island.id}`}
			className={`tvc-tile flex items-center justify-center text-center ${phone ? "max-h-[108px] min-h-0 self-center px-2" : "absolute px-5"}`}
			style={{
				background: island.color,
				color: inkOn(island.color),
				borderRadius: at.shape,
				// The shallows around an island at rest; the focused one has the tile's white edge instead.
				outline: on ? undefined : `${phone ? 4 : 7}px solid ${island.color}38`,
				...(phone
					? { height: "100%" }
					: {
							left: at.left,
							top: at.top,
							width: at.width,
							height: at.height,
						}),
			}}
		>
			<span
				className={`font-bold leading-none tracking-tight ${phone ? "text-[25px]" : "text-[38px]"}`}
			>
				{island.name}
			</span>
		</Item>
	)
}

function IslandMap({
	items,
	view,
}: { items: readonly string[]; view: TvExplorerView }) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	const { islands } = view
	const shownId = useShown(
		islands.map((island) => island.id),
		"island",
	)
	const shown = islands.find((island) => island.id === shownId) ?? islands[0]
	const art = useArt(shown.picture)
	const foot = keySize(canvas, 54)
	return (
		<Frame
			name="Explorer"
			crumb={`${COUNT_WORDS[islands.length]} ${islands.length === 1 ? "island" : "islands"}`}
			items={items}
			art={art}
			dim={0.88}
			inlineExpand
		>
			{P ? (
				// The phone: the islands three by two, in their reading order. The row under them is the Expand
				// key's; beside the key it says what sets the focused island apart.
				<div className="flex h-full flex-col">
					<div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-2.5 pt-2">
						{islands.map((island, place) => (
							<Island key={island.id} island={island} place={place} phone />
						))}
					</div>
					<PhoneFoot items={items} height={foot} className="mt-2.5">
						<div
							key={shown.id}
							className="tvc-fade line-clamp-2 text-[20px] leading-tight text-white/80"
						>
							{shown.apart} · {islandCount(shown.count)}
						</div>
					</PhoneFoot>
				</div>
			) : (
				<div className="relative h-full">
					<svg className="absolute inset-0 h-full w-full" aria-hidden="true">
						{view.bridges.map(([from, to]) => {
							const [a, b] = [MAP_PLACES[from], MAP_PLACES[to]]
							return (
								<line
									key={`${from}-${to}`}
									x1={a.left + a.width / 2}
									y1={a.top + a.height / 2}
									x2={b.left + b.width / 2}
									y2={b.top + b.height / 2}
									stroke="rgba(255,255,255,.45)"
									strokeWidth="4"
									strokeDasharray="2 14"
									strokeLinecap="round"
								/>
							)
						})}
					</svg>
					{islands.map((island, place) => (
						<Island
							key={island.id}
							island={island}
							place={place}
							phone={false}
						/>
					))}
					{/* Under the map, at the left: what the focused island is. The right end is the Expand key's. */}
					<div
						key={shown.id}
						className="tvc-fade absolute bottom-0 left-0 w-[800px]"
					>
						<div className="text-[34px] font-bold leading-tight">
							{shown.apart}
						</div>
						<div className="mt-1 text-[24px] text-white/70">
							{islandCount(shown.count)}
						</div>
					</div>
				</div>
			)}
		</Frame>
	)
}

/** An island's titles and the islands to sail to, in the list every app shows its titles in (../TitleList.tsx). */
function IslandTitles({
	items,
	island,
}: {
	items: readonly string[]
	island: Exclude<TvExplorerView["island"], "missing" | null>
}) {
	const P = useTvView().canvas.edition === "phone"
	return (
		<TitleList
			name="Explorer"
			// The desktop has room for what sets the island apart.
			crumb={P ? island.name : `${island.name} · ${island.apart}`}
			items={items}
			titles={island.titles}
			empty="Nothing on this island right now."
			// The islands next door, each with its colour on the map.
			actions={island.hops.map((hop) => ({
				id: `hop:${hop.id}`,
				label: hop.name,
				says: `Sail to ${hop.name}`,
				mark: hop.color,
			}))}
			actionsLabel="Sail to"
			art={island.picture}
		/>
	)
}

export default function Explorer({
	items,
	view,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	view: TvExplorerView
}) {
	if (view.status !== "ready")
		return (
			<Note items={items}>
				{view.status === "waiting"
					? "The map is on its way."
					: "The map isn't here right now. Try again in a moment."}
			</Note>
		)
	if (view.island === "missing")
		return <Note items={items}>This island isn't on the map.</Note>
	if (view.island) return <IslandTitles items={items} island={view.island} />
	if (!view.islands.length)
		return <Note items={items}>No islands with these titles right now.</Note>
	return <IslandMap items={items} view={view} />
}
