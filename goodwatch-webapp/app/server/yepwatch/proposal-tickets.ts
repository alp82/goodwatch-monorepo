/**
 * Realtime tickets, kept outside the room: issuing one and consuming it on WebSocket attach never writes the room
 * row, so neither waits in the room's write lane behind (or ahead of) a vote or Start.
 *
 * A ticket is a 30 s, one-use bearer for one participant at one capability epoch. The store keeps it by its hash
 * (never the ticket itself) and hands it out once: consume is atomic. Whether the participant may still attach is
 * decided afterwards against a fresh read of the room (epoch, left, session), which is what removing a person's
 * tickets from the room used to guarantee.
 */
export interface TicketRecord {
	participantId: string
	epoch: number
	expiresAt: number
	/** The sign-in session the ticket was issued under. */
	sessionId?: string
	/** The participant was a member (account place) when the ticket was issued: the session must still be on it. */
	member?: boolean
}
export interface TicketStore {
	/**
	 * Stores the ticket unless the participant already holds `limit` unexpired ones; false then. `now` is the API
	 * clock the expiries are on.
	 */
	issue(roomId: string, hash: string, record: TicketRecord, limit: number, now: number): Promise<boolean>
	/** The ticket's record, removed in the same step; null when unknown, consumed already or expired. */
	consume(roomId: string, hash: string, now: number): Promise<TicketRecord | null>
	/** Throws unless the store answers (and lets this process run its scripts): part of readiness. */
	check?(): Promise<void>
}

/** One process only: tests and local runners. */
export class MemoryTicketStore implements TicketStore {
	private tickets = new Map<string, TicketRecord & { roomId: string }>()
	async issue(roomId: string, hash: string, record: TicketRecord, limit: number, now: number) {
		for (const [key, t] of this.tickets) if (t.expiresAt <= now) this.tickets.delete(key)
		// Tickets of an earlier capability epoch can never attach again: they don't count.
		const held = [...this.tickets.values()].filter(
			(t) => t.roomId === roomId && t.participantId === record.participantId && t.epoch === record.epoch
		)
		if (held.length >= limit) return false
		this.tickets.set(hash, { ...record, roomId })
		return true
	}
	async consume(roomId: string, hash: string, now: number) {
		const t = this.tickets.get(hash)
		if (!t || t.roomId !== roomId) return null
		this.tickets.delete(hash)
		if (t.expiresAt <= now) return null
		const { roomId: _, ...record } = t
		return record
	}
}

/** The commands ValkeyTicketStore needs (ioredis Redis or Cluster). */
export interface ScriptClient {
	eval(script: string, numberOfKeys: number, ...args: (string | number)[]): Promise<unknown>
}
/**
 * Both keys carry the room in a hash tag, so one script touches one cluster slot. `held` is a sorted set of the
 * room's live tickets (`participantId:epoch:hash`, scored by expiry) that counts a participant's outstanding
 * tickets in its current capability epoch (an earlier epoch's tickets can never attach, so they don't count).
 * Scripts run once: the client must not resend a command whose answer was lost (see the release bus).
 */
const ISSUE = `
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])
local held = 0
for _, m in ipairs(redis.call('ZRANGE', KEYS[2], 0, -1)) do
  if string.sub(m, 1, #ARGV[5]) == ARGV[5] then held = held + 1 end
end
if held >= tonumber(ARGV[6]) then return 0 end
if not redis.call('SET', KEYS[1], ARGV[7], 'PX', ARGV[3], 'NX') then return redis.error_reply('ticket exists') end
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[4])
if redis.call('PTTL', KEYS[2]) < tonumber(ARGV[3]) then redis.call('PEXPIRE', KEYS[2], ARGV[3]) end
return 1
`
const CONSUME = `
local value = redis.call('GETDEL', KEYS[1])
if not value then return false end
local record = cjson.decode(value)
redis.call('ZREM', KEYS[2], record.participantId .. ':' .. record.epoch .. ':' .. ARGV[1])
return value
`
const ticketKey = (roomId: string, hash: string) => `yepwatch:ticket:{${roomId}}:${hash}`
const heldKey = (roomId: string) => `yepwatch:tickets:{${roomId}}`

/** Tickets in Valkey (the API's messaging connection): shared by every API process, gone with their expiry. */
export class ValkeyTicketStore implements TicketStore {
	private client: ScriptClient
	constructor(client: ScriptClient) {
		this.client = client
	}
	async issue(roomId: string, hash: string, record: TicketRecord, limit: number, now: number) {
		const ttl = Math.max(1, record.expiresAt - now)
		const issued = await this.client.eval(
			ISSUE,
			2,
			ticketKey(roomId, hash),
			heldKey(roomId),
			now,
			record.expiresAt,
			ttl,
			`${record.participantId}:${record.epoch}:${hash}`,
			`${record.participantId}:${record.epoch}:`,
			limit,
			JSON.stringify(record)
		)
		return Number(issued) === 1
	}
	async check() {
		await this.client.eval(CONSUME, 2, ticketKey("readiness", "none"), heldKey("readiness"), "none")
	}
	async consume(roomId: string, hash: string, now: number) {
		const raw = await this.client.eval(CONSUME, 2, ticketKey(roomId, hash), heldKey(roomId), hash)
		if (typeof raw !== "string") return null
		const record = parseRecord(raw)
		return record.expiresAt > now ? record : null
	}
}

function parseRecord(raw: string): TicketRecord {
	const value = JSON.parse(raw) as Record<string, unknown>
	if (
		typeof value.participantId !== "string" ||
		!Number.isInteger(value.epoch) ||
		!Number.isFinite(value.expiresAt) ||
		(value.sessionId !== undefined && typeof value.sessionId !== "string") ||
		(value.member !== undefined && typeof value.member !== "boolean")
	)
		throw new Error("Invalid ticket record")
	return {
		participantId: value.participantId,
		epoch: value.epoch as number,
		expiresAt: value.expiresAt as number,
		...(value.sessionId !== undefined ? { sessionId: value.sessionId as string } : {}),
		...(value.member !== undefined ? { member: value.member as boolean } : {}),
	}
}
