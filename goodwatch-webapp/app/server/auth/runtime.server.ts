import { captureMessage } from "@sentry/remix"
import type { User } from "@supabase/auth-js"
import Redis, { type Cluster } from "ioredis"
import { registerBetterAuthResolver } from "../../utils/auth-session.ts"
import { onShutdown } from "../lifecycle.server.ts"
import { fillWebFetchGaps } from "../web-fetch-gaps.server.ts"
import { createGoodwatchAuth, jsonResponse, setCookiesOf } from "./auth.server.ts"
import { crateAuthTransport, localCrateTransport } from "./crate-adapter.server.ts"
import { AuthMailQueue, smtpTransport } from "./mail.server.ts"
import { startAuthMaintenance } from "./maintenance-worker.server.ts"
import { parseAuthEncryptionKeys } from "./payload-codec.server.ts"
import { ValkeyAuthStorage } from "./secondary-storage.server.ts"
import {
	authCluster,
	registerAuthCluster,
	registeredMemberDataDeletion,
	registerMemberDataDeletion,
} from "./boot.server.ts"

type AuthService = ReturnType<typeof createGoodwatchAuth>
let instance: Promise<AuthService> | null = null
let testAuth: AuthService | null = null
// The cluster registry lives in boot.server.ts, which the server entry loads without this module.
const clusterProvider = authCluster
export { registerAuthCluster }
export const betterAuthEnabled = () =>
	process.env.BETTER_AUTH_ENABLED === "true"
export function setAuthForTest(auth: AuthService | null) {
	testAuth = auth
}
// Account deletion's registry lives in boot.server.ts with the cluster's, so the entry registers it without this module.
export { registerMemberDataDeletion }
const accountDeletion = () => {
	const deleteMemberData = registeredMemberDataDeletion()
	return deleteMemberData ? { deleteMemberData } : undefined
}
function required(name: string) {
	const value = process.env[name]
	if (!value) throw new Error(`Missing auth configuration: ${name}`)
	return value
}
export async function getBetterAuth(): Promise<AuthService> {
	if (!betterAuthEnabled()) throw new Error("Better Auth is disabled")
	if (testAuth) return testAuth
	if (process.env.AUTH_LOCAL_SERVICES === "true") {
		instance ??= Promise.resolve(localAuth())
		return instance
	}
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
			accountDeletion: accountDeletion(),
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
// A dev server against the disposable Docker services of `scripts/auth-wiring/dev.sh`: the wiring's CrateDB,
// Valkey and SMTP catcher on loopback. Never in production, and never the site's own Valkey.
// AUTH_LOCAL_PROFILE=deletion uses the account-deletion suite's services instead (scripts/auth-deletion/dev.sh).
function localAuth(): AuthService {
	if (process.env.NODE_ENV === "production")
		throw new Error("Local auth services are for development only")
	const ports =
		process.env.AUTH_LOCAL_PROFILE === "deletion"
			? { crate: 16248, valkey: 16201, smtp: 16225 }
			: { crate: 15848, valkey: 15901, smtp: 15925 }
	const valkey = new Redis.Cluster([{ host: "127.0.0.1", port: ports.valkey }], {
		natMap: JSON.parse(process.env.AUTH_LOCAL_VALKEY_NAT ?? "{}"),
		redisOptions: { maxRetriesPerRequest: 0, commandTimeout: 3000 },
	})
	return createGoodwatchAuth({
		sql: localCrateTransport([`http://127.0.0.1:${ports.crate}`]),
		storage: new ValkeyAuthStorage(() => valkey),
		mail: new AuthMailQueue(
			smtpTransport({ host: "127.0.0.1", port: ports.smtp, localCatcher: true }),
		),
		baseURL: required("BETTER_AUTH_URL"),
		secret: required("BETTER_AUTH_SECRET"),
		encryptionSecret: required("AUTH_CRATEDB_ENCRYPTION_SECRET"),
		trustedIpHeader: "x-forwarded-for",
		mcp: { resource: required("MCP_RESOURCE_URL") },
		google: {
			clientId: required("AUTH_GOOGLE_CLIENT_ID"),
			clientSecret: required("AUTH_GOOGLE_CLIENT_SECRET"),
		},
		accountDeletion: accountDeletion(),
	})
}
export async function handleAuthRequest(request: Request): Promise<Response> {
	fillWebFetchGaps()
	let response: Response
	if (!betterAuthEnabled()) response = new Response(null, { status: 404 })
	else
		try {
			response = await (await getBetterAuth()).handler(request)
		} catch {
			captureMessage("Auth request failed closed", "error")
			response = jsonResponse(
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
					// Accounts made with an email have no name: the site then shows the address.
					name: data.user.name || undefined,
					full_name: data.user.name || undefined,
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
		setCookies: setCookiesOf(response.headers),
		source: "server" as const,
	}
}
registerBetterAuthResolver(resolveBetterAuthSession)
