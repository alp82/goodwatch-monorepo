import {
	controlFingerprint,
	CONTROL_COLUMNS,
	controlRow,
} from "./proposal-release-control.ts"
import { test } from "node:test"
import assert from "node:assert/strict"
import {
	releaseConfig,
	loadReleaseSecrets,
	type Env,
} from "./proposal-release-config.ts"
import {
	createReleaseRuntime,
	RELEASE_HEALTH,
} from "./proposal-release-runtime.ts"
import {
	storeMarker,
	checkReleaseStore,
	provisionReleaseStore,
} from "./proposal-release-store.ts"
import { releaseHttp } from "./proposal-release-http.ts"
import { CONTINUOUS_LIMITS } from "./continuous-types.ts"
import type { Sql } from "./repository.server.ts"
import type { ProposalCatalog } from "./proposal-types.ts"
import {
	readonlyCatalogEnvironment,
	assertNoSharedCatalogWriter,
} from "./proposal-release-catalog-env.ts"
const secret = "ordinary-release-configuration-secret-at-least32"
test("An already initialized shared writer cannot survive configuration clearing and still serve the release", () => {
	const input = env()
	readonlyCatalogEnvironment(input)
	assert.throws(
		() => assertNoSharedCatalogWriter(() => ({ alreadyInitialized: true })),
		/before isolating/
	)
	assert.doesNotThrow(() => assertNoSharedCatalogWriter(() => null))
})
test("Source snapshot configuration is captured and all general cache-writer configuration is removed before imports", () => {
	const input: Env = {
		...env(),
		REDIS_HOST2: "catalog-cache2.invalid",
		REDIS_USER: "existing_reader",
		REDIS_PASS: "reader-value",
	}
	const source = readonlyCatalogEnvironment(input)
	assert.equal(source.nodes.length, 2)
	assert.equal(source.password, "reader-value")
	assert.equal(source.username, "existing_reader")
	for (const key of ["REDIS_HOST", "REDIS_HOST2", "REDIS_HOST3", "REDIS_USER", "REDIS_PASS"])
		assert.equal((input as Env)[key], undefined)
	assert.equal(input.CRATE_HOSTS, "catalog.invalid")
	assert.equal(
		input.YEPWATCH_PROPOSAL_REVISION_REDIS_URL,
		"redis://127.0.0.1:6379"
	)
})
function env(): Env {
	return {
		YEPWATCH_PROPOSAL_CRATEDB_ORIGIN: "http://127.0.0.1:4200",
		YEPWATCH_PROPOSAL_CRATEDB_USERNAME: "crate",
		YEPWATCH_PROPOSAL_SECRET: secret,
		YEPWATCH_PROPOSAL_KEY_ID: "test-key",
		YEPWATCH_PROPOSAL_GATEWAY_SECRET: secret,
		YEPWATCH_PROPOSAL_PUBLIC_ORIGIN: "https://yepwatch.com",
		YEPWATCH_PROPOSAL_REVISION_REDIS_URL: "redis://127.0.0.1:6379",
		CRATE_HOSTS: "catalog.invalid",
		REDIS_HOST: "catalog-cache.invalid",
		REDIS_PORT: "6379",
	}
}
test("Guest release configuration loads named secret files before catalog imports, without implicit sample or local issuer", async () => {
	const input = env()
	delete input.YEPWATCH_PROPOSAL_SECRET
	input.YEPWATCH_PROPOSAL_SECRET_FILE = "/mounted/key"
	await loadReleaseSecrets(input, async (path) => {
		assert.equal(path, "/mounted/key")
		return secret + "\n"
	})
	const config = releaseConfig(input)
	assert.equal(config.secret, secret)
	assert.equal(config.publicOrigin, "https://yepwatch.com")
	assert.equal(config.port, 3000)
	assert.throws(
		() =>
			releaseConfig({
				...input,
				TITLE_SNAPSHOT_REDIS_URL: "redis://sample.invalid",
			}),
		/must not configure/
	)
	assert.throws(
		() => releaseConfig({ ...input, YEPWATCH_LOCAL_MEMBER_FIXTURE: "1" }),
		/must not configure/
	)
})
test("Readiness stays red indefinitely without loaded snapshot; probes recover and dependency loss never reports green", async () => {
	let count = 0,
		clock = 1000,
		catalogOk = true,
		busOk = true,
		reads = 0,
		writes = 0
	const config = releaseConfig(env())
	const sql: Sql = async (stmt) => {
		reads++
		if (!stmt.startsWith("SELECT")) writes++
		return {
			rows: stmt.includes(
				"SELECT " +
					CONTROL_COLUMNS.join(",") +
					",_seq_no,_primary_term,CURRENT_TIMESTAMP"
			)
				? [
						[
							...CONTROL_COLUMNS.map(
								(k) =>
									controlRow({
										format: 1,
										fingerprint: controlFingerprint(config.control),
										window: -1,
										rooms: [],
										admissions: [],
										commands: [],
									})[k]
							),
							0,
							1,
							clock,
						],
				  ]
				: stmt.includes("format_version")
				? [[1, "test-key", storeMarker(secret), CONTINUOUS_LIMITS.roomMs]]
				: [],
			rowcount: 0,
		}
	}
	const catalog: ProposalCatalog = {
		metadata: async () => ({ countries: [], services: [], moods: [] }),
		page: async () => ({ candidates: [], exhausted: true }),
		recheck: async () => [],
	}
	const runtime = createReleaseRuntime(config, {
		sql,
		catalog,
		snapshot: () => (count ? { count, version: "full" } : null),
		now: () => clock,
		catalogProbe: async () => {
			if (!catalogOk) throw Error("temporary")
		},
		bus: {
			ping: async () => {
				if (!busOk) throw Error("temporary")
			},
			publish: async () => {},
		},
	})
	try {
		await runtime.probe()
		clock += 100000
		assert.equal(runtime.readiness().ready, false)
		const blocked = await runtime.handler(
			new Request("http://api" + RELEASE_HEALTH.ready)
		)
		assert.equal(blocked.status, 503)
		const admission = await runtime.handler(
			new Request("http://api/api/yepwatch/v1/proposal/rooms", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}",
			})
		)
		assert.equal(admission.status, 503)
		assert.equal(writes, 0)
		count = 255293
		await runtime.probe()
		assert.equal(runtime.readiness().ready, true)
		catalogOk = false
		await runtime.probe()
		assert.equal(runtime.readiness().ready, false)
		assert.equal(
			(await runtime.handler(new Request("http://api" + RELEASE_HEALTH.live)))
				.status,
			200
		)
		catalogOk = true
		busOk = false
		await runtime.probe()
		assert.equal(runtime.readiness().ready, false)
		busOk = true
		await runtime.probe()
		assert.equal(runtime.readiness().ready, true)
		runtime.drain()
		assert.equal(runtime.readiness().ready, false)
		assert.ok(reads > 0)
		assert.equal(writes, 0)
	} finally {
		runtime.stop()
	}
})
test("Operator provisioning is explicit and idempotent; ordinary startup only reads table configuration", async () => {
	let installed = false,
		writes = 0
	const sql: Sql = async (stmt) => {
		if (!stmt.startsWith("SELECT")) writes++
		if (stmt.includes("INSERT INTO doc.yepwatch_runtime")) installed = true
		const rows = stmt.includes("SELECT id FROM doc.yepwatch_runtime")
			? installed
				? [["proposal3"]]
				: []
			: stmt.includes("SELECT format_version")
			? installed
				? [[1, "test-key", storeMarker(secret), CONTINUOUS_LIMITS.roomMs]]
				: []
			: []
		return { rows, rowcount: 1 }
	}
	await provisionReleaseStore(sql, 0, "test-key", secret)
	assert.ok(writes >= 3)
	const before = writes
	await checkReleaseStore(sql, "test-key", secret)
	assert.equal(writes, before)
	await provisionReleaseStore(sql, 0, "test-key", secret)
	assert.equal(writes, before + 13)
})
test("Container listener uses configured bind/port and preserves Secure HttpOnly cookie headers", async () => {
	const server = await releaseHttp(
		async () =>
			new Response("{}", {
				headers: {
					"set-cookie": "yepwatch3_test=value; HttpOnly; Secure; SameSite=Lax",
				},
			}),
		"127.0.0.1",
		0
	)
	try {
		const { port } = server.address() as { port: number }
		const response = await fetch(`http://127.0.0.1:${port}/`)
		assert.equal(response.status, 200)
		assert.match(response.headers.get("set-cookie")!, /HttpOnly; Secure/)
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()))
	}
})

test("shared Redis uses explicit cluster nodes and separate messaging credentials", () => {
	const input = env()
	delete input.YEPWATCH_PROPOSAL_REVISION_REDIS_URL
	input.YEPWATCH_PROPOSAL_REDIS_NODES = JSON.stringify([
		{ host: "redis1.internal", port: 6379 },
		{ host: "redis2.internal", port: 6379 },
	])
	input.YEPWATCH_PROPOSAL_REDIS_USER = "yepwatch_messaging"
	input.YEPWATCH_PROPOSAL_REDIS_PASSWORD = "fixture-messaging-password"
	const config = releaseConfig(input)
	assert.equal(config.redisNodes?.length, 2)
	assert.equal(config.redisUsername, "yepwatch_messaging")
	assert.equal(config.revisionUrl, undefined)
	assert.throws(
		() =>
			releaseConfig({
				...input,
				YEPWATCH_PROPOSAL_REVISION_REDIS_URL: "redis://localhost:6379",
			}),
		/not both/
	)
	assert.throws(
		() => releaseConfig({ ...input, YEPWATCH_PROPOSAL_REDIS_PASSWORD: "" }),
		/dedicated/
	)
	assert.throws(
		() =>
			releaseConfig({
				...input,
				YEPWATCH_PROPOSAL_REDIS_NODES: '[{"host":"r","port":0}]',
			}),
		/Invalid/
	)
})
