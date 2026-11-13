import { createHash } from "node:crypto"
import { Redis } from "ioredis"
import { IndeterminateWrite, RoomError } from "./errors.ts"

/**
 * The dedicated YepWatch Valkey that holds live rooms (docs/yepwatch-valkey-rooms.md): standalone, noeviction, AOF.
 * Every key carries the hash tag `{yw}`, so each script stays valid on a cluster too (one slot).
 */
export const K = {
	room: (id: string) => `{yw}:room:${id}`,
	pending: "{yw}:pending",
	jobs: "{yw}:jobs",
	tries: "{yw}:jobs:tries",
	invite: (hash: string) => `{yw}:invite:${hash}`,
	quotaRoom: (id: string) => `{yw}:quota:r:${id}`,
	quotaCreator: (creator: string) => `{yw}:quota:c:${creator}`,
	admissions: (window: number) => `{yw}:adm:${window}`,
	account: (key: string) => `{yw}:acct:${key}`,
	revoked: (key: string) => `{yw}:revoked:${key}`,
	deletions: "{yw}:del",
	mirror: "{yw}:mirror",
} as const
export const ROOM_JOB = "room:"
export type RoomsValkey = Redis

/** The rooms Valkey's password: derived from the room key, as compose derives it for the server. */
export function roomsValkeyPassword(secret: string) {
	return createHash("sha256").update(`yepwatch-rooms-valkey:${secret}`).digest("hex")
}

/**
 * A connection that never sends a command twice: a write whose answer was lost may have run, so the caller treats
 * it as unknown (IndeterminateWrite) and re-reads, as with a lost Crate acknowledgement.
 */
export function createRoomsValkey(url: string, secret: string, options: { password?: string | null } = {}) {
	const password = options.password === undefined ? roomsValkeyPassword(secret) : options.password ?? undefined
	const client = new Redis(url, {
		lazyConnect: true,
		connectTimeout: 2000,
		commandTimeout: 2000,
		maxRetriesPerRequest: 0,
		autoResendUnfulfilledCommands: false,
		enableOfflineQueue: false,
		...(password ? { password } : {}),
	})
	defineScripts(client)
	return client
}

/** A refusal Valkey answered (script error): the command did not run. Anything else after sending may have. */
const answered = (e: unknown) => e instanceof Error && e.name === "ReplyError"
export const unavailable = () => new RoomError("busy", "YepWatch rooms are temporarily unavailable; retry shortly", 503, true)

/** Runs a read; any failure is a retryable 503. */
export async function readCall<T>(work: Promise<T>): Promise<T> {
	try {
		return await work
	} catch (e) {
		if (e instanceof RoomError) throw e
		throw unavailable()
	}
}
/** Runs a write; a lost answer is IndeterminateWrite, a refused one a retryable 503. */
export async function writeCall<T>(work: Promise<T>): Promise<T> {
	try {
		return await work
	} catch (e) {
		if (e instanceof RoomError) throw e
		if (answered(e)) throw unavailable()
		throw new IndeterminateWrite("Rooms store answer lost")
	}
}

/**
 * Shared Lua: `pending(room, pendingKey, id)` keeps the room in the repair set exactly while it has an unpublished
 * revision (`p` > 0) or a running agreement check (`a` = 1).
 */
const PENDING = `
local function pending(room, set, id)
  local f = redis.call('HMGET', room, 'p', 'a')
  if f[1] and (tonumber(f[1]) > 0 or f[2] == '1') then redis.call('ZADD', set, 0, id) else redis.call('ZREM', set, id) end
end
`
/**
 * Unsynced rooms never expire; a synced room is kept a week after its own expiry (at least an hour from now), so an
 * expired room still answers "expired" as Crate did.
 */
const SYNCED_TTL = `
local function synced_ttl(room, now)
  local e = tonumber(redis.call('HGET', room, 'e') or '0')
  redis.call('PEXPIREAT', room, math.max(e + 604800000, now + 3600000))
end
`
const SCRIPTS = {
	/** KEYS room, mirror. {v, i, p, b} of the room, or {false, rooms-imported flag} without one. */
	ywRead: {
		keys: 2,
		lua: `
local f = redis.call('HMGET', KEYS[1], 'v', 'i', 'p', 'b')
if f[1] then return f end
return {false, redis.call('HGET', KEYS[2], 'rooms') or ''}`,
	},
	/** KEYS room, pending, jobs. ARGV now, incarnation, revision, expiry, pendingRevision, agreementChecking, body, id. */
	ywInsert: {
		keys: 3,
		lua: `${PENDING}
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
if tonumber(ARGV[1]) >= tonumber(ARGV[4]) then return -1 end
redis.call('HSET', KEYS[1], 'v', 1, 'i', ARGV[2], 'r', ARGV[3], 'e', ARGV[4], 'p', ARGV[5], 'a', ARGV[6], 'b', ARGV[7], 's', 0)
pending(KEYS[1], KEYS[2], ARGV[8])
redis.call('ZADD', KEYS[3], 'NX', ARGV[1], '${ROOM_JOB}' .. ARGV[8])
return 1`,
	},
	/** KEYS room, pending, jobs. ARGV now, expected version, expected incarnation, revision, pendingRevision, agreementChecking, body, id. */
	ywCas: {
		keys: 3,
		lua: `${PENDING}
local cur = redis.call('HMGET', KEYS[1], 'v', 'i')
if not cur[1] or cur[1] ~= ARGV[2] or cur[2] ~= ARGV[3] then return 0 end
redis.call('HSET', KEYS[1], 'v', tonumber(cur[1]) + 1, 'r', ARGV[4], 'p', ARGV[5], 'a', ARGV[6], 'b', ARGV[7])
redis.call('PERSIST', KEYS[1])
pending(KEYS[1], KEYS[2], ARGV[8])
redis.call('ZADD', KEYS[3], 'NX', ARGV[1], '${ROOM_JOB}' .. ARGV[8])
return 1`,
	},
	/** KEYS room, pending. ARGV revision, id. */
	ywAck: {
		keys: 2,
		lua: `
local f = redis.call('HMGET', KEYS[1], 'p', 'a')
if not f[1] then redis.call('ZREM', KEYS[2], ARGV[2]) return 0 end
local p = tonumber(f[1])
if p > 0 and p <= tonumber(ARGV[1]) then redis.call('HSET', KEYS[1], 'p', 0) p = 0 end
if p == 0 and f[2] ~= '1' then redis.call('ZREM', KEYS[2], ARGV[2]) end
return 1`,
	},
	/** KEYS pending. ARGV limit, key prefix. Ids still pending, dropping those whose room key is gone. */
	ywPending: {
		keys: 1,
		lua: `
local ids = redis.call('ZRANGE', KEYS[1], 0, tonumber(ARGV[1]) * 2)
local out = {}
for _, id in ipairs(ids) do
  if redis.call('EXISTS', ARGV[2] .. id) == 1 then
    if #out < tonumber(ARGV[1]) then out[#out + 1] = id end
  else redis.call('ZREM', KEYS[1], id) end
end
return out`,
	},
	/**
	 * A room read through from Crate, unless the key exists. KEYS room, pending. ARGV now, incarnation, revision,
	 * expiry, pendingRevision, agreementChecking, body, id, crate seq, crate term.
	 */
	ywImport: {
		keys: 2,
		lua: `${PENDING}${SYNCED_TTL}
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('HSET', KEYS[1], 'v', 1, 'i', ARGV[2], 'r', ARGV[3], 'e', ARGV[4], 'p', ARGV[5], 'a', ARGV[6], 'b', ARGV[7], 's', 1, 'cs', ARGV[9], 'ct', ARGV[10])
synced_ttl(KEYS[1], tonumber(ARGV[1]))
pending(KEYS[1], KEYS[2], ARGV[8])
return 1`,
	},
	/**
	 * Crate's head replaces the live copy (it moved without this store: a rollback, a lost Valkey write), unless the
	 * room changed since the caller read it. A new incarnation (no stale compare-and-swap can land). `synced` 0: the
	 * body differs from the head (revision raised above both), so it is queued for the copy.
	 * KEYS room, pending, jobs. ARGV now, expected version, expected incarnation, new incarnation, revision, expiry,
	 * pendingRevision, agreementChecking, body, id, crate seq, crate term, synced, and the copy bookkeeping the caller
	 * decided on: expected cs, ct, w ('' for none). Any change to those (a copy landed meanwhile) refuses.
	 */
	ywReplace: {
		keys: 3,
		lua: `${PENDING}${SYNCED_TTL}
local cur = redis.call('HMGET', KEYS[1], 'v', 'i', 'cs', 'ct', 'w')
if cur[1] ~= ARGV[2] or cur[2] ~= ARGV[3] then return 0 end
if (cur[3] or '') ~= ARGV[14] or (cur[4] or '') ~= ARGV[15] or (cur[5] or '') ~= ARGV[16] then return 0 end
redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[1], 'v', 1, 'i', ARGV[4], 'r', ARGV[5], 'e', ARGV[6], 'p', ARGV[7], 'a', ARGV[8], 'b', ARGV[9], 'cs', ARGV[11], 'ct', ARGV[12])
if ARGV[13] == '1' then
  redis.call('HSET', KEYS[1], 's', 1)
  synced_ttl(KEYS[1], tonumber(ARGV[1]))
else
  redis.call('HSET', KEYS[1], 's', 0)
  redis.call('ZADD', KEYS[3], 'NX', ARGV[1], '${ROOM_JOB}' .. ARGV[10])
end
pending(KEYS[1], KEYS[2], ARGV[10])
return 1`,
	},
	/** KEYS jobs. ARGV now, lease until, limit. Due jobs, leased (score = lease end, the fencing token). */
	ywClaim: {
		keys: 1,
		lua: `
local due = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, tonumber(ARGV[3]))
for _, m in ipairs(due) do redis.call('ZADD', KEYS[1], 'XX', ARGV[2], m) end
return due`,
	},
	/** KEYS jobs, tries. ARGV member, lease. Drops a job whose lease is still this one. */
	ywDone: {
		keys: 2,
		lua: `
if tonumber(redis.call('ZSCORE', KEYS[1], ARGV[1]) or '-1') ~= tonumber(ARGV[2]) then return 0 end
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[2], ARGV[1])
return 1`,
	},
	/** KEYS jobs, tries. ARGV member, lease, now, base ms, max ms. Due again after a growing backoff, if still leased here. */
	ywRetry: {
		keys: 2,
		lua: `
if tonumber(redis.call('ZSCORE', KEYS[1], ARGV[1]) or '-1') ~= tonumber(ARGV[2]) then return 0 end
local n = redis.call('HINCRBY', KEYS[2], ARGV[1], 1)
local wait = math.min(tonumber(ARGV[4]) * math.pow(2, n - 1), tonumber(ARGV[5]))
redis.call('ZADD', KEYS[1], tonumber(ARGV[3]) + wait, ARGV[1])
return n`,
	},
	/**
	 * KEYS jobs, room. ARGV member, lease, version, head fingerprint, incarnation. Notes the write about to start
	 * (crash or lost answer: it may land later): `w` the newest version written, `wf` `version:fingerprint` of every
	 * write not yet known to be fenced out (space-separated, each once, all kept). A write that succeeds fences out all earlier
	 * ones (their base head is gone), so ywSynced and ywAdopt clear them.
	 */
	ywMark: {
		keys: 2,
		lua: `
if tonumber(redis.call('ZSCORE', KEYS[1], ARGV[1]) or '-1') ~= tonumber(ARGV[2]) then return 0 end
if redis.call('HGET', KEYS[2], 'i') ~= ARGV[5] then return 0 end
local entry = ARGV[3] .. ':' .. ARGV[4]
local prints = redis.call('HGET', KEYS[2], 'wf') or ''
if not string.find(' ' .. prints .. ' ', ' ' .. entry .. ' ', 1, true) then
  prints = prints == '' and entry or (prints .. ' ' .. entry)
end
redis.call('HSET', KEYS[2], 'w', ARGV[3], 'wf', prints)
return 1`,
	},
	/**
	 * A room version written to Crate. KEYS jobs, tries, room. ARGV member, lease, written version, crate seq,
	 * crate term, now, incarnation. Records it if newer than what is recorded (also from a writer whose lease ran out:
	 * its write landed), only in the incarnation it was read from (a replaced room keeps its own bookkeeping and job);
	 * the job is dropped once the room is synced, or made due again when a newer version arrived.
	 */
	ywSynced: {
		keys: 3,
		lua: `${SYNCED_TTL}
local held = tonumber(redis.call('ZSCORE', KEYS[1], ARGV[1]) or '-1') == tonumber(ARGV[2])
local f = redis.call('HMGET', KEYS[3], 'v', 's', 'w', 'i')
if not f[1] then
  if held then redis.call('ZREM', KEYS[1], ARGV[1]) redis.call('HDEL', KEYS[2], ARGV[1]) end
  return 0
end
if ARGV[7] ~= '' and f[4] ~= ARGV[7] then
  if held then redis.call('HDEL', KEYS[2], ARGV[1]) redis.call('ZADD', KEYS[1], ARGV[6], ARGV[1]) end
  return 4
end
local s = tonumber(f[2] or '0')
if tonumber(ARGV[3]) > s then
  s = tonumber(ARGV[3])
  redis.call('HSET', KEYS[3], 's', s, 'cs', ARGV[4], 'ct', ARGV[5])
  if f[3] and tonumber(f[3]) <= s then redis.call('HDEL', KEYS[3], 'w', 'wf') end
end
if not held then return 2 end
redis.call('HDEL', KEYS[2], ARGV[1])
if s >= tonumber(f[1]) then
  redis.call('ZREM', KEYS[1], ARGV[1])
  synced_ttl(KEYS[3], tonumber(ARGV[6]))
  return 1
end
redis.call('ZADD', KEYS[1], ARGV[6], ARGV[1])
return 3`,
	},
	/**
	 * Crate's head is this store's own write whose record was lost (crash between the Crate write and ywSynced; the
	 * caller matched the head's fingerprint with `wf`): adopt it: that write's version, and the head as
	 * the base of the next write, only while the caller still holds the room's lease and the bookkeeping it read is
	 * unchanged. KEYS room, jobs. ARGV expected incarnation, that write's version, crate seq, crate term, member, lease,
	 * expected cs, expected ct.
	 */
	ywAdopt: {
		keys: 2,
		lua: `
if tonumber(redis.call('ZSCORE', KEYS[2], ARGV[5]) or '-1') ~= tonumber(ARGV[6]) then return 0 end
local f = redis.call('HMGET', KEYS[1], 'i', 's', 'cs', 'ct')
if f[1] ~= ARGV[1] or (f[3] or '') ~= ARGV[7] or (f[4] or '') ~= ARGV[8] then return 0 end
if tonumber(ARGV[2]) > tonumber(f[2] or '0') then redis.call('HSET', KEYS[1], 's', ARGV[2]) end
redis.call('HSET', KEYS[1], 'cs', ARGV[3], 'ct', ARGV[4])
redis.call('HDEL', KEYS[1], 'w', 'wf', 'x')
return 1`,
	},
	/** KEYS room. ARGV expected incarnation. Forgets the Crate head (it was removed): the next copy inserts. */
	ywUnsync: {
		keys: 1,
		lua: `
if redis.call('HGET', KEYS[1], 'i') ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 's', 0)
redis.call('HDEL', KEYS[1], 'cs', 'ct')
return 1`,
	},
	/**
	 * An invite code's mapping, kept as long as Crate keeps it. KEYS invite, mirror. ARGV room id, expiry, expire at.
	 * Returns the stored expiry for this room, -1 for another room's code, -2 while invites aren't imported.
	 */
	ywInvite: {
		keys: 2,
		lua: `
if redis.call('HGET', KEYS[2], 'invites') ~= '1' then return -2 end
local cur = redis.call('GET', KEYS[1])
if cur then
  local sep = string.find(cur, ' ')
  if string.sub(cur, 1, sep - 1) ~= ARGV[1] then return -1 end
  return tonumber(string.sub(cur, sep + 1))
end
redis.call('SET', KEYS[1], ARGV[1] .. ' ' .. ARGV[2], 'PXAT', ARGV[3])
return tonumber(ARGV[2])`,
	},
	/** KEYS invite, mirror. The room id, '' for none, or false while invites aren't imported. */
	ywFindInvite: {
		keys: 2,
		lua: `
if redis.call('HGET', KEYS[2], 'invites') ~= '1' then return false end
local cur = redis.call('GET', KEYS[1])
if not cur then return '' end
return string.sub(cur, 1, string.find(cur, ' ') - 1)`,
	},
	/** KEYS key, mirror. ARGV mirror field. 1 present, 0 absent, -1 while that mirror isn't imported. */
	ywExists: {
		keys: 2,
		lua: `
if redis.call('HGET', KEYS[2], ARGV[1]) ~= '1' then return -1 end
return redis.call('EXISTS', KEYS[1])`,
	},
	/**
	 * Admissions (create, join) in one step: the room's capacity proof, the creator's allowance, this minute's
	 * admission budget. KEYS proof, creator, admissions, mirror. ARGV mode, now, room id, admission digest, creator,
	 * allowance, op, admission budget, room ms, window end. Returns {status, expiry}.
	 */
	ywAdmit: {
		keys: 4,
		lua: `
if redis.call('HGET', KEYS[4], 'quotas') ~= '1' then return {'unready'} end
local now = tonumber(ARGV[2])
local proof = redis.call('HMGET', KEYS[1], 'a', 'e')
local function charge()
  if redis.call('SISMEMBER', KEYS[3], ARGV[7]) == 1 then return true end
  if redis.call('SCARD', KEYS[3]) >= tonumber(ARGV[8]) then return false end
  redis.call('SADD', KEYS[3], ARGV[7])
  redis.call('PEXPIREAT', KEYS[3], tonumber(ARGV[10]) + 60000)
  return true
end
if ARGV[1] == 'join' then
  if not proof[2] then return {'missing'} end
  if tonumber(proof[2]) <= now then return {'expired'} end
  if not charge() then return {'budget'} end
  return {'ok', proof[2]}
end
if proof[2] then
  if proof[1] ~= ARGV[4] then return {'conflict'} end
  if tonumber(proof[2]) <= now then return {'expired'} end
  return {'ok', proof[2]}
end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
if redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[6]) then return {'full'} end
if not charge() then return {'budget'} end
local e = now + tonumber(ARGV[9])
redis.call('ZADD', KEYS[2], e, ARGV[3])
redis.call('PEXPIREAT', KEYS[2], e + 86400000)
redis.call('HSET', KEYS[1], 'c', ARGV[5], 'a', ARGV[4], 'e', e)
redis.call('PEXPIREAT', KEYS[1], e + 604800000)
return {'ok', e}`,
	},
	/** KEYS proof, mirror. {expiry} of the room's capacity proof, {''} without one, {'unready'} before the import. */
	ywProof: {
		keys: 2,
		lua: `
if redis.call('HGET', KEYS[2], 'quotas') ~= '1' then return {'unready'} end
return {redis.call('HGET', KEYS[1], 'e') or ''}`,
	},
	/** KEYS hash, mirror. ARGV field, mirror field. The value, '' for none, false while not imported. */
	ywMirrorGet: {
		keys: 2,
		lua: `
if redis.call('HGET', KEYS[2], ARGV[2]) ~= '1' then return false end
return redis.call('HGET', KEYS[1], ARGV[1]) or ''`,
	},
} as const
export type ScriptName = keyof typeof SCRIPTS

function defineScripts(client: Redis) {
	for (const [name, { keys, lua }] of Object.entries(SCRIPTS)) client.defineCommand(name, { numberOfKeys: keys, lua })
}
/** Runs one of the scripts above (the client must come from createRoomsValkey or defineRoomsScripts). */
export function script<T = unknown>(client: Redis, name: ScriptName, ...args: (string | number)[]): Promise<T> {
	return (client as unknown as Record<ScriptName, (...a: (string | number)[]) => Promise<T>>)[name](...args)
}
/** Adds the scripts to a client created elsewhere (tests). */
export function defineRoomsScripts(client: Redis) {
	defineScripts(client)
	return client
}
