import { captureMessage } from "@sentry/remix"
import { counter, gauge } from "../metrics/registry.server.ts"
import { authModels } from "./crate-adapter.server.ts"
import {
	type AuthMaintenanceOptions, recoverEmailClaims, collectAuthGarbage,
	reconcileAuthCapacity, reconcileAuthRows, reconcilableAuthModels,
	rotateAuthEncryption, auditAuthPopulation,
} from "./maintenance.server.ts"

type Options = AuthMaintenanceOptions & { storage?: { delete(key: string): Promise<unknown> } }
type JobReport = { job: string; model?: string; [count: string]: string | number | undefined }
const outcomes = counter("goodwatch_auth_maintenance_total", "Auth maintenance pages by bounded job and outcome.", ["job", "outcome"], 32)
let lastCompleted = 0
gauge("goodwatch_auth_maintenance_last_completed_seconds", "Unix time of the last completed auth maintenance pass.", [], () => [{ labels: [], value: lastCompleted }], 1)

/** Serial pages avoid population-size limits and make interruption safe at every boundary. */
export async function runAuthMaintenancePass(options: Options & { signal?: AbortSignal; auditOnly?: boolean }) {
	const jobs: JobReport[] = []
	const run = async (job: string, model: string | undefined, execute: (cursor?: string) => Promise<{ cursor: string | null; complete: boolean; [key: string]: unknown }>) => {
		const total: JobReport = { job, model }
		let cursor: string | undefined
		for (;;) {
			options.signal?.throwIfAborted()
			const report = await execute(cursor)
			for (const [key, value] of Object.entries(report)) if (typeof value === "number") total[key] = Number(total[key] ?? 0) + value
			outcomes.inc([job, "completed"])
			if (report.safe === false) { total.unsafe = Number(total.unsafe ?? 0) + 1; outcomes.inc([job, "unsafe"]) }
			if (report.complete) break
			if (!report.cursor || report.cursor === cursor) throw new Error("Auth maintenance cursor did not advance")
			cursor = report.cursor
		}
		jobs.push(total)
	}
	const shared = { ...options, batchSize: options.batchSize ?? 100 }
	if (options.auditOnly) {
		for (const model of authModels) await run("audit", model, cursor => auditAuthPopulation({ ...shared, model, cursor }))
	} else {
		await run("claims", undefined, cursor => recoverEmailClaims({ ...shared, cursor }))
		for (const model of reconcilableAuthModels) await run("reconcile", model, cursor => reconcileAuthRows({ ...shared, model, cursor }))
		for (const model of authModels) await run("garbage", model, cursor => collectAuthGarbage({ ...shared, model, cursor }))
		await run("capacity", undefined, cursor => reconcileAuthCapacity({ ...shared, cursor }))
		if (options.encryptionKeys) for (const model of [...authModels, "capacity"]) await run("encryption", model, cursor => rotateAuthEncryption({ ...shared, model, cursor }))
	}
	lastCompleted = Date.now() / 1000
	return { jobs, completedAt: new Date().toISOString() }
}

/** One pass at a time per process. All writes are fenced so several processes may run safely. */
export function startAuthMaintenance(options: Options & { intervalMs?: number; reportFailure?: () => void }) {
	const interval = options.intervalMs ?? 60000
	if (!Number.isSafeInteger(interval) || interval < 1) throw new Error("Invalid auth maintenance interval")
	const controller = new AbortController()
	let stopped = false
	let timer: ReturnType<typeof setTimeout> | undefined
	let pending: ReturnType<typeof runAuthMaintenancePass> | null = null
	const reportFailure = options.reportFailure ?? (() => { captureMessage("Auth maintenance pass failed; retrying with authenticated primary-key checks", "error") })
	const schedule = () => {
		if (!stopped) timer = setTimeout(() => { void runNow().catch(() => {}) }, interval).unref()
	}
	const runNow = () => {
		if (stopped) return Promise.reject(new Error("Auth maintenance stopped"))
		if (pending) return pending
		clearTimeout(timer)
		pending = runAuthMaintenancePass({ ...options, signal: controller.signal }).catch(error => {
			if (!stopped) { outcomes.inc(["pass", "failed"]); reportFailure() }
			throw error
		}).finally(() => { pending = null; schedule() })
		return pending
	}
	schedule()
	return {
		runNow,
		async stop() {
			stopped = true
			clearTimeout(timer)
			controller.abort()
			await pending?.catch(() => {})
		},
	}
}
