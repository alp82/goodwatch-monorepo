import { SearchJourneyProvider } from "~/ui/search/SearchJourney"
import { GuestProgressNotice } from "~/ui/GuestProgressNotice"
import { Outlet, useLocation } from "@remix-run/react"
import { Suspense, lazy } from "react"

import Footer from "~/ui/Footer"
import BottomNav from "~/ui/nav/BottomNav"
import {
	HubDialog,
	MobileDock,
	NavigationProvider,
	SearchDialog,
	SiteHeader,
} from "~/ui/navigation"
import { useUser } from "~/utils/auth"
import { useFeature } from "~/hooks/useFeature"
import { useInvalidateOnVisibility } from "~/hooks/useInvalidateOnVisibility"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { Measured } from "~/measure/ablation"

// The header while REC_NAVIGATION is off. Its menus bring the dialog library, so its code stays out of the pages
// that show the new navigation.
const Header = lazy(reloadOnStaleChunk(() => import("~/ui/main/Header")))

// Only members see the onboarding banner, so its code loads for them alone.
const AccountTransfer = lazy(
	reloadOnStaleChunk(() =>
		import("~/ui/onboarding/AccountTransfer").then((module) => ({
			default: module.AccountTransfer,
		})),
	),
)

function App() {
	const location = useLocation()
	const { user } = useUser()
	const navigation = useFeature("navigation")

	useInvalidateOnVisibility()

	const page = (
		<>
			<Measured name="sitenav" part="site_header">
			{navigation ? (
				<SiteHeader />
			) : (
				<Suspense fallback={null}>
					<Header />
				</Suspense>
			)}
			</Measured>
			{/* Show smart onboarding banner for logged-in users */}
			{user && (
				<Suspense fallback={null}>
					<AccountTransfer key={user.id} />
				</Suspense>
			)}
			<main className="relative grow mx-auto mt-16 pb-2 w-full text-neutral-300">
				<GuestProgressNotice />
				<Measured name="outlet"><Outlet /></Measured>
			</main>
			<Measured name="footer"><Footer /></Measured>
			<Measured name="sitenav" part="dock">
			{navigation ? (
				<>
					<MobileDock />
					<HubDialog />
					<SearchDialog />
				</>
			) : (
				<BottomNav />
			)}
			</Measured>
		</>
	)
	return navigation ? <NavigationProvider>{page}</NavigationProvider> : page
}

export default function AppWithSearch() {
	return <SearchJourneyProvider><App /></SearchJourneyProvider>
}
