// What a guest is told about their progress outside the rating flow: the limit dialog, when a score past the guest
// limit (~/domain/taste-rules) is given on a card or a title page. The rating flow never raises it: it shows its own
// locked panel (ui/rating-flow). The sign-up asks while rating are the flow's own, "only on value" (owner, October 28,
// 2026), so there is no strip about keeping progress.
import { Suspense, lazy, useEffect, useState } from "react"
import { useUser } from "~/utils/auth"
import { guestLimitEvent } from "~/utils/guest-progress"
import { useOpenedOnce } from "~/utils/first-use"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

// The dialog shows after a guest's 20th rating. Its code, with the dialog library, loads then.
const GuestLimitDialog = lazy(
	reloadOnStaleChunk(() => import("~/ui/GuestLimitDialog")),
)

const MESSAGE =
	"Your ratings, Wishlist and skips are saved in this browser. Clearing browser data can erase them. Create an account to keep your progress and country/services across visits and devices."

export function GuestProgressNotice() {
	const { user } = useUser()
	const [limit, setLimit] = useState(false)
	useEffect(() => {
		const show = () => setLimit(true)
		window.addEventListener(guestLimitEvent, show)
		return () => window.removeEventListener(guestLimitEvent, show)
	}, [])
	const limitShown = useOpenedOnce(limit)
	if (user || !limitShown) return null
	return (
		<Suspense fallback={null}>
			<GuestLimitDialog
				open={limit}
				onClose={() => setLimit(false)}
				message={MESSAGE}
			/>
		</Suspense>
	)
}
