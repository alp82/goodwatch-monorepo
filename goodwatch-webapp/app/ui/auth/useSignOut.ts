import { useNavigate } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeyUserData } from "~/routes/api.user-data"
import { queryKeyUserSettings } from "~/routes/api.user-settings.get"
import { useAccountSummary } from "~/ui/account/useAccountSummary"
import { SIGNED_OUT_NAME_KEY } from "~/ui/tv-egg/signed-out-name"
import { useAuthClient } from "~/utils/auth-client"

/**
 * Signs out: forgets the onboarding banner's state, ends the session, drops the member's cached data, and goes to
 * the signed-out page, which says good night with the member's handle.
 */
export function useSignOut() {
	const auth = useAuthClient()
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const { handle } = useAccountSummary()
	return async () => {
		sessionStorage.removeItem("onboarding-banner-dismissed")

		const result = await auth.signOut()
		if (!result.ok) console.error(`Sign-out failed: ${result.failure}`)

		queryClient.removeQueries({ queryKey: queryKeyUserSettings })
		queryClient.removeQueries({ queryKey: queryKeyUserData })

		if (!result.ok) return
		try {
			if (handle) sessionStorage.setItem(SIGNED_OUT_NAME_KEY, handle)
		} catch {
			// Without storage the page says good night without a name.
		}
		navigate("/signed-out")
	}
}
