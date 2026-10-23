import { Suspense, lazy, useEffect, useState } from "react"
import { useUser } from "~/utils/auth"
import {
	useGuestInteractions,
	guestLimitEvent,
	reminderKey,
} from "~/utils/guest-progress"
import { Link } from "@remix-run/react"
import { STRIP_BUTTON, STRIP_QUIET, SiteStrip } from "~/ui/site-strip/SiteStrip"
import { useAuthHref } from "~/utils/auth-href"
import { useOpenedOnce } from "~/utils/first-use"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

// The dialog shows after a guest's 20th rating. Its code, with the dialog library, loads then.
const GuestLimitDialog = lazy(
	reloadOnStaleChunk(() => import("~/ui/GuestLimitDialog")),
)

export function GuestProgressNotice() {
	const { user } = useUser()
	const interactions = useGuestInteractions()
	const [dismissed, setDismissed] = useState(true)
	const [limit, setLimit] = useState(false)
	useEffect(() => {
		try {
			setDismissed(localStorage.getItem(reminderKey) === "yes")
		} catch {
			setDismissed(false)
		}
		const show = () => setLimit(true)
		window.addEventListener(guestLimitEvent, show)
		return () => window.removeEventListener(guestLimitEvent, show)
	}, [user?.id])
	const limitShown = useOpenedOnce(limit)
	const authHref = useAuthHref()
	if (user) return null
	const message =
		"Your ratings, Wishlist and skips are saved in this browser. Clearing browser data can erase them. Create an account to keep your progress and country/services across visits and devices."
	return (
		<>
			{!dismissed &&
				interactions.filter((i) => i.type === "score").length >= 10 && (
					<SiteStrip
						label="Keep your progress"
						title="Your ratings, Wishlist and skips are saved in this browser."
						actions={
							<>
								<Link
									rel="nofollow"
									to={authHref("sign-up")}
									className={STRIP_BUTTON}
								>
									Create account
								</Link>
								<button
									type="button"
									onClick={() => {
										setDismissed(true)
										try {
											localStorage.setItem(reminderKey, "yes")
										} catch {}
									}}
									className={STRIP_QUIET}
								>
									Dismiss
								</button>
							</>
						}
					>
						Clearing browser data can erase them. Create an account to keep your
						progress and country/services across visits and devices.
					</SiteStrip>
				)}
			{limitShown && (
				<Suspense fallback={null}>
					<GuestLimitDialog
						open={limit}
						onClose={() => setLimit(false)}
						message={message}
					/>
				</Suspense>
			)}
		</>
	)
}
