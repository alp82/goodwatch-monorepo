import { Link } from "@remix-run/react"
import { useEffect, useState } from "react"
import { useUser } from "~/utils/auth"

// A failed email/OAuth callback can land on any discovery page, even when
// another account is already signed in. Keep the error visible until dismissed.
export function AuthCallbackError() {
	const { user } = useUser()
	const [error, setError] = useState<"email" | "auth" | null>(null)

	useEffect(() => {
		const readCallbackError = () => {
			const url = new URL(window.location.href)
			const hash = new URLSearchParams(url.hash.slice(1))
			const params = hash.has("error") ? hash : url.searchParams
			if (!params.has("error") || (!params.has("error_code") && !params.has("error_description"))) return

			setError(params.get("error_code") === "otp_expired" ? "email" : "auth")
			// Never echo provider text or tokens. Preserve unrelated discovery state.
			for (const key of ["error", "error_code", "error_description"]) params.delete(key)
			if (params === hash) url.hash = hash.toString()
			window.history.replaceState(window.history.state, "", url)
		}
		readCallbackError()
		window.addEventListener("hashchange", readCallbackError)
		return () => window.removeEventListener("hashchange", readCallbackError)
	}, [])

	if (!error) return null
	return (
		<div role="alert" className="border-b border-red-700 bg-red-950 px-4 py-3 text-sm text-white">
			<div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
				<div>
					<p className="font-semibold">{error === "email" ? "This email link is invalid or has expired." : "We couldn’t complete sign-in from that link."}</p>
					{user && <p>You are still signed in to your existing account. Sign out before trying the account you want to confirm.</p>}
					<p>{error === "email" ? "Sign in with the email and password you used to register to request a new confirmation email." : "Return to Sign In and try again."}</p>
					{!user && <Link to="/sign-in" className="mt-1 inline-block underline">Go to Sign In</Link>}
				</div>
				<button type="button" onClick={() => setError(null)} className="shrink-0 rounded border border-red-400 px-3 py-1">Dismiss</button>
			</div>
		</div>
	)
}
