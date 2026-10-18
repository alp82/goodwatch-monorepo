// Runs the built console snippet in Node with browser stubs against the fake JustWatch server.
// Checks: it only contacts the GraphQL endpoint, sends no cookies, never writes the token to the file,
// and falls back when the server rejects `objectId`. Run: node prototypes/justwatch-wishlist/snippet-smoke.mjs
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { fakeJustWatch } from "./fake-justwatch.js"

const snippet = readFileSync(new URL("./snippet/justwatch-capture.snippet.js", import.meta.url), "utf8")
const token = `x.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 3600 })).toString("base64url")}.y`

async function runSnippet({ rejectObjectId = false } = {}) {
	const server = fakeJustWatch()
	const destinations = []
	let saved = null
	let alerted = null
	globalThis.location = { origin: "https://www.justwatch.com", pathname: "/us/watchlist" }
	globalThis.localStorage = { getItem: (key) => (key === "jw/user" ? JSON.stringify({ jwLoginId: "login-secret", jwId: "device-secret", accessToken: token }) : null) }
	globalThis.alert = (message) => {
		alerted = message
	}
	globalThis.document = {
		documentElement: { lang: "en-US" },
		createElement: () => ({ click() {}, remove() {} }),
		body: { append() {} },
	}
	const realCreate = URL.createObjectURL
	URL.createObjectURL = (blob) => {
		saved = blob
		return "blob:local"
	}
	globalThis.setTimeout = ((original) => (fn) => original(fn, 0))(setTimeout)
	globalThis.fetch = async (url, init) => {
		destinations.push({ url, method: init.method, credentials: init.credentials, headers: Object.keys(init.headers) })
		const body = JSON.parse(init.body)
		if (rejectObjectId && body.query.includes("objectId"))
			return { status: 400, json: async () => ({ errors: [{ message: 'Cannot query field "objectId"', extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }] }) }
		const response = await server.request(body)
		return { status: response.status, json: async () => response.body }
	}
	const quiet = console.log
	console.log = () => {}
	await (0, eval)(snippet)
	await new Promise((resolve) => setImmediate(resolve))
	for (let index = 0; index < 50 && !saved; index++) await new Promise((resolve) => setImmediate(resolve))
	console.log = quiet
	URL.createObjectURL = realCreate
	return { destinations, saved: saved && JSON.parse(await saved.text()), alerted }
}

for (const rejectObjectId of [false, true]) {
	const { destinations, saved, alerted } = await runSnippet({ rejectObjectId })
	assert.equal(alerted, null)
	assert.ok(saved, "the snippet saved a file")
	assert.deepEqual([...new Set(destinations.map((d) => d.url))], ["https://apis.justwatch.com/graphql"])
	assert.ok(destinations.every((d) => d.method === "POST" && d.credentials === "omit"))
	const text = JSON.stringify(saved)
	for (const secret of [token, "login-secret", "device-secret"]) assert.ok(!text.includes(secret), "no session values in the file")
	assert.equal(saved.sharedFile.items.length, 47)
	assert.equal(saved.watchlistRuns[0].completeness, "complete")
	assert.equal(saved.watchlistRuns[1].members.length, 47)
	assert.equal(saved.watchlistRuns[0].query, rejectObjectId ? "fallback" : "full")
	assert.equal(saved.sharedFile.completeness, "complete")
	assert.equal(saved.reconciled.chosenRun, 2)
	if (process.env.SAVE_TO && !rejectObjectId) writeFileSync(process.env.SAVE_TO, JSON.stringify(saved))
	console.log(
		`snippet ok (${rejectObjectId ? "objectId rejected, fallback" : "full query"}): ${destinations.length} requests, all to ${destinations[0].url}; ${saved.sharedFile.items.length} wishes; Seen list ${saved.seenlist.members.length}`,
	)
}
