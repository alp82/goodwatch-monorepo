import {
	OAuthError,
	type OAuthTokenVerifier,
} from "@modelcontextprotocol/server"

/** #566 replaces this verifier with Better Auth JWKS verification. Verified sub maps to extra.userId. */
export const mcpAuthorization: OAuthTokenVerifier = {
	async verifyAccessToken() {
		throw new OAuthError("invalid_token", "MCP authorization is not configured")
	},
}
