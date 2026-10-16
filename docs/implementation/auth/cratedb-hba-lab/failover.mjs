// Load through the webapp's Crate wrapper with CRATE_USER/CRATE_PASS while lab.py restarts or kills a node.
// Started by lab.py from goodwatch-webapp/ with the environment set; prints "ready", runs until "stop" on stdin,
// then prints one JSON result. Four readers mix primary-key reads and aggregates; one writer upserts fixed keys.
import { format } from "node:util"
import { setTimeout as delay } from "node:timers/promises"

const logged = []
for (const method of ["log", "warn", "error", "trace"]) console[method] = (...args) => logged.push(format(...args))
const { query, upsert } = await import(new URL("../../../../goodwatch-webapp/app/utils/crate.ts", import.meta.url))

const result = {
	reads: { ok: 0, failed: 0, maxMs: 0 },
	upserts: { ok: 0, failed: 0, maxMs: 0 },
	currentUser: new Set(),
	errors: [],
}
let running = true
const timed = async (bucket, work) => {
	const started = performance.now()
	try {
		await work()
		bucket.ok++
	} catch (error) {
		bucket.failed++
		if (result.errors.length < 20) result.errors.push(String(error?.message ?? error).slice(0, 300))
	}
	bucket.maxMs = Math.max(bucket.maxMs, Math.round(performance.now() - started))
}

async function reader(i) {
	for (let n = 0; running; n++) {
		await timed(result.reads, async () => {
			if (n % 3 === 0) {
				const rows = await query("SELECT current_user AS who")
				result.currentUser.add(rows[0].who)
			} else if (n % 3 === 1) {
				const rows = await query("SELECT title FROM doc.movies WHERE tmdb_id = ?", [603])
				if (rows[0]?.title !== "The Matrix") throw new Error("wrong catalog row")
			} else {
				await query("SELECT count(*) AS n FROM doc.user_setting")
			}
		})
		await delay(20 + i)
	}
}

async function writer() {
	for (let n = 0; running; n++) {
		const key = `k${n % 50}`
		await timed(result.upserts, () =>
			upsert({ table: "user_setting", data: [{ user_id: "lab", key, value: String(n) }], conflictColumns: ["user_id", "key"] }))
		await delay(30)
	}
}

const work = Promise.all([0, 1, 2, 3].map(reader).concat(writer()))
process.stdout.write("ready\n")
let input = ""
process.stdin.setEncoding("utf8")
await new Promise((resolve) => process.stdin.on("data", (chunk) => {
	input += chunk
	if (input.includes("stop")) resolve()
}))
running = false
await work
result.currentUser = [...result.currentUser]
result.wrapperLogLines = logged.length
process.stdout.write(JSON.stringify(result))
process.exit(0)
