// What the server loads at start for Better Auth, without loading Better Auth itself: the Valkey cluster its storage
// uses, a session resolver and the `/api/auth/*` handler. Both load the auth runtime (Better Auth, its mail transport
// and its database adapter) on their first use with BETTER_AUTH_ENABLED on, so a server with the flag off never loads
// it and starts as fast as before.
import type { Cluster } from "ioredis"
import { registerBetterAuthResolver } from "../../utils/auth-session.ts"

let clusterProvider: () => Cluster | null = () => null

/** The server entry hands over the site's Valkey cluster; the auth storage asks for it when it runs. */
export function registerAuthCluster(provider: () => Cluster | null) {
	clusterProvider = provider
}
export function authCluster(): Cluster | null {
	return clusterProvider()
}

// Account deletion (#553) removes the member's rows from the webapp's own CrateDB tables. The server entry registers
// that part (server/account-deletion.server.ts), as it does the Valkey cluster: the sign-in service imports none of
// the app's member data modules. Until it is registered, deleting an account answers 404.
let memberDataDeletion: ((userId: string) => Promise<void>) | null = null
export function registerMemberDataDeletion(deleteMemberData: (userId: string) => Promise<void>) {
	memberDataDeletion = deleteMemberData
}
export function registeredMemberDataDeletion() {
	return memberDataDeletion
}

export const betterAuthEnabled = () => process.env.BETTER_AUTH_ENABLED === "true"
export const loadAuthRuntime = () => import("./runtime.server.ts")

/** Signed-in requests with Better Auth on resolve their member through the runtime, loaded on the first one. */
export function registerLazyAuthResolver() {
	registerBetterAuthResolver(async (cookieHeader) =>
		(await loadAuthRuntime()).resolveBetterAuthSession(cookieHeader),
	)
}

/** The routes under `/api/auth/*`: not found while Better Auth is off, without loading the runtime. */
export async function handleAuthRequest(request: Request): Promise<Response> {
	if (!betterAuthEnabled())
		return new Response(null, {
			status: 404,
			headers: { "Cache-Control": "private, no-store" },
		})
	return (await loadAuthRuntime()).handleAuthRequest(request)
}
