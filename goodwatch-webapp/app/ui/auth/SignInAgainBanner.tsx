// The one-time "please sign in again" notice of the move to Better Auth (#534: variant A). It shows in a browser that
// still holds a Supabase sign-in from before, under the header of whatever page the member opened. Dismissing it, or
// following it to the sign-in page, removes that old sign-in, so it never comes back.
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { Link, useLocation, useRouteLoaderData } from "@remix-run/react"
import { useState } from "react"
import { useUser } from "~/utils/auth"
import { forgetSupabaseSignIn } from "~/utils/auth-cookie"

/** The sign-in page's `reason` when the member comes from this banner: it then says why. */
export const SIGN_IN_AGAIN_REASON = "new-sign-in"

// The root loader's answer stays the same until it runs again, which a navigation doesn't do: remember the dismissal.
let dismissed = false

const ACCOUNT_PAGES = /^\/(sign-in|sign-up|forgot-password|reset-password|verify-email)(\/|$)/

export function SignInAgainBanner() {
	const root = useRouteLoaderData("root") as { signInAgain?: boolean } | undefined
	const { user } = useUser()
	const location = useLocation()
	const [hidden, setHidden] = useState(dismissed)
	if (!root?.signInAgain || user || hidden || ACCOUNT_PAGES.test(location.pathname)) return null
	const close = () => {
		dismissed = true
		forgetSupabaseSignIn()
		setHidden(true)
	}
	const returnTo = location.pathname + location.search
	return (
		<div className="border-b border-amber-700/60 bg-amber-950/80">
			<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
				<ArrowPathIcon className="hidden h-6 w-6 shrink-0 text-amber-400 sm:block" aria-hidden="true" />
				<p className="min-w-0 flex-1 basis-64 text-sm text-amber-50">
					<strong className="font-semibold">GoodWatch has a new sign-in, so you were signed out once.</strong> Everything you saved is still here.
				</p>
				<div className="flex items-center gap-2">
					<Link
						to={`/sign-in?reason=${SIGN_IN_AGAIN_REASON}&redirectTo=${encodeURIComponent(returnTo)}`}
						rel="nofollow"
						onClick={close}
						className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
					>
						Sign in
					</Link>
					<button type="button" onClick={close} className="cursor-pointer rounded-lg p-2 text-amber-200 hover:bg-amber-900" aria-label="Dismiss">
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>
			</div>
		</div>
	)
}
