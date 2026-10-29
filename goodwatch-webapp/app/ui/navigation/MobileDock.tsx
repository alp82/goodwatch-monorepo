// The phone dock (below the large breakpoint): the current page on the left, the raised round G key in the middle,
// and "Go to…" on the right. The whole bar is one button that opens the hub. For two pages after a person left the
// living room through its TV, the TV button stands in the left part instead (a key of its own, over the bar). A page's filter strip renders its complete dock through DockStrip; the G key then shrinks and drops into the row. The dock's height is published as
// --nav-dock-height so full-screen pages such as Explorer can keep clear of it.
import { ChevronUpIcon, Squares2X2Icon } from "@heroicons/react/24/solid"
import { useLocation } from "@remix-run/react"
import { type ReactNode, useEffect, useRef } from "react"
import { TvBackDockKey, useTvWayBack } from "~/ui/living-room/TvWayBackHost"
import { useNavigation } from "./NavigationContext"
import { GoodWatchMark, NewEpisodesMark } from "./bits"
import { currentDestination, getDestinations } from "./destinations"
import { useOpenerSignal } from "./useWhatsNew"

const HUB_LABEL = "Browse GoodWatch"

function DockButton({
	docked,
	leftFree,
}: { docked: boolean; leftFree: boolean }) {
	const navigation = useNavigation()
	const { pathname } = useLocation()
	const destinations = getDestinations()
	const here = currentDestination(pathname)
	const page = here ? destinations[here] : null
	const Icon = page?.icon ?? Squares2X2Icon
	const open = navigation.hubOpen
	// My shows and My movies are tiles inside the hub, so the key that opens the hub says that something is new there.
	const fresh = useOpenerSignal()
	const label = `${leftFree ? "" : `${page ? (page.here ?? page.label) : "Browse"}. `}Go to… ${HUB_LABEL}${page ? `, you're on ${page.label}` : ""}`
	return (
		<button
			type="button"
			onClick={() => navigation.setHubOpen(!open)}
			data-hub-key
			aria-expanded={open}
			aria-controls={open ? "site-hub" : undefined}
			aria-haspopup="dialog"
			aria-label={fresh ? `${label}. ${fresh.door}` : label}
			className="grid h-[72px] w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 text-left"
		>
			{/* The page's name gives its place to the TV button, which is laid over it (see MobileDock). */}
			<span
				aria-hidden
				className={`flex min-w-0 items-center gap-2 justify-self-start ${leftFree ? "invisible" : ""}`}
			>
				<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-amber-400">
					<Icon className="h-5 w-5" />
				</span>
				<b className="truncate text-[14px] text-gray-100">
					{page ? (page.here ?? page.label) : "Browse"}{" "}
				</b>
			</span>
			<span
				aria-hidden
				className={`relative flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#4b5563,#111827_70%)] transition-transform duration-200 motion-reduce:transition-none ${
					docked ? "h-14 w-14" : "-mt-[26px] h-16 w-16"
				} ${
					open
						? "scale-94 shadow-[0_0_0_2px_#fbbf24,0_0_0_6px_rgba(3,7,18,0.94),0_0_30px_rgba(245,158,11,0.4)]"
						: "shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_0_6px_rgba(3,7,18,0.94),0_12px_30px_-6px_rgba(0,0,0,0.9)]"
				}`}
			>
				<GoodWatchMark size={docked ? 26 : 30} />
				<NewEpisodesMark words={fresh} className="absolute top-0 right-0" />
			</span>
			<span
				aria-hidden
				className={`flex h-11 items-center gap-1.5 justify-self-end rounded-full pr-3 pl-4 text-[13.5px] font-bold ${open ? "bg-amber-500/20 text-amber-200" : "bg-white/[0.08] text-gray-100"}`}
			>
				Go to…
				<ChevronUpIcon className="h-4 w-4" />
			</span>
		</button>
	)
}

export function MobileDock({ strip }: { strip?: ReactNode } = {}) {
	const navigation = useNavigation()
	const dock = useRef<HTMLDivElement>(null)
	const docked = strip !== undefined
	const quiet = navigation.quietDock > 0
	const wayBack = useTvWayBack()

	useEffect(() => {
		const element = dock.current
		if (!element) return
		const root = document.documentElement
		const publish = () => {
			const height = element.getBoundingClientRect().height
			// The standalone dock is CSS-hidden while a page supplies its own complete dock.
			if (height || window.matchMedia("(min-width: 1024px)").matches)
				root.style.setProperty("--nav-dock-height", `${height}px`)
		}
		publish()
		const observer = new ResizeObserver(publish)
		observer.observe(element)
		return () => {
			observer.disconnect()
			root.style.removeProperty("--nav-dock-height")
		}
	}, [])

	return (
		<>
			{/* Keeps the end of the page clear of the fixed dock. */}
			{!docked && (
				<div
					aria-hidden
					className="lg:hidden"
					style={{ height: "var(--nav-dock-height, 72px)" }}
				/>
			)}
			<div
				ref={dock}
				data-mobile-dock
				data-mobile-dock-strip={docked || undefined}
				data-mobile-dock-standalone={!docked || undefined}
				className={`fixed inset-x-0 bottom-0 z-50 rounded-t-3xl pb-[env(safe-area-inset-bottom)] text-gray-100 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] lg:hidden ${
					quiet ? "bg-gray-950" : "bg-gray-950/94 backdrop-blur-xl"
				}`}
			>
				{docked && (
					<div className="flex items-end gap-1.5 px-2.5 pt-2.5 pb-2">
						{strip}
					</div>
				)}
				<nav
					aria-label="Site"
					className={`relative transition-opacity duration-150 motion-reduce:transition-none ${
						quiet ? "pointer-events-none opacity-0" : ""
					}`}
					{...(quiet && { inert: "" })}
				>
					<DockButton docked={docked} leftFree={Boolean(wayBack)} />
					{wayBack && (
						// From the dock's edge to just short of the round key.
						<div className="absolute top-1/2 left-3 flex max-w-[calc(50%-52px)] -translate-y-1/2">
							<TvBackDockKey wayBack={wayBack} />
						</div>
					)}
				</nav>
			</div>
		</>
	)
}

/**
 * Asks the phone dock to step back while `active`: its keys fade out (opacity only), can't be focused or pressed, and
 * the dock turns opaque, so nothing of it (the raised G key above all) shows past a page's own sheets or bars laid
 * over it. Several callers count up and down, like DockStrip; the dock is back once none is active.
 */
export function useQuietDock(active: boolean) {
	const { setQuietDock } = useNavigation()
	useEffect(() => {
		if (!active) return
		setQuietDock((count) => count + 1)
		return () => setQuietDock((count) => count - 1)
	}, [active, setQuietDock])
}

/**
 * A page's phone controls, docked above the navigation (the slab). Desktop layouts keep their controls in the page:
 * the dock is hidden from the large breakpoint up.
 */
export function DockStrip({ children }: { children: ReactNode }) {
	// Portals cannot render on the server. Keep controls and navigation together from the first paint.
	// The dock is position: fixed, so no ancestor of a DockStrip may set transform, filter, backdrop-filter,
	// contain or will-change: any of these pins the dock to that ancestor instead of the viewport.
	return <MobileDock strip={children} />
}
