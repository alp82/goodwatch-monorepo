// What is on the new TV: the screen the machine's state names, the menu over it, the boot screen, and the toast.
// Drawn on the canvas the room hands it (TvRoom.tsx), in either edition; before the window is measured, in both.
//
// The screen switch: home is part of the first view. Every other screen is a chunk of its own, asked for on first
// use (screen-code.tsx), and each mini app's slice adds its entry here.
import { type ReactNode, useMemo, useRef } from "react"
import {
	Boot,
	CornerBar,
	Frame,
	Item,
	Layer,
	Shade,
	type TvView,
	TvViewProvider,
	keySize,
} from "./kit"
import type { TvCanvas } from "./room-tv"
import {
	AboutCode,
	DiscoverCode,
	ExplorerCode,
	MenuCode,
	RateCode,
	TitleCode,
	TonightCode,
} from "./screen-code"
import { Home } from "./screens/Home"
import type { TvExplorerView } from "./tv-explorer"
import type { TvAppTile } from "./tv-home"
import {
	type TvContext,
	type TvScreen as Screen,
	menuItems,
	tvItems,
	writeTvParams,
} from "./tv-machine"
import type { TvTitleScreens } from "./tv-title"
import type { Tv } from "./use-tv"
import type { TvDiscoverReport } from "./use-tv-discover"

// What the scene needs of the lazy screens. It takes them from here, so that this file stays the one importer of
// screen-code.tsx (see there).
export {
	DiscoverCode,
	DiscoverData,
	RateCode,
	TitleCode,
	TitleData,
	TonightCode,
	loadFirstScreens,
} from "./screen-code"
// The mini Explorer (slice 7).
export { ExplorerData } from "./screen-code"

/** A screen's name, as its top bar shows it and as it is announced when the screen changes. */
const SCREEN_NAME: Record<Screen["name"], string> = {
	home: "Home",
	tonight: "Tonight",
	discover: "Discover",
	explorer: "Explorer",
	taste: "Taste",
	quiz: "Taste",
	shows: "My shows",
	title: "Title",
	rate: "Seen it",
	search: "Search",
	about: "What is GoodWatch?",
}

export type TvScreenProps = {
	tv: Pick<Tv, "state" | "focused" | "screenFocus" | "dispatch">
	canvas: TvCanvas
	ctx: TvContext
	/** Home's tiles. */
	apps: readonly TvAppTile[]
	/** What the TV says for a moment ("On your Wishlist"), or null. */
	toast: string | null
	/** Tonight's picks and the title on the title screen. */
	titles?: TvTitleScreens
	/** Mini Discover: a picture per option, and the titles of the choice on screen. */
	discover?: TvDiscoverScreens
	/** The mini Explorer's map and island (slice 7). Null until its data component has reported. */
	explorer?: TvExplorerView | null
}

/** What mini Discover draws from. */
export type TvDiscoverScreens = {
	/** A backdrop's path per option, by its item (`theme:crime`). Empty until the pool is there. */
	art: Readonly<Record<string, string>>
	/** The titles of the choice on screen; null until their data component has reported. */
	list: TvDiscoverReport | null
}
const NO_ART: TvDiscoverScreens["art"] = {}

export function TvScreen({
	tv,
	canvas,
	ctx,
	apps,
	toast,
	titles,
	discover,
	explorer,
}: TvScreenProps) {
	const { state, focused, screenFocus, dispatch } = tv
	const { screen } = state
	// The menu's items have the focus while it is open; the screen under it keeps showing its own.
	const under = useMemo<TvView>(
		() => ({ canvas, focused: screenFocus, dispatch }),
		[canvas, screenFocus, dispatch],
	)
	const over = useMemo<TvView>(
		() => ({ canvas, focused, dispatch }),
		[canvas, focused, dispatch],
	)
	// A screen arrives with a short zoom out of the picture. The screen the TV starts on is there at once.
	// Discover's tabs are one screen: a change of tab is no arrival.
	const key = writeTvParams(
		screen.name === "discover" && !screen.choice
			? { ...screen, tab: "moods" }
			: screen,
	).toString()
	const arrived = useRef({ first: key, moved: false })
	if (key !== arrived.current.first) arrived.current.moved = true

	const phone = canvas.edition === "phone"
	const items = tvItems(screen, ctx)
	// The toast stands in the top bar's row, at the left, where a screen's name is: no screen has a focus target
	// there, so it never covers a key, least of all the one it is about. The name steps back while it shows
	// (`data-tv-toast`; kit.tsx's Frame and the home's wordmark listen). It ends before the bar's keys, which are
	// three touch targets on the phone. The menu lies over everything: while it is open there is no toast.
	const says = state.power === "on" && !state.menuOpen ? toast : null
	const toastWidth = phone ? canvas.w - 72 - 3 * keySize(canvas, 54) : 640
	return (
		<div
			className="tvc absolute inset-0 overflow-hidden"
			data-tv-toast={says ? "" : undefined}
		>
			{state.power === "booting" ? (
				<TvViewProvider value={under}>
					<Boot />
				</TvViewProvider>
			) : (
				<>
					<TvViewProvider value={under}>
						<Layer
							key={key}
							className={arrived.current.moved ? "tvc-screen" : ""}
							away={state.menuOpen}
						>
							<ScreenOf
								screen={screen}
								items={items}
								apps={apps}
								titles={titles}
								discover={discover}
								explorer={explorer}
							/>
						</Layer>
					</TvViewProvider>
					{state.menuOpen && (
						<TvViewProvider value={over}>
							<Layer className="tvc-menu">
								{/* A press beside the menu closes it, as Back does. */}
								{/* biome-ignore lint/a11y/useKeyWithClickEvents: the keys close it with Back (use-tv.ts) */}
								<div
									aria-hidden
									className="absolute inset-0"
									onClick={() => dispatch({ type: "back" })}
								/>
								<MenuCode.Screen items={menuItems(ctx)} />
							</Layer>
						</TvViewProvider>
					)}
				</>
			)}
			{/* The screen's name is read out when the screen changes. */}
			<div aria-live="polite" className="sr-only">
				{state.power === "on" ? SCREEN_NAME[screen.name] : ""}
			</div>
			{says && (
				<div
					className={`pointer-events-none absolute left-0 top-0 z-30 flex items-center ${phone ? "h-[78px] pl-5" : "h-[108px] pl-14"}`}
					style={{ maxWidth: toastWidth }}
				>
					<output
						className={
							phone
								? "tvc-toast rounded-[22px] px-4 py-2 text-[20px] leading-tight"
								: "tvc-toast"
						}
					>
						{says}
					</output>
				</div>
			)}
		</div>
	)
}

function ScreenOf({
	screen,
	items,
	apps,
	titles,
	discover,
	explorer,
}: {
	screen: Screen
	items: readonly string[]
	apps: readonly TvAppTile[]
	titles?: TvTitleScreens
	discover?: TvDiscoverScreens
	explorer?: TvExplorerView | null
}): ReactNode {
	const first = <Bare items={items} />
	switch (screen.name) {
		case "home":
			return <Home apps={apps} items={items} />
		case "about":
			return <AboutCode.Screen items={items} first={first} />
		case "tonight":
			return (
				<TonightCode.Screen
					items={items}
					picks={titles?.tonight ?? []}
					pick={screen.pick}
					waiting={titles?.waiting ?? true}
					first={first}
				/>
			)
		case "title":
		case "rate": {
			if (!titles?.title) return first
			const Code = screen.name === "title" ? TitleCode : RateCode
			return <Code.Screen items={items} title={titles.title} first={first} />
		}
		case "discover":
			return (
				<DiscoverCode.Screen
					items={items}
					screen={screen}
					art={discover?.art ?? NO_ART}
					list={discover?.list ?? null}
					first={first}
				/>
			)
		// The mini Explorer (slice 7): the map without an island, an island's titles with one.
		case "explorer":
			return explorer ? (
				<ExplorerCode.Screen items={items} view={explorer} first={first} />
			) : (
				first
			)
		// SEAM (slices 8 to 10): Taste and the quiz, My shows and search each take their entry here.
		default:
			return <NotBuilt screen={screen} items={items} />
	}
}

/** A screen whose code is on its way: its bar alone, so Back, Search and the menu work. */
function Bare({ items }: { items: readonly string[] }) {
	return (
		<>
			<Shade dim={0.82} />
			<CornerBar items={items} />
		</>
	)
}

/**
 * A screen no slice has built yet. It draws the machine's items for it as plain keys, so the focus and the keys
 * work as on any screen, and its bar, so the way back works. The Expand key is not among them: its place is the
 * `Frame`'s corner (slice 11).
 */
function NotBuilt({
	screen,
	items,
}: { screen: Screen; items: readonly string[] }) {
	const own = items.filter(
		(item) => item !== "expand" && !item.startsWith("bar:"),
	)
	return (
		<Frame name={SCREEN_NAME[screen.name]} items={items} dim={0.82}>
			<div className="flex min-h-full flex-col justify-center gap-4">
				<div className="text-[26px] text-white/70">
					This screen is not built yet.
				</div>
				{own.length > 0 && (
					<div className="flex flex-wrap gap-3">
						{own.map((item) => (
							<Item
								key={item}
								id={item}
								className="tvc-btn flex h-[60px] items-center px-6 text-[22px]"
							>
								{item}
							</Item>
						))}
					</div>
				)}
			</div>
		</Frame>
	)
}
