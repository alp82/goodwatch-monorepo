import { randomUUID } from "node:crypto"
import { RoomError } from "./errors.ts"
import { BudgetError } from "./proposal-release-control.ts"
import type { ScriptClient } from "./proposal-tickets.ts"

/**
 * The command rate limit (ControlPolicy.commands across every room and actorCommands per room participant, per
 * minute), kept outside the shared control row: charging a vote there was a compare-and-swap on one row that every
 * command in every room took in turn. Admissions (create, join) stay on the control row.
 *
 * `op` names one logical command (room, actor, command digest): charging it again in the same minute is free, so a
 * command retried after a lost compare-and-swap, or a resent script, is charged once.
 */
export interface CommandBudget {
	/** Charges `op` to this minute's budgets, or throws BudgetError (429, Retry-After) when either is spent. */
	charge(op: string, actor: string, limits: { commands: number; actorCommands: number }): Promise<void>
	/** Throws unless the store answers and lets this process run the script on its keys: part of readiness. */
	check?(): Promise<void>
}

const WINDOW_MS = 60_000
const spent = (now: number) =>
	new BudgetError("Command budget reached; retain pending command and retry", (Math.floor(now / WINDOW_MS) + 1) * WINDOW_MS / 1000 - now / 1000)

/** One process only: tests and local runners. */
export class MemoryCommandBudget implements CommandBudget {
	private window = -1
	private ops = new Set<string>()
	private actors = new Map<string, number>()
	private now: () => number
	constructor(now: () => number = Date.now) {
		this.now = now
	}
	async charge(op: string, actor: string, limits: { commands: number; actorCommands: number }) {
		const now = this.now()
		const window = Math.floor(now / WINDOW_MS)
		if (window !== this.window) {
			this.window = window
			this.ops.clear()
			this.actors.clear()
		}
		if (this.ops.has(op)) return
		const mine = this.actors.get(actor) ?? 0
		if (this.ops.size >= limits.commands || mine >= limits.actorCommands) throw spent(now)
		this.ops.add(op)
		this.actors.set(actor, mine + 1)
	}
}

/**
 * KEYS[1]: the whole budget, one string without expiry (the shared cluster evicts only keys that have one, and an
 * evicted count would hand out a second allowance): this minute's window, total, per-actor counts and granted ops,
 * replaced when a later minute starts (a process whose clock is behind keeps charging the current one). Only GET and
 * SET on `yepwatch:commands:*`. Resending it after a lost answer finds the grant and charges nothing more.
 */
const CHARGE = `
local raw = redis.call('GET', KEYS[1])
local window = tonumber(ARGV[1])
local s = raw and cjson.decode(raw) or nil
if not s or s.w < window then s = { w = window, total = 0, ops = {}, actors = {} } end
if s.ops[ARGV[2]] then return 1 end
local mine = s.actors[ARGV[3]] or 0
if s.total >= tonumber(ARGV[4]) or mine >= tonumber(ARGV[5]) then return 0 end
s.ops[ARGV[2]] = 1
s.actors[ARGV[3]] = mine + 1
s.total = s.total + 1
redis.call('SET', KEYS[1], cjson.encode(s))
return 1
`
export const COMMAND_BUDGET_KEY = "yepwatch:commands:{budget}"
const CHECK = `
redis.call('SET', KEYS[1], '1', 'PX', ARGV[1])
if not redis.call('GET', KEYS[1]) then return redis.error_reply('budget check lost its key') end
return 1
`

/**
 * The command budget in Valkey (the API's messaging connection), shared by every API process. Windows follow the API
 * clock (one host). A store that doesn't answer fails the command, retryably; it never lets one through uncharged.
 */
export class ValkeyCommandBudget implements CommandBudget {
	private client: ScriptClient
	private now: () => number
	constructor(client: ScriptClient, now: () => number = Date.now) {
		this.client = client
		this.now = now
	}
	async charge(op: string, actor: string, limits: { commands: number; actorCommands: number }) {
		const now = this.now()
		let granted: unknown
		try {
			granted = await this.client.eval(CHARGE, 1, COMMAND_BUDGET_KEY, Math.floor(now / WINDOW_MS), op.slice(0, 32), actor.slice(0, 32), limits.commands, limits.actorCommands)
		} catch {
			throw new RoomError("busy", "Command budget unavailable; retain pending command and retry", 503, true)
		}
		if (Number(granted) !== 1) throw spent(now)
	}
	async check() {
		await this.client.eval(CHECK, 1, `yepwatch:commands:{readiness}:${randomUUID()}`, 1000)
	}
}
