import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { loadFixtures } from "./fixtures.mjs"
import { evaluateCase } from "./evaluate.mjs"

const args = process.argv.slice(2)
const option = (key) =>
	args.includes(key) ? args[args.indexOf(key) + 1] : undefined
const base = option("--url") ?? "http://127.0.0.1:5198"
const fixtures = option("--file")
	? JSON.parse(await readFile(option("--file"), "utf8"))
	: await loadFixtures(fileURLToPath(new URL("./", import.meta.url)))
if (args.includes("--reverse")) fixtures.reverse()
const referenceDate = "2026-11-01"
const reports = new Array(fixtures.length)
let next = 0
await Promise.all(
	Array.from({ length: Math.min(4, fixtures.length) }, async () => {
		while (next < fixtures.length) {
			const index = next++,
				fixture = fixtures[index]
			if (fixture.semantic && !args.includes("--semantic")) {
				reports[index] = {
					fixture,
					judgment: { status: "Needs fingerprint read", failures: [] },
				}
				continue
			}
			try {
				const response = await fetch(new URL("/api/interpret", base), {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						...fixture,
						date: fixture.date ?? referenceDate,
						semantic: Boolean(fixture.semantic),
					}),
					signal: AbortSignal.timeout(60000),
				})
				if (!response.ok)
					throw Error(`HTTP ${response.status}: ${await response.text()}`)
				const data = await response.json()
				const judgment = evaluateCase(fixture, data)
				reports[index] = { fixture, data, judgment }
				if (judgment.failures.length)
					console.log(
						`FAIL ${fixture.query}${fixture.existing ? ` [${fixture.existing}]` : ""}\n  ${judgment.failures.join("\n  ")}`,
					)
			} catch (error) {
				reports[index] = {
					fixture,
					judgment: { status: "Error", failures: [error.message] },
				}
				console.log(`ERROR ${fixture.query}: ${error.message}`)
			}
		}
	}),
)
const counts = Object.fromEntries(
	[...new Set(reports.map((row) => row.judgment.status))].map((status) => [
		status,
		reports.filter((row) => row.judgment.status === status).length,
	]),
)
console.log(
	JSON.stringify({ cases: fixtures.length, referenceDate, counts }, null, 2),
)
if (option("--out"))
	await writeFile(
		option("--out"),
		JSON.stringify(
			{ createdAt: new Date().toISOString(), referenceDate, counts, reports },
			null,
			2,
		) + "\n",
	)
if (reports.some((row) => row.judgment.failures.length)) process.exitCode = 1
