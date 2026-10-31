// The phone dock (below the large breakpoint): Watch and Explore on the left, Profile (the member's avatar, name and
// handle) on the right, and the GoodWatch G raised over the middle, which opens the menu (the account menu for
// members; search, the main pages and Sign in for guests). The area keys don't navigate: each opens the sheet of its
// area's pages (PhoneBar.tsx draws it). For two pages after a person left the living room through its TV, the TV
// button shows in a row above the keys. The dock's height is published as --nav-dock-height so full-screen pages
// such as Explorer can keep clear of it.
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect, useRef } from "react"
import { DockMenuKey, ProfileKeyIcon } from "~/ui/account/AccountKey"
import { useAccountSummary } from "~/ui/account/useAccountSummary"
import { TvBackDockKey, useTvWayBack } from "~/ui/living-room/TvWayBackHost"
import { useUser } from "~/utils/auth"
import { useNavigation, usePathViewer } from "./NavigationContext"
import { areaSheetOf } from "./phone-bar"
import { type AreaKeyView, useAreaKeys } from "./SiteHeader"
import { NewEpisodesMark } from "./bits"

/** One area key. A tap opens the area's sheet of pages; the link stays for new tabs and for no-script. */
function DockAreaKey({ area, wide }: { area: AreaKeyView; wide?: boolean }) {
	const navigation = useNavigation()
	const { user } = useUser()
	const me = useAccountSummary()
	const Icon = area.on ? area.iconOn : area.icon
	const profile = area.key === "taste"
	const handle = wide && profile && user ? me.handle : null
	const viewer = usePathViewer()
	// An area without pages for this viewer (a guest's Profile) is a plain link.
	const sheet = area.on || areaSheetOf(area.key, area.href, viewer) !== null
	return (
		<Link
			to={area.href}
			prefetch="intent"
			data-area-key={area.key}
			aria-current={area.on ? "true" : undefined}
			aria-haspopup={sheet ? "dialog" : undefined}
			onClick={(event) => {
				if (!sheet || event.metaKey || event.ctrlKey || event.shiftKey) return
				event.preventDefault()
				navigation.openSheet(area.key)
			}}
			className={`flex h-full min-w-0 items-center justify-center rounded-[18px] font-bold ${
				wide ? "gap-2.5 px-2 text-[13px]" : "flex-col gap-0.5 text-[12px]"
			} ${area.on ? "bg-amber-500/15 text-amber-200" : "text-gray-400 active:bg-white/[0.06]"}`}
		>
			<span className="relative">
				{profile ? (
					<ProfileKeyIcon size={wide ? 30 : 24} on={area.on} fallback={Icon} />
				) : (
					<Icon
						className={`h-[22px] w-[22px] ${area.on ? "text-amber-300" : ""}`}
						aria-hidden
					/>
				)}
				<NewEpisodesMark
					words={area.fresh ?? null}
					className="absolute -top-2 -right-3.5"
				/>
			</span>
			{handle ? (
				<span className="flex min-w-0 flex-col items-start leading-tight">
					<span>{area.label}</span>
					<span className="max-w-full truncate text-[11px] font-medium text-gray-500">
						@{handle}
					</span>
				</span>
			) : (
				<span className="truncate">{area.label}</span>
			)}
		</Link>
	)
}

/** Watch · Explore · (the G's column) · Profile. Profile takes the right half, so the G sits in the screen's middle. */
function DockKeys() {
	const areas = useAreaKeys()
	const byKey = (key: string) => areas.find((a) => a.key === key)
	const watch = byKey("watch")
	const explore = byKey("explore")
	const profile = byKey("taste")
	return (
		<div className="relative flex h-[76px] items-center px-2">
			<div className="grid h-[62px] flex-1 grid-cols-[1fr_1fr_80px_2fr] items-center gap-0.5 rounded-[22px] bg-white/[0.04] p-1 ring-1 ring-white/[0.07]">
				{watch && <DockAreaKey area={watch} />}
				{explore && <DockAreaKey area={explore} />}
				<span aria-hidden />
				{profile && <DockAreaKey area={profile} wide />}
			</div>
			<DockMenuKey />
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
