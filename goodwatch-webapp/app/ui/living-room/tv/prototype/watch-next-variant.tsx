// PROTOTYPE (throwaway, dev only): two phone designs of Watch next to compare, on the real route with the real data.
//   ?variant=a  one pick at a time (the default)
//   ?variant=b  a compact strip of posters, paged by arrows
// The TV keeps unrelated parameters when it writes its address (tv-machine.ts, `writeTvParams`), so the key rides
// along while the person moves around the TV; the tab's sessionStorage keeps it too. A production build always
// draws variant A and never the switcher. Nothing here writes anything but this tab's sessionStorage.
import { useInRouterContext, useLocation } from "@remix-run/react"
import { useEffect, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { ROOM_ID } from "../../use-below-room"

export type WatchNextVariant = "a" | "b"

export const WATCH_NEXT_VARIANTS: readonly { key: WatchNextVariant; name: string }[] = [
	{ key: "a", name: "One pick at a time" },
	{ key: "b", name: "Poster strip" },
]

/** The comparison is on in development only: a production build never offers variant B. */
export const PROTOTYPE = import.meta.env.DEV

const STORE = "gw-proto-watch-next"
const listeners = new Set<() => void>()
let chosen: WatchNextVariant | null = null

const parse = (value: string | null): WatchNextVariant | null =>
	value === "a" || value === "b" ? value : null

function read(): WatchNextVariant | null {
	if (chosen) return chosen
	try {
		return parse(sessionStorage.getItem(STORE))
	} catch {
		return null
	}
}

function choose(variant: WatchNextVariant) {
	chosen = variant
	try {
		sessionStorage.setItem(STORE, variant)
	} catch {}
	// The address says it too, so the page can be shared. Without a navigation: the route's loader stays put, and
	// the router's own entry state is kept.
	const url = new URL(window.location.href)
	url.searchParams.set("variant", variant)
	window.history.replaceState(window.history.state, "", url)
	for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

/**
 * The variant on show: the address's `variant` first (so a shared link shows its variant, on the server too), then
 * what this tab chose last. A production build always shows A.
 */
const useSearch = () => useLocation().search

export function useWatchNextVariant(): WatchNextVariant {
	// The router's location where there is one (the page); none in a screen drawn by itself (the render tests). A
	// component is always drawn inside a router or always outside one, so the hooks keep their order.
	const search = useInRouterContext() ? useSearch() : ""
	const fromUrl = parse(new URLSearchParams(search).get("variant"))
	// The tab's choice is read after hydration only, so the server's HTML and the first render agree.
	const stored = useSyncExternalStore(subscribe, read, () => null)
	if (!PROTOTYPE) return "a"
	return chosen ?? fromUrl ?? stored ?? "a"
}

/**
 * The switcher: a small control at the room's bottom left, outside the TV's picture and beside the Remote, with the
 * variant on show. Its arrows and the arrow keys (only while it has the browser's focus) cycle the variants. It is
 * drawn into the room, so it leaves with it.
 */
export function WatchNextVariantSwitcher({ variant }: { variant: WatchNextVariant }) {
	const [room, setRoom] = useState<HTMLElement | null>(null)
	useEffect(() => setRoom(document.getElementById(ROOM_ID)), [])
	if (!PROTOTYPE || !room) return null
	const at = WATCH_NEXT_VARIANTS.findIndex((one) => one.key === variant)
	const step = (by: 1 | -1) =>
		choose(WATCH_NEXT_VARIANTS[(at + by + WATCH_NEXT_VARIANTS.length) % WATCH_NEXT_VARIANTS.length].key)
	const shown = WATCH_NEXT_VARIANTS[at]
	return createPortal(
		// biome-ignore lint/a11y/useSemanticElements: a prototype's control
		<div
			role="group"
			aria-label={`Prototype: Watch next variant ${shown.key.toUpperCase()}, ${shown.name}`}
			data-prototype-switcher
			className="absolute bottom-[68px] left-[3px] z-[60] flex select-none flex-col items-center gap-0.5 rounded-xl bg-fuchsia-600/95 px-1 py-1 text-white shadow-[0_6px_18px_rgba(0,0,0,.6)] ring-1 ring-white/50 [@media(orientation:landscape)_and_(max-height:540px)]:bottom-[8px] [@media(orientation:landscape)_and_(max-height:540px)]:left-[8px] [@media(orientation:landscape)_and_(max-height:540px)]:flex-row [@media(orientation:landscape)_and_(max-height:540px)]:px-2"
			// The arrow keys are the switcher's only while it has the focus: they never reach the TV from here, and the
			// TV keeps them everywhere else.
			onKeyDown={(e) => {
				if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
				e.preventDefault()
				e.stopPropagation()
				step(e.key === "ArrowRight" ? 1 : -1)
			}}
		>
			<span className="text-[9px] font-bold uppercase leading-none tracking-wide">Proto</span>
			<span className="flex gap-0.5">
				{WATCH_NEXT_VARIANTS.map((one) => (
					<button
						key={one.key}
						type="button"
						aria-pressed={one.key === variant}
						title={one.name}
						onClick={() => choose(one.key)}
						className={`h-[26px] w-[22px] rounded-md text-[13px] font-black ${one.key === variant ? "bg-white text-fuchsia-700" : "bg-black/25 text-white"}`}
					>
						{one.key.toUpperCase()}
					</button>
				))}
			</span>
			<span className="hidden whitespace-nowrap px-1 text-[11px] font-semibold [@media(orientation:landscape)_and_(max-height:540px)]:inline">
				Watch next: {shown.name}
			</span>
		</div>,
		room,
	)
}
