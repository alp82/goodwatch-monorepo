// What is on the new TV: the screen the machine's state names, the menu over it, the boot screen, and the toast.
// Drawn on the canvas the room hands it (TvRoom.tsx), in either edition; before the window is measured, in both.
//
// The screen switch: home is part of the first view. Every other screen is a chunk of its own, asked for on first
// use (screen-code.tsx). Every screen the machine knows has its entry here.
import { type ReactNode, useMemo, useRef } from "react"
import {
	Boot,
	CornerBar,
	ExpandCorner,
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
	PopularCode,
	QuizCode,
	RateCode,
	ServiceCode,
	SearchCode,
	ShowsCode,
	TasteCode,
	TitleCode,
	TonightCode,
} from "./screen-code"
import { Home } from "./screens/Home"
import type { TvExplorerView } from "./tv-explorer"
import {
	type TvAppTile,
	type TvHomeData,
	type TvHomeSide,
	type TvService,
	type TvServiceTile,
	ownedServices,
} from "./tv-home"
import {
	type TvContext,
	type TvScreen as Screen,
	destinationLabel,
	destinationName,
	hasNav,
	menuItems,
	tvItems,
	writeTvParams,
} from "./tv-machine"
import type { TvTasteScreens } from "./tv-taste"
import type { TvTitleScreens } from "./tv-title"
import type { Tv } from "./use-tv"
import type { TvDiscoverReport } from "./use-tv-discover"
import type { TvServiceReport } from "./use-tv-service"
import type { TvSearchReport } from "./use-tv-search"
import type { TvShowsReport } from "./use-tv-shows"

// What the scene needs of the lazy screens. It takes them from here, so that this file stays the one importer of
// screen-code.tsx (see there).
export {
	DiscoverCode,
	DiscoverData,
	PopularCode,
	QuizCode,
	RateCode,
	TasteCode,
	TasteData,
	TitleCode,
	TitleData,
	TonightCode,
	loadFirstScreens,
} from "./screen-code"
// The mini Explorer (slice 7).
export { ExplorerData } from "./screen-code"
// "On <service>" (slice 6b).
export { ServiceData } from "./screen-code"
// Search (slice 10).
export { SearchData } from "./screen-code"
// My shows (slice 9).
export { EpisodeCode, EpisodeData, ShowsCode, ShowsData } from "./screen-code"

/** A screen's name, as its top bar shows it and as it is announced when the screen changes. */
const SCREEN_NAME: Record<Screen["name"], string> = {
	home: "Home",
	tonight: "Watch next",
	popular: "Popular",
	discover: "Discover",
	explorer: "Explorer",
	taste: "Taste",
	quiz: "Taste",
	shows: "My shows",
	title: "Title",
	rate: "Seen it",
	search: "Search",
	about: "What is GoodWatch?",
	service: "On a streaming service",
}

export type TvScreenProps = {
	tv: Pick<
		Tv,
		"state" | "focused" | "screenFocus" | "dispatch" | "ringOff" | "byPointer" | "unpoint"
	>
	canvas: TvCanvas
	ctx: TvContext
	/** Home's tiles. */
	apps: readonly TvAppTile[]
	home?: TvHomeData
	/** A member's taste groups on home's guide. */
	sides?: readonly TvHomeSide[]
	/** What the TV says for a moment ("On your Wishlist"), or null. */
	toast: string | null
	/** Tonight's picks and the title on the title screen. */
	titles?: TvTitleScreens
	/** Mini Discover: a picture per option, and the titles of the choice on screen. */
	discover?: TvDiscoverScreens
	/** The mini Explorer's map and island (slice 7). Null until its data component has reported. */
	explorer?: TvExplorerView | null
	/** The person's taste and the quiz, on Taste, a side's screen and the quiz. */
	taste?: TvTasteScreens
	/** The person's two streaming services: home's tiles after the apps, and the titles of the one on screen. */
	services?: TvServiceScreens
	/** Search (slice 10): what is typed, and the titles found for the query on screen. */
	search?: TvSearchScreens
	/** My shows: the member's shows, and what is new for them. */
	shows?: TvShowsScreens
}

/** What My shows draws from. */
export type TvShowsScreens = {
	/** The member's shows on the TV, from the loader; null for a guest. */
	list: TvHomeData["shows"]
	/** The New episodes signal; null until its data component has reported. */
	signal: TvShowsReport | null
}

/** What home's service tiles and "On <service>" draw from. */
export type TvServiceScreens = {
	/** Home's tiles, in the order of the Remote's keys. */
	tiles: readonly TvServiceTile[]
	/** The titles of the service on screen; null until their data component has reported. */
	list: TvServiceReport | null
}
const NO_SERVICES: readonly TvService[] = []
/** What search draws from. */
export type TvSearchScreens = {
	/** What is typed on the search screen's line, and where a change of it goes. */
	draft: string
	onDraft: (text: string) => void
	/** The titles found for the query on screen; null until their data component has reported. */
	list: TvSearchReport | null
}
const NOT_TYPING: TvSearchScreens = { draft: "", onDraft: () => {}, list: null }

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
	home,
	sides,
	toast,
	titles,
	discover,
	explorer,
	taste,
	services,
	search,
	shows,
}: TvScreenProps) {
	const { state, focused, screenFocus, dispatch, ringOff, byPointer, unpoint } =
		tv
	const { screen } = state
	// The menu's items have the focus while it is open; the screen under it keeps showing its own.
	// The Expand key says where it leads.
	const expands = destinationName(screen, ctx)
	const expandLabel = destinationLabel(screen, ctx)
	// The navigation marks the screen on show; a member's home is Start.
	const here = hasNav(screen, ctx)
		? `nav:${screen.name === "home" ? "home" : screen.name}`
		: null
	const { member } = ctx
	const under = useMemo<TvView>(
		() => ({
			canvas,
			focused: screenFocus,
			dispatch,
			expands,
			expandLabel,
			here,
			member,
			ringOff,
			byPointer,
			unpoint,
		}),
		[
			canvas,
			screenFocus,
			dispatch,
			expands,
			expandLabel,
			here,
			member,
			ringOff,
			byPointer,
			unpoint,
		],
	)
	// The menu marks the screen on show.
	const menuHere = `menu:${screen.name}`
	const over = useMemo<TvView>(
		() => ({
			canvas,
			focused,
			dispatch,
			here: menuHere,
			member,
			ringOff,
			unpoint,
		}),
		[canvas, focused, dispatch, menuHere, member, ringOff, unpoint],
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
	// One of the person's own services is read out by its name when its screen opens.
	const onService =
		screen.name === "service"
			? services?.tiles.find((tile) => tile.service.id === screen.service)
					?.service
			: undefined
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
								home={home}
								member={ctx.member}
								sides={ctx.homeSides.length ? sides : undefined}
								titles={titles}
								discover={discover}
								explorer={explorer}
								taste={taste}
								services={services}
								search={search}
								shows={shows}
							/>
						</Layer>
					</TvViewProvider>
					{state.menuOpen && (
						<TvViewProvider value={over}>
							{/* Over everything of the screen under it: its focused tile and its bar's keys are raised, and a
							    key of the menu may lie under none of them. */}
							<Layer className="tvc-menu z-20">
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
				{state.power !== "on"
					? ""
					: onService
						? `On ${onService.name}`
						: SCREEN_NAME[screen.name]}
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
	home,
	member,
	sides,
	titles,
	discover,
	explorer,
	taste,
	services,
	search = NOT_TYPING,
	shows,
}: {
	screen: Screen
	items: readonly string[]
	apps: readonly TvAppTile[]
	home?: TvHomeData
	member: boolean
	sides?: readonly TvHomeSide[]
	titles?: TvTitleScreens
	discover?: TvDiscoverScreens
	explorer?: TvExplorerView | null
	taste?: TvTasteScreens
	services?: TvServiceScreens
	search?: TvSearchScreens
	shows?: TvShowsScreens
}): ReactNode {
	const first = <Bare items={items} />
	switch (screen.name) {
		case "home":
			return (
				<Home
					apps={apps}
					member={member}
					picks={titles?.tonight ?? home?.tonight ?? []}
					popular={home?.popular}
					waiting={titles?.waiting ?? false}
					failed={home?.homeFailed}
					services={services?.tiles}
					sides={sides}
					items={items}
				/>
			)
		case "about":
			return <AboutCode.Screen items={items} first={first} />
		case "tonight":
			return (
				<TonightCode.Screen
					items={items}
					picks={titles?.tonight ?? []}
					pick={screen.pick}
					mine={ownedServices(home, member)}
					waiting={titles?.waiting ?? true}
					failed={home?.homeFailed}
					first={first}
				/>
			)
		case "popular":
			return (
				<PopularCode.Screen
					items={items}
					popular={home?.popular}
					pick={screen.pick}
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
		// Slice 8: Taste, a side's screen and the quiz, once their data is there.
		case "taste":
			if (!taste) return first
			return (
				<TasteCode.Screen
					items={items}
					taste={taste.taste}
					side={screen.side}
					first={first}
				/>
			)
		case "quiz":
			if (!taste) return first
			return <QuizCode.Screen items={items} quiz={taste.quiz} first={first} />
		// Slice 6b: titles to watch on one streaming service.
		case "service":
			return (
				<ServiceCode.Screen
					items={items}
					screen={screen}
					own={services?.tiles.map((tile) => tile.service) ?? NO_SERVICES}
					list={services?.list ?? null}
					first={first}
				/>
			)
		// Slice 10: the line to type into without a query, the titles found with one.
		case "search":
			return (
				<SearchCode.Screen
					items={items}
					screen={screen}
					draft={search.draft}
					onDraft={search.onDraft}
					list={search.list}
					first={first}
				/>
			)
		// My shows (slice 9).
		case "shows":
			return (
				<ShowsCode.Screen
					items={items}
					shows={shows?.list ?? null}
					signal={shows?.signal ?? null}
					first={first}
				/>
			)
	}
}

/**
 * A screen whose code is on its way: its bar alone, so Back, Search and the menu work, and the Expand key where
 * the screen has one, so a focus that came back to it is on something.
 */
function Bare({ items }: { items: readonly string[] }) {
	return (
		<>
			<Shade dim={0.82} />
			<ExpandCorner items={items} />
			<CornerBar items={items} />
		</>
	)
}
