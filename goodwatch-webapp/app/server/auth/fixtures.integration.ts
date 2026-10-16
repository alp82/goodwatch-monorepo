import type { BetterAuthOptions } from "@goodwatch/auth-stack"

// Logical plugin schema for adapter-boundary tests, pinned to #531's 1.7.7
// inventory. The auth/MCP wiring ticket supplies the actual plugins.
const pluginFields: Record<string, Record<string, string>> = {
 jwks: { publicKey: "string", privateKey: "string", createdAt: "date", expiresAt: "date", alg: "string", crv: "string" },
 oauthClient: { clientId: "string", clientDiscoveryId: "string", userId: "string", referenceId: "string", clientSecret: "string", disabled: "boolean", name: "string", createdAt: "date", updatedAt: "date" },
 oauthResource: { identifier: "string", name: "string", createdAt: "date", updatedAt: "date" },
 oauthClientResource: { clientId: "string", resourceId: "string", createdAt: "date" },
 oauthConsent: { clientId: "string", userId: "string", referenceId: "string", scopes: "string[]", resources: "string[]", createdAt: "date", updatedAt: "date" },
 oauthAccessToken: { token: "string", clientId: "string", userId: "string", sessionId: "string", referenceId: "string", authorizationCodeId: "string", refreshId: "string", revoked: "date", scopes: "string[]", resources: "string[]", createdAt: "date", expiresAt: "date" },
 oauthRefreshToken: { token: "string", clientId: "string", userId: "string", sessionId: "string", referenceId: "string", authorizationCodeId: "string", revoked: "date", rotatedAt: "date", rotationReplayExpiresAt: "date", rotationReplayResponse: "string", scopes: "string[]", resources: "string[]", createdAt: "date", expiresAt: "date" },
 oauthClientAssertion: { expiresAt: "date" },
 rateLimit: { key: "string", count: "number", lastRequest: "number" },
}
export const authTestOptions: BetterAuthOptions = {
 plugins: [{ id: "adapter-inventory-fixture", schema: Object.fromEntries(Object.entries(pluginFields).map(([model, fields]) =>
  [model, { fields: Object.fromEntries(Object.entries(fields).map(([field,type]) => [field, { type, required: false }])) }])) as any }],
}
