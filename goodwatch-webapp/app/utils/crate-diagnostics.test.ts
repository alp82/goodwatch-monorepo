import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"
import {
	crateEvent,
	crateErrorFields,
	redactedSqlShape,
	withCrateHttpRequest,
} from "./crate-diagnostics.ts"

test("SQL shapes remove string/numeric literals and comments, including malformed values, before capping", () => {
	const shape = redactedSqlShape(
		`-- private-email\n SELECT "updated_at", 'secret''quote', E'secret\\'quote', $tag$private$tag$, 123, 1.3e-4 FROM movie WHERE id = ? /* password */ AND country = 'US'`,
	)
	assert.equal(
		shape,
		'SELECT "updated_at", ?, ?, ?, ?, ? FROM movie WHERE id = ? AND country = ?',
	)
	assert.equal(redactedSqlShape("SELECT 'unterminated-secret"), "SELECT ?")
	assert.equal(redactedSqlShape("SELECT 1 /* unterminated-secret"), "SELECT ?")
	assert.ok(
		redactedSqlShape(`SELECT '${"private".repeat(10000)}' FROM movie`).length <
			50,
	)
	assert.deepEqual(
		crateErrorFields({
			name: "CrateError",
			message: "JobKilledException[private SQL user_id=secret]",
			code: 5000,
			statusCode: 500,
		}),
		{ errorClass: "JobKilledException", errorCode: 5000, httpStatus: 500 },
	)
	assert.equal(
		JSON.stringify(crateErrorFields(new Error("password secret"))).includes(
			"secret",
		),
		false,
	)
})

test("concurrent HTTP requests keep route/request identity through async work and final HTTP outcome", async (t) => {
	const events: Record<string, unknown>[] = []
	t.mock.method(console, "warn", (line: string) =>
		events.push(JSON.parse(line)),
	)
	const server = createServer((req, res) =>
		withCrateHttpRequest(
			req,
			res,
			(path) =>
				path.startsWith("/movie/") ? "/movie/:movieKey" : "/api/my-library",
			() => {
				setTimeout(
					() => {
						crateEvent("crate.attempt_failed", {
							host: "127.0.0.1:4200",
							attempt: 1,
							outcome: "failed",
						})
						res.statusCode = req.url?.startsWith("/movie/") ? 500 : 200
						res.end("done")
					},
					req.url?.startsWith("/movie/") ? 20 : 1,
				)
			},
		),
	)
	t.after(async () => {
		server.closeAllConnections()
		await new Promise((resolve) => server.close(resolve))
	})
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	await Promise.all(
		["/movie/private-title?token=secret", "/api/my-library?user=secret"].map(
			async (path) => {
				const response = await fetch(`http://127.0.0.1:${address.port}${path}`)
				await response.text()
			},
		),
	)
	assert.equal(events.length, 4)
	const ids = new Set(events.map((e) => e.requestId))
	assert.equal(ids.size, 2)
	for (const id of ids) {
		const request = events.filter((e) => e.requestId === id)
		assert.equal(request[0].route, request[1].route)
		assert.equal(request[1].event, "crate.http")
		assert.equal(
			request[1].status,
			request[0].route === "/movie/:movieKey" ? 500 : 200,
		)
	}
	assert.doesNotMatch(JSON.stringify(events), /private-title|secret|token=/)
})
