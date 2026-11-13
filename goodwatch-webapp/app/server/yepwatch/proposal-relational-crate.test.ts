import type { RoomCommand } from "../../../packages/yepwatch-contracts/proposal.ts"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { crateSql, type Sql } from "./repository.server.ts"
import { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import {
	provisionReleaseStore,
	checkReleaseStore,
} from "./proposal-release-store.ts"
import {
	provisionControl,
	DEFAULT_CONTROL,
} from "./proposal-release-control.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { proposalFixtureCatalog } from "./proposal-test-support.ts"
import { tables, tableDdl } from "./proposal-storage-schema.ts"
import { IndeterminateWrite } from "./errors.ts"
const enabled = process.env.YEPWATCH_TEST_RELATIONAL_CRATE === "1"
const secret = "typed-room-test-key-isolated-disposable-only"
const request = (nickname = "Guest") => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname,
})
const credential = (admission: any) => ({
	participantId: admission.credential.participantId,
	token: admission.credential.token,
})
const docker = (...args: string[]) =>
	execFileSync("docker", args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
test(
	"typed relational store: concurrency, partial writes, lost acknowledgements, decision, restart and explicit SQL schemas",
	{ skip: !enabled, timeout: 180000 },
	async (t) => {
		const name = `yepwatch-relational-test-${process.pid}`
		docker(
			"run",
			"-d",
			"--name",
			name,
			"-p",
			"127.0.0.1::4200",
			"-e",
			"CRATE_HEAP_SIZE=512m",
			"crate:5.10.16",
			"crate",
			"-Cdiscovery.type=single-node",
			"-Ccluster.name=" + name
		)
		t.after(() => {
			docker("rm", "-f", name)
		})
		const port = docker("port", name, "4200/tcp").split(":").at(-1)
		let sql = crateSql(`http://127.0.0.1:${port}`, "crate", "")
		for (let i = 0; ; i++) {
			try {
				await sql("SELECT 1")
				break
			} catch (e) {
				if (i > 100) throw e
				await new Promise((r) => setTimeout(r, 300))
			}
		}
		await provisionReleaseStore(sql, 0, "typed-test", secret)
		await provisionControl(sql, DEFAULT_CONTROL, 0)
		await checkReleaseStore(sql, "typed-test", secret)
		t.diagnostic("Typed DDL, metadata and control provisioned")
		const statements: string[] = []
		let failHead = false,
			loseHead = false,
			loseInvite = false,
			loseChild = false
		const recording: Sql = async (stmt, args) => {
			statements.push(stmt)
			if (stmt.startsWith("UPDATE doc.yepwatch_room SET") && failHead) {
				failHead = false
				throw new Error("Injected crash before publish")
			}
			const result = await sql(stmt, args)
			if (
				stmt.startsWith("INSERT INTO doc.yepwatch_invitation ") &&
				loseInvite
			) {
				loseInvite = false
				throw new IndeterminateWrite("Lost invite mapping ack")
			}
			if (stmt.startsWith("UPDATE doc.yepwatch_room SET") && loseHead) {
				loseHead = false
				throw new IndeterminateWrite("Lost publish ack")
			}
			if (stmt.startsWith("INSERT INTO doc.yepwatch_vote ") && loseChild) {
				loseChild = false
				throw new IndeterminateWrite("Lost vote ack")
			}
			return result
		}
		const repo = new RelationalProposalRepository(recording, secret)
		const otherRepo = new RelationalProposalRepository(sql, secret)
		const a = new ProposalService(repo, proposalFixtureCatalog, secret)
		const b = new ProposalService(otherRepo, proposalFixtureCatalog, secret)
		const admissionRequest = request("Host")
		loseInvite = true
		const admission = await a.create(admissionRequest)
		assert.match(admission.invite.code, /^[2-9A-HJKMNP-Z]{6}$/)
		assert.equal(
			(await b.resolveInvite(admission.invite.code.toLowerCase())).roomId,
			admission.credential.roomId
		)
		assert.equal(
			(await b.create(admissionRequest)).invite.code,
			admission.invite.code
		)
		const { hash } = await import("./crypto.server.ts")
		assert.equal(
			await otherRepo.rememberInvite(
				hash(admission.invite.code),
				"another-room",
				admission.credential.expiresAt
			),
			null
		)
		t.diagnostic(
			"Short invite immediately resolves across instances; lost mapping ack, replay and collision checks pass"
		)
		const id = admission.credential.roomId,
			host = credential(admission)
		const guestAdmission = await b.join(id, {
			...request("Peer"),
			inviteCode: admission.invite.code,
		})
		const guest = credential(guestAdmission)
		async function send(
			service: ProposalService,
			actor: typeof host,
			command: any
		) {
			const s = await service.read(id, actor)
			return service.command(id, actor, {
				commandId: randomBytes(16).toString("hex"),
				sequence: s.own.nextSequence,
				command,
			})
		}
		let s = await a.read(id, host)
		await send(a, host, {
			type: "setup",
			expectedContextVersion: s.shared.contextVersion,
			screens: [
				{
					id: "screen",
					label: "TV",
					country: "DE",
					serviceIds: [8],
					confirmed: true,
				},
			],
			constraints: { kinds: ["movie"], maxMinutes: null, moods: [] },
			screenId: "screen",
		})
		s = await b.read(id, guest)
		await send(b, guest, {
			type: "assign_screen",
			expectedContextVersion: s.shared.contextVersion,
			screenId: "screen",
		})
		s = await a.read(id, host)
		await send(a, host, {
			type: "ready",
			expectedContextVersion: s.shared.contextVersion,
			ready: true,
		})
		s = await b.read(id, guest)
		await send(b, guest, {
			type: "ready",
			expectedContextVersion: s.shared.contextVersion,
			ready: true,
		})
		s = await a.read(id, host)
		await send(a, host, {
			type: "start",
			expectedRosterVersion: s.shared.rosterVersion,
			expectedContextVersion: s.shared.contextVersion,
		})
		s = await a.read(id, host)
		const candidate = s.shared.candidates[0].id
		const vote = (snap: any) => ({
			type: "vote",
			generation: snap.shared.generation,
			candidateId: candidate,
			value: "watch",
			expectedVoteRevision: 0,
			activeExposureMs: 1234,
		})
		const hs = await a.read(id, host),
			gs = await b.read(id, guest)
		const hostEnvelope = {
			commandId: randomBytes(16).toString("hex"),
			sequence: hs.own.nextSequence,
			command: vote(hs),
		}
		failHead = true
		await assert.rejects(
			a.command(id, host, hostEnvelope as any),
			/Injected crash/
		)
		assert.equal((await b.read(id, host)).own.votes.length, 0)
		const before = statements.length
		loseChild = true
		loseHead = true
		await Promise.all([
			a.command(id, host, hostEnvelope as any),
			b.command(id, guest, {
				commandId: randomBytes(16).toString("hex"),
				sequence: gs.own.nextSequence,
				command: vote(gs),
			} as any),
		])
		const after = await b.read(id, host)
		assert.equal(after.own.votes[0].value, "watch")
		assert.equal(after.shared.matches.length, 1)
		assert.equal((await a.read(id, guest)).own.votes[0].value, "watch")
		assert.ok(
			!statements
				.slice(before)
				.some((x) => x.startsWith("INSERT INTO doc.yepwatch_candidate ")),
			"Voting must not rewrite the deck"
		)
		assert.ok(
			!statements.some((x) => /\bpayload\b/i.test(x)),
			"Release queries contain no generic payload"
		)
		assert.equal(
			(await a.command(id, host, hostEnvelope as any)).receipt.replayed,
			true
		)
		s = await a.read(id, host)
		await send(a, host, {
			type: "propose",
			expectedRosterVersion: s.shared.rosterVersion,
			candidateId: candidate,
			expectedProposalVersion: s.shared.proposalVersion,
			generation: s.shared.generation,
		})
		// A join during the final evidence read invalidates that publication, even after everyone previously agreed.
		let releaseCheck!: () => void, enteredCheck!: () => void
		const held = new Promise<void>((r) => {
				releaseCheck = r
			}),
			entered = new Promise<void>((r) => {
				enteredCheck = r
			})
		const delayed = new ProposalService(
			otherRepo,
			{
				...proposalFixtureCatalog,
				async recheck(room, item) {
					enteredCheck()
					await held
					return proposalFixtureCatalog.recheck(room, item)
				},
			},
			secret
		)
		s = await delayed.read(id, guest)
		const approving = send(delayed, guest, {
			type: "agree",
			expectedRosterVersion: s.shared.rosterVersion,
			candidateId: candidate,
			expectedProposalVersion: s.shared.proposalVersion,
			expectedOwnAgreementRevision: s.own.agreement.revision,
			generation: s.shared.generation,
			agreed: true,
		})
		await entered
		const newcomerAdmission = await b.join(id, {
			...request("Late guest"),
			inviteCode: admission.invite.code,
		})
		const newcomer = credential(newcomerAdmission)
		releaseCheck()
		await approving
		assert.equal((await a.read(id, host)).shared.decision, null)
		s = await b.read(id, newcomer)
		await send(b, newcomer, {
			type: "assign_screen",
			expectedContextVersion: s.shared.contextVersion,
			screenId: "screen",
		})
		s = await b.read(id, newcomer)
		await send(b, newcomer, {
			type: "agree",
			expectedRosterVersion: s.shared.rosterVersion,
			candidateId: candidate,
			expectedProposalVersion: s.shared.proposalVersion,
			expectedOwnAgreementRevision: s.own.agreement.revision,
			generation: s.shared.generation,
			agreed: true,
		})
		const done = await a.read(id, host)
		assert.equal(done.shared.phase, "decided")
		assert.equal(done.shared.decision?.candidateId, candidate)
		await sql(
			"REFRESH TABLE doc.yepwatch_room,doc.yepwatch_participant,doc.yepwatch_vote,doc.yepwatch_proposal,doc.yepwatch_decision"
		)
		const copy = (await repo.read(id))!
		copy.room.candidates[0].identity.tmdbId = 999999
		assert.notEqual(
			(await repo.read(id))!.room.candidates[0].identity.tmdbId,
			999999
		)
		const liveVotes = (
			await sql(
				`SELECT p.participant_id,v.candidate_id,v.choice FROM doc.yepwatch_room r JOIN doc.yepwatch_participant p ON p.record_id=ANY(r.participant_records) JOIN doc.yepwatch_vote v ON v.record_id=ANY(p.vote_records) WHERE r.id=?`,
				[id]
			)
		).rows
		assert.equal(liveVotes.length, 3)
		assert.ok(liveVotes.every((r) => r[2] === "watch"))
		const counts = (
			await sql(
				"SELECT table_name FROM information_schema.tables WHERE table_schema='doc' AND table_name LIKE 'yepwatch_%' ORDER BY table_name"
			)
		).rows
		assert.equal(counts.length, 22)
		const badColumns = (
			await sql(
				"SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='doc' AND table_name LIKE 'yepwatch_%' AND column_name='payload'"
			)
		).rows
		assert.equal(badColumns.length, 0)
		await assert.rejects(
			sql(
				"INSERT INTO doc.yepwatch_vote (record_id,room_id,generation,expires_at,participant_id,candidate_id,choice,revision) VALUES ('bad','bad',0,2000000000000,'p','c','veto',0)"
			)
		)
		await sql("UPDATE doc.yepwatch_room SET constraints=? WHERE id=?", [
			{ kinds: ["movie"], maxMinutes: null, moods: [] },
			id,
		])
		await assert.rejects(
			sql("UPDATE doc.yepwatch_room SET constraints=? WHERE id=?", [
				{ kinds: ["movie"], maxMinutes: null, moods: [], unexpected: "x" },
				id,
			])
		)
		for (const table of Object.values(tables))
			assert.ok(tableDdl(table, 0).includes("column_policy='strict'"))
		const current = (await repo.read(id))!,
			linked = structuredClone(current.room)
		linked.revision++
		linked.participants[0].memberUserId = "local-member-fixture"
		linked.participants[0].memberGrant = {
			accessToken: "test-grant-secret-only",
			expiresAt: Date.now() + 100000,
		}
		linked.memberIntents = [
			{
				stateHash: "local-state",
				participantId: host.participantId,
				epoch: 0,
				expiresAt: Date.now() + 100000,
				client: "native",
				returnTo: "yepwatch://auth/callback",
				challenge: "local-challenge",
				verifier: "local-verifier-secret",
				status: "ready",
				codeHash: null,
			},
		]
		assert.equal(await repo.compareAndSwap(current, linked, false), true)
		const memberAccount = { userId: "local-member-fixture", sessionId: "typed-member-session", expiresAt: Date.now() + 600000 }
        const memberAdmission = await a.resumeAccount(id, memberAccount)
        Object.assign(host, memberAdmission.credential, { accountId: memberAccount.userId, sessionId: memberAccount.sessionId })
        const cold = (await new RelationalProposalRepository(sql, secret).read(id))!
		assert.equal(
			cold.room.participants[0].memberGrant?.accessToken,
			"test-grant-secret-only"
		)
		assert.equal(cold.room.memberIntents?.[0].verifier, "local-verifier-secret")
		await sql(
			"REFRESH TABLE doc.yepwatch_member_grant,doc.yepwatch_member_intent"
		)
		const encrypted = (
			await sql("SELECT access_token_ciphertext FROM doc.yepwatch_member_grant")
		).rows
		assert.ok(encrypted.length > 0)
		assert.ok(
			encrypted.every((r) => !String(r[0]).includes("test-grant-secret-only"))
		)

        const phone = { userId: "typed-account", sessionId: "typed-phone", expiresAt: Date.now() + 86400000 }
        const pc = { ...phone, sessionId: "typed-pc" }
        const accountRoom = await a.create(request("Account host"), phone)
        const accountId = accountRoom.credential.roomId
        const otherDevice = await b.resumeAccount(accountId, pc)
        assert.equal(otherDevice.credential.participantId, accountRoom.credential.participantId)
        assert.equal((await b.accountHome(pc)).rooms.length, 1, "account room locator survives separate repository instances")
        const scopedHost = { ...accountRoom.credential, accountId: phone.userId, sessionId: phone.sessionId }
        const sendAccount = async (command: RoomCommand) => {
          const state = await a.read(accountId, scopedHost)
          return a.command(accountId, scopedHost, { commandId: randomBytes(16).toString("hex"), sequence: state.own.nextSequence, command })
        }
        let accountState = (await sendAccount({ type: "setup", expectedContextVersion: 1,
          screens: [{ id: "room", label: "Room", country: "DE", serviceIds: [1], confirmed: true }],
          constraints: { kinds: ["movie"], moods: [], maxMinutes: null }, screenId: "room" })).snapshot
        accountState = (await sendAccount({ type: "start", expectedContextVersion: accountState.shared.contextVersion, expectedRosterVersion: accountState.shared.rosterVersion, hostReady: true })).snapshot
        const accountCandidate = accountState.shared.candidates[0].id
        accountState = (await sendAccount({ type: "vote", candidateId: accountCandidate, expectedVoteRevision: 0, generation: accountState.shared.generation, value: "watch" })).snapshot
        accountState = (await sendAccount({ type: "propose", candidateId: accountCandidate, expectedRosterVersion: accountState.shared.rosterVersion, expectedProposalVersion: accountState.shared.proposalVersion, generation: accountState.shared.generation })).snapshot
        assert.equal(accountState.shared.phase, "decided")
        const accountHistory = (await b.accountHome(pc)).decisions
        assert.equal(accountHistory.length, 1)
        await sendAccount({ type: "restart", expectedRevision: accountState.shared.revision })
        assert.deepEqual((await b.accountHome(pc)).decisions, accountHistory)
        await b.logoutAccount(pc)
        assert.equal(await otherRepo.accountStore.sessionActive(pc.sessionId), false)

		docker("restart", name)
		sql = crateSql(
			`http://127.0.0.1:${docker("port", name, "4200/tcp").split(":").at(-1)}`,
			"crate",
			""
		)
		for (let i = 0; ; i++) {
			try {
				await checkReleaseStore(sql, "typed-test", secret)
				break
			} catch (e) {
				if (i > 100) throw e
				await new Promise((r) => setTimeout(r, 300))
			}
		}
		const restarted = new ProposalService(
			new RelationalProposalRepository(sql, secret),
			proposalFixtureCatalog,
			secret
		)
		assert.deepEqual(
			(await restarted.read(id, host)).shared.decision,
			done.shared.decision
		)
        assert.deepEqual((await restarted.accountHome(phone)).decisions, accountHistory, "account history survives database restart")
        assert.equal(await restarted.accounts.sessionActive(pc.sessionId), false, "device logout survives database restart")
		await send(restarted, guest, { type: "leave" })
		const beforeRound = (await new RelationalProposalRepository(sql, secret).read(id))!.room
		const currentRound = await restarted.read(id, host)
		await send(restarted, host, { type: "restart", expectedRevision: currentRound.shared.revision })
		const nextRound = (await new RelationalProposalRepository(sql, secret).read(id))!.room
		assert.equal(nextRound.phase, "setup", "Start again publishes a readable new round after a voter leaves")
		assert.equal(nextRound.generation, beforeRound.generation + 1)
		assert.deepEqual(nextRound.candidates, [])
		assert.deepEqual(nextRound.history, beforeRound.history)
		const departed = nextRound.participants.find(p => p.id === guest.participantId)!
		assert.notEqual(departed.leftAt, null)
		assert.deepEqual(departed.votes, {}, "departed votes cannot reference the retired deck")
		assert.equal(departed.lastVotedId, null)
		assert.equal(departed.approvedProposalVersion, null)
		t.diagnostic(
			"Account identity, session receipts, persistent history and logout; concurrent votes, interrupted publication, lost child/head acknowledgements, exact retry, final decision and database restart PASS"
		)
	}
)

test(
	"typed relational store: the sweep finds only live rooms whose current idea is pending past its lease",
	{ skip: !enabled, timeout: 180000 },
	async (t) => {
		const name = `yepwatch-relational-sweep-test-${process.pid}`
		docker("run", "-d", "--name", name, "-p", "127.0.0.1::4200", "-e", "CRATE_HEAP_SIZE=512m", "crate:6.4.6", "crate", "-Cdiscovery.type=single-node", "-Ccluster.name=" + name)
		t.after(() => {
			docker("rm", "-f", name)
		})
		const port = docker("port", name, "4200/tcp").split(":").at(-1)
		const sql = crateSql(`http://127.0.0.1:${port}`, "crate", "")
		for (let i = 0; ; i++) {
			try {
				await sql("SELECT 1")
				break
			} catch (e) {
				if (i > 100) throw e
				await new Promise((r) => setTimeout(r, 300))
			}
		}
		await provisionReleaseStore(sql, 0, "typed-test", secret)
		await provisionControl(sql, DEFAULT_CONTROL, 0)
		const repo = new RelationalProposalRepository(sql, secret)
		let offset = 0
		const now = () => Date.now() + offset
		let answer = false
		const interpret = (prompt: string) =>
			answer
				? Promise.resolve({ prompt, attributes: [{ text: "heist", kind: "attribute" as const }], rankedKeys: [1], interpretedAt: 7 })
				: new Promise<never>(() => {}) // the creating instance "crashes" mid-search
		const catalog = {
			...proposalFixtureCatalog,
			async metadata() {
				return { countries: [{ code: "DE", name: "Germany" }], services: [{ id: 1, name: "1", logoUrl: null }], moods: [] }
			},
		}
		const service = new ProposalService(repo, catalog, secret, undefined, now, undefined, interpret)
		const create = (idea?: string) => service.create({ ...request("Host"), setup: { country: "DE", ...(idea ? { idea } : {}) } })
		const pending = await create("space heist")
		const plain = await create()
		const refresh = () => sql(`REFRESH TABLE ${tables.idea.name}, ${tables.room.name}`)
		await refresh()
		assert.deepEqual(await repo.stalePendingIdeas(now() - 15_000, now(), 50), [], "within the lease")
		offset = 16_000
		assert.deepEqual(await repo.stalePendingIdeas(now() - 15_000, now(), 50), [pending.credential.roomId])
		assert.deepEqual(await repo.stalePendingIdeas(now() - 15_000, now(), 50, pending.credential.roomId), [], "a cursor continues after its room")
		assert.notEqual(plain.credential.roomId, pending.credential.roomId)
		const expiresAt = (await repo.read(pending.credential.roomId))!.room.expiresAt
		assert.deepEqual(await repo.stalePendingIdeas(now() - 15_000, expiresAt + 1, 50), [], "expired rooms are left out")
		answer = true
		const sweeper = new ProposalService(repo, catalog, secret, undefined, now, undefined, interpret)
		await sweeper.resumeStaleInterpretations()
		await sweeper.interpretationsIdle()
		await refresh()
		// The old pending idea row stays stored (rows are immutable), but the room's head no longer lists it.
		assert.deepEqual(await repo.stalePendingIdeas(now() - 15_000, now(), 50), [])
		const room = (await repo.read(pending.credential.roomId))!.room
		assert.deepEqual(room.ideas![0].attributes, [{ text: "heist", kind: "attribute" }])
	}
)

test(
	"typed relational store: a vote's published room is the room a fresh read gives the gateway, and is acknowledged without reading it",
	{ skip: !enabled, timeout: 180000 },
	async (t) => {
		const name = `yepwatch-relational-publish-test-${process.pid}`
		docker("run", "-d", "--name", name, "-p", "127.0.0.1::4200", "-e", "CRATE_HEAP_SIZE=512m", "crate:6.4.6", "crate", "-Cdiscovery.type=single-node", "-Ccluster.name=" + name)
		t.after(() => {
			docker("rm", "-f", name)
		})
		const port = docker("port", name, "4200/tcp").split(":").at(-1)
		const sql = crateSql(`http://127.0.0.1:${port}`, "crate", "")
		for (let i = 0; ; i++) {
			try {
				await sql("SELECT 1")
				break
			} catch (e) {
				if (i > 100) throw e
				await new Promise((r) => setTimeout(r, 300))
			}
		}
		await provisionReleaseStore(sql, 0, "typed-test", secret)
		const catalog = {
			...proposalFixtureCatalog,
			async metadata() {
				return { countries: [{ code: "DE", name: "Germany" }], services: [{ id: 1, name: "1", logoUrl: null }], moods: [] }
			},
		}
		const events: any[] = []
		let roomReads = 0
		const counting: Sql = async (stmt, args) => {
			if (/^SELECT .* FROM doc\.yepwatch_room WHERE id=\?/s.test(stmt) && !stmt.startsWith("SELECT pending_revision")) roomReads++
			return sql(stmt, args)
		}
		const service = new ProposalService(new RelationalProposalRepository(counting, secret), catalog, secret, async (e) => {
			events.push(structuredClone(e))
		})
		const host = await service.create(request("Host"))
		const id = host.credential.roomId
		const guest = await service.join(id, { ...request("Friend"), inviteCode: host.invite.code })
		const send = async (who: any, command: any) => {
			const s = await service.read(id, credential(who))
			return service.command(id, credential(who), { commandId: randomBytes(16).toString("hex"), sequence: s.own.nextSequence, command })
		}
		let s = await service.read(id, credential(host))
		await send(host, { type: "configure", expectedContextVersion: s.shared.contextVersion, country: "DE" })
		await send(host, { type: "set_services", serviceIds: [1] })
		s = await service.read(id, credential(host))
		const started = await send(host, { type: "start", expectedContextVersion: s.shared.contextVersion, expectedRosterVersion: s.shared.rosterVersion, hostReady: true })
		await new Promise((r) => setTimeout(r, 200))
		const sequence = (await service.read(id, credential(guest))).own.nextSequence
		const reads = roomReads
		const voted = await service.command(id, credential(guest), {
			commandId: randomBytes(16).toString("hex"),
			sequence,
			command: { type: "vote", generation: started.snapshot.shared.generation, candidateId: started.snapshot.shared.candidates[0].id, expectedVoteRevision: 0, value: "watch" },
		})
		await new Promise((r) => setTimeout(r, 300))
		assert.equal(roomReads - reads, 1, "only the command's own read of the room")
		const event = events.find((e) => e.revision === voted.receipt.appliedRevision)
		assert.ok(event && "snapshot" in event, "the vote published the committed room")
		// Another instance (its own repository, nothing cached) reads the room as the gateway's refresh would.
		const fresh = new ProposalService(new RelationalProposalRepository(sql, secret), catalog, secret)
		const attachment = await fresh.attach(id, (await fresh.ticket(id, credential(host))).ticket)
		const views = await fresh.views(id, [attachment.lease])
		assert.equal(views.snapshot?.revision, voted.receipt.appliedRevision)
		assert.deepEqual(event.snapshot, views.snapshot)
		const pending = (await sql("SELECT pending_revision FROM doc.yepwatch_room WHERE id=?", [id])).rows[0][0]
		assert.equal(Number(pending), 0, "acknowledged")
		service.decks.forget(id)
		fresh.decks.forget(id)
	}
)
