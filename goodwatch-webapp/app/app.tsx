import { GuestProgressNotice } from "~/ui/GuestProgressNotice"
import { SignInAgainBanner } from "~/ui/auth/SignInAgainBanner"
import { Outlet, useLocation, useMatches } from "@remix-run/react"
import { Suspense, lazy, useEffect } from "react"

import { SiteChrome } from "~/ui/navigation"
import { TvWayBackHost } from "~/ui/living-room/TvWayBackHost"
import { WatchLogHost } from "~/ui/watch-log/WatchLogHost"
import { useUser } from "~/utils/auth"
import { STANDALONE } from "~/utils/standalone"
import { useInvalidateOnVisibility } from "~/hooks/useInvalidateOnVisibility"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { startLoaderCache } from "~/navigation/instant-navigation"
import { installLinkIntent } from "~/navigation/link-intent"

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
	member,
}: {
	member: boolean
}): Promise<unknown> {
	if (!member) return Promise.resolve()
	return Promise.race([
		// A failed load is not this function's to report: `lazy` asks again and handles it.
		loadAccountTransfer().catch(() => {}),
		new Promise((resolve) => setTimeout(resolve, SHELL_CODE_TIMEOUT_MS)),
	])
}

export default function App() {
	const location = useLocation()
	const { user } = useUser()
	const standalone = useMatches().some(
		(match) => (match.handle as { chrome?: string } | undefined)?.chrome === STANDALONE.chrome,
	)

	useInvalidateOnVisibility()
	// After hydration: the router exists, and the first page's data seeds the cache (docs/navigation-cache.md).
	useEffect(() => {
		startLoaderCache()
		installLinkIntent()
	}, [])

	if (standalone) return <Outlet />

	return (
		<SiteChrome
			afterHeader={
				// Show smart onboarding banner for logged-in users
				user && (
					<Suspense fallback={null}>
						<AccountTransfer key={user.id} />
					</Suspense>
				)
			}
			afterFooter={
				<>
					{/* Where a movie's Seen button hands its press: nothing renders or loads before the first one. */}
					<WatchLogHost />
					{/* The way back to the TV for a person who left the living room through it: nothing renders before that. */}
					<TvWayBackHost />
				</>
			}
		>
			<SignInAgainBanner />
			<GuestProgressNotice />
			<Outlet />
		</SiteChrome>
	)
}
