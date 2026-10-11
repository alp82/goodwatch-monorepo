// Anonymous lifecycle evidence complements encrypted history, which can miss failures before delivery.
import { randomUUID } from "node:crypto"

type Completion = "completed" | "failed" | "aborted"
type Output = (event: Record<string, unknown>) => void

export function beginSearchTelemetry(
	output: Output = event => console.info(JSON.stringify(event)),
	now: () => number = Date.now,
) {
	const started = now()
	const id = randomUUID()
	const role = process.env.WEBAPP_ROLE === "search" ? "search" : "page"
	const commit = /^[a-f0-9]{40}$/.test(process.env.SOURCE_COMMIT ?? "")
		? process.env.SOURCE_COMMIT : null
	const emit = (fields: Record<string, unknown>) => {
		try {
			output({ event: "search.lifecycle.v1", at: new Date(now()).toISOString(), id, role, commit, ...fields })
		} catch { /* Telemetry must not change the search response. */ }
	}
	let finished = false
	let firstResults: number | null = null
	let computation: number | null = null
	let titleLookupFailed = false
	let descriptionFailed = false
	emit({ phase: "accepted" })
	return {
		delivered(final: boolean, usable: boolean, elapsedMs: number, errors: readonly string[]) {
			if (finished) return
			if (firstResults === null && (usable || final)) firstResults = now() - started
			if (final && Number.isFinite(elapsedMs) && elapsedMs >= 0) computation = elapsedMs
			titleLookupFailed ||= errors.includes("Title lookup unavailable")
			descriptionFailed ||= errors.includes("Description search unavailable")
		},
		finish(status: Completion) {
			if (finished) return
			finished = true
			emit({ phase: "finished", status, firstResultsMs: firstResults,
				computationMs: computation, lifetimeMs: now() - started,
				titleLookupFailed, descriptionFailed })
		},
	}
}

export function recordSearchHistoryWrite(recorded: boolean) {
	try {
		console.info(JSON.stringify({ event: "search.history-write.v1", at: new Date().toISOString(), recorded }))
	} catch { /* The history result remains available when the logging sink fails. */ }
}

export function recordSearchRejection(reason: "wrong_role" | "busy") {
	try {
		console.info(JSON.stringify({ event: "search.rejection.v1", at: new Date().toISOString(), reason }))
	} catch { /* Admission behavior does not depend on the logging sink. */ }
}
