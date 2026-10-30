// The site header. Desktop: the wordmark, the three area keys (Watch · Explore · Profile), the search field in the
// middle, and the avatar that opens the account menu (Sign in and Sign up for guests). Phones: the page's own bar
// (PhoneBar.tsx: area label, title, the area's pages in a sheet); the area keys and the avatar live in the dock.
import { Link, useLocation } from "@remix-run/react"
import { useMemo } from "react"
import type { SignalWords } from "~/domain/new-episodes-signal"
import { GuestKeys, HeaderAccountKey } from "~/ui/account/AccountKey"
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { GlobalLoading } from "~/ui/nav/GlobalLoading"
import { useUser } from "~/utils/auth"
import { usePathViewer } from "./NavigationContext"
import { HeaderSearchBar, Omnibox } from "./Search"
import { type AreaDef, areaKeys, litArea } from "./areas"
import { PhoneBar } from "./PhoneBar"
import { HEADER_BAR, PHONE_BAR } from "./bar-layers"
import { NewEpisodesMark } from "./bits"
import { useOpenerSignal } from "./useWhatsNew"

export interface AreaKeyView extends AreaDef {
	on: boolean
	/** Watch: what is new for the member's shows and movies. */
	fresh?: SignalWords | null
}

/** The three area keys for this viewer and page, with the lit one and their marks. Shared with the dock. */
export function useAreaKeys(): AreaKeyView[] {
	const viewer = usePathViewer()
	const { pathname } = useLocation()
	const fresh = useOpenerSignal()
	const lit = litArea(pathname, viewer)
	return useMemo(
		() =>
			areaKeys(viewer).map((a) => ({
				...a,
				on: a.key === lit,
				fresh: a.key === "watch" ? fresh : undefined,
			})),
		[viewer, lit, fresh],
	)
}

function Wordmark({ fontSize }: { fontSize: number }) {
	return (
		<Link
			to="/"
			prefetch="intent"
			aria-label="GoodWatch home"
			className="flex shrink-0"
		>
			<GoodWatchWordmark fontSize={fontSize} />
		</Link>
	)
}

/** The three area keys in one segmented track, equal weight. */
function AreaKeys({ areas }: { areas: AreaKeyView[] }) {
	return (
		<nav
			aria-label="Areas"
			className="flex shrink-0 items-center gap-1 rounded-xl bg-white/[0.04] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
		>
			{areas.map((a) => {
				const Icon = a.on ? a.iconOn : a.icon
				return (
					<Link
						key={a.key}
						to={a.href}
						prefetch="intent"
						data-area-key={a.key}
						aria-current={a.on ? "true" : undefined}
						className={`relative flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[14.5px] font-bold ${
							a.on
								? "bg-amber-500/20 text-amber-200"
								: "text-gray-300 hover:bg-white/[0.07] hover:text-white"
						}`}
					>
						<Icon
							className={`h-[18px] w-[18px] ${a.on ? "text-amber-300" : "text-gray-500"}`}
							aria-hidden
						/>
						{a.label}
						<NewEpisodesMark
							words={a.fresh ?? null}
							className="absolute -top-2 -right-2"
						/>
					</Link>
				)
			})}
		</nav>
	)
}

/** The account slot: nothing while the sign-in check runs, the avatar for members, Sign in and Sign up for guests. */
function AccountSlot() {
	const { user, loading } = useUser()
	if (loading) return <span className="size-10 shrink-0" />
	if (user) return <HeaderAccountKey />
	return <GuestKeys />
}

export function SiteHeader() {
	const areas = useAreaKeys()
	return (
		// `data-site-header`: leaving the living room through its TV holds the header still (main.css).
		<div data-site-header className="fixed top-0 z-[1000] w-full text-gray-100">
			<GlobalLoading />
			{/* Phones: the bar that names the page and opens its area's pages (PhoneBar.tsx). It slides, so no blur. */}
			<PhoneBar surface={PHONE_BAR} />
			<header className={`hidden lg:block ${HEADER_BAR}`}>
				<div className="mx-auto flex h-16 max-w-7xl items-center gap-[18px] px-8">
					<Wordmark fontSize={30} />
					<AreaKeys areas={areas} />
					<div className="flex min-w-0 flex-1 justify-center">
						<div className="hidden xl:block">
							<Omnibox />
						</div>
						<div className="flex w-full max-w-[400px] min-w-0 xl:hidden">
							<HeaderSearchBar />
						</div>
					</div>
					<AccountSlot />
				</div>
			</header>
		</div>
	)
}
