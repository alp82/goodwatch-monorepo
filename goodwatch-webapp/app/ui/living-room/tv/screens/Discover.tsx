// Mini Discover. Its first screen is three tabs, Moods, Themes and Styles, with six options each; one choice leads
// to the first titles of Discover's own results for it, and a title to its title screen. Change leads back to the
// tabs. Choices never combine on the TV: combining is the Discover page's, one Expand away, with the choice
// already set. A chunk the TV asks for on first use (screen-code.tsx).
//
// The tabs stand under the top bar, at the left. A tab opens when the direction keys land on it; the pointer over
// a tab only gives it the focus, and a click or a tap opens it (tv-machine.ts, "Mini Discover"). The open tab is
// marked whether or not it has the focus.
//
// A tile is its option's picture under its own colour, with its name on it: one title that has the mood, theme
// or style, which the pool names (`choiceArt`). Until the pool is there, and for an option without a title, the
// tile is the option's colour alone.
//
// On the phone every key is a touch target, 44 px or more on the phone's screen (`keySize` in kit.tsx): the tabs
// share the width, the six tiles stand three by three, and the last row holds the focused option's line, or
// Change, beside the Expand key's corner at the bottom right.
import { useRef } from "react"
import type { TitleCard } from "~/server/title-cards.server"
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
import {
	DISCOVER_TAB_KEYS,
	type TvDiscoverOption,
	discoverOption,
	discoverOptions,
	listEmptyLine,
	listFacts,
} from "../tv-discover"
import { TV_ROW_ATTR } from "../tv-dom"
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

/** A tab: quiet until it is open, and white while it has the focus (tv.css, `tvc-tab`). */
const TAB = "tvc-tab flex items-center justify-center whitespace-nowrap"

/** An option's own colour over its picture: the picture shows through at the top. */
const tint = (color: string) =>
	`linear-gradient(0deg, color-mix(in srgb, ${color} 26%, #05060a) 0%, color-mix(in srgb, ${color} 34%, transparent) 100%)`
/** An option's own colour alone, for a tile without a picture. */
const plain = (color: string) =>
	`linear-gradient(160deg, color-mix(in srgb, ${color} 58%, #05060a) 0%, color-mix(in srgb, ${color} 20%, #05060a) 100%)`

/** A long name is set smaller, so it stays on two lines. */
const nameSize = (name: string, large: number, small: number) =>
	name.length > 16 ? small : large

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

function List({
	items,
	option,
	list,
}: {
	items: readonly string[]
	option: TvDiscoverOption | null
	list: TvDiscoverReport | null
}) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
	const cards = (list?.cards ?? []).filter((card) =>
		items.includes(`title:${tvTitleKey(card)}`),
	)
	// The title the screen names and shows behind everything: the one with the focus, and while the focus is on
	// Change or the bar, the one that had it last.
	const last = useRef<string | null>(null)
	const at = cards.find((card) => `title:${tvTitleKey(card)}` === focused)
	if (at) last.current = tvTitleKey(at)
	const shown: TitleCard | null =
		cards.find((card) => tvTitleKey(card) === last.current) ?? cards[0] ?? null
	const empty = listEmptyLine(list?.waiting ?? true)
	const behind = shown?.backdrop_path
		? tmdbImageUrl(shown.backdrop_path, backdropSize(canvas))
		: undefined
	const change = items.includes("change")
	const poster = (card: TitleCard, size: string) =>
		card.poster_path && (
			<Img
				src={tmdbImageUrl(card.poster_path, size)}
				className="absolute inset-0 h-full w-full"
			/>
		)

	// The phone: one line of name, one of facts, the posters as tall as is left, and Change beside the Expand
	// key's corner.
	if (P)
		return (
			<Frame name="Discover" crumb={option?.name} items={items} art={behind}>
				<div className="flex h-full flex-col">
					{shown ? (
						<div key={tvTitleKey(shown)} className="tvc-fade shrink-0">
							<div className="truncate text-[30px] font-bold leading-none tracking-tight">
								{shown.title}
							</div>
							<div className="mt-2 truncate text-[20px] leading-tight text-white/75">
								{listFacts(shown)}
							</div>
						</div>
					) : (
						<div className="shrink-0 text-[26px] text-white/70">{empty}</div>
					)}
					<div
						{...{ [TV_ROW_ATTR]: "" }}
						className="relative -mx-5 flex min-h-0 flex-1 gap-3.5 overflow-hidden px-5 py-3.5"
					>
						{cards.map((card) => (
							<Item
								key={card.key}
								id={`title:${tvTitleKey(card)}`}
								label={card.title}
								// Four posters fit the row: a taller phone leaves the rest under them.
								className="tvc-tile aspect-[2/3] h-full max-h-[156px] shrink-0 bg-[#10131c]"
							>
								{poster(card, "w185")}
							</Item>
						))}
					</div>
					<div
						className={`flex shrink-0 items-center ${CORNER}`}
						style={{ height: keySize(canvas, 54) }}
					>
						{change && (
							<Item
								id="change"
								className="tvc-btn flex h-full min-w-0 items-center px-6 text-[21px]"
							>
								<span className="truncate">Change</span>
							</Item>
						)}
					</div>
				</div>
			</Frame>
		)
	return (
		<Frame
			name="Discover"
			crumb={option?.name}
			items={items}
			art={behind}
			reserve
		>
			<div className="flex min-h-full flex-col justify-between">
				<div className="w-[820px]">
					{shown ? (
						<div key={tvTitleKey(shown)} className="tvc-fade">
							<div
								className="line-clamp-2 font-bold leading-none tracking-tight"
								style={{ fontSize: nameSize(shown.title, 62, 46) }}
							>
								{shown.title}
							</div>
							<div className="mt-3 truncate text-[26px] text-white/75">
								{listFacts(shown)}
							</div>
						</div>
					) : (
						<div className="text-[32px] text-white/70">{empty}</div>
					)}
				</div>
				<div className="flex items-end gap-8">
					<div
						{...{ [TV_ROW_ATTR]: "" }}
						className="relative -mx-6 flex min-w-0 flex-1 gap-6 overflow-hidden px-6 py-7"
					>
						{cards.map((card) => (
							<Item
								key={card.key}
								id={`title:${tvTitleKey(card)}`}
								label={card.title}
								className="tvc-tile shrink-0 bg-[#10131c]"
								style={{ width: 172, height: 258 }}
							>
								{poster(card, "w342")}
							</Item>
						))}
					</div>
					{change && (
						<div className="flex shrink-0 flex-col gap-3 pb-7">
							<Item
								id="change"
								className="tvc-btn flex h-[68px] items-center justify-center whitespace-nowrap px-8 text-[26px]"
							>
								Change
							</Item>
						</div>
					)}
				</div>
			</div>
		</Frame>
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
	return screen.choice ? (
		<List
			items={items}
			option={discoverOption(screen.tab, screen.choice)}
			list={list}
		/>
	) : (
		<Choice items={items} tab={screen.tab} art={art} />
	)
}
