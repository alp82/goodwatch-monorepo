import {
	YEPWATCH_READ_SCOPE,
	validateYepWatchOAuthConfig,
	type YepWatchOAuthConfig,
} from "../auth/yepwatch-oauth-policy.ts"
import { verifyOAuthResourceToken } from "../auth/oauth-access.server.ts"
import { RoomError } from "./errors.ts"
import type { MemberIssuer } from "./continuous-members.server.ts"
import type { createGoodwatchAuth } from "../auth/auth.server.ts"
/** The existing central issuer owns login, consent, keys, codes and live grants. No MCP token fallback. */
export function centralMemberIssuer(
	config: YepWatchOAuthConfig & { issuerOrigin: string },
	auth?: ReturnType<typeof createGoodwatchAuth>,
	transport: typeof fetch = fetch,
): MemberIssuer {
	validateYepWatchOAuthConfig(config)
	const origin = new URL(config.issuerOrigin)
	if (
		origin.origin !== config.issuerOrigin ||
		origin.username ||
		origin.password ||
		!(
			origin.protocol === "https:" ||
			(origin.protocol === "http:" &&
				["127.0.0.1", "localhost"].includes(origin.hostname))
		)
	)
		throw new Error("Invalid central issuer origin")
	return {
		authorize({ state, challenge, redirectUri }) {
			if (!config.redirectUris.includes(redirectUri))
				throw new RoomError("invalid_request", "Callback not allowed", 400)
			const u = new URL("/api/auth/oauth2/authorize", origin)
			u.search = new URLSearchParams({
				response_type: "code",
				prompt: "consent",
				client_id: config.clientId,
				redirect_uri: redirectUri,
				scope: YEPWATCH_READ_SCOPE,
				resource: config.resource,
				state,
				code_challenge: challenge,
				code_challenge_method: "S256",
			}).toString()
			return u.href
		},
		async exchange({ code, verifier, redirectUri }) {
			if (!config.redirectUris.includes(redirectUri))
				throw new RoomError("invalid_request", "Callback not allowed", 400)
			const response = await transport(
				new URL("/api/auth/oauth2/token", origin),
				{
					method: "POST",
					headers: { "content-type": "application/x-www-form-urlencoded" },
					body: new URLSearchParams({
						grant_type: "authorization_code",
						client_id: config.clientId,
						redirect_uri: redirectUri,
						resource: config.resource,
						code,
						code_verifier: verifier,
					}),
					redirect: "error",
					signal: AbortSignal.timeout(12000),
				},
			)
			if (!response.ok)
				throw new RoomError(
					"unauthorized",
					"GoodWatch sign-in exchange failed; start sign-in again",
					401,
				)
			const value = (await response.json()) as {
				access_token?: unknown
				expires_in?: unknown
				token_type?: unknown
			}
			if (
				typeof value.access_token !== "string" ||
				typeof value.expires_in !== "number" ||
				value.expires_in <= 0 ||
				String(value.token_type).toLowerCase() !== "bearer"
			)
				throw new RoomError("unauthorized", "Invalid issuer response", 401)
			return {
				accessToken: value.access_token,
				expiresAt: Date.now() + value.expires_in * 1000,
			}
		},
		async verify(token) {
			try {
				const result = await verifyOAuthResourceToken(
					token,
					{
						resource: config.resource,
						clientId: config.clientId,
						requiredScopes: [YEPWATCH_READ_SCOPE],
					},
					auth,
				)
				return {
					userId: result.extra.userId,
					expiresAt: result.expiresAt * 1000,
				}
			} catch {
				throw new RoomError(
					"unauthorized",
					"GoodWatch grant is expired or revoked",
					401,
				)
			}
		},
	}
}
