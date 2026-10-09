// Prints when the newest search_history rows were written and their outcome fields. Read only, no search text.
const host = process.env.CRATE_HOSTS.split(",")[0]
const q = async (stmt) => {
	const r = await fetch(`http://${host}:${process.env.CRATE_PORT || "4200"}/_sql`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${process.env.CRATE_USER || ""}:${process.env.CRATE_PASS || ""}`).toString("base64")}` },
		body: JSON.stringify({ stmt }),
	})
	return r.json()
}
const cols = (await q("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'doc' AND table_name = 'search_history'")).rows
const ts = cols.find((c) => /timestamp/.test(c[1]))?.[0]
const names = cols.map((c) => c[0]).filter((n) => /outcome|reason|fallback/.test(n))
console.log("columns:", cols.map((c) => c[0]).join(" "))
const rows = (await q(`SELECT ${[ts, ...names].join(", ")} FROM doc.search_history ORDER BY ${ts} DESC LIMIT 3`)).rows
console.log(JSON.stringify([[ts, ...names], ...rows.map((r) => [new Date(r[0]).toISOString(), ...r.slice(1)])]))
