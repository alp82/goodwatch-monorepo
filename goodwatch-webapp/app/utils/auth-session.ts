import type { User } from "@supabase/auth-js"
import { createServerClient, parse, serialize } from "@supabase/ssr"
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose"
import { authCookieName, hasAuthCookie } from "./auth-cookie.ts"
import { fetchWithBackendTimeout, timeoutSetting, withBackendTimeout } from "./backend-timeout.ts"

export const SUPABASE_TIMEOUT_DEFAULT_MS = 5000

export function authFetch(signal?: AbortSignal): typeof fetch {
	return (input, init) => {
		const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
		return fetchWithBackendTimeout("Supabase auth", timeoutSetting("SUPABASE_TIMEOUT_MS", SUPABASE_TIMEOUT_DEFAULT_MS), input, {
			...init,
			signal: signal && callerSignal ? AbortSignal.any([signal, callerSignal]) : signal ?? callerSignal,
		})
	}
}

export type SessionSource = "none" | "memo" | "local" | "server"
export interface ResolvedSession {
	user: User | null
	/** Refresh cookies are shared with every caller of this result. */
	setCookies: string[]
	source: Exclude<SessionSource, "memo">
}
export const AUTH_MEMO_MS = 30_000
export const authCheckCounts: Record<SessionSource | "error", number> = {
	none: 0,
	memo: 0,
	local: 0,
	server: 0,
	error: 0,
}
const memo = new Map<
	string,
	{ expiresAt: number; promise: Promise<ResolvedSession> }
>()
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()
const algorithms = ["ES256", "RS256", "EdDSA"]

function definitive(error: { status?: number; name?: string } | null): boolean {
	return (
		!error ||
		error.name === "AuthSessionMissingError" ||
		(typeof error.status === "number" &&
			error.status >= 400 &&
			error.status < 500)
	)
}

export function resolveSession(
	cookieHeader: string | null,
	options?: { fresh?: boolean },
): Promise<ResolvedSession> {
	if (!hasAuthCookie(cookieHeader)) {
		authCheckCounts.none++
		return Promise.resolve({ user: null, setCookies: [], source: "none" })
	}
	const cookies = parse(cookieHeader ?? "")
	const base = authCookieName()
	const key = Object.keys(cookies)
		.filter((name) =>
			base
				? name === base ||
					(name.startsWith(`${base}.`) &&
						/^\d+$/.test(name.slice(base.length + 1)))
				: /^sb-[^=;\s]+-auth-token(?:\.\d+)?$/.test(name),
		)
		.sort()
		.map((name) => `${name}=${cookies[name]}`)
		.join(";")
	const cached = memo.get(key)
	if (!options?.fresh && cached && cached.expiresAt > Date.now()) {
		authCheckCounts.memo++
		return cached.promise
	}
	if (memo.size >= 5_000) {
		for (const [key, entry] of memo)
			if (entry.expiresAt <= Date.now()) memo.delete(key)
		if (memo.size >= 5_000) {
			const oldest = memo.keys().next().value
			if (oldest !== undefined) memo.delete(oldest)
		}
	}
	// Defer execution until the entry is installed, including for synchronous failures.
	const entry = {
		expiresAt: Number.POSITIVE_INFINITY,
		promise: Promise.resolve().then(run),
	}
	memo.set(key, entry)
	return entry.promise

	async function run(): Promise<ResolvedSession> {
		const setCookies: string[] = []
		let tokenExpiresAt = Number.POSITIVE_INFINITY
		let result: ResolvedSession = { user: null, setCookies, source: "server" }
		let transient = false
		const checkAuth = async (signal: AbortSignal) => {
			const url = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "")
			const supabase = createServerClient(
				url,
				process.env.SUPABASE_ANON_KEY ?? "",
				{
					global: { fetch: authFetch(signal) },
					cookies: {
						getAll: () =>
							Object.entries(cookies).map(([name, value]) => ({
								name,
								value: value ?? "",
							})),
						setAll(updates) {
							if (signal.aborted) return
							for (const { name, value, options } of updates) {
								cookies[name] = value
								setCookies.push(serialize(name, value, options))
							}
						},
					},
				},
			)
			if (!options?.fresh) {
				try {
					const {
						data: { session },
					} = await supabase.auth.getSession()
					signal.throwIfAborted()
					if (session) {
						const token = session.access_token
						const header = decodeProtectedHeader(token)
						if (header.kid && header.alg && algorithms.includes(header.alg)) {
							let jwks = jwksCache.get(url)
							if (!jwks) {
								jwks = createRemoteJWKSet(
									new URL(`${url}/auth/v1/.well-known/jwks.json`),
									{
										cooldownDuration: 30_000,
										cacheMaxAge: 600_000,
										timeoutDuration: 3_000,
									},
								)
								jwksCache.set(url, jwks)
							}
							const { payload } = await jwtVerify(token, jwks, {
								issuer: `${url}/auth/v1`,
								algorithms,
								clockTolerance: 5,
							})
							signal.throwIfAborted()
							if (
								typeof payload.sub === "string" &&
								payload.sub.length > 0 &&
								payload.role !== "anon" &&
								typeof payload.exp === "number" &&
								payload.exp * 1000 > Date.now()
							) {
								result = {
									source: "local",
									setCookies,
									user: {
										id: payload.sub,
										aud:
											typeof payload.aud === "string"
												? payload.aud
												: (payload.aud?.[0] ?? ""),
										role: payload.role,
										email: payload.email,
										phone: payload.phone,
										app_metadata: payload.app_metadata ?? {},
										user_metadata: payload.user_metadata ?? {},
										is_anonymous: payload.is_anonymous,
										created_at: "",
									} as User,
								}
								tokenExpiresAt = payload.exp * 1000
							}
						}
					}
				} catch {
					// Unsupported keys, invalid tokens, and unavailable JWKS fall back to Auth.
				}
			}
			signal.throwIfAborted()
			if (result.source === "server") {
				const { data, error } = await supabase.auth.getUser()
				signal.throwIfAborted()
				result.user = data.user ?? null
				transient = !result.user && !definitive(error)
			}
		}
		try {
			await withBackendTimeout("Supabase auth", timeoutSetting("SUPABASE_TIMEOUT_MS", SUPABASE_TIMEOUT_DEFAULT_MS), checkAuth)
		} catch {
			result.user = null
			transient = true
		}
		authCheckCounts[result.source]++
		if (transient) {
			authCheckCounts.error++
			if (memo.get(key) === entry) memo.delete(key)
		} else entry.expiresAt = Math.min(Date.now() + AUTH_MEMO_MS, tokenExpiresAt)
		return result
	}
}

export function resetAuthSessionForTest(): void {
	memo.clear()
	jwksCache.clear()
	for (const source of Object.keys(
		authCheckCounts,
	) as (keyof typeof authCheckCounts)[])
		authCheckCounts[source] = 0
}
