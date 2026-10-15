// With BETTER_AUTH_ENABLED off, the server must not load Better Auth: no auth runtime, mail transport, database adapter
// or auth packages. With it on, the same wiring loads the runtime on the first use.
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"

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

const AUTH_RUNTIME =
	/better-auth|@goodwatch\/auth-stack|nodemailer|bcryptjs|\/server\/auth\/(runtime|auth|mail|crate-adapter)\.server\.ts/
const authModules = () => resolved.filter((url) => AUTH_RUNTIME.test(url))

test("with Better Auth off, the boot wiring, /api/auth/* and the OAuth metadata load nothing of Better Auth", async () => {
	delete process.env.BETTER_AUTH_ENABLED
	const boot = await import("./boot.server.ts")
	boot.registerAuthCluster(() => null)
	boot.registerLazyAuthResolver()
	const route = await import("../../routes/api.auth.$.ts")
	const args = (method: string) =>
		({
			request: new Request("http://localhost/api/auth/get-session", { method }),
			params: {},
			context: {},
		}) as never
	const wellKnown = await Promise.all([
		import("../../routes/[.well-known].oauth-authorization-server.$.ts"),
		import("../../routes/[.well-known].oauth-protected-resource.$.ts"),
		import("../../routes/[.well-known].openid-configuration.$.ts"),
	])
	const answers = [await route.loader(args("GET")), await route.action(args("POST"))]
	for (const metadata of wellKnown) answers.push(await metadata.loader(args("GET")))
	for (const response of answers) {
		assert.equal(response.status, 404)
		assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	}
	assert.deepEqual(authModules(), [])
})

test("with Better Auth on, a signed-in request loads the runtime through the lazy resolver", async () => {
	process.env.BETTER_AUTH_ENABLED = "true"
	try {
		const { resolveSession } = await import("../../utils/auth-session.ts")
		// No auth configuration here: the runtime loads, fails closed and the request has no member.
		const session = await resolveSession("gw.session_token=test")
		assert.equal(session.user, null)
		assert.ok(authModules().some((url) => url.endsWith("/server/auth/runtime.server.ts")))
	} finally {
		delete process.env.BETTER_AUTH_ENABLED
	}
})
