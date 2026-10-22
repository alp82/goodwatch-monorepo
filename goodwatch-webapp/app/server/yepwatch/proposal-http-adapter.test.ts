import { test } from "node:test"
import assert from "node:assert/strict"
import { listenYepWatch } from "./node-http.server.ts"
test("Local catalog runtime Headers polyfill raw cookies survive Node adapter", async () => {
	const server = await listenYepWatch(async () => {
		const response = new Response("{}")
		Object.defineProperty(response.headers, "getSetCookie", {
			value: undefined,
		})
		Object.defineProperty(response.headers, "raw", {
			value: () => ({
				"set-cookie": ["first=one; HttpOnly", "second=two; HttpOnly"],
			}),
		})
		return response
	})
	try {
		const { port } = server.address() as { port: number }
		const response = await fetch(`http://127.0.0.1:${port}/`)
		assert.equal(response.status, 200)
		assert.deepEqual(response.headers.getSetCookie(), [
			"first=one; HttpOnly",
			"second=two; HttpOnly",
		])
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((e) => (e ? reject(e) : resolve()))
		)
	}
})
