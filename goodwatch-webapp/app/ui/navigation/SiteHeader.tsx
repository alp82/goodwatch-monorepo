// The site header. Desktop: the wordmark, the three area keys (Watch · Explore · Profile), the search field in the
// middle, and the avatar that opens the account menu (Sign in and Sign up for guests). Phones: the wordmark and the
// search key, plus Sign up for guests; the area keys and the avatar live in the dock (MobileDock.tsx).
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { Link, useLocation } from "@remix-run/react"
import { useMemo } from "react"
import type { SignalWords } from "~/domain/new-episodes-signal"
import { GuestKeys, HeaderAccountKey } from "~/ui/account/AccountKey"
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { GlobalLoading } from "~/ui/nav/GlobalLoading"
import { useUser } from "~/utils/auth"
import { useNavigation, usePathViewer } from "./NavigationContext"
import { HeaderSearchBar, Omnibox, holdKeyboardForSearch } from "./Search"
import { type AreaDef, areaKeys, litArea } from "./areas"
import { HEADER_BAR } from "./bar-layers"
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

/** Phones: search is a key in the header (the dock holds the areas). */
function PhoneSearchKey() {
	const navigation = useNavigation()
	return (
		<button
			type="button"
			onClick={() => {
				holdKeyboardForSearch()
				navigation.setSearchOpen(true)
			}}
			aria-haspopup="dialog"
			aria-label="Search titles, people, moods"
			className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/[0.06] text-amber-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
		>
			<MagnifyingGlassIcon className="h-5 w-5" aria-hidden />
		</button>
	)
}

/** The account slot: nothing while the sign-in check runs, the avatar for members, Sign in and Sign up for guests. */
function AccountSlot({ compact }: { compact?: boolean }) {
	const { user, loading } = useUser()
	if (loading) return <span className={compact ? "" : "size-10 shrink-0"} />
	if (user) return compact ? null : <HeaderAccountKey />
	return <GuestKeys compact={compact} />
}

export function SiteHeader() {
	const areas = useAreaKeys()
	return (
		// `data-site-header`: leaving the living room through its TV holds the header still (main.css).
		<div data-site-header className="fixed top-0 z-[1000] w-full text-gray-100">
			<GlobalLoading />
			<div
				className={`flex h-16 items-center gap-2.5 px-4 lg:hidden ${HEADER_BAR}`}
			>
				<Wordmark fontSize={20} />
				<span className="flex-1" />
				<PhoneSearchKey />
				<AccountSlot compact />
			</div>
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
