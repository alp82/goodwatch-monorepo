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
import { WatchLogHost } from "~/ui/watch-log/WatchLogHost"
import { useUser } from "~/utils/auth"
import { useFeature } from "~/hooks/useFeature"
import { useInvalidateOnVisibility } from "~/hooks/useInvalidateOnVisibility"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

// The header while REC_NAVIGATION is off. Its menus bring the dialog library, so its code stays out of the pages
// that show the new navigation.
const loadHeader = reloadOnStaleChunk(() => import("~/ui/main/Header"))
const Header = lazy(loadHeader)

// Only members see the onboarding banner, so its code loads for them alone.
const loadAccountTransfer = reloadOnStaleChunk(() =>
	import("~/ui/onboarding/AccountTransfer").then((module) => ({
		default: module.AccountTransfer,
	})),
)
const AccountTransfer = lazy(loadAccountTransfer)

// How long hydration waits for the code below before it starts without it.
const SHELL_CODE_TIMEOUT_MS = 3000

/**
 * Loads the code of the lazy parts that the server rendered into this page's shell. The browser entry waits for it
 * before it hydrates. Without the wait, React hydrates the rest of the page first and leaves these parts for later.
 * Any urgent state change above them in that time (the search provider's first effects, a query's answer, the
 * sign-in client) makes React drop their server markup, render them again in the browser, and report React
 * error 421.
 * The conditions are the ones `App` renders by.
 */
export function loadShellCode({
	navigation,
	member,
}: {
	navigation: boolean
	member: boolean
}): Promise<unknown> {
	const loads: Promise<unknown>[] = []
	if (!navigation) loads.push(loadHeader())
	if (member) loads.push(loadAccountTransfer())
	if (!loads.length) return Promise.resolve()
	return Promise.race([
		// A failed load is not this function's to report: `lazy` asks again and handles it.
		Promise.all(loads).catch(() => {}),
		new Promise((resolve) => setTimeout(resolve, SHELL_CODE_TIMEOUT_MS)),
	])
}

function App() {
	const location = useLocation()
	const { user } = useUser()
	const navigation = useFeature("navigation")
	const tracking = useFeature("tracking")

	useInvalidateOnVisibility()

	const page = (
		<>
			{navigation ? (
				<SiteHeader />
			) : (
				<Suspense fallback={null}>
					<Header />
				</Suspense>
			)}
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
			{/* Where a movie's Seen button hands its press: nothing renders or loads before the first one. */}
			{tracking && <WatchLogHost />}
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
