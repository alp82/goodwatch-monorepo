// The header while REC_NAVIGATION is on. Desktop: the wordmark and the Browse button (the current page's name away
// from Home) that opens the Browse panel, the omnibox in the middle, Tonight's pick, and the account slot. Phones: the
// wordmark, a search bar that opens the hub, and the account slot; everything else lives in the dock.
import { ChevronDownIcon, Squares2X2Icon } from "@heroicons/react/24/solid"
import { Link, useLocation } from "@remix-run/react"
import { useFeatures } from "~/hooks/useFeature"
import { GlobalLoading } from "~/ui/nav/GlobalLoading"
import { useNavigation } from "./NavigationContext"
import { HeaderSearchBar, Omnibox } from "./Search"
import { AccountSlot, TonightsPickThumb } from "./bits"
import { currentDestination, getDestinations } from "./destinations"

function BrowseButton() {
	const navigation = useNavigation()
	const { pathname } = useLocation()
	const here = currentDestination(pathname)
	const destinations = getDestinations(useFeatures())
	const open = Boolean(navigation?.hubOpen)
	return (
		<button
			type="button"
			onClick={() => navigation?.setHubOpen(!open)}
			aria-expanded={open}
			aria-controls={open ? "site-hub" : undefined}
			aria-haspopup="dialog"
			className={`flex h-10 items-center gap-2 rounded-xl px-3.5 font-bold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] ${
				open
					? "bg-amber-500/20 text-amber-200"
					: "bg-white/[0.07] text-gray-100 hover:bg-white/[0.1]"
			}`}
		>
			<Squares2X2Icon className="h-[18px] w-[18px]" aria-hidden />
			{here && here !== "home" ? destinations[here].label : "Browse"}
			<ChevronDownIcon className="h-4 w-4" aria-hidden />
		</button>
	)
}

function Wordmark({ className }: { className: string }) {
	return (
		<Link
			to="/"
			prefetch="intent"
			aria-label="GoodWatch home"
			className={`brand-header shrink-0 leading-none text-gray-100 ${className}`}
		>
			Good<span className="text-amber-400">Watch</span>
		</Link>
	)
}

export function SiteHeader() {
	return (
		<div className="fixed top-0 z-[1000] w-full text-gray-100">
			<GlobalLoading />
			<div className="flex h-16 items-center gap-2.5 border-b border-white/[0.09] bg-gray-950/90 px-3.5 backdrop-blur-md lg:hidden">
				<Wordmark className="text-[20px]" />
				<HeaderSearchBar />
				<AccountSlot compact />
			</div>
			<header className="hidden border-b border-white/[0.09] bg-gray-950/90 backdrop-blur-md lg:block">
				<div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-[18px] px-8">
					<div className="flex items-center gap-[18px]">
						<Wordmark className="text-[30px]" />
						<BrowseButton />
					</div>
					<Omnibox />
					<div className="flex items-center justify-end gap-[18px]">
						<TonightsPickThumb />
						<AccountSlot />
					</div>
				</div>
			</header>
		</div>
	)
}
