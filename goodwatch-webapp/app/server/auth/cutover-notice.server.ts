// The cut-over notice (#552 step 2.2, owner Q47): AUTH_MAINTENANCE=on stops our site from creating Supabase accounts or
// changing Supabase passwords, so the final export of users and identities stays consistent. Members who are signed in
// keep browsing, and session refresh and sign-out keep working. Set in Coolify; read on every call, so a change needs a
// container restart but no build. Unset or anything but "on" means off.
//
// Where it acts:
// - the account pages' loaders pass it on, and show the notice instead of their forms;
// - the password pages' actions (the Supabase path) refuse;
// - /api/auth/* (the Better Auth path) refuses the routes that sign in, sign up or change a password;
// - the browser's sign-in client refuses before it calls Supabase (utils/auth-client.ts), which no server can see.
// It works with Better Auth on or off, so it can also guard the first minutes after BETTER_AUTH_ENABLED flips.
import { MAINTENANCE_CODE, MAINTENANCE_MESSAGE, MAINTENANCE_RETRY_SECONDS } from "../../utils/auth-maintenance.ts"

export const authMaintenanceOn = () => (process.env.AUTH_MAINTENANCE ?? "").trim().toLowerCase() === "on"

const NO_STORE = "private, no-store"

/** The refusal of an action: 503 with the notice's words and the code. */
export function maintenanceResponse(): Response {
	return new Response(JSON.stringify({ code: MAINTENANCE_CODE, message: MAINTENANCE_MESSAGE }), {
		status: 503,
		headers: {
			"Content-Type": "application/json",
			"Retry-After": String(MAINTENANCE_RETRY_SECONDS),
			"Cache-Control": NO_STORE,
		},
	})
}

/** A page's loader data with the flag, and with it on a cache never shares the page. */
export function withMaintenance<T extends object>(data: T): { data: T & { maintenance: boolean }; headers?: Record<string, string> } {
	const maintenance = authMaintenanceOn()
	return { data: { ...data, maintenance }, headers: maintenance ? { "Cache-Control": NO_STORE } : undefined }
}

// The Better Auth routes that sign in, sign up, reset or change a credential, or confirm one. Everything else stays:
// the session, sign-out, the account list and the apps' own routes.
const CREDENTIAL_ROUTES = [
	"/sign-in",
	"/sign-up",
	"/callback",
	"/request-password-reset",
	"/forget-password",
	"/reset-password",
	"/change-password",
	"/set-password",
	"/send-verification-email",
	"/verify-email",
	"/change-email",
	"/link-social",
]

/** Null when the request may go on; else the refusal. A link opened in the browser lands on the sign-in page. */
export function authMaintenanceGuard(request: Request): Response | null {
	if (!authMaintenanceOn()) return null
	const path = new URL(request.url).pathname.replace(/^\/api\/auth/i, "").toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "")
	if (!CREDENTIAL_ROUTES.some((route) => path === route || path.startsWith(`${route}/`))) return null
	if (request.method === "GET" || request.method === "HEAD") return new Response(null, { status: 303, headers: { Location: "/sign-in", "Cache-Control": NO_STORE } })
	return maintenanceResponse()
}
