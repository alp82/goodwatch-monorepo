// Lists the main-thread tasks of a saved trace with what runs in each.
import { readFileSync } from "node:fs"
const events = JSON.parse(readFileSync(process.argv[2], "utf8")).traceEvents
const min = Number(process.argv[3] ?? 8)
const mark = (name) => events.find((e) => e.cat?.includes("blink.user_timing") && e.name === name)
const call = mark("gw:hydrate-call")
const { pid, tid } = call
const nav = events.find((e) => e.name === "navigationStart" && e.pid === pid && e.args?.data?.documentLoaderURL?.startsWith("http://localhost"))?.ts
const main = events.filter((e) => e.pid === pid && e.tid === tid && e.ph === "X" && e.dur != null && e.ts >= nav).sort((a, b) => a.ts - b.ts || b.dur - a.dur)
const ms = (t) => ((t - nav) / 1000).toFixed(0)
for (const m of events.filter((e) => e.cat?.includes("blink.user_timing") && e.pid === pid)) console.log("MARK", ms(m.ts), m.name, m.ph)
for (const n of ["firstContentfulPaint", "MarkDOMContent", "MarkLoad", "largestContentfulPaint::Candidate"]) for (const e of events.filter((e) => e.name === n && e.pid === pid)) console.log("EV", ms(e.ts), n)
const tasks = main.filter((e) => e.name === "RunTask")
let small = 0, smallDur = 0
for (const t of tasks) {
	if (t.dur < min * 1000) { small++; smallDur += t.dur; continue }
	const inside = main.filter((e) => e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur)
	// direct children: not contained in another inside event
	const direct = []
	let end = -1
	for (const e of inside) { if (e.ts >= end) { direct.push(e); end = e.ts + e.dur } }
	const label = direct.filter((e) => e.dur > 3000).map((e) => {
		const d = e.args?.data ?? {}
		const what = d.url ? d.url.split("/").pop().slice(0, 40) : d.functionName ? `${d.functionName}@${(d.url ?? "").split("/").pop()}` : d.type ?? ""
		return `${e.name}(${(e.dur / 1000).toFixed(0)}${what ? " " + what : ""})`
	})
	console.log(`TASK ${ms(t.ts)} +${(t.dur / 1000).toFixed(0)}  ${label.join(" ").slice(0, 400)}`)
}
console.log("small tasks", small, (smallDur / 1000).toFixed(0), "ms")
