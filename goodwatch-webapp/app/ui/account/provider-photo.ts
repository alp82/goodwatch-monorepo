// The sign-in provider's photo from the session, the one picture known before /api/account-summary answers.
import type { User } from "@supabase/auth-js"

export function providerPhoto(user: User | null | undefined): string | null {
	const url = user?.user_metadata?.avatar_url
	return typeof url === "string" && url ? url : null
}
