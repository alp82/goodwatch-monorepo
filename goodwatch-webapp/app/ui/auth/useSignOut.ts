import { useQueryClient } from "@tanstack/react-query"
import { queryKeyUserData } from "~/routes/api.user-data"
import { queryKeyUserSettings } from "~/routes/api.user-settings.get"
import { useAuthClient } from "~/utils/auth-client"

/** Signs out: forgets the onboarding banner's state, ends the session, and drops the member's cached data. */
export function useSignOut() {
	const auth = useAuthClient()
	const queryClient = useQueryClient()
	return async () => {
		sessionStorage.removeItem("onboarding-banner-dismissed")

		const result = await auth.signOut()
		if (!result.ok) console.error(`Sign-out failed: ${result.failure}`)

		queryClient.removeQueries({ queryKey: queryKeyUserSettings })
		queryClient.removeQueries({ queryKey: queryKeyUserData })
	}
}
