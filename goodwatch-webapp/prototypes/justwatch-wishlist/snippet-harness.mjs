// Runs the built console snippet in Node with browser stubs. `respond(body, server)` may replace
// the fake server's answer; return undefined to use the fake server.
import { readFileSync } from "node:fs"
import { fakeJustWatch } from "./fake-justwatch.js"

export const TOKEN = `x.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 3600 })).toString("base64url")}.y`
export const SESSION_SECRETS = [TOKEN, "login-secret", "device-secret"]

export async function runSnippet({ respond, faults } = {}) {
	const snippet = readFileSync(new URL("./snippet/justwatch-capture.snippet.js", import.meta.url), "utf8")
	const server = fakeJustWatch(faults)
	const destinations = []
	let saved = null
	let alerted = null
	globalThis.location = { origin: "https://www.justwatch.com", pathname: "/us/watchlist" }
	globalThis.localStorage = { getItem: (key) => (key === "jw/user" ? JSON.stringify({ jwLoginId: "login-secret", jwId: "device-secret", accessToken: TOKEN }) : null) }
	globalThis.alert = (message) => {
		alerted = message
	}
	globalThis.document = { documentElement: { lang: "en-US" }, createElement: () => ({ click() {}, remove() {} }), body: { append() {} } }
	const realCreate = URL.createObjectURL
	const realTimeout = globalThis.setTimeout
	URL.createObjectURL = (blob) => {
		saved = blob
		return "blob:local"
	}
	globalThis.setTimeout = (fn) => realTimeout(fn, 0)
	globalThis.fetch = async (url, init) => {
		destinations.push({ url, method: init.method, credentials: init.credentials })
		const body = JSON.parse(init.body)
		const response = (await respond?.(body, server)) ?? (await server.request(body))
		return { status: response.status, json: async () => response.body }
	}
	const quiet = console.log
	console.log = () => {}
	try {
		await (0, eval)(snippet)
		for (let index = 0; index < 50 && !saved; index++) await new Promise((resolve) => setImmediate(resolve))
	} finally {
		console.log = quiet
		URL.createObjectURL = realCreate
		globalThis.setTimeout = realTimeout
	}
	return { destinations, savedText: saved ? await saved.text() : null, alerted }
}
