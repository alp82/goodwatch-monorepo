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
} from "./kit"
import type { TvCanvas } from "./room-tv"
import {
	AboutCode,
	MenuCode,
	RateCode,
	TitleCode,
	TonightCode,
} from "./screen-code"
import { Home } from "./screens/Home"
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
}

export function TvScreen({
	tv,
	canvas,
	ctx,
	apps,
	toast,
	titles,
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
	const key = writeTvParams(screen).toString()
	const arrived = useRef({ first: key, moved: false })
	if (key !== arrived.current.first) arrived.current.moved = true

	const phone = canvas.edition === "phone"
	const items = tvItems(screen, ctx)
	return (
		<div className="tvc absolute inset-0 overflow-hidden">
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
			{toast && state.power === "on" && (
				// On the phone it stands over the last row, clear of the Expand key in the corner.
				<div
					className={`pointer-events-none absolute inset-x-0 z-30 flex justify-center ${phone ? "bottom-[88px]" : "bottom-8"}`}
				>
					<output className="tvc-toast">{toast}</output>
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
}: {
	screen: Screen
	items: readonly string[]
	apps: readonly TvAppTile[]
	titles?: TvTitleScreens
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
		// SEAM (slices 6 to 10): Discover, Explorer, Taste and the quiz, My shows and search each take their entry
		// here.
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
