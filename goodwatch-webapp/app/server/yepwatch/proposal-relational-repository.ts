import { z } from "zod"
import { codec, keyed } from "./crypto.server.ts"
import { IndeterminateWrite, RoomError } from "./errors.ts"
import { LIMITS } from "./types.ts"
import type { Sql } from "./repository.server.ts"
import type {
	ProposalRoom,
	ProposalStored,
	ProposalRepository,
} from "./proposal-types.ts"
import {
	tables,
	invitationTable,
	columns,
	parseRow,
	tableDdl,
	type Entity,
} from "./proposal-storage-schema.ts"

type Row = Record<string, any>
interface RecordWrite {
	entity: Entity
	row: Row
}
interface Plan {
	head: Row
	records: Map<string, RecordWrite>
}
const stable = (value: unknown): string =>
	JSON.stringify(value, (_k, v) =>
		v && typeof v === "object" && !Array.isArray(v)
			? Object.fromEntries(
					Object.keys(v)
						.sort()
						.map((k) => [k, v[k]])
				)
			: v
	)
const secretField: Partial<Record<Entity, string>> = {
	grant: "access_token_ciphertext",
	intent: "verifier_ciphertext",
}
const fail = () =>
	new RoomError("busy", "Stored room is incomplete or incompatible", 503, true)
async function parallel<T, R>(
	items: T[],
	fn: (item: T) => Promise<R>
): Promise<R[]> {
	const result: R[] = new Array(items.length)
	let index = 0
	await Promise.all(
		Array.from({ length: Math.min(12, items.length) }, async () => {
			for (;;) {
				const i = index++
				if (i >= items.length) return
				result[i] = await fn(items[i])
			}
		})
	)
	return result
}
export async function provisionRelationalRooms(sql: Sql, replicas: 0 | 2) {
	for (const table of [...Object.values(tables), invitationTable])
		await sql(tableDdl(table, replicas))
}
export async function checkRelationalRooms(sql: Sql) {
	for (const table of [...Object.values(tables), invitationTable])
		await sql(
			`SELECT ${columns(table).join(",")} FROM ${table.name} WHERE ${
				table.primary
			}=?`,
			["__typed_storage_health__"]
		)
}

/** Immutable typed domain records, published together by one room-head CAS. Readers never follow SQL search freshness. */
export class RelationalProposalRepository implements ProposalRepository {
	private crypto: ReturnType<typeof codec>
	// Only validated immutable rows. A bounded cache is an optimization, never the source of truth.
	private cache = new Map<string, Row>()
	private sql: Sql
	private secret: string
	constructor(sql: Sql, secret: string) {
		this.sql = sql
		this.secret = secret
		this.crypto = codec(secret)
	}
	async findInvite(hash: string) {
		const row = (
			await this.sql(
				`SELECT room_id FROM ${invitationTable.name} WHERE code_hash=?`,
				[hash]
			)
		).rows[0]
		return row ? z.string().parse(row[0]) : null
	}
	async rememberInvite(hash: string, roomId: string, expiresAt: number) {
		try {
			await this.sql(
				`INSERT INTO ${invitationTable.name} (code_hash,room_id,expires_at) VALUES (?,?,?) ON CONFLICT DO NOTHING`,
				[hash, roomId, expiresAt]
			)
		} catch (e) {
			if (!(e instanceof IndeterminateWrite)) throw e
		}
		// Prove the immutable mapping by primary key, including a lost INSERT response.
		const row = (
			await this.sql(
				`SELECT room_id,expires_at FROM ${invitationTable.name} WHERE code_hash=?`,
				[hash]
			)
		).rows[0]
		if (!row)
			throw new RoomError(
				"outcome_unknown",
				"Retain and retry same admission",
				503,
				true
			)
		if (row[0] !== roomId) return null
		return Number(row[1])
	}
	private remember(key: string, row: Row) {
		this.cache.set(key, structuredClone(row))
		if (this.cache.size > 4096)
			this.cache.delete(this.cache.keys().next().value!)
	}
	private recordId(entity: Entity, row: Row) {
		const { record_id: _, ...values } = row
		return keyed(this.secret, `yepwatch-row:${entity}`, stable(values))
	}
	private protectedRow(entity: Entity, row: Row, encrypt: boolean): Row {
		const field = secretField[entity]
		if (!field || row[field] === null) return row
		const result = { ...row },
			aad = `${row.room_id}:${entity}:${row.record_id}:${field}`
		result[field] = encrypt
			? this.crypto.encode(row[field], aad)
			: z.string().parse(this.crypto.decode(row[field], aad))
		return result
	}
	private validateRecord(entity: Entity, raw: Row, roomId: string, id: string) {
		const row = this.protectedRow(entity, parseRow(tables[entity], raw), false)
		if (
			row.room_id !== roomId ||
			row.record_id !== id ||
			this.recordId(entity, row) !== id
		)
			throw fail()
		return row
	}
	private async record(
		entity: Entity,
		roomId: string,
		id: string
	): Promise<Row> {
		const key = `${entity}:${id}`
		const cached = this.cache.get(key)
		if (cached) {
			if (cached.room_id !== roomId) throw fail()
			return structuredClone(cached)
		}
		const table = tables[entity],
			names = columns(table)
		const row = (
			await this.sql(
				`SELECT ${names.join(",")} FROM ${table.name} WHERE record_id=?`,
				[id]
			)
		).rows[0]
		if (!row) throw fail()
		const decoded = this.validateRecord(
			entity,
			Object.fromEntries(names.map((k, i) => [k, row[i]])),
			roomId,
			id
		)
		this.remember(key, decoded)
		return decoded
	}
	private plan(room: ProposalRoom, pending: number): Plan {
		if (room.format !== 2 || room.flowVersion !== 3) throw fail()
		if (Buffer.byteLength(JSON.stringify(room)) > LIMITS.aggregateBytes)
			throw new RoomError("limit_reached", "Room state limit reached", 409)
		const records = new Map<string, RecordWrite>()
		const put = (entity: Entity, values: Row) => {
			const row = {
				record_id: "",
				room_id: room.id,
				generation: room.generation,
				expires_at: room.expiresAt,
				...values,
			}
			row.record_id = this.recordId(entity, row)
			// Ciphertext columns store a bounded encrypted string; plaintext is validated before encryption too.
			parseRow(tables[entity], row)
			records.set(`${entity}:${row.record_id}`, { entity, row })
			return row.record_id
		}
		const participants = room.participants.map((p) => {
			const votes = Object.entries(p.votes).map(([candidateId, v]) =>
				put("vote", {
					participant_id: p.id,
					candidate_id: candidateId,
					choice: v.value,
					revision: v.revision,
					active_exposure_ms: v.activeExposureMs ?? null,
					timing_source: v.timingSource ?? null,
				})
			)
			const receipts = p.receipts.map((r) =>
				put("receipt", {
					participant_id: p.id,
					command_id: r.commandId,
					sequence: r.sequence,
					digest: r.digest,
					revision: r.revision,
				})
			)
			const agreement = put("agreement", {
				participant_id: p.id,
				proposal_version: p.approvedProposalVersion,
				revision: p.agreementRevision,
			})
			const grant = p.memberGrant
				? put("grant", {
						participant_id: p.id,
						access_token_ciphertext: p.memberGrant.accessToken,
						grant_expires_at: p.memberGrant.expiresAt,
					})
				: null
			return put("participant", {
				participant_id: p.id,
				nickname: p.nickname,
				token_hash: p.tokenHash,
				admission_hash: p.admissionHash,
				epoch: p.epoch,
				next_sequence: p.nextSequence,
				screen_id: p.screenId,
				ready: p.ready,
				revoked: p.revoked ?? false,
				last_voted_id: p.lastVotedId ?? null,
				member_state: p.member.state,
				member_prefill: p.member.prefill,
				member_user_id: p.memberUserId,
				vote_records: votes,
				receipt_records: receipts,
				agreement_record: agreement,
				grant_record: grant,
				legacy_pick_id: p.pick.candidateId,
				legacy_pick_revision: p.pick.revision,
			})
		})
		const screens = room.screens.map((s) =>
			put("screen", {
				screen_id: s.id,
				label: s.label,
				country: s.country,
				service_ids: s.serviceIds,
				confirmed: s.confirmed,
			})
		)
		const candidates = room.candidates.map((c) =>
			put("candidate", {
				candidate_id: c.id,
				identity: c.identity,
				title: c.title,
				year: c.year,
				overview: c.overview,
				poster_url: c.posterUrl,
				runtime_minutes: c.runtimeMinutes,
				availability: c.availability,
				viewing_duration: c.viewingDuration,
				backdrop_url: c.backdropUrl ?? null,
				trailer_url: c.trailerUrl ?? null,
				goodwatch_score: c.goodwatchScore ?? null,
				genres: c.genres ?? null,
			})
		)
		const tickets = room.tickets.map((t) =>
			put("ticket", {
				ticket_hash: t.hash,
				participant_id: t.participantId,
				epoch: t.epoch,
				ticket_expires_at: t.expiresAt,
			})
		)
		const intents = (room.memberIntents ?? []).map((t) =>
			put("intent", {
				state_hash: t.stateHash,
				participant_id: t.participantId,
				epoch: t.epoch,
				intent_expires_at: t.expiresAt,
				client: t.client,
				return_to: t.returnTo,
				challenge: t.challenge,
				verifier_ciphertext: t.verifier,
				status: t.status,
				code_hash: t.codeHash,
			})
		)
		const p = room.proposal,
			d = room.decision
		const proposal = p
			? put("proposal", {
					candidate_id: p.candidateId,
					version: p.version,
					previous_candidate_id: p.previousCandidateId,
					proposer_id: p.proposerId,
					base_participant_ids: p.baseParticipantIds,
				})
			: null
		const decision = d
			? put("decision", {
					candidate_id: d.candidateId,
					agreement_version: d.agreementVersion,
					decided_at: d.decidedAt,
					availability: d.availability,
				})
			: null
		const head = parseRow(tables.room, {
			id: room.id,
			storage_format: 1,
			revision: room.revision,
			expires_at: room.expiresAt,
			host_id: room.hostId,
			invite_hash: room.inviteHash,
			phase: room.phase,
			roster_version: room.rosterVersion,
			context_version: room.contextVersion,
			generation: room.generation,
			constraints: room.constraints,
			stream: room.stream,
			agreement_check: room.agreement,
			seen_keys: room.seenKeys,
			proposal_version: room.proposalVersion,
			participant_records: participants,
			screen_records: screens,
			candidate_records: candidates,
			ticket_records: tickets,
			member_intent_records: intents,
			proposal_record: proposal,
			decision_record: decision,
			pending_revision: pending,
			pending_agreement: room.agreement.state === "checking",
		})
		this.validateRelations(room)
		return { head, records }
	}
	private validateRelations(room: ProposalRoom) {
		const unique = (ids: string[]) => {
			if (new Set(ids).size !== ids.length) throw fail()
		}
		const people = new Set(room.participants.map((p) => p.id)),
			candidates = new Set(room.candidates.map((c) => c.id)),
			screens = new Set(room.screens.map((s) => s.id))
		unique(room.participants.map((p) => p.id))
		unique(room.candidates.map((c) => c.id))
		unique(room.screens.map((s) => s.id))
		if (!people.has(room.hostId)) throw fail()
		if ((room.phase === "decided") !== Boolean(room.decision)) throw fail()
		if (room.proposal && room.proposal.version !== room.proposalVersion)
			throw fail()
		for (const p of room.participants) {
			unique(p.receipts.map((r) => r.commandId))
			unique(p.receipts.map((r) => String(r.sequence)))
			if (p.screenId !== null && !screens.has(p.screenId)) throw fail()
			for (const id of Object.keys(p.votes))
				if (!candidates.has(id)) throw fail()
			if (
				p.approvedProposalVersion !== null &&
				p.approvedProposalVersion !== room.proposal?.version
			)
				throw fail()
		}
		if (
			room.proposal &&
			(!candidates.has(room.proposal.candidateId) ||
				!people.has(room.proposal.proposerId) ||
				room.proposal.baseParticipantIds.some((id) => !people.has(id)))
		)
			throw fail()
		if (room.decision && !candidates.has(room.decision.candidateId))
			throw fail()
		if (
			room.tickets.some((t) => !people.has(t.participantId)) ||
			room.memberIntents?.some((t) => !people.has(t.participantId))
		)
			throw fail()
	}
	private async ensure(records: RecordWrite[]) {
		await parallel(records, async ({ entity, row }) => {
			const table = tables[entity],
				names = columns(table)
			const encrypted = parseRow(table, this.protectedRow(entity, row, true))
			try {
				await this.sql(
					`INSERT INTO ${table.name} (${names.join(",")}) VALUES (${names
						.map(() => "?")
						.join(",")}) ON CONFLICT DO NOTHING`,
					names.map((k) => encrypted[k])
				)
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e
			}
			// Full-key proof before publication, including lost INSERT responses. Never publish a partial set.
			const key = `${entity}:${row.record_id}`
			this.cache.delete(key)
			const proof = await this.record(entity, row.room_id, row.record_id)
			if (stable(proof) !== stable(row)) throw fail()
		})
	}
	async insert(room: ProposalRoom) {
		const plan = this.plan(room, room.revision)
		await this.ensure([...plan.records.values()])
		const names = columns(tables.room)
		// The database clock fences a delayed admission independently of the API clock.
		const expressions = names.map((k) =>
			k === "expires_at"
				? "CASE WHEN CURRENT_TIMESTAMP < ? THEN ? ELSE NULL END"
				: "?"
		)
		const args = names.flatMap((k) =>
			k === "expires_at" ? [room.expiresAt, room.expiresAt] : [plan.head[k]]
		)
		return (
			(
				await this.sql(
					`INSERT INTO ${tables.room.name} (${names.join(
						","
					)}) VALUES (${expressions.join(",")}) ON CONFLICT DO NOTHING`,
					args
				)
			).rowcount === 1
		)
	}
	async compareAndSwap(
		previous: ProposalStored,
		room: ProposalRoom,
		notify: boolean
	) {
		if (previous.room.id !== room.id || room.revision < previous.room.revision)
			throw fail()
		const plan = this.plan(
			room,
			notify
				? Math.max(previous.pendingRevision, room.revision)
				: previous.pendingRevision
		)
		const old = this.plan(previous.room, previous.pendingRevision)
		await this.ensure(
			[...plan.records].filter(([id]) => !old.records.has(id)).map(([, r]) => r)
		)
		const names = columns(tables.room).filter((k) => k !== "id")
		return (
			(
				await this.sql(
					`UPDATE ${tables.room.name} SET ${names
						.map((k) => `${k}=?`)
						.join(",")} WHERE id=? AND _seq_no=? AND _primary_term=?`,
					[
						...names.map((k) => plan.head[k]),
						room.id,
						previous.seq,
						previous.term,
					]
				)
			).rowcount === 1
		)
	}
	async read(id: string): Promise<ProposalStored | null> {
		const names = columns(tables.room),
			raw = (
				await this.sql(
					`SELECT ${names.join(",")},_seq_no,_primary_term FROM ${
						tables.room.name
					} WHERE id=?`,
					[id]
				)
			).rows[0]
		if (!raw) return null
		try {
			const h = parseRow(
				tables.room,
				Object.fromEntries(names.map((k, i) => [k, raw[i]]))
			)
			if (
				h.id !== id ||
				h.storage_format !== 1 ||
				h.pending_revision > h.revision ||
				h.pending_agreement !== (h.agreement_check.state === "checking")
			)
				throw fail()
			const get = (entity: Entity, ref: string) => this.record(entity, id, ref)
			const many = (entity: Entity, refs: string[]) =>
				parallel(refs, (ref) => get(entity, ref))
			const participants = await parallel(
				h.participant_records as string[],
				async (ref) => {
					const p = await get("participant", ref)
					const [votes, receipts, agreement, grant] = await Promise.all([
						many("vote", p.vote_records),
						many("receipt", p.receipt_records),
						get("agreement", p.agreement_record),
						p.grant_record ? get("grant", p.grant_record) : null,
					])
					if (
						[...votes, ...receipts, agreement, ...(grant ? [grant] : [])].some(
							(r) =>
								r.participant_id !== p.participant_id ||
								r.generation !== h.generation ||
								r.expires_at !== h.expires_at
						) ||
						p.generation !== h.generation ||
						p.expires_at !== h.expires_at
					)
						throw fail()
					if (new Set(votes.map((v) => v.candidate_id)).size !== votes.length)
						throw fail()
					return {
						id: p.participant_id,
						nickname: p.nickname,
						tokenHash: p.token_hash,
						admissionHash: p.admission_hash,
						epoch: p.epoch,
						nextSequence: p.next_sequence,
						screenId: p.screen_id,
						ready: p.ready,
						revoked: p.revoked,
						lastVotedId: p.last_voted_id,
						votes: Object.fromEntries(
							votes.map((v) => [
								v.candidate_id,
								{
									value: v.choice,
									revision: v.revision,
									activeExposureMs: v.active_exposure_ms,
									...(v.timing_source !== null
										? { timingSource: v.timing_source }
										: {}),
								},
							])
						),
						pick: {
							candidateId: p.legacy_pick_id,
							revision: p.legacy_pick_revision,
						},
						approvedProposalVersion: agreement.proposal_version,
						agreementRevision: agreement.revision,
						member: { state: p.member_state, prefill: p.member_prefill },
						memberUserId: p.member_user_id,
						...(grant
							? {
									memberGrant: {
										accessToken: grant.access_token_ciphertext,
										expiresAt: grant.grant_expires_at,
									},
								}
							: {}),
						receipts: receipts.map((r) => ({
							commandId: r.command_id,
							sequence: r.sequence,
							digest: r.digest,
							revision: r.revision,
						})),
					}
				}
			)
			const [screens, candidates, tickets, intents, proposal, decision] =
				await Promise.all([
					many("screen", h.screen_records),
					many("candidate", h.candidate_records),
					many("ticket", h.ticket_records),
					many("intent", h.member_intent_records),
					h.proposal_record ? get("proposal", h.proposal_record) : null,
					h.decision_record ? get("decision", h.decision_record) : null,
				])
			if (
				[
					...screens,
					...candidates,
					...tickets,
					...intents,
					...(proposal ? [proposal] : []),
					...(decision ? [decision] : []),
				].some(
					(r) => r.generation !== h.generation || r.expires_at !== h.expires_at
				)
			)
				throw fail()
			const room: ProposalRoom = {
				format: 2,
				flowVersion: 3,
				id,
				revision: h.revision,
				expiresAt: h.expires_at,
				hostId: h.host_id,
				inviteHash: h.invite_hash,
				phase: h.phase,
				rosterVersion: h.roster_version,
				contextVersion: h.context_version,
				generation: h.generation,
				participants,
				screens: screens.map((s) => ({
					id: s.screen_id,
					label: s.label,
					country: s.country,
					serviceIds: s.service_ids,
					confirmed: s.confirmed,
				})),
				constraints: h.constraints,
				candidates: candidates.map((c) => ({
					id: c.candidate_id,
					identity: c.identity,
					title: c.title,
					year: c.year,
					overview: c.overview,
					posterUrl: c.poster_url,
					runtimeMinutes: c.runtime_minutes,
					availability: c.availability,
					viewingDuration: c.viewing_duration,
					backdropUrl: c.backdrop_url,
					trailerUrl: c.trailer_url,
					goodwatchScore: c.goodwatch_score,
					...(c.genres !== null ? { genres: c.genres } : {}),
				})),
				seenKeys: h.seen_keys,
				stream: h.stream,
				agreement: h.agreement_check,
				decision: decision
					? {
							candidateId: decision.candidate_id,
							agreementVersion: decision.agreement_version,
							decidedAt: decision.decided_at,
							availability: decision.availability,
						}
					: null,
				proposalVersion: h.proposal_version,
				proposal: proposal
					? {
							candidateId: proposal.candidate_id,
							version: proposal.version,
							previousCandidateId: proposal.previous_candidate_id,
							proposerId: proposal.proposer_id,
							baseParticipantIds: proposal.base_participant_ids,
						}
					: null,
				tickets: tickets.map((t) => ({
					hash: t.ticket_hash,
					participantId: t.participant_id,
					epoch: t.epoch,
					expiresAt: t.ticket_expires_at,
				})),
				memberIntents: intents.map((t) => ({
					stateHash: t.state_hash,
					participantId: t.participant_id,
					epoch: t.epoch,
					expiresAt: t.intent_expires_at,
					client: t.client,
					returnTo: t.return_to,
					challenge: t.challenge,
					verifier: t.verifier_ciphertext,
					status: t.status,
					codeHash: t.code_hash,
				})),
			}
			this.validateRelations(room)
			return {
				room,
				seq: z.number().int().parse(raw[names.length]),
				term: z
					.number()
					.int()
					.parse(raw[names.length + 1]),
				pendingRevision: h.pending_revision,
			}
		} catch (e) {
			if (e instanceof RoomError) throw e
			throw fail()
		}
	}
	async pending(limit: number) {
		return (
			await this.sql(
				`SELECT id FROM ${tables.room.name} WHERE (pending_revision>0 OR pending_agreement=true) AND expires_at>CURRENT_TIMESTAMP LIMIT ?`,
				[Math.min(100, limit)]
			)
		).rows.map((r) => String(r[0]))
	}
	async acknowledge(id: string, revision: number) {
		// No child reads needed for a notification acknowledgement.
		const row = (
			await this.sql(
				`SELECT pending_revision,_seq_no,_primary_term FROM ${tables.room.name} WHERE id=?`,
				[id]
			)
		).rows[0]
		if (row && Number(row[0]) <= revision)
			await this.sql(
				`UPDATE ${tables.room.name} SET pending_revision=0 WHERE id=? AND _seq_no=? AND _primary_term=?`,
				[id, row[1], row[2]]
			)
	}
}
