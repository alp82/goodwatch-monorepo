// What the server loads at start for Better Auth, without loading Better Auth itself: the Valkey cluster its storage
// uses, a session resolver and the `/api/auth/*` handler. Both load the auth runtime (Better Auth, its mail transport
// and its database adapter) on their first use with BETTER_AUTH_ENABLED on, so a server with the flag off never loads
// it and starts as fast as before.
import type { Cluster } from "ioredis"
import { registerBetterAuthResolver } from "../../utils/auth-session.ts"
import { addReadinessCheck } from "../lifecycle.server.ts"
import { authMaintenanceGuard } from "./cutover-notice.server.ts"

let clusterProvider: () => Cluster | null = () => null

/** The server entry hands over the site's Valkey cluster; the auth storage asks for it when it runs. */
export function registerAuthCluster(provider: () => Cluster | null) {
	clusterProvider = provider
}
export function authCluster(): Cluster | null {
	return clusterProvider()
}

export const betterAuthEnabled = () =>
	process.env.BETTER_AUTH_ENABLED === "true"
export const loadAuthRuntime = () => import("./runtime.server.ts")

/**
 * With Better Auth on, the runtime starts loading now and readiness waits for it. Loaded on first use, it compiled
 * its modules for 1.1 to 1.5 s in the middle of the first sign-in (measured with the stall profiler on November 13,
 * 2026), and every other request waited; one such stall failed a YepWatch sign-in. A failed load leaves readiness to
 * the other checks, and the first use tries again as before.
 */
export function preloadAuthRuntime({
	enabled = betterAuthEnabled,
	load = loadAuthRuntime as () => Promise<unknown>,
	addCheck = addReadinessCheck,
}: {
	enabled?: () => boolean
	load?: () => Promise<unknown>
	addCheck?: (name: string, check: () => boolean) => void
} = {}) {
	if (!enabled()) return
	let settled = false
	addCheck("auth runtime", () => settled)
	load()
		.catch((error) =>
			console.error("Auth runtime: loading at start failed", error),
		)
		.finally(() => {
			settled = true
		})
}

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
	// The cut-over notice (AUTH_MAINTENANCE) turns away sign-in, sign-up and password routes before the runtime loads.
	const refused = authMaintenanceGuard(request)
	if (refused) return refused
	return (await loadAuthRuntime()).handleAuthRequest(request)
}
