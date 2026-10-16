// With BETTER_AUTH_ENABLED off, the sign-in page's app check, the consent page and Connected apps answer without loading
// Better Auth, and Connected apps is not found.
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
const authModules = () =>
	resolved.filter((url) =>
		/better-auth|@goodwatch\/auth-stack|nodemailer|bcryptjs|\/server\/auth\/(runtime|auth|mail|crate-adapter)\.server\.ts/.test(url),
	)

async function rejection(promise: Promise<unknown>): Promise<Response> {
	try {
		await promise
	} catch (error) {
		if (error instanceof Response) return error
		throw error
	}
	assert.fail("expected a thrown response")
}

test("with Better Auth off, the app check, the consent page and Connected apps load nothing of Better Auth", async () => {
	delete process.env.BETTER_AUTH_ENABLED
	const flow = await import("./mcp-flow.server.ts")
	const apps = await import("./connected-apps.server.ts")
	const signed = new Request("http://localhost/sign-in?client_id=app&sig=x&ba_param=client_id")
	assert.equal(await flow.connectingApp(signed), null)
	assert.equal((await rejection(flow.mcpConsentLoader(new Request("http://localhost/auth/mcp/consent")))).status, 404)
	assert.equal((await rejection(apps.connectedAppsPage(new Request("http://localhost/settings/connected-apps")))).status, 404)
	assert.equal(await apps.listConnectedApps(new Request("http://localhost/settings/connected-apps")), null)
	assert.deepEqual(authModules(), [])
})
