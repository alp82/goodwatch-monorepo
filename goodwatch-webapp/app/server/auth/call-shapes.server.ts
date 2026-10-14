import type { CleanedWhere } from "better-auth/adapters"

// #531, Better Auth 1.7.7. Signatures use logical names, AND only. Every
// delete hook's findMany pre-read is included below. Optional DB verification,
// preservation and rate-limit shapes are gated by the factory configuration.
const rules: Record<string, Record<string, string[]>> = {
	user: { findOne: ["id", "email"], update: ["id", "email"], findMany: ["id"], delete: ["id"] },
	account: { findMany: ["providerId+accountId", "userId", "id"], findOne: ["userId+providerId+accountId"], updateMany: ["userId+providerId+accountId"], update: ["id"], delete: ["id"], deleteMany: ["userId"] },
	session: { findOne: ["token", "id"], update: ["token"], findMany: ["token", "userId", "token:in", "userId+expiresAt:gt", "token:in+expiresAt:gt", "token+expiresAt:gt"], delete: ["token"], deleteMany: ["userId", "token:in"], updateMany: ["token+expiresAt:gt", "userId+expiresAt:gt", "token:in+expiresAt:gt"] },
	verification: { findOne: ["id"], findMany: ["identifier", "expiresAt:lt"], update: ["identifier"], consumeOne: ["id"], deleteMany: ["identifier", "expiresAt:lt"] },
	jwks: { findMany: [""], findOne: ["id"] },
	oauthClient: { findOne: ["clientId"], findMany: ["referenceId", "userId", "clientId:in"], update: ["clientId", "clientId+clientDiscoveryId"], delete: ["clientId"] },
	oauthResource: { findOne: ["identifier"], findMany: ["", "identifier:in"], update: ["identifier"], delete: ["identifier"] },
	oauthClientResource: { findOne: ["clientId+resourceId"], findMany: ["clientId", "clientId+resourceId:in"], deleteMany: ["clientId+resourceId"] },
	oauthConsent: { findOne: ["clientId+userId", "clientId+userId+referenceId", "id"], findMany: ["userId"], update: ["id"], delete: ["id"] },
	oauthAccessToken: { findOne: ["token"], findMany: ["sessionId"], delete: ["id", "token"], deleteMany: ["refreshId", "refreshId:in", "authorizationCodeId"], updateMany: ["id:in"] },
	oauthRefreshToken: { findOne: ["token"], findMany: ["sessionId", "clientId+userId"], deleteMany: ["authorizationCodeId", "clientId+userId"], updateMany: ["id:in"], incrementOne: ["id+revoked"], update: ["id"] },
	oauthClientAssertion: { findOne: ["id"] },
	rateLimit: { findMany: ["key"], incrementOne: ["key+lastRequest:lte", "key+lastRequest:gt+count:lt"], deleteMany: ["lastRequest:lt"] },
}

export type ShapeModes = { verification: boolean; rateLimit: boolean; preserveSessions: boolean }
const signature = (parts: string[]) => parts.map(p => p.includes(":") ? p : `${p}:eq`).sort().join("+")

export function assertAuthShape(model: string, action: string, where: CleanedWhere[], modes: ShapeModes) {
	const fail = () => { throw new Error(`Unsupported auth shape: ${model}.${action}`) }
	if (!(model in rules)) fail()
	if (model === "verification" && !modes.verification || model === "rateLimit" && !modes.rateLimit || model === "session" && action === "updateMany" && !modes.preserveSessions) fail()
	if (action === "create") { if (where.length) fail(); return }
	if (where.some(p => p.connector !== "AND" || p.mode !== "sensitive" || p.operator === "in" && !Array.isArray(p.value))) fail()
	if (new Set(where.map(p => p.field)).size !== where.length) fail()
	const patterns = [...(rules[model]?.[action] ?? [])]
	if (action === "findMany") patterns.push(...(rules[model].delete ?? []), ...(rules[model].deleteMany ?? []))
	if (!patterns.some(p => signature(p ? p.split("+") : []) === signature(where.map(p => `${p.field}:${p.operator}`)))) fail()
	if (model === "oauthRefreshToken" && action === "incrementOne" && where.find(p => p.field === "revoked")?.value !== null) fail()
	if (model === "account" && ["findOne", "updateMany"].includes(action)) {
		const values = Object.fromEntries(where.map(p => [p.field, p.value]))
		if (values.providerId !== "credential" || values.accountId !== values.userId) fail()
	}
}
