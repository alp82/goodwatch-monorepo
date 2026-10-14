import type { CleanedWhere } from "better-auth/adapters"

// #531, Better Auth 1.7.7. Signatures use logical names, AND only. Every
// delete hook's findMany pre-read is included below. Optional DB verification,
// preservation and rate-limit shapes are gated by the factory configuration.
const rules: Record<string, Record<string, string[]>> = {
	user: { findOne: ["id", "email"], update: ["id", "email"], findMany: ["id"], delete: ["id"], incrementOne: ["id+confirmationDigest"] },
	account: { findMany: ["providerId+accountId", "userId", "id"], findOne: ["userId+providerId+accountId"], updateMany: ["userId+providerId+accountId"], update: ["id"], delete: ["id"], deleteMany: ["userId"], incrementOne: ["id+password"] },
	session: { findOne: ["token", "id"], update: ["token"], findMany: ["token", "userId", "token:in", "userId+expiresAt:gt", "token:in+expiresAt:gt", "token+expiresAt:gt"], delete: ["token"], deleteMany: ["userId", "token:in"], updateMany: ["token+expiresAt:gt", "userId+expiresAt:gt", "token:in+expiresAt:gt"] },
	verification: { findOne: ["id"], findMany: ["identifier", "expiresAt:lt"], update: ["identifier"], consumeOne: ["id"], delete: ["id"], deleteMany: ["identifier", "expiresAt:lt"] },
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

export function assertAuthMutation(model: string, action: string, input: Record<string, any>) {
	const fail = () => { throw new Error(`Unsupported auth shape: ${model}.${action} values/options`) }
	if (action === "create") {
		const required: Record<string, string[]> = {
			user: ["id", "email"], account: ["providerId", "accountId", "userId"], session: ["token", "userId"],
			verification: ["id", "identifier", "value"], jwks: ["id", "publicKey", "privateKey"],
			oauthClient: ["clientId"], oauthResource: ["identifier"], oauthClientResource: ["clientId", "resourceId"],
			oauthConsent: ["clientId", "userId"], oauthAccessToken: ["token", "clientId"], oauthRefreshToken: ["token", "clientId"],
			oauthClientAssertion: ["id"], rateLimit: ["key"],
		}
		if ((required[model] ?? []).some(field => typeof input.data[field] !== "string" || !input.data[field].trim())) fail()
		if (model === "rateLimit" && (!Number.isSafeInteger(input.data.count) || !Number.isSafeInteger(input.data.lastRequest))) fail()
	}
	if (input.sortBy && !(model === "verification" && action === "findMany" && input.sortBy.field === "createdAt" && input.sortBy.direction === "desc")) fail()
	if (input.limit !== undefined && (!Number.isSafeInteger(input.limit) || input.limit < 1)) fail()
	if (input.offset !== undefined && (!Number.isSafeInteger(input.offset) || input.offset < 0)) fail()
	if (["update", "updateMany", "incrementOne"].includes(action)) {
		const data = action === "incrementOne" ? input.set ?? {} : input.update ?? {}
		if (!Object.keys(data).length && !Object.keys(input.increment ?? {}).length) fail()
		// #549: atomically consume only the newest email confirmation digest.
		if (model === "user" && action === "incrementOne" && (Object.keys(input.increment).length || Object.keys(data).some(field => !["confirmationDigest", "updatedAt"].includes(field)) || data.confirmationDigest !== null || typeof input.where.find((p: CleanedWhere) => p.field === "confirmationDigest")?.value !== "string")) fail()
		// #549: a legacy rehash must not overwrite a concurrent password change.
		if (model === "account" && action === "incrementOne" && (Object.keys(input.increment).length || Object.keys(data).some(field => !["password", "updatedAt"].includes(field)) || typeof data.password !== "string" || !data.password || !String(input.where.find((p: CleanedWhere) => p.field === "password")?.value ?? "").startsWith("$2"))) fail()
		if (model === "account" && ["id", "accountId", "userId"].some(field => field in data)) fail()
		if (model === "session" && ["id", "token", "userId"].some(field => field in data)) fail()
		const allowed = model === "oauthRefreshToken"
			? action === "update" ? ["rotationReplayResponse"] : action === "updateMany" ? ["revoked"] : ["revoked", "rotatedAt", "rotationReplayExpiresAt"]
			: model === "oauthAccessToken" ? ["revoked"] : undefined
		if (allowed && Object.keys(data).some(field => !allowed.includes(field))) fail()
		if (["oauthRefreshToken", "oauthAccessToken"].includes(model) && action !== "update" && (!(data.revoked instanceof Date) || !Number.isFinite(data.revoked.getTime()))) fail()
		if (model === "oauthRefreshToken" && action === "incrementOne" && Object.keys(input.increment ?? {}).length) fail()
		if (model === "rateLimit" && action === "incrementOne") {
			if (Object.keys(data).some(field => !["count", "lastRequest"].includes(field)) || !Number.isFinite(data.lastRequest)) fail()
			const reset = input.where.some((p: CleanedWhere) => p.field === "lastRequest" && p.operator === "lte")
			if (reset ? Object.keys(input.increment).length !== 0 || data.count !== 1 : input.increment.count !== 1 || Object.keys(input.increment).length !== 1 || "count" in data) fail()
		}
	}
}
