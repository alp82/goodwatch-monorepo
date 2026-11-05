// Background search catalogs share one queue, away from request budgets. A failed refresh retains its snapshot and
// backs off; a slow catalog can never start alongside another catalog read. Spec: docs/implementation/grouped-search-panel.md.
import { fetch } from "undici"
import {
	CrateAuthenticationError,
	isCrateRecoveryError,
	toCrateError,
} from "~/utils/crate"

/** One 60-second attempt per host, with no replay on a host already tried. SELECT only, without logging row contents. */
export async function backgroundStatement(
	stmt: string,
): Promise<{ rows: unknown[][] }> {
	if (!/^SELECT\b/i.test(stmt))
		throw new Error("Background catalog must be read-only")
	const hosts = (process.env.CRATE_HOSTS ?? "")
		.split(",")
		.map((h) => h.trim())
		.filter(Boolean)
	if (!hosts.length) throw new Error("Catalog unavailable")
	const authorization = `Basic ${Buffer.from(`${process.env.CRATE_USER || "crate"}:${process.env.CRATE_PASS || ""}`).toString("base64")}`
	for (const [at, host] of hosts.entries()) {
		try {
			const response = await fetch(
				`http://${host}:${process.env.CRATE_PORT || "4200"}/_sql`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: authorization,
					},
					body: JSON.stringify({ stmt }),
					signal: AbortSignal.timeout(60_000),
				},
			)
			if (response.status === 401) {
				await response.body?.cancel()
				throw new CrateAuthenticationError("CrateDB HTTP 401")
			}
			const data = (await response.json().catch((error) => {
				if (response.ok) throw error
				return {}
			})) as {
				rows: unknown[][]
				error?: unknown
			}
			if (!response.ok || data.error)
				throw Object.assign(
					toCrateError(data.error ?? new Error("Catalog unavailable")),
					{ statusCode: response.status },
				)
			return data
		} catch (error) {
			const cause = (error as { cause?: unknown })?.cause
			const failure = cause instanceof Error && "code" in cause ? cause : error
			if (
				at === hosts.length - 1 ||
				!(
					isCrateRecoveryError(failure) ||
					(failure instanceof Error && failure.name === "TimeoutError")
				)
			)
				throw failure
		}
	}
	throw new Error("Catalog unavailable")
}

type Job = {
	load: () => Promise<void>
	interval: number
	due: number
	failures: number
}
const jobs = new Map<string, Job>()
let timer: ReturnType<typeof setTimeout> | undefined
let running = false
function wake() {
	if (running || timer || !jobs.size) return
	const due = Math.min(...[...jobs.values()].map((j) => j.due))
	timer = setTimeout(
		() => {
			timer = undefined
			void run()
		},
		Math.max(0, due - Date.now()),
	)
	timer.unref()
}
async function run() {
	running = true
	try {
		for (const [key, job] of jobs) {
			if (job.due > Date.now()) continue
			try {
				await job.load()
				job.failures = 0
				job.due = Date.now() + job.interval
			} catch (error) {
				const minutes = Math.min(30, 2 ** Math.min(job.failures++, 5))
				job.due = Date.now() + minutes * 60_000
				console.warn(
					`Palette ${key} refresh failed; retrying in ${minutes} minutes`,
					error,
				)
			}
		}
	} finally {
		running = false
		wake()
	}
}
/** Registration is idempotent. Startup gives request-serving indexes a five-second head start. */
export function scheduleCatalog(
	key: string,
	interval: number,
	load: () => Promise<void>,
) {
	if (jobs.has(key)) return
	jobs.set(key, { load, interval, due: Date.now() + 5000, failures: 0 })
	if (timer) {
		clearTimeout(timer)
		timer = undefined
	}
	wake()
}
