// Supabase sign-ins finish in the browser. Its auth server supplies the actual session and picture.
import type { ActionFunctionArgs } from "@remix-run/node"
import { legacyAvatarLogin } from "~/server/profile/legacy-avatar-login"
import { refreshProviderAvatar } from "~/server/profile/settings.server"
import { getUserFromRequest } from "~/utils/auth"

export async function action({ request }: ActionFunctionArgs) {
	return legacyAvatarLogin(
		request,
		process.env.BETTER_AUTH_ENABLED === "true",
		getUserFromRequest,
		refreshProviderAvatar,
	)
}
