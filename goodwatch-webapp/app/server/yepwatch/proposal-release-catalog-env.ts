import type { Env } from "./proposal-release-config.ts"
/** Clearing environment cannot undo an earlier module initialization: refuse to serve in that case. */
export function assertNoSharedCatalogWriter(read: () => unknown) {
	if (read() !== null)
		throw new Error(
			"Guest release imported a shared catalog writer before isolating configuration"
		)
}
/** Capture the source reader settings, then remove all general shared-cache writers BEFORE catalog imports. */
export function readonlyCatalogEnvironment(env: Env) {
	const host = env.REDIS_HOST
	const port = Number(env.REDIS_PORT)
	if (!host || !Number.isInteger(port) || port <= 0)
		throw new Error("Full snapshot reader requires an existing cluster seed")
	for (const name of [
		"TITLE_SNAPSHOT_REDIS_URL",
		"TITLE_CARDS_REDIS_URL",
		"TASTE_REDIS_URL",
	])
		if (env[name])
			throw new Error(
				`Guest release does not use the development cache override ${name}`
			)
	const source = {
		nodes: [
			...new Set(
				[host, env.REDIS_HOST2, env.REDIS_HOST3].filter((v): v is string => !!v)
			),
		].map((host) => ({ host, port })),
		password: env.REDIS_PASS ?? "",
		timeoutMs: Number(env.REDIS_COMMAND_TIMEOUT_MS) || 10000,
	}
	for (const name of [
		"REDIS_HOST",
		"REDIS_HOST2",
		"REDIS_HOST3",
		"REDIS_PASS",
		"REDIS_PASS_FILE",
	])
		delete env[name]
	return source
}
