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
import {
	Frame,
	Img,
	Item,
	backdropSize,
	keySize,
	useReport,
	useTvView,
} from "../kit"
import { TV_ROW_ATTR } from "../tv-dom"
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

/** How wide the Expand key's corner is on the phone, in canvas pixels: the row beside it ends before it. */
const PHONE_CORNER = 158

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
					<div
						className="mt-2.5 flex shrink-0 items-center"
						style={{ height: foot, paddingRight: PHONE_CORNER }}
					>
						<div
							key={shown.id}
							className="tvc-fade line-clamp-2 text-[20px] leading-tight text-white/80"
						>
							{shown.apart} · {islandCount(shown.count)}
						</div>
					</div>
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

/** A long name is set smaller, so it stays on two lines. */
const nameSize = (name: string) =>
	name.length > 28 ? 38 : name.length > 16 ? 46 : 62

function IslandTitles({
	items,
	island,
}: {
	items: readonly string[]
	island: Exclude<TvExplorerView["island"], "missing" | null>
}) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	const { titles, hops } = island
	const shownKey = useShown(
		titles.map((title) => title.key),
		"title",
	)
	const shown = titles.find((title) => title.key === shownKey) ?? titles[0]
	const art = useArt(shown?.backdrop ?? island.picture)
	const key = keySize(canvas, 54)
	const posters = titles.map((title) => (
		<Item
			key={title.key}
			id={`title:${title.key}`}
			label={title.title}
			// The phone: as tall as the row, and no taller than lets four stand side by side.
			className={`tvc-tile shrink-0 ${P ? "aspect-[2/3] h-full max-h-[156px]" : ""}`}
			style={P ? undefined : { width: 172, height: 258 }}
		>
			<Img
				src={tmdbImageUrl(title.poster, P ? "w185" : "w342")}
				className="absolute inset-0 h-full w-full"
			/>
		</Item>
	))
	const empty = "Nothing on this island right now."
	if (P)
		return (
			<Frame name="Explorer" crumb={island.name} items={items} art={art}>
				<div className="flex h-full flex-col">
					{shown ? (
						<div key={shown.key} className="tvc-fade shrink-0">
							<div className="truncate text-[30px] font-bold leading-none tracking-tight">
								{shown.title}
							</div>
							<div className="mt-2 truncate text-[20px] leading-tight text-white/75">
								{shown.facts}
							</div>
						</div>
					) : (
						<div className="text-[22px] text-white/70">{empty}</div>
					)}
					<div
						{...{ [TV_ROW_ATTR]: "" }}
						className="-mx-5 flex min-h-0 flex-1 items-center gap-3.5 overflow-hidden px-5 py-3.5"
					>
						{posters}
					</div>
					{/* The last row: the islands to sail to, beside the Expand key's corner. */}
					<div
						className="flex shrink-0 items-center gap-2"
						style={{ height: key, paddingRight: PHONE_CORNER }}
					>
						{hops.map((hop) => (
							<Item
								key={hop.id}
								id={`hop:${hop.id}`}
								label={`Sail to ${hop.name}`}
								className="tvc-btn flex min-w-0 items-center px-4 text-[21px]"
								style={{ height: key }}
							>
								<span className="truncate">{hop.name}</span>
							</Item>
						))}
					</div>
				</div>
			</Frame>
		)
	return (
		<Frame
			name="Explorer"
			crumb={`${island.name} · ${island.apart}`}
			items={items}
			art={art}
			reserve
		>
			<div className="flex min-h-full flex-col justify-between">
				<div className="w-[820px]">
					{shown ? (
						<div key={shown.key} className="tvc-fade">
							<div
								className="line-clamp-2 font-bold leading-none tracking-tight"
								style={{ fontSize: nameSize(shown.title) }}
							>
								{shown.title}
							</div>
							<div className="mt-3 text-[26px] text-white/75">
								{shown.facts}
							</div>
						</div>
					) : (
						<div className="text-[32px] text-white/70">{empty}</div>
					)}
				</div>
				<div className="flex items-end gap-8">
					<div
						{...{ [TV_ROW_ATTR]: "" }}
						className="-mx-6 flex min-w-0 flex-1 gap-6 overflow-hidden px-6 py-7"
					>
						{posters}
					</div>
					{hops.length > 0 && (
						<div className="flex shrink-0 flex-col gap-3 pb-7">
							<span className="text-[24px] text-white/70">Sail to</span>
							{hops.map((hop) => (
								<Item
									key={hop.id}
									id={`hop:${hop.id}`}
									label={`Sail to ${hop.name}`}
									className="tvc-btn flex h-[68px] items-center gap-3.5 whitespace-nowrap px-8 text-[26px]"
								>
									{/* The island, as it is on the map. */}
									<span
										aria-hidden="true"
										className="h-[22px] w-[30px] shrink-0 rounded-[50%]"
										style={{ background: hop.color }}
									/>
									{hop.name}
								</Item>
							))}
						</div>
					)}
				</div>
			</div>
		</Frame>
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
