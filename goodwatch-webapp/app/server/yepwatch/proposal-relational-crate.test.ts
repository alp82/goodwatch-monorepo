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
		assert.match(admission.invite.code, /^[0-9A-HJKMNP-TV-Z]{16}$/)
		assert.equal(
			(await b.resolveInvite(admission.invite.code.toLowerCase())).roomId,
			admission.credential.roomId
		)
		assert.equal(
			(await b.create(admissionRequest)).invite.code,
			admission.invite.code
		)
		const { hash } = await import("./crypto.server.ts")
		await assert.rejects(
			otherRepo.rememberInvite(
				hash(admission.invite.code),
				"another-room",
				admission.credential.expiresAt
			),
			(e: any) => e.code === "busy"
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
		assert.equal(counts.length, 15)
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
		t.diagnostic(
			"Concurrent votes, interrupted publication, lost child/head acknowledgements, exact retry, final decision and database restart PASS"
		)
	}
)
