import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import * as nodeModule from "node:module"
import { after, test } from "node:test"

// No cache bootstrap, credentials, server or sockets in these tests.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: unknown,
			next: (s: string, c: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		if (specifier === "~/utils/cache" || specifier === "../../utils/cache")
			return {
				url: "data:text/javascript,export const getRedisCluster=()=>null",
				shortCircuit: true,
			}
		return next(specifier, context)
	},
})
const { createRateLimiter } = await import("../rate-limit.server.ts")
const { createRestBudget } = await import("./rest-limit.server.ts")
const luaFailures: string[] = []
after(() =>
	assert.deepEqual(
		luaFailures,
		[],
		"every production Lua invocation ran successfully",
	),
)

// Run both production scripts in Lua with a shared, expiring key table. Two limiter objects represent separate
// page processes, so a process-local count cannot make the cross-process assertions pass.
function valkey(clock: { now: number }) {
	let state = ""
	return {
		async eval(script: string, count: number, ...args: (string | number)[]) {
			assert.ok(
				args.slice(0, count).every((key) => String(key).includes("{global}")),
			)
			const run = spawnSync(
				"lua",
				[
					"-e",
					`
local now = ${clock.now}
local store = {}
for line in io.lines() do
 local key, value, untilAt = line:match('^(.-)\t(%-?%d+)\t(%-?%d+)$')
 if key and tonumber(untilAt) > now then store[key] = { value = tonumber(value), untilAt = tonumber(untilAt) } end
end
redis = { call = function(command, key, value, unit, delay)
 local entry = store[key]
 if command == 'GET' then return entry and tostring(entry.value) or false end
 if command == 'TTL' then return entry and math.ceil((entry.untilAt - now) / 1000) or -2 end
 if command == 'PTTL' then return entry and entry.untilAt - now or -2 end
 if command == 'INCRBY' then
  if not entry then entry = {value = 0, untilAt = now + 100000}; store[key] = entry end
  entry.value = entry.value + tonumber(value); return entry.value
 end
 if command == 'EXPIRE' then entry.untilAt = now + tonumber(value) * 1000; return 1 end
 if command == 'SET' then
  assert(unit == 'PX'); store[key] = {value = tonumber(value), untilAt = now + tonumber(delay)}; return 'OK'
 end
 error('Unexpected command ' .. command)
end }
KEYS = {${args
						.slice(0, count)
						.map((value) => JSON.stringify(String(value)))
						.join(",")}}
ARGV = {${args
						.slice(count)
						.map((value) => JSON.stringify(String(value)))
						.join(",")}}
local function run()
${script}
end
print(run())
for key, entry in pairs(store) do print(key .. '\t' .. entry.value .. '\t' .. entry.untilAt) end
`,
				],
				{ input: state, encoding: "utf8", timeout: 5000 },
			)
			if (run.status !== 0) luaFailures.push(run.stderr || String(run.error))
			assert.equal(run.status, 0, run.stderr)
			const [result, ...entries] = run.stdout.trim().split("\n")
			state = entries.join("\n")
			return Number(result)
		},
	}
}

test("separate processes and clients share 50 attempts per second, then resume after expiry", async () => {
	const clock = { now: 1000 }
	const store = valkey(clock)
	const budgets = Array.from({ length: 2 }, () =>
		createRestBudget({
			redis: () => store,
			limiter: createRateLimiter({ redis: () => store, now: () => clock.now }),
			now: () => clock.now,
		}),
	)
	for (let i = 0; i < 50; i++) assert.equal(await budgets[i % 2].take(), 0)
	assert.equal(await budgets[0].take(), 1000)
	assert.equal(await budgets[1].take(), 1000)
	clock.now += 1000
	assert.equal(await budgets[1].take(), 0)
})

test("global cooldown crosses processes and a shorter cooldown never releases it early", async () => {
	const clock = { now: 1000 }
	const store = valkey(clock)
	let attempts = 0
	const limiter = {
		take: async () => {
			attempts++
			return { allowed: true, store: "valkey" } as const
		},
	}
	const a = createRestBudget({
		redis: () => store,
		limiter,
		now: () => clock.now,
	})
	const b = createRestBudget({
		redis: () => store,
		limiter,
		now: () => clock.now,
	})
	await a.pause(3000)
	assert.equal(await b.take(), 3000)
	clock.now += 1000
	await b.pause(500)
	assert.equal(await a.take(), 2000)
	assert.equal(
		attempts,
		0,
		"waiting requests do not consume the request budget",
	)
	clock.now += 2000
	assert.equal(await b.take(), 0)
	assert.equal(attempts, 1)
})

test("a Valkey outage retains the process cooldown and request cap", async () => {
	const clock = { now: 1000 }
	const budget = createRestBudget({
		redis: () => {
			throw new Error("unavailable")
		},
		limiter: createRateLimiter({ redis: () => null, now: () => clock.now }),
		now: () => clock.now,
	})
	await budget.pause(500)
	assert.equal(await budget.take(), 500)
	clock.now += 500
	for (let i = 0; i < 50; i++) assert.equal(await budget.take(), 0)
	assert.equal(await budget.take(), 1000)
})
