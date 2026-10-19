// Owner step for #712, part 2 of 2. Reads plex-fetch.mjs's recording from
// stdin, plays Plex for a disposable Seerr from memory, reads one Seerr
// user's Watchlist with the reader, and prints counts only to stdout.
//
// Seerr gets a synthetic token, never the owner's. With
// GW712_INJECT_REFRESH_FAILURE=1 (dry run), metadata succeeds once per item
// and then fails, and the reader waits past Seerr's 10-second rolling-cache
// buffer before its second run. That makes Seerr's unhandled background
// refresh fail, which prints the request's token on Seerr's stderr.
//
// Usage: node plex-replay.mjs <seerr-url> <seerr-db> <cert> <key>
import { randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"
import { createServer } from "node:https"
import { DatabaseSync } from "node:sqlite"
import { connect, readWatchlist } from "../reader.mjs"

const [seerrUrl, dbPath, certPath, keyPath] = process.argv.slice(2)
const inject = process.env.GW712_INJECT_REFRESH_FAILURE === "1"
const API_KEY = "gw712-local-test-key"
const SYNTHETIC = `gw712-replay-${randomBytes(12).toString("hex")}`

let input = ""
for await (const chunk of process.stdin) input += chunk
const recording = JSON.parse(input)
input = ""

const served = { list: 0, listMisses: 0, metadata: 0, metadataMisses: 0, refreshFailuresServed: 0 }
const tokensSeen = new Set()
const listCursor = {}
const metadataServed = new Set()
const send = (res, status, body, headers = {}) => {
	res.writeHead(status, { "content-type": "application/json", ...headers })
	res.end(body === undefined ? "" : JSON.stringify(body))
}
const server = createServer({ cert: readFileSync(certPath), key: readFileSync(keyPath) }, (req, res) => {
	const url = new URL(req.url, "https://discover.provider.plex.tv")
	if (req.headers["x-plex-token"]) tokensSeen.add(req.headers["x-plex-token"])
	if (url.pathname === "/library/sections/watchlist/all") {
		served.list += 1
		const key = `${url.searchParams.get("X-Plex-Container-Start") ?? "0"}|${req.headers["if-none-match"] ?? ""}`
		const responses = recording.list[key]
		if (!responses) {
			served.listMisses += 1
			return send(res, 599, {})
		}
		const index = Math.min(listCursor[key] ?? 0, responses.length - 1)
		listCursor[key] = index + 1
		const response = responses[index]
		if (!response.status) return res.destroy()
		return send(res, response.status, response.status === 304 ? undefined : response.body, response.etag ? { etag: response.etag } : {})
	}
	const metadata = /^\/library\/metadata\/(.+)$/.exec(url.pathname)
	if (metadata) {
		served.metadata += 1
		const ratingKey = decodeURIComponent(metadata[1])
		const response = recording.metadata[ratingKey]
		if (!response) {
			served.metadataMisses += 1
			return send(res, 599, {})
		}
		if (inject && metadataServed.has(ratingKey)) {
			served.refreshFailuresServed += 1
			return send(res, 500, {})
		}
		metadataServed.add(ratingKey)
		if (!response.status) return res.destroy()
		return send(res, response.status, response.body)
	}
	send(res, 404, {})
})
await new Promise((resolve) => server.listen(443, resolve))

const api = async (path, init = {}) => {
	const response = await fetch(`${seerrUrl}/api/v1${path}`, {
		...init,
		headers: { "x-api-key": API_KEY, "content-type": "application/json", ...init.headers },
	})
	if (!response.ok) throw new Error(`Seerr ${path} answered ${response.status}`)
	return response.json()
}
const user = await api("/user", {
	method: "POST",
	body: JSON.stringify({ email: "plex-check@gw712.invalid", username: "plexcheck", password: `pw-${randomBytes(8).toString("hex")}` }),
})
const db = new DatabaseSync(dbPath)
db.exec("PRAGMA busy_timeout = 5000")
db.prepare("UPDATE user SET plexToken = ? WHERE id = ?").run(SYNTHETIC, user.id)

const seerr = await connect({ baseUrl: seerrUrl, apiKey: API_KEY, apiUser: user.id })
const strip = ({ report, file }) => ({ ...report, fileWritten: !!file, fileLabel: file?.completeness ?? null })
const attempt = async () => {
	try {
		return strip(await readWatchlist({ getPage: seerr.getPage }))
	} catch (error) {
		return { failed: error.message }
	}
}
const coldCache = await attempt()
if (inject) await new Promise((resolve) => setTimeout(resolve, 11_000))
const warmCache = await attempt()
// Give background refreshes time to land before checking on Seerr.
if (inject) await new Promise((resolve) => setTimeout(resolve, 2_000))
let seerrAlive = true
try {
	await api("/status")
} catch {
	seerrAlive = false
}
db.prepare("UPDATE user SET plexToken = NULL WHERE id = ?").run(user.id)
server.close()

const summary = {
	measuredAt: new Date().toISOString(),
	direct: recording.direct,
	metadata: recording.metadataCounts,
	throughSeerr: { coldCache, warmCache, seerrAliveAfterwards: seerrAlive },
	replay: { listRequests: served.list, listMisses: served.listMisses, metadataRequests: served.metadata, metadataMisses: served.metadataMisses },
}
if (inject)
	summary.dryRun = {
		refreshFailuresServed: served.refreshFailuresServed,
		seerrTokensSeen: tokensSeen.size,
		seerrTokensSynthetic: [...tokensSeen].every((token) => token === SYNTHETIC),
	}
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
process.exit(0)
