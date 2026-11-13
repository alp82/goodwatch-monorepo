import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { COMMAND_BUDGET_KEY, MemoryCommandBudget, ValkeyCommandBudget, type CommandBudget } from "./proposal-command-budget.ts"
import { BudgetError, CONTROL_COLUMNS, CONTROL_TABLE, DEFAULT_CONTROL, ReleaseControl, controlFingerprint, controlRow } from "./proposal-release-control.ts"
import { MemoryCreationQuotas } from "./proposal-test-support.ts"
import type { Sql } from "./repository.server.ts"

const limits = { commands: 3, actorCommands: 2 }
const spent = (e: unknown) => e instanceof BudgetError && e.status === 429 && e.retryAfterSeconds >= 1

/** The rules every store follows, on a clock the test moves (one budget window is a minute of it). */
async function rules(budget: CommandBudget, clock: { now: number }) {
	await budget.charge("op-a1", "actor-a", limits)
	await budget.charge("op-a1", "actor-a", limits) // an exact retry is free
	await budget.charge("op-a2", "actor-a", limits)
	await assert.rejects(budget.charge("op-a3", "actor-a", limits), spent, "the actor's own budget")
	await budget.charge("op-b1", "actor-b", limits)
	await assert.rejects(budget.charge("op-c1", "actor-c", limits), spent, "the shared budget")
	await budget.charge("op-a1", "actor-a", limits) // granted ones stay granted all window
	clock.now += 60_000
	await budget.charge("op-a3", "actor-a", limits) // a new window
	await budget.charge("op-c1", "actor-c", limits)
}

test("command budget (memory): shared and per-actor limits per minute; an exact retry is free", async () => {
	const clock = { now: 1_800_000_000_000 }
	await rules(new MemoryCommandBudget(() => clock.now), clock)
})

test("command budget (Valkey): same rules, safe to resend, and only GET/SET on its own keys", { skip: process.env.YEPWATCH_TEST_VALKEY !== "1", timeout: 60000 }, async (t) => {
	const { Redis } = await import("ioredis")
	const name = `yepwatch-command-budget-${process.pid}`
	execFileSync("docker", ["run", "-d", "--rm", "--name", name, "-p", "127.0.0.1::6379", "valkey/valkey:8"], { stdio: "ignore" })
	t.after(() => execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" }))
	const port = execFileSync("docker", ["port", name, "6379/tcp"]).toString().trim().split("\n")[0].split(":").at(-1)
	const client = new Redis({ host: "127.0.0.1", port: Number(port), lazyConnect: true, maxRetriesPerRequest: 1 })
	t.after(() => client.disconnect())
	for (let i = 0; ; i++) {
		try {
			await client.connect()
			break
		} catch (error) {
			if (i > 50) throw error
			await new Promise((resolve) => setTimeout(resolve, 200))
		}
	}
	const clock = { now: 1_800_000_000_000 }
	await rules(new ValkeyCommandBudget(client, () => clock.now), clock)
	assert.equal(await client.pttl(COMMAND_BUDGET_KEY), -1, "no expiry: the shared cluster never evicts the counts")
	// A process whose clock is a little behind charges the current minute, never resets it.
	const behind = new ValkeyCommandBudget(client, () => clock.now - 60_000)
	await assert.rejects(behind.charge("op-late", "actor-a", { commands: 3, actorCommands: 1 }), spent)
	// A user limited to GET/SET/EVAL on the budget keys (what the release ACL grants) runs the script and the check.
	await client.call("ACL", "SETUSER", "budget", "on", ">budget-password-for-tests", "+eval", "+get", "+set", "+ping", "~yepwatch:commands:*")
	const limited = new Redis({ host: "127.0.0.1", port: Number(port), username: "budget", password: "budget-password-for-tests", lazyConnect: true, maxRetriesPerRequest: 1 })
	t.after(() => limited.disconnect())
	await limited.connect()
	const budget = new ValkeyCommandBudget(limited, () => clock.now)
	await budget.check()
	await budget.charge("op-limited", "actor-l", limits)
	// A script resent after its answer was lost charges once.
	const resending = new ValkeyCommandBudget({
		async eval(...args: Parameters<typeof client.eval>) {
			await client.eval(...args) // this answer is "lost"
			return client.eval(...args)
		},
	} as never, () => clock.now)
	clock.now += 60_000
	await resending.charge("op-r1", "actor-r", limits)
	await budget.charge("op-r2", "actor-r", limits)
	await assert.rejects(budget.charge("op-r3", "actor-r", limits), spent, "the resent charge counted once")
	// A store that can't be reached fails the command (retryable), never lets it through.
	const down = new ValkeyCommandBudget({ async eval() { throw new Error("connection closed") } }, () => clock.now)
	await assert.rejects(down.charge("op-x", "actor-x", limits), { code: "busy", status: 503 })
})

/** A control row database (only the statements a command's permit and room check use). */
function controlDatabase(now = 1_800_000_010_000) {
	const events: string[] = []
	let row = controlRow({ format: 1, fingerprint: controlFingerprint(DEFAULT_CONTROL), window: -1, rooms: [], admissions: [], commands: [] })
	const sql: Sql = async (stmt) => {
		if (!stmt.includes(CONTROL_TABLE)) throw new Error(`unexpected: ${stmt}`)
		events.push(stmt.startsWith("SELECT") ? "control read" : "control write")
		if (stmt.startsWith("SELECT")) return { rows: [[...CONTROL_COLUMNS.map((k) => row[k]), 1, 1, now]], rowcount: 1, cols: [] } as never
		return { rows: [], rowcount: 0, cols: [] } as never
	}
	return { sql, events, set: (r: typeof row) => (row = r) }
}

test("with a command budget, a command's permit never writes the control row", async () => {
	const db = controlDatabase()
	const quotas = new MemoryCreationQuotas(() => 1_800_000_010_000)
	const charged: string[] = []
	const budget: CommandBudget = {
		async charge(op, actor) {
			charged.push(actor)
		},
	}
	const control = new ReleaseControl(db.sql, DEFAULT_CONTROL, quotas, budget)
	const room = { id: "room-b", expiresAt: await quotas.reserve("room-b", "admission", "creator") }
	const check = await control.active(room)
	db.events.length = 0
	await control.command(room.id, "actor", "digest-1", check)
	assert.deepEqual(db.events, [], "the room check's read is enough: nothing read or written")
	assert.equal(charged.length, 1)
	// Without a check from the same room (a preview), the room's capacity is proven first; still no write.
	await control.command(room.id, "actor", "digest-2")
	assert.deepEqual(db.events, ["control read"])
	await assert.rejects(control.command("no-such-room", "actor", "digest-3"))
	assert.equal(charged.length, 2, "a room without capacity charges nothing")
	// A spent budget refuses the command.
	const refusing = new ReleaseControl(db.sql, DEFAULT_CONTROL, quotas, {
		async charge() {
			throw new BudgetError("Command budget reached; retain pending command and retry", 10)
		},
	})
	await assert.rejects(refusing.command(room.id, "actor", "digest-4", await refusing.active(room)), spent)
})
