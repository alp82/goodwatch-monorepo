// The one-time "please sign in again" notice of the move to Better Auth (#534: variant A). It shows in a browser that
// still holds a Supabase sign-in from before, under the header of whatever page the member opened. Dismissing it, or
// following it to the sign-in page, removes that old sign-in, so it never comes back.
// Solid icons: their set is on every page already; the outline set would join the shell with every icon the site uses.
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link, useLocation, useRouteLoaderData } from "@remix-run/react"
import { useState } from "react"
import { useUser } from "~/utils/auth"
import { forgetSupabaseSignIn } from "~/utils/auth-cookie"
import { STRIP_BUTTON, STRIP_QUIET, SiteStrip } from "~/ui/site-strip/SiteStrip"

/** The sign-in page's `reason` when the member comes from this banner: it then says why. */
export const SIGN_IN_AGAIN_REASON = "new-sign-in"

// The root loader's answer stays the same until it runs again, which a navigation doesn't do: remember the dismissal.
let dismissed = false

const ACCOUNT_PAGES =
	/^\/(sign-in|sign-up|forgot-password|reset-password|verify-email)(\/|$)/

export function SignInAgainBanner() {
	const root = useRouteLoaderData("root") as
		| { signInAgain?: boolean }
		| undefined
	const { user } = useUser()
	const location = useLocation()
	const [hidden, setHidden] = useState(dismissed)
	if (
		!root?.signInAgain ||
		user ||
		hidden ||
		ACCOUNT_PAGES.test(location.pathname)
	)
		return null
	const close = () => {
		dismissed = true
		forgetSupabaseSignIn()
		setHidden(true)
	}
	const returnTo = location.pathname + location.search
	return (
		<SiteStrip
			label="Sign in again"
			lead={
				<ArrowPathIcon
					className="hidden h-6 w-6 shrink-0 text-amber-300 sm:block"
					aria-hidden="true"
				/>
			}
			title="GoodWatch has a new sign-in, so you were signed out once."
			actions={
				<>
					<Link
						to={`/sign-in?reason=${SIGN_IN_AGAIN_REASON}&redirectTo=${encodeURIComponent(returnTo)}`}
						rel="nofollow"
						onClick={close}
						className={STRIP_BUTTON}
					>
						Sign in
					</Link>
					<button
						type="button"
						onClick={close}
						className={`${STRIP_QUIET} px-2`}
						aria-label="Dismiss"
					>
						<XMarkIcon className="h-5 w-5" />
					</button>
				</>
			}
		>
			Everything you saved is still here.
		</SiteStrip>
	)
}
