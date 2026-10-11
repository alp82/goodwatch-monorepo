// The phone dock (below the large breakpoint): the current page on the left, the raised round G key in the middle,
// and "Go to…" on the right. The whole bar is one button that opens the hub. A page's filter strip docks above it
// (the slab) through DockStrip; the G key then shrinks and drops into the row. The dock's height is published as
// --nav-dock-height so full-screen pages such as Explorer can keep clear of it.
import { ChevronUpIcon, Squares2X2Icon } from "@heroicons/react/24/solid"
import { useLocation } from "@remix-run/react"
import { type ReactNode, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useFeatures } from "~/hooks/useFeature"
import { useNavigation } from "./NavigationContext"
import { GoodWatchMark, NewEpisodesMark } from "./bits"
import { currentDestination, getDestinations } from "./destinations"
import { useNewEpisodes } from "./useNewEpisodes"

const HUB_LABEL = "Browse GoodWatch"

function DockButton({ docked }: { docked: boolean }) {
	const navigation = useNavigation()
	const { pathname } = useLocation()
	const destinations = getDestinations(useFeatures())
	const here = currentDestination(pathname)
	const page = here ? destinations[here] : null
	const Icon = page?.icon ?? Squares2X2Icon
	const open = Boolean(navigation?.hubOpen)
	// My shows is a tile inside the hub, so the key that opens the hub says that something is new there.
	const fresh = useNewEpisodes()
	const label = page ? `${HUB_LABEL}, you're on ${page.label}` : HUB_LABEL
	return (
		<button
			type="button"
			onClick={() => navigation?.setHubOpen(!open)}
			aria-expanded={open}
			aria-controls={open ? "site-hub" : undefined}
			aria-haspopup="dialog"
			aria-label={fresh ? `${label}. ${fresh.door}` : label}
			className="grid h-[72px] w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 text-left"
		>
			<span
				aria-hidden
				className="flex min-w-0 items-center gap-2 justify-self-start"
			>
				<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-amber-400">
					<Icon className="h-5 w-5" />
				</span>
				<b className="truncate text-[14px] text-gray-100">
					{page?.label ?? "Browse"}
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

export function MobileDock() {
	const navigation = useNavigation()
	const dock = useRef<HTMLDivElement>(null)
	const setStripTarget = navigation?.setStripTarget
	const docked = Boolean(navigation?.strips)

	useEffect(() => {
		const element = dock.current
		if (!element) return
		const root = document.documentElement
		const publish = () =>
			root.style.setProperty(
				"--nav-dock-height",
				`${element.getBoundingClientRect().height}px`,
			)
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
			<div
				aria-hidden
				className="lg:hidden"
				style={{ height: "var(--nav-dock-height, 72px)" }}
			/>
			<div
				ref={dock}
				className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-gray-950/94 pb-[env(safe-area-inset-bottom)] text-gray-100 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl lg:hidden"
			>
				<div
					ref={setStripTarget}
					className={
						docked ? "flex items-end gap-1.5 px-2.5 pt-2.5 pb-2" : "hidden"
					}
				/>
				<nav aria-label="Site">
					<DockButton docked={docked} />
				</nav>
			</div>
		</>
	)
}

/**
 * A page's phone controls, docked above the navigation (the slab). Renders nothing without the dock (REC_NAVIGATION
 * off for the viewer); `useHasDock` tells the page to place its controls itself then. Desktop layouts keep their
 * controls in the page: the dock is hidden from the large breakpoint up.
 */
export function DockStrip({ children }: { children: ReactNode }) {
	const navigation = useNavigation()
	const setStrips = navigation?.setStrips
	useEffect(() => {
		if (!setStrips) return
		setStrips((count) => count + 1)
		return () => setStrips((count) => count - 1)
	}, [setStrips])
	const target = navigation?.stripTarget
	return target ? createPortal(children, target) : null
}

/** Whether the phone dock is there to take a page's controls. */
export function useHasDock(): boolean {
	return Boolean(useNavigation())
}
