import { Suspense, lazy, useEffect, useState } from "react"
import { useUser } from "~/utils/auth"
import {
	useGuestInteractions,
	guestLimitEvent,
	reminderKey,
} from "~/utils/guest-progress"
import { SignInButton } from "~/ui/auth/SignInButton"
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
	if (user) return null
	const message =
		"Your ratings, Wishlist and skips are saved in this browser. Clearing browser data can erase them. Create an account to keep your progress and country/services across visits and devices."
	return (
		<>
			{!dismissed &&
				interactions.filter((i) => i.type === "score").length >= 10 && (
					<aside
						className="mx-auto max-w-7xl px-4 py-3 text-sm text-gray-300 flex flex-wrap items-center gap-3"
						aria-label="Keep your progress"
					>
						<p className="flex-1 min-w-48">{message}</p>
						<SignInButton />
						<button
							type="button"
							onClick={() => {
								setDismissed(true)
								try {
									localStorage.setItem(reminderKey, "yes")
								} catch {}
							}}
							className="underline"
						>
							Dismiss
						</button>
					</aside>
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
