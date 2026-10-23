import { isDeepStrictEqual } from "node:util"
import type { createGoodwatchAuth } from "./auth.server.ts"
import {
	validateYepWatchOAuthConfig,
	YEPWATCH_READ_SCOPE,
	type YepWatchOAuthConfig,
} from "./yepwatch-oauth-policy.ts"

/** Explicit operator provisioning through the existing encrypted auth adapter. Never called during API startup. */
export async function ensureYepWatchClient(
	auth: ReturnType<typeof createGoodwatchAuth>,
	config: YepWatchOAuthConfig,
	apply = false
) {
	validateYepWatchOAuthConfig(config)
	const { adapter } = await auth.$context
	const where = [{ field: "clientId", value: config.clientId }]
	let client = await adapter.findOne<Record<string, unknown>>({
		model: "oauthClient",
		where,
	})
	const expected = {
		tokenEndpointAuthMethod: "none",
		redirectUris: config.redirectUris,
		scopes: [YEPWATCH_READ_SCOPE],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		requirePKCE: true,
		skipConsent: false,
		disabled: false,
	}
	function validate(value: Record<string, unknown>) {
		if (
			value.clientSecret ||
			Object.entries(expected).some(
				([key, v]) => !isDeepStrictEqual(value[key], v)
			)
		)
			throw new Error(
				"Existing YepWatch client differs; refusing to change live registration"
			)
	}
	if (client) validate(client)
	let resource = await adapter.findOne<{
		id: string
		disabled?: boolean
		allowedScopes?: string[]
	}>({
		model: "oauthResource",
		where: [{ field: "identifier", value: config.resource }],
	})
	if (
		resource &&
		(resource.disabled ||
			!resource.allowedScopes?.includes(YEPWATCH_READ_SCOPE))
	)
		throw new Error("Existing YepWatch resource is not enabled for read access")
	if (apply && !resource)
		resource = await adapter.create({
			model: "oauthResource",
			data: {
				identifier: config.resource,
				name: "YepWatch",
				allowedScopes: [YEPWATCH_READ_SCOPE],
				disabled: false,
				policyVersion: 1,
				dpopBoundAccessTokensRequired: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		})
	if (apply && !client) {
		client = await adapter.create({
			model: "oauthClient",
			data: {
				clientId: config.clientId,
				name: "YepWatch",
				uri: new URL(config.redirectUris[0]).origin,
				applicationType: "native",
				...expected,
				clientCredentialsScopes: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		})
		if (!client) throw new Error("Client creation failed")
		validate(client)
	}
	const linkWhere = resource
		? [
				{ field: "clientId", value: config.clientId },
				{ field: "resourceId", value: resource.id },
		  ]
		: null
	let link = linkWhere
		? await adapter.findOne({ model: "oauthClientResource", where: linkWhere })
		: null
	if (apply && !link && resource && client)
		link = await adapter.create({
			model: "oauthClientResource",
			data: {
				clientId: config.clientId,
				resourceId: resource.id,
				createdAt: new Date(),
			},
		})
	return {
		clientId: config.clientId,
		resource: config.resource,
		redirectUris: config.redirectUris,
		ready: Boolean(client && resource && link),
		clientExists: Boolean(client),
		resourceExists: Boolean(resource),
		linked: Boolean(link),
	}
}
