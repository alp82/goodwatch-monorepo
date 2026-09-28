// The phone dock (below the large breakpoint): Tonight's pick on the left, the raised round hub key in the middle,
// and Search on the right. A page's filter strip docks above them (the slab) through DockStrip; the hub key then
// shrinks and drops into the row. The dock's height is published as --nav-dock-height so full-screen pages such as
// Explorer can keep clear of it.
import { useLocation } from "@remix-run/react"
import { type ReactNode, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useFeatures } from "~/hooks/useFeature"
import { useNavigation } from "./NavigationContext"
import { DockSearchKey } from "./Search"
import { GoodWatchMark, TonightsPickThumb } from "./bits"
import { currentDestination, getDestinations } from "./destinations"

function HubKey({ docked }: { docked: boolean }) {
	const navigation = useNavigation()
	const { pathname } = useLocation()
	const destinations = getDestinations(useFeatures())
	const here = currentDestination(pathname)
	const Icon = here ? destinations[here].icon : null
	const open = Boolean(navigation?.hubOpen)
	return (
		<button
			type="button"
			onClick={() => navigation?.setHubOpen(!open)}
			aria-expanded={open}
			aria-controls={open ? "site-hub" : undefined}
			aria-haspopup="dialog"
			aria-label="Browse GoodWatch"
			className={`flex flex-col items-center justify-center gap-0.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#4b5563,#111827_70%)] transition-transform duration-200 motion-reduce:transition-none ${
				docked ? "h-14 w-14" : "-mt-[26px] h-16 w-16"
			} ${
				open
					? "scale-94 shadow-[0_0_0_2px_#fbbf24,0_0_0_6px_rgba(3,7,18,0.94),0_0_30px_rgba(245,158,11,0.4)]"
					: "shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_0_6px_rgba(3,7,18,0.94),0_12px_30px_-6px_rgba(0,0,0,0.9)]"
			}`}
		>
			<GoodWatchMark size={24} />
			<small
				aria-hidden
				className="flex max-w-[58px] items-center gap-0.5 overflow-hidden text-[9px] font-bold whitespace-nowrap text-amber-400"
			>
				{Icon && <Icon className="h-3 w-3 shrink-0" />}
				{here ? destinations[here].short : "Browse"}
			</small>
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
				<nav
					aria-label="Site"
					className="grid h-[72px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3"
				>
					<TonightsPickThumb className="justify-self-start" />
					<HubKey docked={docked} />
					<DockSearchKey />
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
