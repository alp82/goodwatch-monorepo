import { SearchJourneyProvider } from "~/ui/search/SearchJourney"
import { GuestProgressNotice } from "~/ui/GuestProgressNotice"
import { Outlet, useLocation } from "@remix-run/react"
import { Suspense, lazy } from "react"

import Footer from "~/ui/Footer"
import Header from "~/ui/main/Header"
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
			{navigation ? <SiteHeader /> : <Header />}
			{/* Show smart onboarding banner for logged-in users */}
			{user && (
				<Suspense fallback={null}>
					<AccountTransfer key={user.id} />
				</Suspense>
			)}
			<main className="relative grow mx-auto mt-16 pb-2 w-full text-neutral-300">
				<GuestProgressNotice />
				<Outlet />
			</main>
			<Footer />
			{navigation ? (
				<>
					<MobileDock />
					<HubDialog />
					<SearchDialog />
				</>
			) : (
				<BottomNav />
			)}
		</>
	)
	return navigation ? <NavigationProvider>{page}</NavigationProvider> : page
}

export default function AppWithSearch() {
	return <SearchJourneyProvider><App /></SearchJourneyProvider>
}
