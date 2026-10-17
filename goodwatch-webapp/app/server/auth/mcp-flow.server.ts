import type { ConnectState, ConsentApp, ConsentView } from "../../utils/mcp-connect.ts"
import { isAddressedTo } from "../site-origin.server.ts"
import type { createGoodwatchAuth } from "./auth.server.ts"
import { betterAuthEnabled, loadAuthRuntime } from "./boot.server.ts"

export type { ConnectState, ConsentApp, ConsentView }

type AuthService = ReturnType<typeof createGoodwatchAuth>

/** The scopes a member can grant on the consent page. */
const GRANTABLE_SCOPES = new Set(["mcp:read", "mcp:write", "offline_access"])

// The consent page of an app connecting through MCP (#570): what it shows, and the member's answer. The provider sends
// the member here with a signed query; nothing in it is trusted before the signature is checked. The sign-in step is
// the site's own sign-in page (the provider's loginPage), which sends the same signed query along.

/** The security headers of the consent page. `request` names the callback that a redirect after the form may go to. */
export function consentHeaders(request: Request): Headers {
	const headers = new Headers({
		"Cache-Control": "private, no-store",
		// Chromium sends `Origin: null` on a form post under no-referrer; the action checks Origin.
		"Referrer-Policy": "strict-origin",
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "DENY",
	})
	let formAction = "'self'"
	try {
		const callback = new URL(new URL(request.url).searchParams.get("redirect_uri") ?? "")
		// Chromium applies form-action to the redirect after the post too. The callback is checked against the signature
		// before anything redirects there.
		formAction += ` ${["http:", "https:"].includes(callback.protocol) ? callback.origin : callback.protocol}`
	} catch {}
	headers.set("Content-Security-Policy", `form-action ${formAction}; frame-ancestors 'none'; base-uri 'none'`)
	return headers
}

// Better Auth's own code loads only when a connection request is checked: the sign-in page imports this module, and a
// server with BETTER_AUTH_ENABLED off never loads Better Auth.
async function verifyQuery(query: string, secret: string) {
	const { verifyOAuthQueryParams } = await import("@goodwatch/auth-stack/oauth-provider")
	return verifyOAuthQueryParams(query, secret)
}

async function checked(request: Request, auth: AuthService) {
	const query = new URL(request.url).search.slice(1)
	const context = await auth.$context
	if (!(await verifyQuery(query, context.secret)))
		return new Response("Invalid or expired connection request", { status: 400 })
	const canonicalOrigin = new URL(context.baseURL).origin
	if (!isAddressedTo(request, canonicalOrigin)) return new Response("Origin rejected", { status: 403 })
	if (request.method === "POST" && request.headers.get("Origin") !== canonicalOrigin)
		return new Response("Origin rejected", { status: 403 })
	const session = await auth.api.getSession({ headers: request.headers })
	return { query, context, canonicalOrigin, session, params: new URLSearchParams(query) }
}

/** The page's data, or the answer for a request that can't show it (a signed-out member goes to sign in). */
export async function loadMcpConsent(request: Request, auth: AuthService): Promise<ConsentView | Response> {
	const check = await checked(request, auth)
	if (check instanceof Response) return check
	const { params, context, session, canonicalOrigin } = check
	const restartUrl = `${canonicalOrigin}/api/auth/oauth2/authorize?${unsignedQuery(params)}`
	if (!session) return new Response(null, { status: 302, headers: { Location: `/sign-in?${check.query}` } })
	const clientId = params.get("client_id")
	if (!clientId) return new Response("Missing app", { status: 400 })
	const client = await context.adapter.findOne<{ name?: string; clientDiscoveryId?: string; disabled?: boolean }>({
		model: "oauthClient",
		where: [{ field: "clientId", value: clientId }],
	})
	if (!client || client.disabled) return new Response("Unknown app", { status: 400 })
	const scopes = (params.get("scope") ?? "").split(" ").filter(Boolean)
	return {
		app: describeApp({
			clientId,
			name: client.name,
			verified: client.clientDiscoveryId === "cimd",
			redirectUri: params.get("redirect_uri"),
		}),
		email: session.user.email,
		canChange: scopes.includes("mcp:write"),
		restartUrl,
	}
}

/** Allow or Deny: the provider answers with the app's callback, which the browser follows. */
export async function decideMcpConsent(request: Request, auth: AuthService): Promise<Response> {
	const check = await checked(request, auth)
	if (check instanceof Response) return check
	if (!check.session) return new Response("Sign in first", { status: 401 })
	const form = await request.formData()
	const decision = String(form.get("decision"))
	if (!["allow", "deny"].includes(decision)) return new Response("Choose Allow or Deny", { status: 400 })
	const requested = (check.params.get("scope") ?? "").split(" ").filter(Boolean)
	const access = form.get("access") ?? "read"
	if (decision === "allow" && !["read", "write"].includes(String(access)))
		return new Response("Choose read-only or read and change", { status: 400 })
	if (decision === "allow" && access === "write" && !requested.includes("mcp:write"))
		return new Response("This app did not request write access", { status: 400 })
	// Only narrow the signed request, using the provider's supported partial-consent parameter. Identity scopes
	// (openid, profile, email) are never granted: the page promises the app can't see the member's email address.
	const granted = requested.filter(
		(scope) => GRANTABLE_SCOPES.has(scope) && (scope !== "mcp:write" || access === "write"),
	)
	// Every MCP call needs mcp:read, so a grant without it would only issue a token that can't be used.
	if (decision === "allow" && !granted.includes("mcp:read"))
		return new Response("This app did not ask to see your GoodWatch", { status: 400 })
	const scope = granted.join(" ")
	const headers = new Headers(request.headers)
	headers.set("Content-Type", "application/json")
	headers.set("Accept", "application/json")
	headers.delete("Content-Length")
	const result = await auth.handler(
		new Request(`${check.context.baseURL}/oauth2/consent`, {
			method: "POST",
			headers,
			body: JSON.stringify({ accept: decision === "allow", oauth_query: check.query, scope }),
		}),
	)
	if (!result.ok || result.status === 302) return result
	const data = await result.json()
	if (typeof data.url !== "string") return new Response("Connection could not continue", { status: 503 })
	const redirects = new Headers({ Location: data.url })
	const { setCookiesOf } = await import("./auth.server.ts")
	for (const cookie of setCookiesOf(result.headers)) redirects.append("Set-Cookie", cookie)
	return new Response(null, { status: 302, headers: redirects })
}

/** The app's original authorization request: the signed query without its signature and timing. */
export function unsignedQuery(params: URLSearchParams): string {
	const original = new URLSearchParams(params)
	for (const key of ["sig", "exp", "ba_iat", "ba_pl", "ba_param"]) original.delete(key)
	return original.toString()
}

/** Names and marks for the apps members connect most; any other app shows the name it gave. */
export function describeApp(input: {
	clientId: string
	name?: string | null
	verified: boolean
	redirectUri?: string | null
}): ConsentApp {
	const name = input.name?.trim() || "An app"
	let returnsTo = ""
	try {
		const callback = new URL(input.redirectUri ?? "")
		returnsTo = ["127.0.0.1", "localhost", "[::1]"].includes(callback.hostname) ? "this computer" : callback.hostname
	} catch {}
	let host = ""
	try {
		// A published client's id is the address of its details (CIMD).
		if (input.verified) host = new URL(input.clientId).hostname
	} catch {}
	const lower = name.toLowerCase()
	const kind =
		input.verified && /claude code/.test(lower)
			? "claude-code"
			: input.verified && /claude/.test(lower)
				? "claude"
				: input.verified && /chatgpt|openai/.test(lower)
					? "chatgpt"
					: null
	return { name, host: host || returnsTo || "unknown", returnsTo: returnsTo || "the app", verified: input.verified, kind }
}

async function service() {
	if (!betterAuthEnabled()) throw new Response(null, { status: 404 })
	const { getBetterAuth } = await loadAuthRuntime()
	try {
		return await getBetterAuth()
	} catch {
		throw new Response("Connection is temporarily unavailable", {
			status: 503,
			headers: { "Cache-Control": "private, no-store" },
		})
	}
}

export async function mcpConsentLoader(request: Request) {
	return loadMcpConsent(request, await service())
}
export async function mcpConsentAction(request: Request) {
	return decideMcpConsent(request, await service())
}


/**
 * The app waiting for this sign-in, when the provider sent the member to the sign-in page with a signed query. Null for
 * an ordinary sign-in, a query whose signature doesn't hold, or with Better Auth off.
 */
export async function connectingApp(request: Request): Promise<ConnectState | null> {
	const params = new URL(request.url).searchParams
	const clientId = params.get("client_id")
	if (!params.has("sig") || !clientId) return null
	if (!betterAuthEnabled()) return null
	const { getBetterAuth } = await loadAuthRuntime()
	try {
		// Only what the signature covers: the provider lists those names in `ba_param`.
		const signed = new Set(params.getAll("ba_param"))
		const oauthQuery = new URLSearchParams(
			[...params].filter(([key]) => key === "sig" || key === "ba_param" || signed.has(key)),
		).toString()
		const context = await (await getBetterAuth()).$context
		if (!(await verifyQuery(oauthQuery, context.secret))) return null
		const client = await context.adapter.findOne<{ name?: string; clientDiscoveryId?: string; disabled?: boolean }>({
			model: "oauthClient",
			where: [{ field: "clientId", value: clientId }],
		})
		if (!client || client.disabled) return null
		return {
			app: describeApp({
				clientId,
				name: client.name,
				verified: client.clientDiscoveryId === "cimd",
				redirectUri: params.get("redirect_uri"),
			}),
			oauthQuery,
			continueUrl: `/api/auth/oauth2/authorize?${unsignedQuery(new URLSearchParams(oauthQuery))}`,
		}
	} catch {
		return null
	}
}
