// The cut-over notice (#552 step 2.2): with AUTH_MAINTENANCE=on nothing creates an account or changes a password, and
// nothing reaches Supabase Auth. Signed-in members keep browsing, and session refresh and sign-out keep working.
// Packages load before the alias hook, which resolves only the app's own files.
import "@supabase/ssr"
import "@remix-run/node"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { afterEach, test } from "node:test"

const resolved: string[] = []
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: unknown,
			next: (specifier: string, context: unknown) => { url: string },
		): { url: string }
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		const result = next(specifier, context)
		resolved.push(result.url)
		return result
	},
})
const authModules = () =>
	resolved.filter((url) =>
		/better-auth|@goodwatch\/auth-stack|nodemailer|bcryptjs|\/server\/auth\/(runtime|auth|mail|crate-adapter)\.server\.ts/.test(url),
	)

const notice = await import("./cutover-notice.server.ts")
const boot = await import("./boot.server.ts")

afterEach(() => {
	delete process.env.AUTH_MAINTENANCE
	delete process.env.BETTER_AUTH_ENABLED
})

const request = (method: string, path: string, headers?: Record<string, string>) =>
	new Request(`http://localhost${path}`, { method, headers })

test("the flag is on only for the value on; unset and anything else mean off", () => {
	for (const [value, expected] of [
		[undefined, false],
		["", false],
		["off", false],
		["true", false],
		["1", false],
		["on", true],
		[" ON ", true],
	] as const) {
		if (value === undefined) delete process.env.AUTH_MAINTENANCE
		else process.env.AUTH_MAINTENANCE = value
		assert.equal(notice.authMaintenanceOn(), expected, String(value))
	}
})

const BLOCKED: [string, string][] = [
	["POST", "/api/auth/sign-in/email"],
	["POST", "/api/auth/sign-in/social"],
	["POST", "/api/auth/sign-up/email"],
	["GET", "/api/auth/callback/google"],
	["POST", "/api/auth/request-password-reset"],
	["POST", "/api/auth/reset-password"],
	["GET", "/api/auth/reset-password/some-token"],
	["POST", "/api/auth/change-password"],
	["POST", "/api/auth/set-password"],
	["POST", "/api/auth/send-verification-email"],
	["GET", "/api/auth/verify-email"],
	["POST", "/api/auth/change-email"],
	["POST", "/api/auth/link-social"],
	// Spelling tricks reach the same routes.
	["POST", "/api/auth/Sign-Up/Email"],
	["POST", "/api/auth/sign-up/email/"],
	["POST", "/api/auth//sign-up/email"],
]
const ALLOWED: [string, string][] = [
	["GET", "/api/auth/get-session"],
	["POST", "/api/auth/sign-out"],
	["GET", "/api/auth/list-accounts"],
	["GET", "/api/auth/jwks"],
	["POST", "/api/auth/oauth2/token"],
	["GET", "/api/auth/oauth2/authorize"],
]

test("with the flag on, the routes that sign in, sign up, reset or change a password are refused with the notice", async () => {
	process.env.AUTH_MAINTENANCE = "on"
	for (const [method, path] of BLOCKED) {
		const response = notice.authMaintenanceGuard(request(method, path))
		assert.ok(response, `${method} ${path}`)
		if (method === "GET") {
			// A link opened in the browser lands on the sign-in page, which shows the notice.
			assert.equal(response.status, 303, `${method} ${path}`)
			assert.equal(response.headers.get("Location"), "/sign-in", `${method} ${path}`)
		} else {
			assert.equal(response.status, 503, `${method} ${path}`)
			assert.equal(response.headers.get("Retry-After"), "1800")
			assert.deepEqual(await response.json(), {
				code: "AUTH_MAINTENANCE",
				message: "We're moving sign-in to a new home. Back in about 30 minutes.",
			})
		}
		assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	}
})

test("with the flag on, session refresh, sign-out and the app routes still work", () => {
	process.env.AUTH_MAINTENANCE = "on"
	for (const [method, path] of ALLOWED) assert.equal(notice.authMaintenanceGuard(request(method, path)), null, `${method} ${path}`)
})

test("with the flag off, nothing is refused", () => {
	for (const value of [undefined, "off"]) {
		if (value === undefined) delete process.env.AUTH_MAINTENANCE
		else process.env.AUTH_MAINTENANCE = value
		for (const [method, path] of [...BLOCKED, ...ALLOWED]) assert.equal(notice.authMaintenanceGuard(request(method, path)), null, `${method} ${path}`)
	}
})

test("with Better Auth on and the flag on, /api/auth/* refuses a sign-up before the auth runtime loads", async () => {
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.AUTH_MAINTENANCE = "on"
	const before = authModules().length
	const response = await boot.handleAuthRequest(request("POST", "/api/auth/sign-up/email"))
	assert.equal(response.status, 503)
	assert.equal(((await response.json()) as { code: string }).code, "AUTH_MAINTENANCE")
	assert.equal(authModules().length, before)
})

test("with Better Auth off, /api/auth/* stays not found whatever the flag says", async () => {
	for (const value of [undefined, "on"]) {
		if (value) process.env.AUTH_MAINTENANCE = value
		const response = await boot.handleAuthRequest(request("POST", "/api/auth/sign-up/email"))
		assert.equal(response.status, 404)
	}
})

test("the status route tells the page whether the notice is on, and is never cached", async () => {
	const route = await import("../../routes/api.auth-maintenance.ts")
	const ask = () => route.loader()
	for (const [value, expected] of [
		[undefined, false],
		["on", true],
	] as const) {
		if (value) process.env.AUTH_MAINTENANCE = value
		else delete process.env.AUTH_MAINTENANCE
		const response = await ask()
		assert.deepEqual(await response.json(), { maintenance: expected })
		assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	}
})
