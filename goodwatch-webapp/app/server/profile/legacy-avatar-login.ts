import type { User } from "@supabase/auth-js"
import { fromThisSite } from "./request.server.ts"

// The member's trusted Google identity may carry a newer picture than their editable user metadata.
export async function legacyAvatarLogin(
	request: Request,
	betterAuth: boolean,
	session: (params: { request: Request; fresh: true }) => Promise<User | null>,
	refresh: (userId: string, signIn: { at: number; photo?: string | null }) => Promise<unknown>,
) {
	const headers = { "Cache-Control": "private, no-store" }
	if (request.method !== "POST") return new Response(null, { status: 405, headers })
	if (!fromThisSite(request)) return new Response(null, { status: 403, headers })
	if (betterAuth) return new Response(null, { status: 404, headers })
	const user = await session({ request, fresh: true })
	if (!user) return new Response(null, { status: 401, headers })
	const at = Date.parse(user.last_sign_in_at ?? "")
	if (Number.isFinite(at)) {
		const google = user.identities?.find((identity) => identity.provider === "google")
		await refresh(user.id, {
			at,
			photo: google ? (google.identity_data?.picture ?? null) : undefined,
		})
	}
	return new Response(null, { status: 204, headers })
}
