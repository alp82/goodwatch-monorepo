// Prepared decks store their cards ahead of Start (RelationalProposalRepository.prestore), on a disposable Crate:
// Start writes only what changed, and rows of decks that never start stay unreachable and leave with their room.
// YEPWATCH_TEST_RELATIONAL_CRATE=1 node --test app/server/yepwatch/proposal-prestore-crate.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import type { RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import { crateSql, type Sql } from "./repository.server.ts"
import { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import { provisionReleaseStore } from "./proposal-release-store.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { proposalFixtureCatalog } from "./proposal-test-support.ts"
import { tables } from "./proposal-storage-schema.ts"
import { DAY_MS, RoomRetention, ROOM_RECORD_TABLES } from "./proposal-room-retention.ts"
import type { ProposalCatalog, ProposalRoom } from "./proposal-types.ts"
import { IndeterminateWrite } from "./errors.ts"

const enabled = process.env.YEPWATCH_TEST_RELATIONAL_CRATE === "1"
const secret = "prestore-test-key-isolated-disposable-only-32"
const docker = (...args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
const ALL = [tables.room.name, ...ROOM_RECORD_TABLES.map((t) => t.name)]
const CANDIDATE = tables.candidate.name
const titleKey = (c: ProposalRoom["candidates"][number]) => `${c.identity.kind === "movie" ? "movie" : "show"}_${c.identity.tmdbId}`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

test("prepared decks are stored ahead of Start on Crate", { skip: !enabled, timeout: 240000 }, async (t) => {
	const name = `yepwatch-prestore-test-${process.pid}`
	docker("run", "-d", "--name", name, "-p", "127.0.0.1::4200", "-e", "CRATE_HEAP_SIZE=512m", "crate:6.4.6", "crate", "-Cdiscovery.type=single-node", "-Ccluster.name=" + name)
	t.after(() => {
		docker("rm", "-f", name)
	})
	const port = docker("port", name, "4200/tcp").split(":").at(-1)
	const raw: Sql = crateSql(`http://127.0.0.1:${port}`, "crate", "")
	for (let i = 0; ; i++) {
		try {
			await raw("SELECT 1")
			break
		} catch (e) {
			if (i > 100) throw e
			await sleep(300)
		}
	}
	await provisionReleaseStore(raw, 0, "prestore-test", secret)

	/** Every statement, for counting what a step wrote; `hook` may delay or fail one, or lose its answer ("lose"). */
	const statements: string[] = []
	let hook: ((stmt: string) => Promise<"lose" | void>) | null = null
	const sql: Sql = async (stmt, args) => {
		statements.push(stmt)
		if ((await hook?.(stmt)) === "lose") {
			await raw(stmt, args)
			throw new IndeterminateWrite("Crate write response unavailable")
		}
		return raw(stmt, args)
	}
	const candidateInserts = (from: number) => statements.slice(from).filter((s) => s.startsWith(`INSERT INTO ${CANDIDATE} `)).length
	/** The room as a reader with nothing cached sees it: every record it names is really stored. */
	const fresh = async (id: string) => (await new RelationalProposalRepository(raw, secret).read(id))!.room
	const candidateRows = async (id: string) => {
		await raw(`REFRESH TABLE ${CANDIDATE}`)
		return Number((await raw(`SELECT count(*) FROM ${CANDIDATE} WHERE room_id=?`, [id])).rows[0][0])
	}
	const rows = async (id: string) => {
		await raw(`REFRESH TABLE ${ALL.join(",")}`)
		const counts: Record<string, number> = {}
		for (const table of ALL) {
			const n = Number((await raw(`SELECT count(*) FROM ${table} WHERE ${table === tables.room.name ? "id" : "room_id"}=?`, [id])).rows[0][0])
			if (n) counts[table] = n
		}
		return counts
	}

	/** After a command: its background notify has run (it schedules the deck, then acknowledges) and the deck is built. */
	async function settled(f: ReturnType<typeof setup>, id: string) {
		for (let i = 0; Number((await raw(`SELECT pending_revision FROM ${tables.room.name} WHERE id=?`, [id])).rows[0][0]) !== 0; i++) {
			assert.ok(i < 500, "the command's notify ran")
			await sleep(5)
		}
		await f.service.decks.idle()
	}
	/** Moves a room's expiry into the past, as time would: the head by its compare-and-swap, every record to match. */
	async function expire(id: string, expiresAt: number) {
		const repository = new RelationalProposalRepository(raw, secret)
		const stored = (await repository.read(id))!
		const expired = structuredClone(stored.room)
		expired.expiresAt = expiresAt
		expired.revision++
		assert.equal(await repository.compareAndSwap(stored, expired, false), true)
		await raw(`REFRESH TABLE ${ALL.join(",")}`)
		for (const table of ROOM_RECORD_TABLES) await raw(`UPDATE ${table.name} SET expires_at=? WHERE room_id=?`, [expiresAt, id])
	}
	function setup(options: { catalog?: Partial<ProposalCatalog> } = {}) {
		const repository = new RelationalProposalRepository(sql, secret)
		const catalog: ProposalCatalog = {
			...proposalFixtureCatalog,
			async metadata(country) {
				const m = await proposalFixtureCatalog.metadata(country)
				return { ...m, services: [1, 2, 3].map((id) => ({ id, name: `Fixture service ${id}`, logoUrl: null })) }
			},
			...options.catalog,
		}
		const service = new ProposalService(repository, catalog, secret)
		return { repository, service }
	}
	async function room(f: ReturnType<typeof setup>) {
		const host = await f.service.create({
			contractVersion: 3,
			commandId: randomBytes(16).toString("hex"),
			admissionSecret: randomBytes(32).toString("base64url"),
			nickname: "Host",
			setup: { country: "DE" },
		})
		const id = host.credential.roomId
		const actor = (credential: { participantId: string; token: string }) => ({
			credential,
			send: async (command: RoomCommand) => {
				const s = await f.service.read(id, credential)
				return f.service.command(id, credential, { commandId: randomBytes(16).toString("hex"), sequence: s.own.nextSequence, command })
			},
		})
		const me = actor({ participantId: host.credential.participantId, token: host.credential.token })
		return {
			id,
			...me,
			start: async () => {
				const s = await f.service.read(id, me.credential)
				return me.send({ type: "start", expectedRosterVersion: s.shared.rosterVersion, expectedContextVersion: s.shared.contextVersion, expectedGeneration: s.shared.generation, hostReady: true } as RoomCommand)
			},
			join: async (nickname: string) => {
				const friend = await f.service.join(id, {
					contractVersion: 3,
					commandId: randomBytes(16).toString("hex"),
					admissionSecret: randomBytes(32).toString("base64url"),
					nickname,
					inviteCode: host.invite.code,
				} as Parameters<ProposalService["join"]>[1])
				return actor({ participantId: friend.credential.participantId, token: friend.credential.token })
			},
		}
	}
	/** The deck the fixture catalog gives a fresh one-person room with service 1 (what the tests below prepare). */
	async function sampleDeck() {
		const f = setup()
		const r = await room(f)
		await r.send({ type: "set_services", serviceIds: [1] })
		await settled(f, r.id)
		return f.service.decks.page((await f.repository.read(r.id))!.room)
	}

	await t.test("Start writes none of the prepared deck's cards: they are stored while the room is in setup", async () => {
		const f = setup()
		const r = await room(f)
		await r.send({ type: "set_services", serviceIds: [1] })
		await settled(f, r.id)
		const prepared = await candidateRows(r.id)
		assert.ok(prepared > 0, "the prepared deck's cards are stored during setup")
		const before = statements.length
		const started = await r.start()
		assert.equal(candidateInserts(before), 0, "Start inserted no card row")
		const cards = started.snapshot.shared.candidates
		assert.equal(cards.length, prepared)
		assert.deepEqual((await fresh(r.id)).candidates.map((c) => c.id), cards.map((c) => c.id), "a reader with nothing cached finds every card")
		assert.equal(await candidateRows(r.id), prepared, "no card row written twice")
	})

	await t.test("a setup change after preparation: Start shows only the new deck, the old deck's rows stay unreachable", async () => {
		const f = setup()
		const r = await room(f)
		await r.send({ type: "set_services", serviceIds: [1] })
		await settled(f, r.id)
		const first = await f.service.decks.page((await f.repository.read(r.id))!.room)
		assert.ok(first.candidates.some((c) => c.identity.kind !== "movie"), "the first deck has shows")
		const s = await f.service.read(r.id, r.credential)
		await r.send({ type: "configure", expectedContextVersion: s.shared.contextVersion, constraints: { kinds: ["movie"], maxMinutes: null, moods: [] } } as RoomCommand)
		await settled(f, r.id)
		const before = statements.length
		const started = await r.start()
		assert.equal(candidateInserts(before), 0, "the second deck was stored ahead too")
		const cards = (await fresh(r.id)).candidates
		assert.deepEqual(cards.map((c) => c.id), started.snapshot.shared.candidates.map((c) => c.id))
		assert.ok(cards.length > 0 && cards.every((c) => c.identity.kind === "movie"), "only the movie deck is in the round")
		assert.ok((await candidateRows(r.id)) > cards.length, "the first deck's rows exist but no head names them")
	})

	await t.test("a member's seen titles are left out at Start for everyone, though their cards were stored ahead", async () => {
		const deck = await sampleDeck()
		const seen = deck.candidates[0]
		const f = setup({ catalog: { excludedKeys: async () => [titleKey(seen)] } })
		const r = await room(f)
		const friend = await r.join("Friend")
		await r.send({ type: "set_services", serviceIds: [1] })
		await friend.send({ type: "set_services", serviceIds: [1] })
		await settled(f, r.id)
		assert.ok(f.service.decks.prepared((await f.repository.read(r.id))!.room), "both people's deck was prepared")
		const before = statements.length
		const started = await r.start()
		assert.equal(candidateInserts(before), 0)
		const theirs = await f.service.read(r.id, friend.credential)
		for (const cards of [started.snapshot.shared.candidates, theirs.shared.candidates, (await fresh(r.id)).candidates]) {
			assert.ok(cards.length > 0)
			assert.ok(!cards.some((c) => titleKey(c) === titleKey(seen)), "the seen title is nobody's card")
		}
		await raw(`REFRESH TABLE ${CANDIDATE}`)
		assert.ok(Number((await raw(`SELECT count(*) FROM ${CANDIDATE} WHERE room_id=? AND candidate_id=?`, [r.id, seen.id])).rows[0][0]) > 0, "its stored row is simply never named")
	})

	await t.test("Start pressed while the deck is still building: one write of the cards, every card readable", async () => {
		let building = 0
		const f = setup({
			catalog: {
				async page(room) {
					if (!building++) await sleep(150)
					return proposalFixtureCatalog.page(room)
				},
			},
		})
		const r = await room(f)
		const before = statements.length
		await r.send({ type: "set_services", serviceIds: [1] })
		// Start is pressed while the background build runs: it joins that build, then races its store ahead.
		for (let i = 0; !building; i++) {
			assert.ok(i < 500, "the deck started building")
			await sleep(1)
		}
		const started = await r.start()
		assert.equal(building, 1, "Start used the build already running")
		await f.service.decks.idle()
		const cards = (await fresh(r.id)).candidates
		assert.ok(cards.length > 0)
		assert.deepEqual(cards.map((c) => c.id), started.snapshot.shared.candidates.map((c) => c.id))
		assert.equal(await candidateRows(r.id), cards.length)
		assert.equal(candidateInserts(before), 1, "Start waited for the cards being stored instead of sending them again")
	})

	await t.test("Start's write waits for a store ahead in flight, and writes the cards itself when that store fails", async () => {
		for (const outcome of ["slow", "fails", "lost"] as const) {
			const f = setup()
			const r = await room(f)
			await r.send({ type: "set_services", serviceIds: [1] })
			await settled(f, r.id)
			// A second repository: nothing stored ahead or cached by the service's own.
			const repository = new RelationalProposalRepository(sql, secret)
			const old = (await repository.read(r.id))!
			const deck = await f.service.decks.page(old.room)
			const next = structuredClone(old.room)
			next.revision++
			// A round nothing has stored cards for yet.
			next.generation += 5
			next.phase = "choosing"
			next.candidates = deck.candidates.slice(0, 5)
			// The room as the store ahead sees it: in setup, one round before.
			const ahead = structuredClone(old.room)
			ahead.generation = next.generation - 1
			let entered = false
			hook = async (stmt) => {
				if (!stmt.startsWith(`INSERT INTO ${CANDIDATE} `) || entered) return
				entered = true
				await sleep(100)
				if (outcome === "fails") throw new Error("store refused")
				if (outcome === "lost") return "lose"
			}
			const before = statements.length
			const stored = repository.prestore(ahead, next.candidates).catch(() => "failed")
			while (!entered) await sleep(1)
			const swapped = await repository.compareAndSwap(old, next, false)
			hook = null
			await stored
			assert.equal(swapped, true, outcome)
			assert.deepEqual((await fresh(r.id)).candidates.map((c) => c.id), next.candidates.map((c) => c.id), outcome)
			// Slow: Start's write waited for it. Lost answer: the store ahead proved its rows by reading them. Failed: Start wrote them.
			assert.equal(candidateInserts(before), outcome === "fails" ? 2 : 1, `${outcome}: candidate INSERTs`)
			assert.equal(await stored, outcome === "fails" ? "failed" : undefined)
		}
	})

	await t.test("a room that never starts leaves no rows once retention removes it, its stored-ahead cards included", async () => {
		const f = setup()
		const r = await room(f)
		await r.send({ type: "set_services", serviceIds: [1] })
		await settled(f, r.id)
		assert.ok((await rows(r.id))[CANDIDATE] > 0, "cards were stored ahead")
		await expire(r.id, Date.now() - 40 * DAY_MS)
		const retention = new RoomRetention(raw, new RelationalProposalRepository(raw, secret), { retentionDays: 30 })
		for (let i = 0, calm = 0; calm < 2; i++) {
			assert.ok(i < 40, "retention settles")
			await raw(`REFRESH TABLE ${ALL.join(",")}`)
			const report = await retention.run()
			calm = report.rooms || Object.keys(report.deleted).length ? 0 : calm + 1
		}
		assert.deepEqual(await rows(r.id), {}, "nothing of the room is left")
	})

	await t.test("a room erased by a deletion request before Start leaves no rows, its stored-ahead cards included", async () => {
		const f = setup()
		const r = await room(f)
		await r.send({ type: "set_services", serviceIds: [1] })
		await settled(f, r.id)
		assert.ok((await rows(r.id))[CANDIDATE] > 0, "cards were stored ahead")
		await f.service.deletions.schedule({ kind: "guest", roomId: r.id, participantId: r.credential.participantId }, Date.now() - 31 * DAY_MS)
		await expire(r.id, Date.now() - 60_000)
		await f.service.deletions.purgeDue(Date.now())
		assert.deepEqual(await rows(r.id), {}, "nothing of the room is left")
	})
})
