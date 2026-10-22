import { createLocalJWKSet, jwtVerify } from "jose"
import type { createGoodwatchAuth } from "./auth.server.ts"
export interface OAuthResourcePolicy {
	resource: string
	clientId?: string
	requiredScopes?: string[]
}
/** Shared signature/audience plus durable user/client/consent revocation checks. */
export async function verifyOAuthResourceToken(
	token: string,
	policy: OAuthResourcePolicy,
	suppliedAuth?: ReturnType<typeof createGoodwatchAuth>,
) {
	const resource = policy.resource
	if (!resource) throw new Error("Resource missing")
	const auth =
		suppliedAuth ??
		(await (await import("./runtime.server.ts")).getBetterAuth())
	const context = await auth.$context
	const keys = await auth.api.getJwks()
	const { payload } = await jwtVerify(token, createLocalJWKSet(keys), {
		issuer: context.baseURL,
		audience: resource,
		algorithms: ["EdDSA"],
		typ: "at+jwt",
		requiredClaims: [
			"sub",
			"exp",
			"iat",
			"jti",
			"client_id",
			"scope",
			"gw_grant_id",
			"gw_grant_version",
		],
	})
	if (
		payload.aud !== resource ||
		typeof payload.sub !== "string" ||
		!payload.sub.trim() ||
		typeof payload.client_id !== "string" ||
		!payload.client_id.trim() ||
		typeof payload.gw_grant_id !== "string" ||
		typeof payload.gw_grant_version !== "string" ||
		payload.azp !== payload.client_id ||
		typeof payload.scope !== "string" ||
		typeof payload.exp !== "number" ||
		!Number.isSafeInteger(payload.exp) ||
		payload.cnf !== undefined
	)
		throw new Error("Invalid token claims")
	const clientId = payload.client_id
	const userId = payload.sub
	const scopes = payload.scope.split(" ").filter(Boolean)
	if (
		(policy.clientId && payload.client_id !== policy.clientId) ||
		!(policy.requiredScopes ?? []).every((scope) => scopes.includes(scope))
	)
		throw new Error("Wrong client or scope")
	const [user, client, consent] = await Promise.all([
		context.adapter.findOne<{ emailVerified: boolean }>({
			model: "user",
			where: [{ field: "id", value: userId }],
		}),
		context.adapter.findOne<{ disabled?: boolean }>({
			model: "oauthClient",
			where: [{ field: "clientId", value: clientId }],
		}),
		context.adapter.findOne<{
			id: string
			clientId: string
			userId: string
			grantVersion: string
			scopes: string[]
			resources?: string[]
			lastUsedAt?: Date
		}>({
			model: "oauthConsent",
			where: [{ field: "id", value: payload.gw_grant_id }],
		}),
	])
	if (
		!user?.emailVerified ||
		!client ||
		client.disabled ||
		!consent ||
		consent.clientId !== clientId ||
		consent.userId !== userId ||
		consent.grantVersion !== payload.gw_grant_version ||
		!consent.resources?.includes(resource) ||
		!scopes.every((scope) => consent.scopes.includes(scope))
	)
		throw new Error("Grant is no longer active")
	// Bound durable write frequency; conditional touch cannot resurrect a deleted grant.
	const now = new Date()
	if (
		(scopes.includes("mcp:read") || scopes.includes("yepwatch:read")) &&
		(!consent.lastUsedAt ||
			now.getTime() - new Date(consent.lastUsedAt).getTime() >= 60_000)
	) {
		const touched = await context.adapter.incrementOne({
			model: "oauthConsent",
			where: [
				{ field: "id", value: consent.id },
				{ field: "lastUsedAt", value: consent.lastUsedAt ?? null },
			],
			increment: {},
			set: { lastUsedAt: now },
		})
		if (!touched) {
			const current = await context.adapter.findOne<{
				scopes: string[]
				resources?: string[]
				grantVersion: string
			}>({
				model: "oauthConsent",
				where: [{ field: "id", value: consent.id }],
			})
			if (
				current?.grantVersion !== payload.gw_grant_version ||
				!current?.resources?.includes(resource) ||
				!scopes.every((scope) => current.scopes.includes(scope))
			)
				throw new Error("Grant changed during usage update")
		}
	}
	return {
		token,
		clientId,
		scopes,
		expiresAt: payload.exp,
		resource: new URL(resource),
		extra: { userId },
	}
}
