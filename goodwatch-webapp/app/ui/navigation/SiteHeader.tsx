// The header while REC_NAVIGATION is on. Desktop: the wordmark, the Browse button (the current page's name away from
// Home) that opens the Browse panel, the omnibox, Tonight's pick, and the account slot. Phones: the mark, the page's
// name, and the account slot; everything else lives in the dock.
import { assetUrl } from "~/utils/asset-url"
import { ChevronDownIcon, Squares2X2Icon } from "@heroicons/react/24/solid"
import { Link, useLocation } from "@remix-run/react"
import { useFeatures } from "~/hooks/useFeature"
import logo from "~/img/goodwatch-logo-white.svg"
import { GlobalLoading } from "~/ui/nav/GlobalLoading"
import { useNavigation } from "./NavigationContext"
import { Omnibox } from "./Search"
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

export function SiteHeader() {
	const { pathname } = useLocation()
	const here = currentDestination(pathname)
	const destinations = getDestinations(useFeatures())
	const title = here && here !== "home" ? destinations[here].label : "GoodWatch"
	return (
		<div className="fixed top-0 z-[1000] w-full text-gray-100">
			<GlobalLoading />
			<div className="flex h-16 items-center gap-2.5 border-b border-white/[0.09] bg-gray-950/90 pr-2.5 pl-3.5 backdrop-blur-md lg:hidden">
				<Link to="/" prefetch="intent" aria-label="GoodWatch home">
					<img className="h-[25px] w-auto" src={assetUrl(logo)} alt="" />
				</Link>
				<span className="brand-header truncate text-[19px]">{title}</span>
				<span className="grow" />
				<AccountSlot compact />
			</div>
			<header className="hidden border-b border-white/[0.09] bg-gray-950/90 backdrop-blur-md lg:block">
				<div className="mx-auto flex h-16 max-w-7xl items-center gap-[18px] px-8">
					<Link
						to="/"
						prefetch="intent"
						className="flex shrink-0 items-baseline"
						aria-label="GoodWatch home"
					>
						<img className="h-7 w-auto" src={assetUrl(logo)} alt="" />
						<span
							aria-hidden
							className="brand-header ml-0.5 text-4xl text-gray-100"
						>
							oodWatch
						</span>
					</Link>
					<BrowseButton />
					<span className="grow" />
					<Omnibox />
					<TonightsPickThumb />
					<AccountSlot />
				</div>
			</header>
		</div>
	)
}
