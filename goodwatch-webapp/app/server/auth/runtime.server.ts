import { captureMessage } from "@sentry/remix"
import type { User } from "@supabase/auth-js"
import type { Cluster } from "ioredis"
import { registerBetterAuthResolver } from "../../utils/auth-session.ts"
import { onShutdown } from "../lifecycle.server.ts"
import { createGoodwatchAuth } from "./auth.server.ts"
import { crateAuthTransport } from "./crate-adapter.server.ts"
import { AuthMailQueue, smtpTransport } from "./mail.server.ts"
import { startAuthMaintenance } from "./maintenance-worker.server.ts"
import { parseAuthEncryptionKeys } from "./payload-codec.server.ts"
import { ValkeyAuthStorage } from "./secondary-storage.server.ts"

type AuthService = ReturnType<typeof createGoodwatchAuth>
let instance: Promise<AuthService> | null = null
let testAuth: AuthService | null = null
let clusterProvider: () => Cluster | null = () => null
export function registerAuthCluster(provider: () => Cluster | null) {
	clusterProvider = provider
}
export const betterAuthEnabled = () =>
	process.env.BETTER_AUTH_ENABLED === "true"
export function setAuthForTest(auth: AuthService | null) {
	testAuth = auth
}
function required(name: string) {
	const value = process.env[name]
	if (!value) throw new Error(`Missing auth configuration: ${name}`)
	return value
}
export async function getBetterAuth(): Promise<AuthService> {
	if (!betterAuthEnabled()) throw new Error("Better Auth is disabled")
	if (testAuth) return testAuth
	instance ??= (async () => {
		const mail = new AuthMailQueue(
			smtpTransport({
				user: required("AUTH_SMTP_USER"),
				password: required("AUTH_SMTP_PASSWORD"),
			}),
		)
		onShutdown("auth mail", () => mail.drain())
		const sql = crateAuthTransport(
			required("AUTH_CRATEDB_ORIGINS")
				.split(",")
				.map((url) => url.trim()),
			15000,
			{
				username: required("AUTH_CRATEDB_USERNAME"),
				password: required("AUTH_CRATEDB_PASSWORD"),
			},
		)
		const encryptionSecret = required("AUTH_CRATEDB_ENCRYPTION_SECRET")
		const encryptionKeys = parseAuthEncryptionKeys(
			required("AUTH_CRATEDB_ENCRYPTION_KEYS"),
		)
		const storage = new ValkeyAuthStorage(() => clusterProvider())
		const auth = createGoodwatchAuth({
			sql,
			encryptionSecret,
			encryptionKeys,
			secret: required("BETTER_AUTH_SECRET"),
			baseURL: required("BETTER_AUTH_URL"),
			mcp: { resource: required("MCP_RESOURCE_URL") },
			trustedIpHeader: required("AUTH_TRUSTED_IP_HEADER"),
			storage,
			mail,
			google: {
				clientId: required("AUTH_GOOGLE_CLIENT_ID"),
				clientSecret: required("AUTH_GOOGLE_CLIENT_SECRET"),
			},
		})
		const maintenance = startAuthMaintenance({
			sql,
			encryptionSecret,
			encryptionKeys,
			storage,
		})
		onShutdown("auth maintenance", () => maintenance.stop())
		return auth
	})().catch((error) => {
		instance = null
		throw error
	})
	return instance
}
export async function handleAuthRequest(request: Request): Promise<Response> {
	let response: Response
	if (!betterAuthEnabled()) response = new Response(null, { status: 404 })
	else
		try {
			response = await (await getBetterAuth()).handler(request)
		} catch {
			captureMessage("Auth request failed closed", "error")
			response = Response.json(
				{ message: "Sign-in is temporarily unavailable." },
				{ status: 503 },
			)
		}
	response.headers.set("Cache-Control", "private, no-store")
	return response
}
export async function resolveBetterAuthSession(cookieHeader: string | null) {
	const auth = await getBetterAuth()
	// Server loaders bypass the HTTP router's missing-IP rate-limit bucket.
	const response = await auth.api.getSession({
		headers: new Headers({ cookie: cookieHeader ?? "" }),
		asResponse: true,
	})
	if (!response.ok) throw new Error("Auth session check failed")
	const data = await response.json()
	const user: User | null = data?.user
		? {
				id: data.user.id,
				email: data.user.email,
				aud: "authenticated",
				role: "authenticated",
				app_metadata: { provider: "better-auth" },
				user_metadata: {
					name: data.user.name,
					full_name: data.user.name,
					avatar_url: data.user.image,
				},
				created_at: new Date(data.user.createdAt).toISOString(),
				updated_at: new Date(data.user.updatedAt).toISOString(),
				email_confirmed_at: data.user.emailVerified
					? new Date(data.user.updatedAt).toISOString()
					: undefined,
			}
		: null
	return {
		user,
		setCookies: response.headers.getSetCookie(),
		source: "server" as const,
	}
}
registerBetterAuthResolver(resolveBetterAuthSession)
