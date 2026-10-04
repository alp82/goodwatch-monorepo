// stale-list.mjs: measures how long two webapp processes serve an old share list page to anonymous visitors.
// It writes nothing to Crate. The "old" state is a list view planted in the measurement instance's own Valkey, with a
// marker in the list's title, as if Crate had held it before an edit. The "edit" is the moment the planting stops.
//
// - MODE=reset: at that moment the script runs the data cache's reset script for the view key (the marker and the
//   delete in one step), which is what `resetListView` sends from the process that got the write. Neither app
//   process gets a reset of its page cache, so both stand for "the other instance".
// - MODE=noreset: nothing is sent. The planted value and the stored pages run out by their lifetimes alone.
//
// Environment: APPS (base URLs, comma-separated), LIST_PATH (never printed), SUPABASE_URL (for the name of the auth
// cookie), REDIS_HOST, REDIS_PORT, REDIS_PASS, ROUNDS (default 3), MODE.
// Run it inside the app image, which has ioredis:
//   docker run --rm --network gw-pagecache-net --env-file /opt/gw-pagecache/bench.env -e LIST_PATH=... -e MODE=reset \
//     -e APPS=http://172.31.247.20:3000,http://172.31.247.21:3000 -v /opt/gw-pagecache/work:/work:ro \
//     -w /app --entrypoint node <image> /work/stale-list.mjs
import { createHash, randomBytes } from "node:crypto"
import { createRequire } from "node:module"
const Redis = createRequire("/app/")("ioredis")

const apps = (process.env.APPS ?? "").split(",").filter(Boolean)
const path = process.env.LIST_PATH ?? ""
const mode = process.env.MODE ?? "reset"
const rounds = Number(process.env.ROUNDS ?? 3)
const id = path.split("/").at(-1)
if (!apps.length || !id) throw new Error("Set APPS and LIST_PATH")
const MARKER = "Stale marker 250"
const key = `cached-share-list-view-v1:${createHash("sha256").update(JSON.stringify({ id })).digest("hex")}`
const markerKey = `cached-reset:{${key}}`
const redis = new Redis.Cluster([{ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) }], {
	dnsLookup: (address, callback) => callback(null, address),
	redisOptions: { password: process.env.REDIS_PASS },
})
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const browser = {
	"User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
	"Accept-Language": "en-US,en;q=0.9",
}
const audiences = {
	// A visitor without the identity header gets a keyed page, and one with it a shared page: two stored pages per app.
	keyed: { ...browser, Cookie: "gw_browser=1" },
	shared: { ...browser, Cookie: "gw_browser=1", "GW-Cache-Identity": "anon;US;en" },
}
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0]
const member = { ...browser, Cookie: `gw_browser=1; sb-${ref}-auth-token=forged` }

async function get(app, headers) {
	const response = await fetch(app + path, { headers, redirect: "manual", signal: AbortSignal.timeout(15_000) })
	const html = await response.text()
	return {
		status: response.status,
		old: html.includes(MARKER),
		state: response.headers.get("gw-page-cache"),
		age: Number(response.headers.get("age") ?? 0),
		control: response.headers.get("cache-control"),
	}
}

async function round(n) {
	// The real view, as the app stores it.
	await redis.del(key)
	await get(apps[0], member)
	let raw = null
	for (let i = 0; i < 50 && !raw; i++) {
		raw = await redis.get(key)
		if (!raw) await sleep(100)
	}
	if (!raw) throw new Error("The app stored no list view")
	const view = JSON.parse(raw).data
	const planted = () =>
		JSON.stringify({ data: { ...view, list: { ...view.list, title: MARKER } }, timestamp: Date.now() })

	// Before the edit: keep the old view fresh, and request the page until every process serves it from its store.
	// A random extra wait puts the edit at a different point of each stored page's lifetime.
	const planter = setInterval(() => void redis.set(key, planted(), "EX", 20), 1000)
	await redis.set(key, planted(), "EX", 20)
	const settle = Date.now() + 22_000 + Math.random() * 10_000
	let served = 0
	while (Date.now() < settle || served < apps.length * 2) {
		served = 0
		for (const app of apps)
			for (const headers of Object.values(audiences)) {
				const result = await get(app, headers)
				if (result.old && (result.state === "hit" || result.state === "stale")) served++
			}
		await sleep(150)
		if (Date.now() > settle + 60_000) throw new Error("The old page never reached every store")
	}

	// The edit.
	clearInterval(planter)
	await sleep(50)
	await redis.set(key, planted(), "EX", 20)
	const edit = Date.now()
	if (mode === "reset")
		await redis.eval(
			"redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2]); return redis.call('DEL', KEYS[1])",
			2,
			key,
			markerKey,
			randomBytes(9).toString("base64url"),
			320,
		)
	const resetMs = Date.now() - edit

	// After the edit: a member at once, then anonymous visitors until 70 seconds have passed.
	const members = []
	for (const app of apps) {
		const result = await get(app, member)
		members.push({ state: result.state, old: result.old, control: result.control, afterMs: Date.now() - edit })
	}
	const last = {}
	const states = {}
	while (Date.now() - edit < 70_000) {
		for (const [i, app] of apps.entries())
			for (const [audience, headers] of Object.entries(audiences)) {
				const result = await get(app, headers)
				const name = `app${i + 1}.${audience}`
				if (result.status !== 200) throw new Error(`Status ${result.status}`)
				if (result.old) {
					last[name] = { lastOldMs: Date.now() - edit, state: result.state, age: result.age }
					states[name] = { ...states[name], [result.state]: (states[name]?.[result.state] ?? 0) + 1 }
				}
			}
		await sleep(100)
	}
	console.log(JSON.stringify({ mode, round: n, resetMs, members, lastOld: last, oldByState: states }))
	return Math.max(0, ...Object.values(last).map((entry) => entry.lastOldMs))
}

let worst = 0
for (let n = 1; n <= rounds; n++) worst = Math.max(worst, await round(n))
console.log(JSON.stringify({ mode, rounds, worstLastOldMs: worst }))
await redis.del(key)
redis.disconnect()
