// The phone dock (below the large breakpoint): the three area keys (Watch · Explore · Profile) in one track, and the
// avatar outside it, which opens the account menu as a bottom sheet (Sign in for guests). For two pages after a person
// left the living room through its TV, the TV button shows in a row above the keys. A page's filter strip renders its
// complete dock through DockStrip; the strip then sits above the keys. The dock's height is published as
// --nav-dock-height so full-screen pages such as Explorer can keep clear of it.
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect, useRef } from "react"
import { DockAccountKey, DockSignIn } from "~/ui/account/AccountKey"
import { TvBackDockKey, useTvWayBack } from "~/ui/living-room/TvWayBackHost"
import { useUser } from "~/utils/auth"
import { useNavigation } from "./NavigationContext"
import { useAreaKeys } from "./SiteHeader"
import { NewEpisodesMark } from "./bits"

function DockKeys() {
	const areas = useAreaKeys()
	const { user, loading } = useUser()
	const navigation = useNavigation()
	return (
		<div className="flex h-[76px] items-center gap-2 px-2">
			<div className="grid h-[62px] flex-1 grid-cols-3 gap-0.5 rounded-[22px] bg-white/[0.04] p-1 ring-1 ring-white/[0.07]">
				{areas.map((a) => {
					const Icon = a.on ? a.iconOn : a.icon
					return (
						<Link
							key={a.key}
							to={a.href}
							prefetch="intent"
							data-area-key={a.key}
							aria-current={a.on ? "true" : undefined}
							onClick={(event) => {
								// A second tap on the lit key opens the area's pages, as the top bar's title does.
								if (!a.on || !navigation.phoneRow) return
								event.preventDefault()
								navigation.setTabsOpen(true)
							}}
							className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] text-[12px] font-bold ${
								a.on
									? "bg-amber-500/15 text-amber-200"
									: "text-gray-400 active:bg-white/[0.06]"
							}`}
						>
							<span className="relative">
								<Icon
									className={`h-[22px] w-[22px] ${a.on ? "text-amber-300" : ""}`}
									aria-hidden
								/>
								<NewEpisodesMark
									words={a.fresh ?? null}
									className="absolute -top-2 -right-3.5"
								/>
							</span>
							<span className="truncate">{a.label}</span>
						</Link>
					)
				})}
			</div>
			{loading ? (
				<span className="h-[62px] w-[68px] shrink-0" />
			) : user ? (
				<DockAccountKey />
			) : (
				<DockSignIn />
			)}
		</div>
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
					style={{ height: "var(--nav-dock-height, 76px)" }}
				/>
			)}
			<div
				ref={dock}
				data-mobile-dock
				data-mobile-dock-strip={docked || undefined}
				data-mobile-dock-standalone={!docked || undefined}
				className={`fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)] text-gray-100 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] lg:hidden ${
					docked ? "rounded-t-3xl" : ""
				} ${quiet ? "bg-gray-950" : "bg-gray-950/94 backdrop-blur-xl"}`}
			>
				{docked && (
					<div className="flex items-end gap-1.5 px-2.5 pt-2.5 pb-1">
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
					{wayBack && (
						<div className="flex px-3 pt-2">
							<TvBackDockKey wayBack={wayBack} />
						</div>
					)}
					<DockKeys />
				</nav>
			</div>
		</>
	)
}

/**
 * Asks the phone dock to step back while `active`: its keys fade out (opacity only), can't be focused or pressed, and
 * the dock turns opaque, so nothing of it shows past a page's own sheets or bars laid
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
 * A page's phone controls, below lg. They sit in the page where the page puts them and scroll away with it: phones
 * keep two persistent bars only (the top bar and the dock), so nothing docks above the navigation any more.
 * Desktop layouts draw their own controls.
 */
export function DockStrip({ children }: { children: ReactNode }) {
	return (
		<div
			data-phone-controls
			className="mx-auto flex w-full max-w-7xl items-end gap-1.5 px-4 pt-3 sm:px-6 lg:hidden"
		>
			{children}
		</div>
	)
}
