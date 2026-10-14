import { OAuthError, type OAuthTokenVerifier } from "@modelcontextprotocol/server"
import { createLocalJWKSet, jwtVerify } from "jose"

/** Verify against this auth instance's durable public JWKS, then current member/client/consent. */
export const mcpAuthorization: OAuthTokenVerifier = {
 async verifyAccessToken(token) {
  try {
   const resource = process.env.MCP_RESOURCE_URL
   if (!resource) throw new Error("MCP resource missing")
   const {getBetterAuth} = await import("../auth/runtime.server.ts")
   const auth = await getBetterAuth()
   const context = await auth.$context
   const keys = await auth.api.getJwks()
   const {payload} = await jwtVerify(token, createLocalJWKSet(keys), {
    issuer: context.baseURL, audience: resource, algorithms: ["EdDSA"], typ: "at+jwt",
    requiredClaims: ["sub", "exp", "iat", "jti", "client_id", "scope"],
   })
   if (payload.aud !== resource || typeof payload.sub !== "string" || !payload.sub.trim() ||
    typeof payload.client_id !== "string" || !payload.client_id.trim() ||
    payload.azp !== payload.client_id || typeof payload.scope !== "string" ||
    !Number.isSafeInteger(payload.exp) || payload.cnf !== undefined) throw new Error("Invalid token claims")
   const clientId = payload.client_id
   const userId = payload.sub
   const scopes = payload.scope.split(" ").filter(Boolean)
   const [user, client, consent] = await Promise.all([
    context.adapter.findOne<{emailVerified: boolean}>({model: "user", where: [{field: "id", value: userId}]}),
    context.adapter.findOne<{disabled?: boolean}>({model: "oauthClient", where: [{field: "clientId", value: clientId}]}),
    context.adapter.findOne<{id: string; scopes: string[]; resources?: string[]; lastUsedAt?: Date}>({model: "oauthConsent", where: [
     {field: "clientId", value: clientId}, {field: "userId", value: userId},
    ]}),
   ])
   if (!user?.emailVerified || !client || client.disabled || !consent ||
    !consent.resources?.includes(resource) || !scopes.every(scope => consent.scopes.includes(scope)))
    throw new Error("Grant is no longer active")
   // Bound durable write frequency; conditional touch cannot resurrect a deleted grant.
   const now = new Date()
   if (scopes.includes("mcp:read") && (!consent.lastUsedAt || now.getTime() - new Date(consent.lastUsedAt).getTime() >= 60_000)) {
    const touched = await context.adapter.incrementOne({model: "oauthConsent", where: [
     {field: "id", value: consent.id}, {field: "lastUsedAt", value: consent.lastUsedAt ?? null},
    ], increment: {}, set: {lastUsedAt: now}})
    if (!touched) {
     const current = await context.adapter.findOne<{scopes: string[]; resources?: string[]}>({model: "oauthConsent", where: [{field: "id", value: consent.id}]})
     if (!current?.resources?.includes(resource) || !scopes.every(scope => current.scopes.includes(scope))) throw new Error("Grant changed during usage update")
    }
   }
   return {token, clientId, scopes, expiresAt: payload.exp!, resource: new URL(resource), extra: {userId}}
  } catch {
   // Do not expose JWT parsing, DB details, or identities to unauthenticated callers.
   throw new OAuthError("invalid_token", "MCP access token is invalid or no longer authorized")
  }
 },
}
