import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, ctx, next) {
		if (url.endsWith("/utils/auth.ts"))
			return {
				format: "module",
				shortCircuit: true,
				source:
					"export const getAuthFromRequest=async({request})=>({user:request.headers.get('x-fixture-member')?{id:request.headers.get('x-fixture-member')}:null,headers:new Headers()});export const getUserIdFromRequest=async()=>null",
			}
		return next(url, ctx)
	},
})
test("bulk acceptance and discard are authenticated bounded POST actions", async () => {
	for (const file of [
		"../../routes/api.imports.$id.accept-suggestions.ts",
		"../../routes/api.imports.$id.discard.ts",
	]) {
		const { action } = await import(file)
		const invoke = (method: string, member = false, large = false) =>
			action({
				params: { id: "10000000-0000-4000-a000-000000000000" },
				context: {},
				request: new Request("https://example.test/import", {
					method,
					headers: {
						...(member ? { "x-fixture-member": "member" } : {}),
						...(large ? { "Content-Length": "50000" } : {}),
						"Content-Type": "application/json",
					},
					...(method === "POST" ? { body: "{}" } : {}),
				}),
			})
		assert.equal((await invoke("POST")).status, 401)
		assert.equal((await invoke("GET", true)).status, 405)
		if (file.includes("accept"))
			assert.equal((await invoke("POST", true, true)).status, 413)
	}
})
