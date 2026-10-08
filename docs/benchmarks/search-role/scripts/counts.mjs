// Prints the row counts of the three search tables that a ranked search could write to. Read only. Run inside the
// measurement image before and after the warm-up: the counts must not change because of the measurement.
const host = process.env.CRATE_HOSTS.split(",")[0]
const counts = {}
for (const table of ["search_history", "search_interpretations", "search_spending"]) {
	const response = await fetch(`http://${host}:${process.env.CRATE_PORT || "4200"}/_sql`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Basic ${Buffer.from(`${process.env.CRATE_USER || ""}:${process.env.CRATE_PASS || ""}`).toString("base64")}`,
		},
		body: JSON.stringify({ stmt: `SELECT count(*) FROM doc.${table}` }),
	})
	counts[table] = response.ok ? (await response.json()).rows[0][0] : `error ${response.status}`
}
console.log(JSON.stringify({ at: new Date().toISOString(), ...counts }))
