import type { Summary, VotingState, Action } from "./rules.ts"
export const SESSION_TTL = 24 * 60 * 60
export const EXPIRED = "This session expired. Start a new one with /together."
export interface DeckPlace {
	country: string
	services: number[]
}
export interface SessionMeta {
	id: string
	createdAt: number
	// Original webhook credentials allow binding recovery during its 15 minute lifetime.
	applicationId?: string
	interactionToken?: string
	starterId: string
	guildId: string
	channelId?: string
	messageId?: string
	type: "movie" | "show" | "any"
	mood?: string
	place: DeckPlace
	deck: string[]
	// Decision/end/expiry handlers can close this gate in the next ticket.
	status: "open" | "decided" | "ended"
	deckDone?: boolean
}
export interface Session extends VotingState {
	meta: SessionMeta
	summary: Summary
}
export interface EvalClient {
	eval(
		script: string,
		keys: number,
		...args: (string | number)[]
	): Promise<unknown>
}
/** All session keys share a cluster hash tag. Never retain private votes outside this TTL. */
export const sessionKey = (id: string) => `discord:together:v1:{${id}}`
// One script owns mutations and the summary, including the participant limit and append-only deck CAS.
export const SESSION_SCRIPT = `
local op, user, input = ARGV[1], ARGV[2], cjson.decode(ARGV[3])
local raw = redis.call('HGET', KEYS[1], 'data')
if op == 'create' and not raw then
 raw = ARGV[3]
 redis.call('HSET', KEYS[1], 'data', raw)
elseif not raw then return nil end
local meta = cjson.decode(raw)
local deck = meta.deck
local flat = redis.call('HGETALL', KEYS[2])
local votes = {}
local count = 0
for i = 1, #flat, 2 do
 local ballot = cjson.decode(flat[i + 1])
 if #ballot > 0 then votes[flat[i]] = ballot; count = count + 1 end
end
local ballot = votes[user] or {}
local function nextTitle(b)
 for _, id in ipairs(deck) do
  local found = false
  for _, v in ipairs(b) do if v.titleId == id then found = true end end
  if not found then return id end
 end
end
if op ~= 'read' and op ~= 'create' and meta.status ~= 'open' then
 return redis.error_reply('This session is closed')
end
if (op == 'join' or op == 'vote') and #ballot == 0 and count >= 12 then
 return redis.error_reply('This session is full')
end
if op == 'vote' and input.titleId == nextTitle(ballot) and (input.vote == 'yep' or input.vote == 'nope') then
 table.insert(ballot, {titleId = input.titleId, vote = input.vote})
 votes[user] = ballot
 redis.call('HSET', KEYS[2], user, cjson.encode(ballot))
elseif op == 'undo' and #ballot > 0 and ballot[#ballot].titleId == input.titleId then
 table.remove(ballot)
 if #ballot == 0 then votes[user] = nil; redis.call('HDEL', KEYS[2], user)
 else redis.call('HSET', KEYS[2], user, cjson.encode(ballot)) end
elseif op == 'leave' then
 votes[user] = nil
 redis.call('HDEL', KEYS[2], user)
elseif op == 'grow' and #deck == input.expectedLength then
 local added = 0
 for _, id in ipairs(input.candidates) do
  local found = false
  for _, old in ipairs(deck) do if old == id then found = true end end
  if not found and added < 30 and #deck < 120 then table.insert(deck, id); added = added + 1 end
 end
 meta.deckDone = input.done
elseif op == 'bind' then
 meta.channelId = input.channelId; meta.messageId = input.messageId
end
if op ~= 'read' then
 redis.call('HSET', KEYS[1], 'data', cjson.encode(meta))
 redis.call('EXPIRE', KEYS[1], 86400)
 redis.call('EXPIRE', KEYS[2], 86400)
end
local participants, still = 0, 0
for _, b in pairs(votes) do
 participants = participants + 1
 if nextTitle(b) then still = still + 1 end
end
local matches, possible = {}, {}
for _, id in ipairs(deck) do
 local yep, nope = 0, false
 for _, b in pairs(votes) do
  for _, v in ipairs(b) do
   if v.titleId == id then
    if v.vote == 'yep' then yep = yep + 1 else nope = true end
   end
  end
 end
 if yep > 0 and not nope then
  if yep == participants then table.insert(matches, id)
  else table.insert(possible, {titleId = id, waitingFor = participants - yep}) end
 end
end
return cjson.encode({meta = meta, votes = votes, summary = {
 participantCount = participants, stillVoting = still, matches = matches, possibleMatches = possible
}})
`
export function createSessionStore(
	client: EvalClient,
	deadline: <T>(p: Promise<T>) => Promise<T>,
) {
	async function run(id: string, op: string, user = "", input: unknown = {}) {
		let raw: unknown
		try {
			raw = await deadline(
				client.eval(
					SESSION_SCRIPT,
					2,
					`${sessionKey(id)}:meta`,
					`${sessionKey(id)}:votes`,
					op,
					user,
					JSON.stringify(input),
				),
			)
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("This session is full")
			)
				throw new Error("This session is full")
			throw error
		}
		if (!raw) return null
		const value = JSON.parse(String(raw)) as Omit<Session, "deck">
		// Redis cjson encodes empty Lua tables as objects.
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
		return { ...value, deck: value.meta.deck } as Session
	}
	return {
		load: (id: string) => run(id, "read"),
		create: (meta: SessionMeta) => run(meta.id, "create", "", meta),
		act: (id: string, action: Action) =>
			run(id, action.kind, action.user, action),
		grow: (
			id: string,
			expectedLength: number,
			candidates: string[],
			done: boolean,
		) => run(id, "grow", "", { expectedLength, candidates, done }),
		bind: (id: string, channelId: string, messageId: string) =>
			run(id, "bind", "", { channelId, messageId }),
	}
}
export type SessionStore = ReturnType<typeof createSessionStore>
export async function sessionStore() {
	const { getRedisCluster, withRedisDeadline } = await import(
		"../../../utils/cache"
	)
	const redis = getRedisCluster()
	if (!redis) throw new Error("Together storage unavailable")
	return createSessionStore(redis, withRedisDeadline)
}
