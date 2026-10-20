import BrowseFilters from "./BrowseFilters"
import { browseActions, selectionNames } from "./browse-actions"
import { copyMediaPresentation } from "~/utils/media-presentation"
// Discover keeps its established mood/theme/style choices and adds catalog browsing, filters and paging.
// Results use the shared stable TitleList; filter edits stay in a dedicated step until Done/Back applies them.
// This screen and its filter UI are lazy, loaded only when Discover is opened.
import { useRef } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { TitleList, type TvListTitle } from "../TitleList"
import {
	Frame,
	Img,
	Item,
	backdropSize,
	keySize,
	useReport,
	useTvView,
} from "../kit"
import {
	DISCOVER_TAB_KEYS,
	type TvDiscoverOption,
	discoverOptions,
	listEmptyLine,
	listFacts,
} from "../tv-discover"
import { tvTitleKey } from "../tv-home"
import type { TvDiscoverTab, TvScreen } from "../tv-machine"
import { type TvDiscoverReport, useTvDiscover } from "../use-tv-discover"

/**
 * The titles of the choice on screen (use-tv-discover.ts). Draws nothing. The scene mounts it once while the
 * address names a choice, and gets what it holds through `report`. It is in this chunk, so the list's data costs
 * no request for code of its own and nothing in the page's first view.
 */
export function DiscoverData({
	report,
	...on
}: Parameters<typeof useTvDiscover>[0] & {
	report: (list: TvDiscoverReport | null) => void
}) {
	useReport(report, useTvDiscover(on))
	return null
}

/** How wide the Expand key's corner is on the phone: the last row ends before it. */
const CORNER = "pr-[158px]"

/** A tab: quiet until it is open, and white while it has the focus (living-room.css, `tvc-tab`). */
const TAB = "tvc-tab flex items-center justify-center whitespace-nowrap"

/** An option's own colour over its picture: the picture shows through at the top. */
const tint = (color: string) =>
	`linear-gradient(0deg, color-mix(in srgb, ${color} 26%, #05060a) 0%, color-mix(in srgb, ${color} 34%, transparent) 100%)`
/** An option's own colour alone, for a tile without a picture. */
const plain = (color: string) =>
	`linear-gradient(160deg, color-mix(in srgb, ${color} 58%, #05060a) 0%, color-mix(in srgb, ${color} 20%, #05060a) 100%)`

function Choice({
	items,
	tab,
	art,
}: {
	items: readonly string[]
	tab: TvDiscoverTab
	art: Readonly<Record<string, string>>
}) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
	const options = discoverOptions(tab)
	// The option the screen says a line about and shows behind everything: the one with the focus, and while the
	// focus is on a tab or the bar, the one that had it last on this tab.
	const last = useRef(options[0]?.item)
	if (options.some((option) => option.item === focused)) last.current = focused
	const shown =
		options.find((option) => option.item === last.current) ?? options[0]
	const picture = shown && art[shown.item]

	const tabs = (
		<div
			className={`flex shrink-0 ${P ? "gap-2" : "mb-5 gap-3"}`}
			style={{ height: P ? keySize(canvas, 52) : 64 }}
		>
			<Item
				id="browse:all"
				className={`${TAB} px-4 ${P ? "text-[22px]" : "text-[28px]"}`}
			>
				All
			</Item>
			{DISCOVER_TAB_KEYS.filter((key) => items.includes(key.item)).map(
				(key) => (
					<Item
						key={key.item}
						id={key.item}
						pressed={key.tab === tab}
						className={`${TAB} ${key.tab === tab ? "tvc-tab-open" : ""} ${P ? "min-w-0 flex-1 text-[22px]" : "px-9 text-[28px]"}`}
					>
						{key.name}
					</Item>
				),
			)}
		</div>
	)
	const tile = (option: TvDiscoverOption) => {
		const path = art[option.item]
		return (
			<Item
				key={option.item}
				id={option.item}
				className="tvc-tile min-h-0"
				style={P ? undefined : { height: 158 }}
			>
				{path && (
					<Img
						src={tmdbImageUrl(path, "w780")}
						className="absolute inset-0 h-full w-full"
					/>
				)}
				<span
					className="absolute inset-0"
					style={{
						background: path ? tint(option.color) : plain(option.color),
					}}
				/>
				<span
					className={`absolute ${P ? "inset-x-3 bottom-2.5" : "inset-x-5 bottom-4"}`}
				>
					<span
						className={`block font-bold leading-none ${P ? "text-[22px]" : "text-[38px]"}`}
					>
						{option.name}
					</span>
					{!P && (
						<span className="mt-1.5 line-clamp-2 text-[22px] leading-tight text-white/85">
							{option.line}
						</span>
					)}
				</span>
			</Item>
		)
	}
	const tiles = options
		.filter((option) => items.includes(option.item))
		.map(tile)
	const behind = picture
		? tmdbImageUrl(picture, backdropSize(canvas))
		: undefined

	// The phone: the six options three by three, and the focused one's line beside the Expand key's corner. The two
	// rows of tiles share what the tabs and the last row leave. On a short phone the gaps give way first, so a tile
	// stays a touch target.
	if (P) {
		const row = { flex: `1 0 ${keySize(canvas, 0)}px` }
		return (
			<Frame name="Discover" items={items} art={behind} dim={0.86}>
				<div className="flex h-full flex-col">
					{tabs}
					<div className="min-h-[5px] shrink basis-[10px]" />
					<div className="grid min-h-0 grid-cols-3 gap-x-3" style={row}>
						{tiles.slice(0, 3)}
					</div>
					<div className="min-h-[8px] shrink basis-[12px]" />
					<div className="grid min-h-0 grid-cols-3 gap-x-3" style={row}>
						{tiles.slice(3)}
					</div>
					<div className="min-h-[5px] shrink basis-[10px]" />
					<div
						className={`flex shrink-0 items-center ${CORNER}`}
						style={{ height: keySize(canvas, 54) }}
					>
						{shown && (
							<span
								key={shown.item}
								className="tvc-fade line-clamp-2 min-w-0 text-[20px] leading-tight text-white/85"
							>
								{shown.line}
							</span>
						)}
					</div>
				</div>
			</Frame>
		)
	}
	return (
		<Frame name="Discover" items={items} art={behind} dim={0.86} reserve>
			{tabs}
			<div className="grid grid-cols-3 gap-6">{tiles}</div>
		</Frame>
	)
}

/** The titles of one choice, in the list every app shows its titles in (../TitleList.tsx). */
function List({
	items,
	screen,
	list,
}: {
	items: readonly string[]
	screen: Extract<TvScreen, { name: "discover" }>
	list: TvDiscoverReport | null
}) {
	const titles: TvListTitle[] = (list?.cards ?? []).map((card) => ({
		key: tvTitleKey(card),
		...copyMediaPresentation(card),
		title: card.title,
		poster: card.poster_path,
		backdrop: card.backdrop_path,
		facts: listFacts(card),
	}))
	return (
		<TitleList
			name="Discover"
			crumb={`${selectionNames(screen) || "All titles"} · Page ${screen.page ?? 1}${list ? ` of ${list.pages} · ${list.total} titles` : ""}`}
			items={items}
			titles={titles}
			empty={list?.failed ?? listEmptyLine(list?.waiting ?? true)}
			actions={browseActions(screen, list)}
			actionsLabel={list?.summary}
		/>
	)
}

export default function Discover({
	items,
	screen,
	art,
	list,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	screen: Extract<TvScreen, { name: "discover" }>
	/** A picture per option, by its item (`theme:crime`): a backdrop's path. Empty until the pool is there. */
	art: Readonly<Record<string, string>>
	/** The titles of the choice on screen; null until their data component has reported. */
	list: TvDiscoverReport | null
}) {
	if (screen.filters)
		return (
			<BrowseFilters
				screen={screen}
				items={items}
				summary={list?.summary}
				controls={list?.controls}
				hasTaste={list?.hasTaste}
			/>
		)
	return screen.choice || screen.all ? (
		<List items={items} screen={screen} list={list} />
	) : (
		<Choice items={items} tab={screen.tab} art={art} />
	)
}
