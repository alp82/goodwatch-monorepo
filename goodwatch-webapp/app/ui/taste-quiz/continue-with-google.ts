// The one-press save: Continue with Google, then back to `returnTo`. The account transfer moves the guest's ratings
// to the account once the sign-in lands.
import { useCallback } from "react"
import { beginAuthentication } from "~/utils/account-transfer"
import { useSupabase } from "~/utils/auth"

export function useContinueWithGoogle() {
	const { supabase } = useSupabase()
	return useCallback(
		(returnTo: string) => {
			if (!supabase) return
			beginAuthentication("oauth", returnTo)
			supabase.auth.signInWithOAuth({
				provider: "google",
				options: { redirectTo: `${window.location.origin}${returnTo}` },
			})
		},
		[supabase],
	)
}
