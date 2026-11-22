import type { User } from "@supabase/auth-js"
import { googlePhotoUrl } from "./google-photo"
import { isHttpsUrl } from "./settings.server"

/** Only a provider-owned identity can introduce a Google URL for server-side downloading.
 * Existing choices predate local photo storage and still work before the next Google login. */
export async function providerPhotoForSettings(user: User, saved: string | null) {
	const metadata = user.user_metadata?.avatar_url
	if (isHttpsUrl(metadata) && !googlePhotoUrl(metadata)) return metadata
	if (process.env.BETTER_AUTH_ENABLED === "true") {
		const { linkedGooglePhoto } = await import("../auth/runtime.server.ts")
		return googlePhotoUrl(await linkedGooglePhoto(user.id)) ?? googlePhotoUrl(saved)
	}
	const google = user.identities?.find((identity) => identity.provider === "google")
	return googlePhotoUrl(google?.identity_data?.picture) ?? googlePhotoUrl(saved)
}
