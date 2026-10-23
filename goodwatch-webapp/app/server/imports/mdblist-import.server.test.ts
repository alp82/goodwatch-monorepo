import "./remix-runtime.test-support.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { ParsedImport } from "../../domain/imports.ts"
import { MdblistError, createMdblistClient } from "./mdblist-client.server.ts"
import { fakeMdblist } from "./mdblist-fake.test-support.ts"
import { createMdblistImport } from "./mdblist-import.server.ts"

const KEY = "synthetic-key-0001"
function fixture(
	read?: (
		key: string,
		options: { signal?: AbortSignal },
	) => Promise<ParsedImport>,
) {
	const fake = fakeMdblist({ key: KEY })
	const client = createMdblistClient({
		fetch: fake.fetch,
		sleep: async () => {},
	})
	const reads: string[] = []
	const previews: ParsedImport[] = []
	const flow = createMdblistImport({
		client: {
			readAccount: async (key, options = {}) => {
				reads.push(key)
				return read ? read(key, options) : client.readAccount(key, options)
			},
		},
		member: async (request) => ({
			userId: request.headers.get("Member"),
			headers: new Headers(),
		}),
		origin: () => "https://goodwatch.test",
		preview: async (_userId, _name, parsed) => {
			previews.push(parsed)
			return { id: "00000000-0000-4000-8000-000000000001" }
		},
	})
	const post = (
		body: Record<string, string> = { apiKey: KEY },
		headers: Record<string, string> = {},
		method = "POST",
		signal?: AbortSignal,
	) =>
		flow.handle(
			new Request("https://goodwatch.test/api/imports/mdblist", {
				method,
				signal,
				headers: {
					Origin: "https://goodwatch.test",
					Member: "member",
					"Content-Type": "application/x-www-form-urlencoded",
					...headers,
				},
				...(method === "POST" ? { body: new URLSearchParams(body) } : {}),
			}),
		)
	return { flow, fake, reads, previews, post }
}

test("a pasted key reads the account once and opens the MDBList preview", async () => {
	const f = fixture()
	const logged: unknown[] = []
	const original = {
		log: console.log,
		error: console.error,
		warn: console.warn,
	}
	console.log =
		console.error =
		console.warn =
			(...args: unknown[]) => {
				logged.push(args)
			}
	let response: Response
	try {
		response = await f.post({ apiKey: `  ${KEY}\n` })
	} finally {
		Object.assign(console, original)
	}
	assert.equal(response.status, 303)
	assert.equal(
		response.headers.get("Location"),
		"/settings/imports?source=mdblist&import=00000000-0000-4000-8000-000000000001",
	)
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	assert.equal(response.headers.get("Referrer-Policy"), "no-referrer")
	assert.deepEqual(f.reads, [KEY])
	assert.equal(f.previews.length, 1)
	assert.doesNotMatch(
		JSON.stringify(f.previews) +
			JSON.stringify([...response.headers]) +
			JSON.stringify(logged),
		new RegExp(KEY),
	)
})

test("sign-in, POST, GoodWatch's own page and a key-shaped value come first", async () => {
	const f = fixture()
	const cases: [Response, number, RegExp][] = [
		[await f.post(undefined, { Member: "" }), 401, /Sign in/],
		[await f.post(undefined, {}, "GET"), 405, /Method not allowed/],
		[
			await f.post(undefined, { Origin: "https://evil.test" }),
			403,
			/Open Imports/,
		],
		[await f.post({ apiKey: "" }), 400, /doesn't look like an MDBList API key/],
		[await f.post({ apiKey: "a b c d e f g h" }), 400, /doesn't look like/],
		[await f.post({ other: KEY }), 400, /doesn't look like/],
	]
	for (const [response, status, message] of cases) {
		assert.equal(response.status, status)
		assert.match((await response.json()).error, message)
		assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	}
	assert.deepEqual(f.reads, [])
})

test("a second read with the same key, or by the same member, waits for the first", async () => {
	let release = () => {}
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	const f = fixture(async () => {
		await gate
		return { source: "mdblist", observations: [], warnings: [] }
	})
	const first = f.post()
	const sameKey = await f.post(undefined, { Member: "other-member" })
	const sameMember = await f.post({ apiKey: "another-key-0002" })
	assert.equal(sameKey.status, 429)
	assert.equal(sameMember.status, 429)
	assert.match((await sameKey.json()).error, /already being read/)
	release()
	assert.equal((await first).status, 303)
	// Once finished, the key can start a new import.
	assert.equal((await f.post()).status, 303)
})

test("MDBList failures reach the member as fixed messages; other failures never show their text", async () => {
	const refused = fixture(async () => {
		throw new MdblistError("MDBList didn't accept this API key.", 400)
	})
	const response = await refused.post()
	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), {
		error: "MDBList didn't accept this API key.",
	})
	const crashed = fixture(async (key) => {
		throw new Error(`boom https://api.mdblist.com/sync/watched?apikey=${key}`)
	})
	const hidden = await crashed.post()
	assert.equal(hidden.status, 503)
	const text = await hidden.text()
	assert.doesNotMatch(text, new RegExp(KEY))
	assert.match(text, /could not be prepared/)
})

test("an oversized body is refused before the form is read", async () => {
	const f = fixture()
	const response = await f.post({ apiKey: KEY }, { "Content-Length": "5000" })
	assert.equal(response.status, 413)
	assert.deepEqual(f.reads, [])
})

test("a member who leaves the page cancels the MDBList read and frees the lock", async () => {
	const seen: AbortSignal[] = []
	const f = fixture(async (_key, options) => {
		const signal = options.signal as AbortSignal
		seen.push(signal)
		await new Promise((_resolve, reject) =>
			signal.addEventListener("abort", () =>
				reject(
					new MdblistError("The import was canceled before it finished.", 499),
				),
			),
		)
		return { source: "mdblist", observations: [], warnings: [] }
	})
	const controller = new AbortController()
	const first = f.post(undefined, {}, "POST", controller.signal)
	await new Promise((resolve) => setTimeout(resolve, 10))
	assert.equal(seen.length, 1)
	controller.abort()
	assert.equal((await first).status, 499)
	assert.ok(seen[0].aborted)
	// The lock is gone: the same member and key start a new read right away.
	const retry = new AbortController()
	const second = f.post(undefined, {}, "POST", retry.signal)
	await new Promise((resolve) => setTimeout(resolve, 10))
	assert.equal(seen.length, 2)
	retry.abort()
	assert.equal((await second).status, 499)
})

test("a script post gets the preview address as JSON, so the page can open it without router state", async () => {
	const f = fixture()
	const response = await f.post(undefined, { Accept: "application/json" })
	assert.equal(response.status, 200)
	assert.deepEqual(await response.json(), {
		location:
			"/settings/imports?source=mdblist&import=00000000-0000-4000-8000-000000000001",
	})
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	assert.equal(response.headers.get("Location"), null)
})

test("through remix-serve's Express adapter, a dropped connection stops the MDBList read and frees the lock", async () => {
	const { createServer, request } = await import("node:http")
	// express ships no type declarations in this app; only these two calls are used.
	const express = (
		(await import(
			// @ts-expect-error -- no declaration file for express
			"express"
		)) as {
			default: () => {
				post: (
					path: string,
					handler: (req: unknown, res: unknown) => Promise<void>,
				) => void
			} & Parameters<typeof import("node:http").createServer>[1]
		}
	).default
	const { createRemixRequest, sendRemixResponse } = (await import(
		"@remix-run/express/dist/server.js"
	)) as unknown as {
		createRemixRequest: (req: unknown, res: unknown) => Request
		sendRemixResponse: (res: unknown, response: Response) => Promise<void>
	}
	const seen: AbortSignal[] = []
	const flow = createMdblistImport({
		client: {
			readAccount: async (_key, options = {}) => {
				const signal = options.signal as AbortSignal
				seen.push(signal)
				await new Promise((_resolve, reject) =>
					signal.addEventListener("abort", () =>
						reject(
							new MdblistError(
								"The import was canceled before it finished.",
								499,
							),
						),
					),
				)
				return { source: "mdblist", observations: [], warnings: [] }
			},
		},
		member: async () => ({ userId: "member", headers: new Headers() }),
		origin: () => "https://goodwatch.test",
		preview: async () => ({ id: "00000000-0000-4000-8000-000000000001" }),
	})
	const app = express()
	app.post("/api/imports/mdblist", async (req: unknown, res: unknown) => {
		await sendRemixResponse(
			res,
			await flow.handle(createRemixRequest(req, res)),
		)
	})
	const server = createServer(app)
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	const { port } = server.address() as { port: number }
	const post = () => {
		const outgoing = request({
			host: "127.0.0.1",
			port,
			path: "/api/imports/mdblist",
			method: "POST",
			headers: {
				Origin: "https://goodwatch.test",
				"Content-Type": "application/x-www-form-urlencoded",
			},
		})
		outgoing.on("error", () => {})
		outgoing.end(`apiKey=${KEY}`)
		return outgoing
	}
	const waitFor = async (check: () => boolean) => {
		for (let i = 0; i < 200 && !check(); i++)
			await new Promise((resolve) => setTimeout(resolve, 5))
		assert.ok(check())
	}
	try {
		const first = post()
		await waitFor(() => seen.length === 1)
		first.destroy()
		await waitFor(() => seen[0].aborted)
		// The lock is free: the same member and key start a new read.
		const second = post()
		await waitFor(() => seen.length === 2)
		second.destroy()
		await waitFor(() => seen[1].aborted)
	} finally {
		server.close()
	}
})
