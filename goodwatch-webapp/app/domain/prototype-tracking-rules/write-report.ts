// PROTOTYPE (issue #368). Writes the report. Run from goodwatch-webapp:
//   node app/domain/prototype-tracking-rules/write-report.ts
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { renderReport } from "./report.ts"
import { SCENARIOS } from "./scenarios.ts"
import { SURPRISES } from "./surprises.ts"

export const REPORT_PATH = fileURLToPath(
	new URL(
		"../../../../docs/prototypes/tracking-rules/README.md",
		import.meta.url,
	),
)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	mkdirSync(dirname(REPORT_PATH), { recursive: true })
	writeFileSync(REPORT_PATH, renderReport(SCENARIOS, SURPRISES))
	console.log(`Wrote ${REPORT_PATH}`)
}
