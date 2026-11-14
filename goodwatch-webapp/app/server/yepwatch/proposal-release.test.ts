import { MemoryTicketStore } from "./proposal-tickets.ts"
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
	liveRoute,
	RELEASE_HEALTH,
} from "./proposal-release-runtime.ts"
import {
	storeMarker,
	checkReleaseStore,
	provisionReleaseStore,
} from "./proposal-release-store.ts"
import { releaseHttp, RELEASE_KEEP_ALIVE_MS } from "./proposal-release-http.ts"
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
	for (const key of [
		"REDIS_HOST",
		"REDIS_HOST2",
		"REDIS_HOST3",
		"REDIS_USER",
		"REDIS_PASS",
	])
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
		YEPWATCH_PROPOSAL_ROOMS_VALKEY_URL: "redis://127.0.0.1:6380",
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
				? [[3, "test-key", storeMarker(secret), CONTINUOUS_LIMITS.roomMs]]
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
		tickets: new MemoryTicketStore(),
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
		// The release's listener waits for this (proposal-release-main.ts).
		assert.equal(runtime.initialized(), false)
		count = 255293
		await runtime.probe()
		assert.equal(runtime.readiness().ready, true)
		assert.equal(runtime.initialized(), true)
		catalogOk = false
		await runtime.probe()
		assert.equal(runtime.readiness().ready, false)
		assert.equal(runtime.initialized(), true)
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
test("A startup hold keeps early requests waiting; the live channel's routes go through once the rooms answer", async () => {
	let count = 0
	const config = releaseConfig(env())
	const sql: Sql = async (stmt) => ({
		rows: stmt.includes("SELECT " + CONTROL_COLUMNS.join(",") + ",_seq_no,_primary_term,CURRENT_TIMESTAMP")
			? [[...CONTROL_COLUMNS.map((k) => controlRow({ format: 1, fingerprint: controlFingerprint(config.control), window: -1, rooms: [], admissions: [], commands: [] })[k]), 0, 1, Date.now()]]
			: stmt.includes("format_version")
			? [[3, "test-key", storeMarker(secret), CONTINUOUS_LIMITS.roomMs]]
			: [],
		rowcount: 0,
	})
	const catalog: ProposalCatalog = {
		metadata: async () => ({ countries: [], services: [], moods: [] }),
		page: async () => ({ candidates: [], exhausted: true }),
		recheck: async () => [],
	}
	let warm!: () => void
	const runtime = createReleaseRuntime(config, {
		sql,
		catalog,
		snapshot: () => (count ? { count, version: "full" } : null),
		catalogProbe: async () => {},
		bus: { ping: async () => {}, publish: async () => {} },
		tickets: new MemoryTicketStore(),
		startupHoldMs: 5000,
		warm: new Promise<void>((resolve) => { warm = resolve }),
	})
	try {
		await runtime.probe()
		assert.equal(runtime.initialized(), false, "no snapshot yet")
		assert.equal(runtime.roomsAnswer(), true)
		// A room read is a live route: answered by the handler itself (no such room) without waiting for the snapshot.
		const read = await runtime.handler(new Request(`http://api/api/yepwatch/v1/proposal/rooms/${"a".repeat(32)}`))
		assert.notEqual(read.status, 503)
		// An admission waits for the snapshot and the warm reads, then gets the handler's own answer.
		let settled = false
		const admission = runtime.handler(new Request("http://api/api/yepwatch/v1/proposal/rooms", {
			method: "POST", headers: { "content-type": "application/json" }, body: "{}",
		})).finally(() => { settled = true })
		await new Promise((r) => setTimeout(r, 100))
		assert.equal(settled, false, "held while the release initializes")
		count = 1
		await runtime.probe()
		assert.equal(runtime.initialized(), true)
		await new Promise((r) => setTimeout(r, 100))
		assert.equal(settled, false, "held until the warm reads are in")
		warm()
		assert.notEqual((await admission).status, 503)
		// Draining ends a hold at once with the retryable refusal.
		const late = createReleaseRuntime(config, {
			sql, catalog, snapshot: () => null, catalogProbe: async () => {},
			bus: { ping: async () => {}, publish: async () => {} }, tickets: new MemoryTicketStore(), startupHoldMs: 5000,
		})
		const held = late.handler(new Request("http://api/api/yepwatch/v1/proposal/rooms", {
			method: "POST", headers: { "content-type": "application/json" }, body: "{}",
		}))
		late.drain()
		assert.equal((await held).status, 503)
		late.stop()
	} finally {
		runtime.stop()
	}
})
test("A room read before the release is initialized starts no idea takeover; after it, reads do again", async () => {
	const { ProposalService } = await import("./proposal-service.server.ts")
	const { ProposalMemoryRepository, proposalFixtureCatalog } = await import("./proposal-test-support.ts")
	const { PENDING_IDEA_ATTRIBUTE } = await import("../../../packages/yepwatch-contracts/proposal.ts")
	const config = releaseConfig(env())
	const sql: Sql = async (stmt) => ({
		rows: stmt.includes("SELECT " + CONTROL_COLUMNS.join(",") + ",_seq_no,_primary_term,CURRENT_TIMESTAMP")
			? [[...CONTROL_COLUMNS.map((k) => controlRow({ format: 1, fingerprint: controlFingerprint(config.control), window: -1, rooms: [], admissions: [], commands: [] })[k]), 0, 1, Date.now()]]
			: stmt.includes("format_version")
			? [[3, "test-key", storeMarker(secret), CONTINUOUS_LIMITS.roomMs]]
			: [],
		rowcount: 0,
	})
	const repo = new ProposalMemoryRepository()
	const seed = new ProposalService(repo, proposalFixtureCatalog, secret)
	const admitted = await seed.create({ contractVersion: 3, commandId: crypto.randomUUID(), admissionSecret: "a".repeat(43), nickname: "Host" })
	const room = repo.rows.get(admitted.credential.roomId)!.room
	// An idea whose search lease ran out (a deploy took its process away): any reader would take it over.
	room.ideas = [{ id: "idea-1", authorId: room.hostId, text: "space heist", on: true, attributes: [{ ...PENDING_IDEA_ATTRIBUTE }], rankedKeys: [], interpretedAt: Date.now() - 600_000 } as never]
	let count = 0
	const runtime = createReleaseRuntime(config, {
		sql, catalog: proposalFixtureCatalog, snapshot: () => (count ? { count, version: "full" } : null), catalogProbe: async () => {},
		bus: { ping: async () => {}, publish: async () => {} }, tickets: new MemoryTicketStore(), startupHoldMs: 1000,
	})
	const service = runtime.service as unknown as { repository: Record<string, unknown>; guard: unknown; interpret: unknown; interpretationsIdle(): Promise<void> }
	for (const method of ["read", "compareAndSwap", "acknowledge"]) service.repository[method] = (repo as unknown as Record<string, (...a: unknown[]) => unknown>)[method].bind(repo)
	service.guard = undefined
	let searches = 0
	service.interpret = async () => { searches++; return null }
	const read = () => runtime.handler(new Request(`http://api/api/yepwatch/v1/proposal/rooms/${room.id}`, { headers: { authorization: "Bearer invalid", "x-yepwatch-participant": room.hostId } }))
	try {
		await runtime.probe()
		assert.equal(runtime.initialized(), false)
		assert.equal(runtime.roomsAnswer(), true)
		assert.equal((await read()).status, 401)
		await service.interpretationsIdle()
		assert.equal(searches, 0, "no search before the release is initialized")
		count = 1
		await runtime.probe()
		assert.equal(runtime.initialized(), true)
		await read()
		await service.interpretationsIdle()
		assert.equal(searches, 1, "the takeover runs once initialized")
	} finally {
		runtime.stop()
	}
})
test("Live routes: the realtime ticket, the gateway's attach/view/views and the room read, nothing else", () => {
	const id = "b".repeat(32)
	const p = "/api/yepwatch/v1/proposal"
	for (const [method, path] of [["GET", `${p}/rooms/${id}`], ["POST", `${p}/rooms/${id}/realtime-ticket`], ["POST", `${p}/realtime/internal/attach`], ["POST", `${p}/realtime/internal/view`], ["POST", `${p}/realtime/internal/views`]])
		assert.equal(liveRoute(method, path), true, `${method} ${path}`)
	for (const [method, path] of [["POST", `${p}/rooms`], ["POST", `${p}/rooms/${id}/commands`], ["POST", `${p}/rooms/${id}/join`], ["GET", `${p}/rooms/${id}/member`], ["POST", `${p}/rooms/${id}`], ["GET", `${p}/rooms/${id}/realtime-ticket`], ["GET", `${p}/catalog/metadata`], ["GET", `${p}/rooms/short`]])
		assert.equal(liveRoute(method, path), false, `${method} ${path}`)
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
				? [[3, "test-key", storeMarker(secret), CONTINUOUS_LIMITS.roomMs]]
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
	assert.equal(writes, before + 21)
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
test("Container listener outlives Caddy's 2 min idle upstream connections, so Caddy never reuses a socket the API is closing", async () => {
	const server = await releaseHttp(async () => new Response("{}"), "127.0.0.1", 0)
	try {
		// Caddy's reverse_proxy keeps idle upstream connections for 2 min; a POST written into one the API closes at
		// that moment comes back as 502 (EOF). The API must hold idle connections longer, so Caddy closes them.
		assert.equal(server.keepAliveTimeout, RELEASE_KEEP_ALIVE_MS)
		assert.ok(server.keepAliveTimeout > 120_000)
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
