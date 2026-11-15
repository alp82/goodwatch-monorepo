/**
 * Private YepWatch device profiles. Ranker entry point: await profiles.signal(profileId, goodwatchVector?).
 * Returns { vector, quantiles, confidence, seen, hidden, unseen, revision }; number keys use the snapshot ids.
 * profiles.signals(ids) batches cold Crate reads; then signal() hits the 5000-entry, 10-minute LRU.
 * A member passes their GoodWatch vector; only the bounded YepWatch blend is computed here. Nothing writes back.
 * Room participants carry only the HMAC profileId and tasteRevision, neither is projected. Never log secrets/answers.
 */
import { createHmac } from "node:crypto"
import { z } from "zod"
import type { Sql } from "./repository.server.ts"
import { RoomError } from "./errors.ts"
import { profileTaste, type Answer } from "./proposal-taste.ts"
import { calibrationKeys, tasteClusters } from "./proposal-taste-deck.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
import type {
	ProfileAnswersRequest,
	ProfileSummary,
	TasteCard,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import type { ProposalRoom } from "./proposal-types.ts"
import { activeRoom } from "./proposal-context.ts"
export const PROFILE_RETENTION_MS = 180 * 86400000
export const FOLLOWUP_MIN_MS = 10 * 3600000
export const FOLLOWUP_MAX_MS = 7 * 86400000
const TABLE = "doc.yepwatch_taste_profile"
export const profileAnswersSchema = z
	.object({
		revision: z.number().int().safe().nonnegative(),
		items: z
			.array(
				z
					.object({
						key: z
							.number()
							.int()
							.safe()
							.refine(
								(k) =>
									(k > 1e12 && k < 1e12 + 1e10) || (k > 2e12 && k < 2e12 + 1e10)
							),
						answer: z
							.enum(["loved", "not_for_me", "unseen", "did_not_watch"])
							.nullable(),
						at: z.number().int().safe().nonnegative(),
						source: z.enum(["taste", "followup"]).optional(),
						decidedAt: z.number().int().safe().nonnegative().optional(),
					})
					.strict()
			)
			.min(1)
			.max(50),
	})
	.strict()
export interface Followup {
	key: number
	decided_at: number
	state: "pending" | "answered" | "dismissed"
}
export interface Profile {
	id: string
	answers: { items: Answer[] }
	followups: Followup[]
	dealt: number[]
	revision: number
	created_at: number
	updated_at: number
	expires_at: number
	write_window: number
	write_count: number
}
interface Stored {
	profile: Profile
	seq: number
	term: number
}
export interface ProfileStore {
	read(ids: string[]): Promise<Stored[]>
	save(profile: Profile, old: Stored | null): Promise<boolean>
	delete(id: string): Promise<void>
	expire(now: number): Promise<void>
}
/** Primary-key CAS for every mutation; revisions/rate windows survive restarts and competing API processes. */
export class SqlProfileStore implements ProfileStore {
	private sql: Sql
	constructor(sql: Sql) {
		this.sql = sql
	}
	async read(ids: string[]) {
		if (!ids.length) return []
		const result = await this.sql(
			`SELECT id,answers,followups,dealt,revision,updated_at,expires_at,write_window,write_count,created_at,_seq_no,_primary_term FROM ${TABLE} WHERE id=ANY(?)`,
			[ids]
		)
		return result.rows.map((r) => ({
			profile: {
				id: r[0],
				answers: r[1],
				followups: r[2],
				dealt: r[3],
				revision: Number(r[4]),
				updated_at: Number(r[5]),
				expires_at: Number(r[6]),
				write_window: Number(r[7]),
				write_count: Number(r[8]),
				created_at: Number(r[9]),
			} as Profile,
			seq: Number(r[10]),
			term: Number(r[11]),
		}))
	}
	async save(p: Profile, old: Stored | null) {
		const columns = [
			"id",
			"answers",
			"followups",
			"dealt",
			"revision",
			"updated_at",
			"expires_at",
			"write_window",
			"write_count",
			"created_at",
		] as const
		const values = columns.map((c) => p[c])
		if (!old) {
			return (
				(
					await this.sql(
						`INSERT INTO ${TABLE} (${columns.join(",")}) VALUES (${columns
							.map(() => "?")
							.join(",")}) ON CONFLICT DO NOTHING`,
						values
					)
				).rowcount === 1
			)
		}
		return (
			(
				await this.sql(
					`UPDATE ${TABLE} SET ${columns
						.slice(1)
						.map((c) => `${c}=?`)
						.join(",")} WHERE id=? AND _seq_no=? AND _primary_term=?`,
					[...values.slice(1), p.id, old.seq, old.term]
				)
			).rowcount === 1
		)
	}
	async delete(id: string) {
		await this.sql(`DELETE FROM ${TABLE} WHERE id=?`, [id])
	}
	async expire(now: number) {
		const ids = (
			await this.sql(
				`SELECT id FROM ${TABLE} WHERE expires_at<=? ORDER BY expires_at LIMIT 500`,
				[now]
			)
		).rows.map((r) => r[0])
		if (ids.length)
			await this.sql(`DELETE FROM ${TABLE} WHERE id=ANY(?) AND expires_at<=?`, [
				ids,
				now,
			])
		const stale = (
			await this.sql(
				`SELECT id FROM ${TABLE} WHERE array_min(followups['decided_at'])<=? LIMIT 500`,
				[now - FOLLOWUP_MAX_MS]
			)
		).rows.map((r) => String(r[0]))
		for (const old of await this.read(stale)) {
			const p = structuredClone(old.profile)
			p.followups = p.followups.filter(
				(f) => now - f.decided_at < FOLLOWUP_MAX_MS
			)
			if (p.followups.length !== old.profile.followups.length) {
				p.revision++
				await this.save(p, old)
			}
		}
	}
}
export class ProfileConflict extends RoomError {
	readonly profile: ProfileSummary
	constructor(profile: ProfileSummary) {
		super("conflict", "Taste changed; retry with the current revision", 409)
		this.profile = profile
	}
}
export class TasteProfiles {
	private cache = new Map<
		string,
		{
			at: number
			profile: Profile
			signal?: {
				version: string
				member?: string
				value: ReturnType<typeof profileTaste>
			}
		}
	>()
	/** The room service sets this to invalidate setup decks. Only rooms using this profile are affected. */
	changed: (id: string, revision: number) => Promise<void> = async () => {}
	readonly store: ProfileStore
	private secret: string
	private snapshot: () => TitleSnapshot | null
	private displays: (keys: number[]) => Promise<Map<number, TasteCard>>
	private now: () => number
	constructor(
		store: ProfileStore,
		secret: string,
		snapshot: () => TitleSnapshot | null,
		displays: (keys: number[]) => Promise<Map<number, TasteCard>>,
		now: () => number = Date.now
	) {
		this.store = store
		this.secret = secret
		this.snapshot = snapshot
		this.displays = displays
		this.now = now
	}
	identity(secret: string | null) {
		if (
			!secret ||
			!/^[A-Za-z0-9_-]{43}$/.test(secret) ||
			Buffer.from(secret, "base64url").toString("base64url") !== secret
		)
			throw new RoomError(
				"unauthorized",
				"A 32-byte profile secret is required",
				401
			)
		return createHmac("sha256", this.secret)
			.update("yepwatch-profile\0")
			.update(secret)
			.digest("base64url")
	}
	private empty(id: string): Profile {
		const now = this.now()
		return {
			id,
			answers: { items: [] },
			followups: [],
			dealt: [],
			revision: 0,
			created_at: now,
			updated_at: now,
			expires_at: now + PROFILE_RETENTION_MS,
			write_window: -1,
			write_count: 0,
		}
	}
	private remember(p: Profile) {
		// The same profile at the same revision has the same answers: keep its built taste (a room read is not a rebuild).
		const held = this.cache.get(p.id)
		const signal =
			held &&
			held.profile.revision === p.revision &&
			held.profile.created_at === p.created_at &&
			JSON.stringify(held.profile.answers) === JSON.stringify(p.answers)
				? held.signal
				: undefined
		this.cache.delete(p.id)
		this.cache.set(p.id, { at: this.now(), profile: p, ...(signal ? { signal } : {}) })
		while (this.cache.size > 5000)
			this.cache.delete(this.cache.keys().next().value!)
	}
	private async fresh(id: string) {
		const row = (await this.store.read([id]))[0] ?? null
		if (row?.profile.expires_at && row.profile.expires_at <= this.now()) {
			// Leave physical expiry to the guarded cleanup; an explicit use can replace the expired row by CAS.
			return {
				...row,
				profile: {
					...this.empty(id),
					revision: row.profile.revision + 1,
					updated_at: 0,
					expires_at: 0,
				},
			}
		}
		return row
	}
	async summary(id: string): Promise<ProfileSummary> {
		const p = (await this.fresh(id))?.profile ?? this.empty(id)
		this.remember(p)
		return this.describe(p)
	}
	private async describe(p: Profile): Promise<ProfileSummary> {
		const loved = p.answers.items.filter((a) => a.answer === "loved").length
		const notForMe = p.answers.items.filter(
			(a) => a.answer === "not_for_me"
		).length
		const unseen = p.answers.items.filter((a) => a.answer === "unseen").length
		const pending = p.followups
			.filter(
				(f) =>
					f.state === "pending" &&
					this.now() - f.decided_at >= FOLLOWUP_MIN_MS &&
					this.now() - f.decided_at < FOLLOWUP_MAX_MS
			)
			.sort((a, b) => b.decided_at - a.decided_at)
		const displays = await this.displays(pending.map((f) => f.key))
		return {
			revision: p.revision,
			answered: loved + notForMe,
			loved,
			notForMe,
			unseen,
			followups: pending.flatMap((f) => {
				const d = displays.get(f.key)
				return d ? [{ ...d, decidedAt: f.decided_at }] : []
			}),
		}
	}
	/** The revision this process read or wrote within the last minute, unless the daily expiry touch is due; else null. */
	known(id: string): number | null {
		const e = this.cache.get(id),
			now = this.now()
		return e &&
			now - e.at < 60000 &&
			e.profile.expires_at > now &&
			now - e.profile.updated_at < 86400000
			? e.profile.revision
			: null
	}
	async touch(id: string) {
		for (let i = 0; i < 6; i++) {
			const old = await this.fresh(id),
				p = structuredClone(old?.profile ?? this.empty(id))
			if (
				old &&
				this.now() - p.updated_at < 86400000 &&
				p.revision === old.profile.revision &&
				p.expires_at > this.now()
			) {
				this.remember(p)
				return p.revision
			}
			p.updated_at = this.now()
			p.expires_at = this.now() + PROFILE_RETENTION_MS
			if (await this.store.save(p, old)) {
				this.remember(p)
				return p.revision
			}
		}
		throw new RoomError("busy", "Profile is busy; retry", 503, true)
	}
	async answers(id: string, request: ProfileAnswersRequest) {
		const parsed = profileAnswersSchema.safeParse(request)
		if (!parsed.success)
			throw new RoomError("invalid_request", "Invalid taste answers", 400)
		const old = await this.fresh(id),
			p = structuredClone(old?.profile ?? this.empty(id))
		const now = this.now()
		for (const item of request.items) {
			if (item.at > now + 300000)
				throw new RoomError(
					"invalid_request",
					"Answer time is in the future",
					400
				)
			const source = item.source ?? "taste"
			if (source === "followup") {
				const f = p.followups.find(
					(f) => f.key === item.key && f.decided_at === item.decidedAt
				)
				if (
					!f ||
					now - f.decided_at < FOLLOWUP_MIN_MS ||
					now - f.decided_at >= FOLLOWUP_MAX_MS
				)
					throw new RoomError("invalid_request", "Follow-up unavailable", 400)
				if (item.answer === "unseen")
					throw new RoomError(
						"invalid_request",
						"Invalid follow-up answer",
						400
					)
				f.state =
					item.answer === null
						? "pending"
						: item.answer === "did_not_watch"
						? "dismissed"
						: "answered"
			} else if (
				item.answer === "did_not_watch" ||
				item.decidedAt !== undefined
			)
				throw new RoomError("invalid_request", "Invalid taste answer", 400)
			if (item.answer === "did_not_watch") continue
			const existing = p.answers.items.find((a) => a.key === item.key)
			if (existing && existing.at >= item.at) {
				if (
					existing.at === item.at &&
					(existing.answer !== item.answer || existing.source !== source)
				)
					throw new ProfileConflict(
						await this.describe(old?.profile ?? this.empty(id))
					)
				continue
			}
			p.answers.items = p.answers.items.filter((a) => a.key !== item.key)
			p.answers.items.push({
				key: item.key,
				answer: item.answer,
				at: item.at,
				source,
			})
		}
		p.answers.items.sort((a, b) => b.at - a.at || a.key - b.key)
		p.answers.items = p.answers.items.slice(0, 500) // null tombstones fence delayed retries/undo.
		p.followups = p.followups.filter(
			(f) => now - f.decided_at < FOLLOWUP_MAX_MS
		)
		const identical =
			JSON.stringify(p.answers) ===
				JSON.stringify(old?.profile.answers ?? { items: [] }) &&
			JSON.stringify(p.followups) ===
				JSON.stringify(old?.profile.followups ?? [])
		if (identical) {
			const s = await this.describe(p)
			return { revision: p.revision, answered: s.answered }
		}
		if (request.revision !== p.revision)
			throw new ProfileConflict(
				await this.describe(old?.profile ?? this.empty(id))
			)
		const window = Math.floor(now / 3600000)
		if (p.write_window !== window) {
			p.write_window = window
			p.write_count = 0
		}
		if (p.write_count >= 120)
			throw Object.assign(
				new RoomError(
					"limit_reached",
					"Taste write limit reached; retry next hour",
					429,
					true
				),
				{
					retryAfterSeconds: Math.ceil(((window + 1) * 3600000 - now) / 1000),
				}
			)
		p.write_count++
		p.revision++
		p.updated_at = now
		p.expires_at = now + PROFILE_RETENTION_MS
		if (!(await this.store.save(p, old)))
			throw new ProfileConflict(await this.summary(id))
		this.remember(p)
		// Precompute before scheduling a build; a changed callback failure must not turn a committed answer into failure.
		await this.signal(id)
		await this.changed(id, p.revision).catch(() => {})
		return {
			revision: p.revision,
			answered: p.answers.items.filter(
				(a) => a.answer === "loved" || a.answer === "not_for_me"
			).length,
		}
	}
	async delete(id: string) {
		await this.store.delete(id)
		this.cache.delete(id)
		await this.changed(id, 0).catch(() => {})
	}
	async expire() {
		await this.store.expire(this.now())
		for (const [id, entry] of this.cache)
			if (
				entry.profile.expires_at <= this.now() ||
				entry.profile.followups.some(
					(f) => this.now() - f.decided_at >= FOLLOWUP_MAX_MS
				)
			)
				this.cache.delete(id)
	}
	async signals(ids: string[]) {
		const missing = [...new Set(ids)].filter((id) => {
			const e = this.cache.get(id)
			return (
				!e || this.now() - e.at >= 600000 || e.profile.expires_at <= this.now()
			)
		})
		if (missing.length) {
			const rows = await this.store.read(missing)
			const byId = new Map(rows.map((r) => [r.profile.id, r.profile]))
			for (const id of missing) {
				const p = byId.get(id)
				this.remember(p && p.expires_at > this.now() ? p : this.empty(id))
			}
		}
	}
	async signal(id: string, member?: Float32Array | null) {
		await this.signals([id])
		const entry = this.cache.get(id)!
		this.cache.delete(id)
		this.cache.set(id, entry)
		const snapshot = this.snapshot()
		if (!snapshot)
			throw new RoomError(
				"catalog_unavailable",
				"Taste catalog is loading",
				503,
				true
			)
		const memberKey = member
			? Buffer.from(
					member.buffer,
					member.byteOffset,
					member.byteLength
			  ).toString("base64")
			: undefined
		if (
			!entry.signal ||
			entry.signal.version !== snapshot.version ||
			entry.signal.member !== memberKey
		)
			entry.signal = {
				version: snapshot.version,
				member: memberKey,
				value: profileTaste(snapshot, entry.profile.answers.items, member),
			}
		return { ...entry.signal.value, revision: entry.profile.revision }
	}
	async deck(id: string, count: number) {
		if (!Number.isInteger(count) || count < 1 || count > 10)
			throw new RoomError(
				"invalid_request",
				"Count must be between 1 and 10",
				400
			)
		const snapshot = this.snapshot()
		if (!snapshot)
			throw new RoomError(
				"catalog_unavailable",
				"Taste catalog is loading",
				503,
				true
			)
		const p = (await this.fresh(id))?.profile ?? this.empty(id)
		const keys = calibrationKeys(
			await tasteClusters(snapshot),
			p.answers.items,
			count
		)
		const displays = await this.displays(keys)
		return {
			cards: keys.flatMap((key) => {
				const d = displays.get(key)
				return d ? [d] : []
			}),
		}
	}
	/** Called only after a committed decision. Never creates a missing/deleted profile. Idempotent across retries. */
	async recordDecision(room: ProposalRoom) {
		const d = room.decision
		const candidate = room.candidates.find((c) => c.id === d?.candidateId)
		if (!d || !candidate || this.now() - d.decidedAt >= FOLLOWUP_MAX_MS) return
		const key =
			(candidate.identity.kind === "movie" ? 1e12 : 2e12) +
			candidate.identity.tmdbId
		for (const id of new Set(
			activeRoom(room).participants.flatMap((p) =>
				p.profileId ? [p.profileId] : []
			)
		)) {
			for (let i = 0; i < 6; i++) {
				const old = (await this.store.read([id]))[0]
				if (
					!old ||
					old.profile.expires_at <= this.now() ||
					d.decidedAt < old.profile.created_at
				)
					break
				const p = structuredClone(old.profile)
				if (
					p.followups.some((f) => f.key === key && f.decided_at === d.decidedAt)
				)
					break
				p.followups = [
					...p.followups.filter(
						(f) => this.now() - f.decided_at < FOLLOWUP_MAX_MS
					),
					{ key, decided_at: d.decidedAt, state: "pending" as const },
				]
					.sort((a, b) => b.decided_at - a.decided_at)
					.slice(0, 20)
				p.revision++
				p.updated_at = this.now()
				p.expires_at = this.now() + PROFILE_RETENTION_MS
				if (await this.store.save(p, old)) {
					this.remember(p)
					break
				}
				if (i === 5)
					throw new RoomError("busy", "Follow-up will retry", 503, true)
			}
		}
	}
}
