import { processRole } from "../role.server.ts"

let started = false

/** Start the shared ranking read before the first page request, without delaying server startup. */
export function startHotOnSocialsWarmup(
	env: Record<string, string | undefined> = process.env,
	load: () => Promise<unknown> = async () =>
		(await import("./start-row.server.ts")).getHotOnSocials(),
): void {
	if (
		started ||
		env.NODE_ENV !== "production" ||
		env.NODE_TEST_CONTEXT ||
		processRole(env) === "search"
	)
		return
	started = true
	// A failed fill uses the same retry backoff as request-triggered reads. It never prevents startup.
	void Promise.resolve()
		.then(load)
		.catch(() => {})
}
