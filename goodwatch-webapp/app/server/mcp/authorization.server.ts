import { OAuthError, type OAuthTokenVerifier } from "@modelcontextprotocol/server"
import { verifyOAuthResourceToken } from "../auth/oauth-access.server.ts"
/** MCP policy stays MCP-only; YepWatch supplies its own resource/client/read scope. */
export const mcpAuthorization: OAuthTokenVerifier = {
 async verifyAccessToken(token) {
  try { return await verifyOAuthResourceToken(token, { resource: process.env.MCP_RESOURCE_URL ?? "" }) }
  catch { throw new OAuthError("invalid_token", "MCP access token is invalid or no longer authorized") }
 },
}
