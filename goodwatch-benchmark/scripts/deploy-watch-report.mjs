// Prints what `./bench.sh deploy-watch` recorded: the container events, the state changes, and the failed requests.
// Addresses in the recording aren't printed.
import { readFileSync } from "node:fs"
import { join } from "node:path"

const dir = process.argv[2]
if (!dir) {
	console.error("Usage: deploy-watch-report.mjs <results directory>")
	process.exit(2)
}
const time = (seconds) => new Date(seconds * 1000).toISOString().slice(11, 23)
const inside = readFileSync(join(dir, "inside.log"), "utf8").split("\n")

console.log("Container events (the host's clock, UTC)")
for (const line of inside) {
	if (!line.startsWith("EV ")) continue
	const [, nanos, ...rest] = line.split(" ")
	const event = rest.join(" ").replace(/ (signal|exit)=<no value>/g, "")
	console.log(`  ${time(Number(nanos) / 1e9)} ${event}`)
}

console.log("\nContainer state changes (polled once a second)")
const last = new Map()
for (const line of inside) {
	if (!line.startsWith("POLL ")) continue
	const [, at, name, ...state] = line.split(" ")
	const text = state.join(" ")
	if (last.get(name) === text) continue
	last.set(name, text)
	console.log(`  ${time(Number(at))} ${name} ${text}`)
}

console.log("\nShutdown log lines")
for (const line of inside)
	if (line.startsWith("LOG ") && line.includes("Shutdown:"))
		console.log(`  ${line.slice(4)}`)

const requests = readFileSync(join(dir, "outside.log"), "utf8")
	.split("\n")
	.filter(Boolean)
	.map((line) => {
		const [at, path, status, seconds] = line.split(" ")
		return { at: Number(at), path, status, seconds: Number(seconds) }
	})
	.sort((a, b) => a.at - b.at)
const counts = {}
for (const request of requests)
	counts[request.status] = (counts[request.status] ?? 0) + 1
console.log(
	`\nRequests from outside: ${requests.length} from ${time(requests[0].at)} to ${time(requests.at(-1).at)}`,
)
console.log(`  By status (000 is no answer within 20 seconds): ${JSON.stringify(counts)}`)
const failed = requests.filter((request) => request.status !== "200")
if (failed.length) {
	const [first, lastFailed] = [failed[0], failed.at(-1)]
	const inWindow = requests.filter(
		(request) => request.at >= first.at && request.at <= lastFailed.at,
	)
	console.log(
		`  Failed: ${failed.length} of the ${inWindow.length} requests between ${time(first.at)} and ${time(lastFailed.at)} (${(lastFailed.at - first.at).toFixed(1)} s)`,
	)
	for (const request of failed)
		console.log(
			`    ${time(request.at)} ${request.status} ${request.path} ${request.seconds.toFixed(2)} s`,
		)
} else console.log("  Failed: none")
const slow = requests.filter(
	(request) => request.status === "200" && request.seconds > 2,
)
console.log(
	`  Answered 200 after more than 2 seconds: ${slow.map((request) => `${time(request.at)} ${request.path} ${request.seconds.toFixed(1)} s`).join(", ") || "none"}`,
)
