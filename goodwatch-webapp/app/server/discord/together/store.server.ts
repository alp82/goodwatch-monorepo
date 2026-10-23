import type { Summary, VotingState, Action } from "./rules.ts"
import type { GuestTitle } from "../cards.ts"
export const SESSION_TTL = 24 * 60 * 60
export const EXPIRED = "This session expired. Start a new one with /together."
export const GUILD_LIMIT =
	"Slow down. This server has 3 open sessions. End one or try again when it expires."
export interface DeckPlace {
	country: string
	services: number[]
}
export interface SessionMeta {
	id: string
	createdAt: number
	applicationId?: string
	interactionToken?: string
	starterId: string
	starterName?: string
	guildId: string
	channelId?: string
	messageId?: string
	type: "movie" | "show" | "any"
	mood?: string
	place: DeckPlace
	deck: string[]
	status: "open" | "decided" | "ended" | "expired"
	deckDone?: boolean
	endedAt?: number
	decidedTitleId?: string
	decisionBy?: "everyone" | "starter"
	titles?: Record<string, GuestTitle>
	decisionTitle?: GuestTitle
	availabilityFailed?: boolean
	participantCount?: number
}
export interface Session extends VotingState {
	meta: SessionMeta
	summary: Summary
	names?: Record<string, string>
	transitioned?: boolean
}
export type SessionAction =
	| Action
	| { kind: "end"; user: string }
	| { kind: "remove"; user: string; target: string }
	| { kind: "choose"; user: string; titleId: string }
export interface EvalClient {
	eval(
		script: string,
		keys: number,
		...args: (string | number)[]
	): Promise<unknown>
}
export const sessionKey = (id: string) => `discord:together:v1:{${id}}`
export const guildKey = (id: string) => `discord:together:guild:v1:{${id}}`
/** One slot per guild. Expired reservations are pruned atomically before counting. */
export const GUILD_SCRIPT = `
local now = tonumber(ARGV[2])
local flat = redis.call('HGETALL', KEYS[1])
local count = 0
for i = 1, #flat, 2 do
 if tonumber(flat[i+1]) <= now then redis.call('HDEL', KEYS[1], flat[i])
 else count = count + 1 end
end
if ARGV[1] == 'release' then redis.call('HDEL', KEYS[1], ARGV[3]); return 1 end
if redis.call('HGET', KEYS[1], ARGV[3]) then
 redis.call('HSET', KEYS[1], ARGV[3], ARGV[4]); return 1
end
if count >= 3 then return 0 end
redis.call('HSET', KEYS[1], ARGV[3], ARGV[4])
redis.call('EXPIRE', KEYS[1], 86400)
return 1
`
/** Votes, picks, membership, closing CAS, and their projection have one atomic owner. */
export const SESSION_SCRIPT = `
local op, user, input = ARGV[1], ARGV[2], cjson.decode(ARGV[3])
local now = tonumber(ARGV[4])
local raw = redis.call('HGET', KEYS[1], 'data')
local recovered = not raw and op ~= 'create'
if op == 'create' and not raw then raw = ARGV[3]
elseif not raw then raw = redis.call('HGET', KEYS[3], 'data') end
if not raw then return nil end
local meta = cjson.decode(raw)
local deck = meta.deck
local flat = redis.call('HGETALL', KEYS[2])
local votes, count = {}, 0
for i = 1, #flat, 2 do
 local b = cjson.decode(flat[i+1])
 if #b > 0 then votes[flat[i]] = b; count = count + 1 end
end
local picks = cjson.decode(redis.call('HGET', KEYS[1], 'picks') or '{}')
local names = cjson.decode(redis.call('HGET', KEYS[1], 'names') or '{}')
local transitioned = false
local function close(status)
 meta.status = status; meta.endedAt = now; transitioned = true
end
if meta.status == 'open' and (recovered or (count == 0 and (meta.participantCount or 0) > 0) or now >= meta.createdAt + 86400000) then
 close('expired'); meta.endedAt = math.min(now, meta.createdAt + 86400000)
end
local function nextTitle(b)
 for _, id in ipairs(deck) do
  local found = false
  for _, v in ipairs(b) do if v.titleId == id then found = true end end
  if not found then return id end
 end
end
if op ~= 'read' and op ~= 'create' and op ~= 'bind' and op ~= 'details' and op ~= 'titles' and meta.status ~= 'open' and not transitioned then
 return redis.error_reply('This session is closed')
end
if meta.status == 'open' then
 local b = votes[user] or {}
 if (op == 'join' or op == 'vote') and #b == 0 and count >= 12 then
  return redis.error_reply('This session is full')
 end
 if (op == 'end' or op == 'remove' or op == 'choose') and user ~= meta.starterId then
  return redis.error_reply('Only the starter can do that')
 end
 if op == 'vote' and input.titleId == nextTitle(b) and (input.vote == 'yep' or input.vote == 'nope') then
  table.insert(b, {titleId = input.titleId, vote = input.vote}); votes[user] = b
  redis.call('HSET', KEYS[2], user, cjson.encode(b))
 elseif op == 'undo' and #b > 0 and b[#b].titleId == input.titleId then
  table.remove(b)
  if #b == 0 then votes[user] = nil; redis.call('HDEL', KEYS[2], user)
  else redis.call('HSET', KEYS[2], user, cjson.encode(b)) end
 elseif op == 'leave' or op == 'remove' then
  local target = user
  if op == 'remove' then target = input.target end
  votes[target] = nil; redis.call('HDEL', KEYS[2], target)
 elseif op == 'grow' and #deck == input.expectedLength then
  local added = 0
  for _, id in ipairs(input.candidates) do
   local found = false
   for _, old in ipairs(deck) do if old == id then found = true end end
   if not found and added < 30 and #deck < 120 then table.insert(deck, id); added = added + 1 end
  end
  meta.deckDone = input.done
 elseif op == 'end' then close('ended') end
 if input.displayName and votes[user] then names[user] = input.displayName end
end
if op == 'bind' then meta.channelId = input.channelId; meta.messageId = input.messageId end
if op == 'titles' and meta.status == 'open' then
 meta.titles = meta.titles or {}
 for _, title in ipairs(input.titles) do meta.titles[title.id] = title end
end
if op == 'details' and meta.status == 'decided' then
 meta.decisionTitle = input.title; meta.availabilityFailed = input.failed
end
local participants, still = 0, 0
for _, b in pairs(votes) do
 participants = participants + 1
 if nextTitle(b) then still = still + 1 end
end
local matches, possible, ranked = {}, {}, {}
local matchSet = {}
for order, id in ipairs(deck) do
 local yep, nope = 0, false
 for _, b in pairs(votes) do
  for _, v in ipairs(b) do
   if v.titleId == id then
    if v.vote == 'yep' then yep = yep + 1 else nope = true end
   end
  end
 end
 table.insert(ranked, {titleId = id, yep = yep, order = order})
 if yep > 0 and not nope then
  if yep == participants then table.insert(matches, id); matchSet[id] = true
  else table.insert(possible, {titleId = id, waitingFor = participants - yep}) end
 end
end
for u, id in pairs(picks) do if not votes[u] or not matchSet[id] then picks[u] = nil end end
for u, _ in pairs(names) do if not votes[u] then names[u] = nil end end
if meta.status == 'open' then
 meta.participantCount = participants
 if op == 'pick' then
  if not votes[user] then return redis.error_reply('Join to pick') end
  if not matchSet[input.titleId] then return redis.error_reply('Choose a current match') end
  picks[user] = input.titleId
 end
 local agreed = nil
 for u, _ in pairs(votes) do
  if not picks[u] then agreed = nil; break end
  if not agreed then agreed = picks[u] elseif agreed ~= picks[u] then agreed = nil; break end
 end
 if participants > 0 and agreed then
  meta.decidedTitleId = agreed; meta.decisionBy = 'everyone'
  meta.decisionTitle = (meta.titles or {})[agreed]; meta.availabilityFailed = true; close('decided')
 elseif op == 'choose' then
  if (#deck < 120 and not meta.deckDone) or participants == 0 or still > 0 or #matches > 0 then
   return redis.error_reply('The deck is not exhausted')
  end
  table.sort(ranked, function(a,b) if a.yep == b.yep then return a.order < b.order else return a.yep > b.yep end end)
  local valid = false
  for i = 1, math.min(3, #ranked) do if ranked[i].titleId == input.titleId then valid = true end end
  if not valid then return redis.error_reply('Choose one of the top three titles') end
  meta.decidedTitleId = input.titleId; meta.decisionBy = 'starter'
  meta.decisionTitle = (meta.titles or {})[input.titleId]; meta.availabilityFailed = true; close('decided')
 end
end
local remaining = math.max(1, math.ceil((meta.createdAt + 86400000 - now) / 1000))
if meta.status ~= 'open' then remaining = math.max(1, math.ceil((meta.createdAt + 172800000 - now) / 1000)) end
redis.call('HSET', KEYS[1], 'data', cjson.encode(meta))
redis.call('HSET', KEYS[1], 'picks', meta.status == 'open' and cjson.encode(picks) or '{}')
redis.call('HSET', KEYS[1], 'names', meta.status == 'open' and cjson.encode(names) or '{}')
redis.call('EXPIRE', KEYS[1], remaining)
-- Private ballots always expire at the original deadline, including after a decision.
redis.call('EXPIRE', KEYS[2], math.max(1, math.ceil((meta.createdAt + 86400000 - now) / 1000)))
-- Recovery record has only session metadata and counts, never ballots, picks, or display names.
-- It lets the first post-expiry press record the outcome after live hashes have expired.
local record = {}
for k, v in pairs(meta) do if k ~= 'deck' and k ~= 'titles' and k ~= 'starterName' and k ~= 'interactionToken' then record[k] = v end end
record.deck = {}
redis.call('HSET', KEYS[3], 'data', cjson.encode(record))
redis.call('EXPIRE', KEYS[3], math.max(1, math.ceil((meta.createdAt + 172800000 - now) / 1000)))
return cjson.encode({meta = meta, votes = votes, picks = picks, names = names, transitioned = transitioned, summary = {
 participantCount = meta.participantCount or participants, stillVoting = still, matches = matches, possibleMatches = possible
}})
`
export function createSessionStore(
	client: EvalClient,
	deadline: <T>(p: Promise<T>) => Promise<T>,
	options: {
		now?: () => number
		onClose?: (session: Session) => Promise<void>
	} = {},
) {
	const now = options.now ?? Date.now
	const guild = (id: string, op: string, session: string, expires = 0) =>
		deadline(
			client.eval(GUILD_SCRIPT, 1, guildKey(id), op, now(), session, expires),
		)
	async function run(id: string, op: string, user = "", input: unknown = {}) {
		const raw = await deadline(
			client.eval(
				SESSION_SCRIPT,
				3,
				`${sessionKey(id)}:meta`,
				`${sessionKey(id)}:votes`,
				`${sessionKey(id)}:record`,
				op,
				user,
				JSON.stringify(input),
				now(),
			),
		)
		if (!raw) return null
		const value = JSON.parse(String(raw)) as Omit<Session, "deck">
		value.meta.deck = Array.isArray(value.meta.deck) ? value.meta.deck : []
		value.meta.place.services = Array.isArray(value.meta.place.services)
			? value.meta.place.services
			: []
		value.summary.matches = Array.isArray(value.summary.matches)
			? value.summary.matches
			: []
		value.summary.possibleMatches = Array.isArray(value.summary.possibleMatches)
			? value.summary.possibleMatches
			: []
		const session = { ...value, deck: value.meta.deck } as Session
		if (session.transitioned) {
			await guild(session.meta.guildId, "release", id).catch(() =>
				console.error("DISCORD together limit release failed"),
			)
			await options
				.onClose?.(session)
				.catch(() => console.error("DISCORD together outcome write failed"))
		}
		return session
	}
	return {
		reserve: (guildId: string, id: string, expiresAt: number) =>
			guild(guildId, "reserve", id, expiresAt),
		release: (guildId: string, id: string) => guild(guildId, "release", id),
		load: (id: string) => run(id, "read"),
		create: async (meta: SessionMeta) => {
			if (
				!Number(
					await guild(
						meta.guildId,
						"reserve",
						meta.id,
						meta.createdAt + SESSION_TTL * 1000,
					),
				)
			)
				throw new Error(GUILD_LIMIT)
			try {
				return await run(meta.id, "create", "", meta)
			} catch (error) {
				await guild(meta.guildId, "release", meta.id)
				throw error
			}
		},
		act: (id: string, action: SessionAction, displayName?: string) =>
			run(id, action.kind, action.user, { ...action, displayName }),
		grow: (
			id: string,
			expectedLength: number,
			candidates: string[],
			done: boolean,
		) => run(id, "grow", "", { expectedLength, candidates, done }),
		bind: (id: string, channelId: string, messageId: string) =>
			run(id, "bind", "", { channelId, messageId }),
		remember: (id: string, titles: GuestTitle[]) =>
			run(id, "titles", "", { titles }),
		details: (id: string, title: GuestTitle, failed: boolean) =>
			run(id, "details", "", { title, failed }),
	}
}
export type SessionStore = ReturnType<typeof createSessionStore>
export async function sessionStore() {
	const { getRedisCluster, withRedisDeadline } = await import(
		"../../../utils/cache"
	)
	const redis = getRedisCluster()
	if (!redis) throw new Error("Together storage unavailable")
	const { writeOutcome } = await import("./outcome.server.ts")
	return createSessionStore(redis, withRedisDeadline, {
		onClose: writeOutcome,
	})
}
