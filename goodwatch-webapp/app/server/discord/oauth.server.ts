import { randomBytes } from "node:crypto"
export class DiscordStateError extends Error {}
export const STATE_TTL_SECONDS = 600
export const STATE_COOKIE = "gw_discord_state"
export const appOrigin = () => process.env.APP_ORIGIN || "https://goodwatch.app"
export function requireLinkOrigin(request: Request) {
	if (request.headers.get("Origin") !== appOrigin())
		throw new Response("Invalid origin", { status: 403 })
}
export const callbackUri = () =>
	new URL("/discord/link/callback", appOrigin()).href
export interface StateStore {
	put: (key: string, value: string, ttl: number) => Promise<void>
	take: (key: string) => Promise<string | null>
}
async function stateStore(): Promise<StateStore> {
	const { getRedisCluster } = await import("../../utils/cache.ts")
	const redis = getRedisCluster()
	if (!redis)
		throw new Error("Linking is temporarily unavailable. Please try again.")
	return {
		put: async (key, value, ttl) => {
			await redis.set(key, value, "EX", ttl)
		},
		// GET + DEL must be atomic even with concurrent callbacks (GETDEL requires newer Valkey).
		take: async (key) =>
			(await redis.eval(
				"local v = redis.call('GET', KEYS[1]); redis.call('DEL', KEYS[1]); return v",
				1,
				key,
			)) as string | null,
	}
}
const key = (state: string) => `discord:oauth:state:v1:${state}`
export function stateCookie(value: string, maxAge = STATE_TTL_SECONDS) {
	return `${STATE_COOKIE}=${value}; Path=/discord/link; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
		new URL(appOrigin()).protocol === "https:" ? "; Secure" : ""
	}`
}
function cookieState(request: Request) {
	return request.headers
		.get("Cookie")
		?.split(";")
		.map((v) => v.trim())
		.find((v) => v.startsWith(`${STATE_COOKIE}=`))
		?.slice(STATE_COOKIE.length + 1)
}
export async function createState(
	userId: string,
	store?: StateStore,
	now = Date.now(),
) {
	const state = randomBytes(32).toString("base64url")
	const browser = randomBytes(32).toString("base64url")
	await (store ?? (await stateStore())).put(
		key(state),
		JSON.stringify({
			userId,
			browser,
			expires: now + STATE_TTL_SECONDS * 1000,
		}),
		STATE_TTL_SECONDS,
	)
	return { state, cookie: stateCookie(browser) }
}
export async function consumeState(
	request: Request,
	userId: string | undefined,
	store?: StateStore,
	now = Date.now(),
) {
	const state = new URL(request.url).searchParams.get("state") ?? ""
	if (!/^[\w-]{43}$/.test(state))
		throw new DiscordStateError(
			"This Discord link has expired. Please try again.",
		)
	const raw = await (store ?? (await stateStore())).take(key(state))
	if (!raw)
		throw new DiscordStateError(
			"This Discord link has expired or was already used. Please try again.",
		)
	const saved = JSON.parse(raw)
	if (saved.expires <= now)
		throw new DiscordStateError(
			"This Discord link has expired. Please try again.",
		)
	if (!userId || saved.userId !== userId)
		throw new DiscordStateError(
			"Sign in to the same GoodWatch account and try again.",
		)
	if (!cookieState(request) || cookieState(request) !== saved.browser)
		throw new DiscordStateError(
			"Use the same browser to link Discord. Please try again.",
		)
}
export function authorizeUrl(state: string) {
	const url = new URL("https://discord.com/oauth2/authorize")
	url.search = new URLSearchParams({
		client_id: process.env.DISCORD_APP_ID ?? "",
		response_type: "code",
		scope: "identify",
		redirect_uri: callbackUri(),
		state,
	}).toString()
	return url.href
}
/** Keep tokens local to this call; neither provider bodies nor codes appear in errors or logs. */
export async function discordIdentity(
	code: string,
	fetcher: typeof fetch = fetch,
) {
	const response = await fetcher("https://discord.com/api/v10/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: process.env.DISCORD_APP_ID ?? "",
			client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
			grant_type: "authorization_code",
			code,
			redirect_uri: callbackUri(),
		}),
		signal: AbortSignal.timeout(10_000),
	})
	if (!response.ok)
		throw new Error("Discord could not complete sign-in. Please try again.")
	const token = await response.json()
	if (typeof token.access_token !== "string")
		throw new Error("Discord could not complete sign-in. Please try again.")
	try {
		const me = await fetcher("https://discord.com/api/v10/users/@me", {
			headers: { Authorization: `Bearer ${token.access_token}` },
			signal: AbortSignal.timeout(10_000),
		})
		if (!me.ok)
			throw new Error("Discord could not read your account. Please try again.")
		const user = await me.json()
		if (
			typeof user.id !== "string" ||
			!/^\d+$/.test(user.id) ||
			typeof user.username !== "string"
		)
			throw new Error("Discord could not read your account. Please try again.")
		return { id: user.id as string, username: user.username as string }
	} finally {
		try {
			await fetcher("https://discord.com/api/v10/oauth2/token/revoke", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: process.env.DISCORD_APP_ID ?? "",
					client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
					token: token.access_token,
					token_type_hint: "access_token",
				}),
				signal: AbortSignal.timeout(10_000),
			})
		} catch {
			// Revocation is best effort; account identification already completed.
		}
	}
}
