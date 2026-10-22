/** Extra protected resource on the existing issuer, not a second issuer/account store. */
export const YEPWATCH_READ_SCOPE = "yepwatch:read" as const
export interface YepWatchOAuthConfig {
	resource: string
	clientId: string
	redirectUris: string[]
}
export function validateYepWatchOAuthConfig(
	config: YepWatchOAuthConfig,
): YepWatchOAuthConfig {
	const resource = new URL(config.resource)
	if (
		!config.clientId ||
		!config.redirectUris.length ||
		resource.search ||
		resource.hash ||
		resource.username ||
		resource.password ||
		!(
			resource.protocol === "https:" ||
			(resource.protocol === "http:" &&
				["127.0.0.1", "localhost", "[::1]"].includes(resource.hostname))
		)
	)
		throw new Error("Invalid YepWatch OAuth configuration")
	for (const value of config.redirectUris) {
		const u = new URL(value)
		if (
			u.username ||
			u.password ||
			u.search ||
			u.hash ||
			!["https:", "http:", "yepwatch:"].includes(u.protocol) ||
			(u.protocol === "http:" &&
				!["127.0.0.1", "localhost", "[::1]"].includes(u.hostname))
		)
			throw new Error("Invalid YepWatch redirect allowlist")
	}
	return config
}
/** Fail closed before provider parsing; provider still validates signed consent/code/PKCE and registration. */
export function assertYepWatchOAuthRequest(
	config: YepWatchOAuthConfig | undefined,
	path: string,
	value: Record<string, unknown>,
) {
	if (!config) return
	const data =
		typeof value.oauth_query === "string"
			? Object.fromEntries(new URLSearchParams(value.oauth_query))
			: value
	const resources = Array.isArray(data.resource)
		? data.resource
		: typeof data.resource === "string"
			? [data.resource]
			: []
	const scopes =
		typeof data.scope === "string" ? data.scope.split(" ").filter(Boolean) : []
	const own = data.client_id === config.clientId
	if (
		!own &&
		!resources.includes(config.resource) &&
		!scopes.includes(YEPWATCH_READ_SCOPE)
	)
		return
	if (
		!own ||
		resources.length !== 1 ||
		resources[0] !== config.resource ||
		scopes.some((s) => ![YEPWATCH_READ_SCOPE, "offline_access"].includes(s))
	)
		throw new Error("YepWatch client/resource/scope mismatch")
	if (path === "/oauth2/authorize" || path === "/oauth2/consent") {
		if (
			!scopes.includes(YEPWATCH_READ_SCOPE) ||
			data.code_challenge_method !== "S256" ||
			typeof data.code_challenge !== "string" ||
			!/^[A-Za-z0-9_-]{43}$/.test(data.code_challenge) ||
			typeof data.state !== "string" ||
			data.state.length < 32 ||
			!config.redirectUris.includes(String(data.redirect_uri))
		)
			throw new Error("Invalid YepWatch authorization intent")
	}
	if (
		path === "/oauth2/token" &&
		data.grant_type === "authorization_code" &&
		!config.redirectUris.includes(String(data.redirect_uri))
	)
		throw new Error("Invalid YepWatch token redirect")
}
export function yepwatchOAuthEnvironment(
	env: Record<string, string | undefined>,
): YepWatchOAuthConfig | undefined {
	if (
		!env.AUTH_YEPWATCH_RESOURCE &&
		!env.AUTH_YEPWATCH_CLIENT_ID &&
		!env.AUTH_YEPWATCH_REDIRECT_URIS
	)
		return
	if (
		!env.AUTH_YEPWATCH_RESOURCE ||
		!env.AUTH_YEPWATCH_CLIENT_ID ||
		!env.AUTH_YEPWATCH_REDIRECT_URIS
	)
		throw new Error("Incomplete YepWatch OAuth configuration")
	return validateYepWatchOAuthConfig({
		resource: env.AUTH_YEPWATCH_RESOURCE,
		clientId: env.AUTH_YEPWATCH_CLIENT_ID,
		redirectUris: env.AUTH_YEPWATCH_REDIRECT_URIS.split(",").map((s) =>
			s.trim(),
		),
	})
}
