import { readFile } from "node:fs/promises"
export type Env = Record<string, string | undefined>
const secretNames = [
	"YEPWATCH_PROPOSAL_SECRET",
	"YEPWATCH_PROPOSAL_GATEWAY_SECRET",
	"YEPWATCH_PROPOSAL_CRATEDB_PASSWORD",
	"YEPWATCH_PROPOSAL_REVISION_REDIS_URL",
	"CRATE_PASS",
	"REDIS_PASS",
] as const
/** Load only the named runtime secrets before importing any existing catalog modules. Values never logged. */
export async function loadReleaseSecrets(
	env: Env,
	read = (path: string) => readFile(path, "utf8")
) {
	for (const name of secretNames) {
		const path = env[`${name}_FILE`]
		if (!path) continue
		if (env[name] !== undefined)
			throw new Error(`Configure ${name} or its _FILE, not both`)
		env[name] = (await read(path)).replace(/\r?\n$/, "")
	}
}
function required(env: Env, name: string) {
	const value = env[name]
	if (value === undefined || value === "") throw new Error(`Missing ${name}`)
	return value
}
function url(value: string, protocols: string[]) {
	const parsed = new URL(value)
	if (!protocols.includes(parsed.protocol))
		throw new Error("Unsupported runtime URL protocol")
	return parsed
}
function integer(
	env: Env,
	name: string,
	fallback: number,
	min: number,
	max: number
) {
	const value = env[name] === undefined ? fallback : Number(env[name])
	if (!Number.isInteger(value) || value < min || value > max)
		throw new Error(`Invalid ${name}`)
	return value
}
export function releaseControlConfig(env: Env) {
	return {
		rooms: integer(env, "YEPWATCH_PROPOSAL_MAX_ACTIVE_ROOMS", 20, 1, 100),
		admissions: integer(
			env,
			"YEPWATCH_PROPOSAL_ADMISSIONS_PER_MINUTE",
			20,
			1,
			120
		),
		commands: integer(
			env,
			"YEPWATCH_PROPOSAL_COMMANDS_PER_MINUTE",
			600,
			1,
			2400
		),
		actorCommands: integer(
			env,
			"YEPWATCH_PROPOSAL_ACTOR_COMMANDS_PER_MINUTE",
			60,
			1,
			120
		),
	}
}
export function releaseStoreConfig(env: Env) {
	const origin = url(required(env, "YEPWATCH_PROPOSAL_CRATEDB_ORIGIN"), [
		"http:",
		"https:",
	])
	if (origin.username || origin.password || origin.pathname !== "/")
		throw new Error("Room origin must not contain credentials or a path")
	const secret = required(env, "YEPWATCH_PROPOSAL_SECRET")
	if (secret.length < 32)
		throw new Error("Room secret must have at least 32 characters")
	const keyId = required(env, "YEPWATCH_PROPOSAL_KEY_ID")
	if (!/^[A-Za-z0-9_-]{1,80}$/.test(keyId))
		throw new Error("Invalid room key ID")
	return {
		origin: origin.origin,
		username: required(env, "YEPWATCH_PROPOSAL_CRATEDB_USERNAME"),
		password: env.YEPWATCH_PROPOSAL_CRATEDB_PASSWORD ?? "",
		secret,
		keyId,
	}
}
export function releaseConfig(env: Env) {
	for (const name of [
		"TITLE_SNAPSHOT_REDIS_URL",
		"YEPWATCH_LOCAL_FIXTURES",
		"YEPWATCH_LOCAL_MEMBER_FIXTURE",
		"YEPWATCH_LOCAL_MEMBER_FILE",
		"YEPWATCH_LOAD_LOCAL_ENV",
		"YEPWATCH_INSTALL_DISPOSABLE_TABLE",
	])
		if (env[name]) throw new Error(`Release must not configure ${name}`)
	const publicUrl = url(required(env, "YEPWATCH_PROPOSAL_PUBLIC_ORIGIN"), [
		"https:",
	])
	if (publicUrl.origin !== env.YEPWATCH_PROPOSAL_PUBLIC_ORIGIN)
		throw new Error("Public origin must be an exact HTTPS origin")
	if (
		env.YEPWATCH_PROPOSAL_ALLOWED_ORIGINS &&
		env.YEPWATCH_PROPOSAL_ALLOWED_ORIGINS !== publicUrl.origin
	)
		throw new Error("Guest release allows only its public same-origin browser")
	const gatewaySecret = required(env, "YEPWATCH_PROPOSAL_GATEWAY_SECRET")
	if (gatewaySecret.length < 32)
		throw new Error("Gateway secret must have at least 32 characters")
	const revisionUrl = required(env, "YEPWATCH_PROPOSAL_REVISION_REDIS_URL")
	url(revisionUrl, ["redis:", "rediss:"])
	for (const name of ["CRATE_HOSTS", "REDIS_HOST", "REDIS_PORT"])
		required(env, name)
	return {
		...releaseStoreConfig(env),
		control: releaseControlConfig(env),
		publicOrigin: publicUrl.origin,
		gatewaySecret,
		revisionUrl,
		host: env.HOST ?? "0.0.0.0",
		port: integer(env, "PORT", 3000, 0, 65535),
		sourceCommit: env.SOURCE_COMMIT ?? "unknown",
		probeMs: integer(env, "YEPWATCH_PROPOSAL_PROBE_MS", 5000, 100, 60000),
		shutdownDelayMs: integer(
			env,
			"YEPWATCH_PROPOSAL_SHUTDOWN_DELAY_MS",
			8000,
			0,
			10000
		),
		drainMs: integer(env, "YEPWATCH_PROPOSAL_DRAIN_MS", 12000, 100, 15000),
	}
}
export type ReleaseConfig = ReturnType<typeof releaseConfig>
