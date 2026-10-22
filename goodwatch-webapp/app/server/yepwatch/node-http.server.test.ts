import { test } from "node:test"
import assert from "node:assert/strict"
import { once } from "node:events"
import { listenYepWatch } from "./node-http.server.ts"
test("Local HTTP adapter preserves bound origin and distinct issuer cookies", async () => {
	const server = await listenYepWatch(async (request) => {
		const h = new Headers()
		h.append("set-cookie", "session=one; Path=/; HttpOnly")
		h.append("set-cookie", "remember=two; Path=/; HttpOnly")
		return new Response(new URL(request.url).origin, { headers: h })
	})
	try {
		const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
		const response = await fetch(origin + "/consent", {
			headers: { host: "untrusted.example" },
		})
		assert.equal(await response.text(), origin)
		assert.equal(response.headers.getSetCookie().length, 2)
	} finally {
		server.close()
		await once(server, "close")
	}
})
