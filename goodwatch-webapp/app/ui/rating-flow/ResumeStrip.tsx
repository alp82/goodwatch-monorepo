import { usePathViewer } from "~/ui/navigation/NavigationContext"
import { ratePath } from "~/domain/member-paths"
// After sign-up a member lands back on the page they came from; this slim strip under the header offers to pick the
// rating flow up again while their taste isn't ready. One strip at a time (ui/site-strip): it shows only when no
// account transfer and no onboarding step is showing (ui/onboarding/AccountTransfer.tsx), never on the flow itself, and
// a dismissal is remembered in this browser.
import { Link, useLocation } from "@remix-run/react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { useUserData } from "~/routes/api.user-data"
import { STRIP_BUTTON, STRIP_QUIET, SiteStrip } from "~/ui/site-strip/SiteStrip"
import { useUser } from "~/utils/auth"
import {
	RESUME_DISMISSED_KEY,
	offersResume,
	resumeWords,
	tally,
} from "./flow"
import { WORDS } from "./words"

function readDismissed() {
	try {
		return localStorage.getItem(RESUME_DISMISSED_KEY) === "1"
	} catch {
		return false
	}
}

export function RatingResumeStrip({
	fallback = null,
	className = "",
}: {
	/** The strip to show when this one has nothing to offer. */
	fallback?: ReactNode
	className?: string
}) {
	const viewer = usePathViewer()
	const { user } = useUser()
	const { pathname } = useLocation()
	const { data } = useUserData()
	// Read in the browser only; until then the strip stays away rather than flash.
	const [dismissed, setDismissed] = useState(true)
	useEffect(() => setDismissed(readDismissed()), [])
	const scores = data?.scores
	const totals = useMemo(
		() =>
			user && scores ? tally(Object.values(scores).map((s) => s?.score)) : null,
		[user, scores],
	)
	if (!totals || !offersResume({ tally: totals, pathname, dismissed }))
		return <>{fallback}</>
	const dismiss = () => {
		setDismissed(true)
		try {
			localStorage.setItem(RESUME_DISMISSED_KEY, "1")
		} catch {
			// Storage is off: the strip stays away for this visit.
		}
	}
	return (
		<SiteStrip
			label={WORDS.resumeTitle}
			className={className}
			title={WORDS.resumeTitle}
			actions={
				<>
					<Link to={ratePath(viewer)} className={STRIP_BUTTON}>
						{WORDS.continueRating}
					</Link>
					<button type="button" onClick={dismiss} className={STRIP_QUIET}>
						{WORDS.dismiss}
					</button>
				</>
			}
		>
			· {resumeWords(totals)}
		</SiteStrip>
	)
}
