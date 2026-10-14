// The per-visitor search limit: a burst of 10 in 30 seconds and 60 in 10 minutes, keyed by the address the trusted
// ingress writes, shared through Valkey and counted in memory without it. No test reaches Valkey: the shared count
// runs the limiter's own Lua script against a table that stands in for Valkey's keys.
//
// CommonJS packages are loaded before the alias hook, which would otherwise resolve their own relative requires.
import "ioredis"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import "../title-filter/test-alias.ts"

const { RATE_LIMIT_SCRIPT, createRateLimiter } = await import("../rate-limit.server.ts")
const {
	SEARCH_LIMITED_MESSAGE,
	SEARCH_RATE_WINDOWS,
	checkSearchRate,
	trustedClientAddress,
	visitorNetwork,
} = await import("./rate-limit.server.ts")
const { SEARCH_LIMITED_MESSAGE: BROWSER_MESSAGE } = await import("../../ui/search/search-client.ts")

// A Valkey stand-in that runs the limiter's own script in Lua 5.1 (the version Valkey embeds), with GET, TTL, INCR
// and EXPIRE on a table that lives in this process between calls. It checks that every key of one call shares a
// hash tag (one cluster slot). Without a Lua 5.1 interpreter the tests that need it are skipped.
const LUA = ["lua5.1", "luajit"].find((bin) => spawnSync(bin, ["-v"]).status === 0) ?? null
const needsLua = LUA ? {} : { skip: "no Lua 5.1 interpreter (lua5.1 or luajit) on this machine" }
const HARNESS = `
local now = tonumber(arg[1])
local numkeys = tonumber(arg[2])
local store = {}
for line in io.lines() do
	local k, v, u = line:match("^(.-)\t(%-?%d+)\t(%-?%d+)$")
	if k then store[k] = { v = tonumber(v), u = tonumber(u) } end
end
local function live(k)
	local e = store[k]
	if e and e.u >= 0 and e.u <= now then store[k] = nil end
	return store[k]
end
redis = { call = function(cmd, k, a)
	local e = live(k)
	if cmd == "GET" then return e and tostring(e.v) or false end
	if cmd == "TTL" then
		if not e then return -2 end
		if e.u < 0 then return -1 end
		return math.floor((e.u - now + 500) / 1000)
	end
	if cmd == "INCR" then
		if e then e.v = e.v + 1 else e = { v = 1, u = -1 }; store[k] = e end
		return e.v
	end
	if cmd == "EXPIRE" then
		if not e then return 0 end
		e.u = now + tonumber(a) * 1000
		return 1
	end
	error("unexpected command " .. cmd)
end }
KEYS, ARGV = {}, {}
for i = 3, 2 + numkeys do KEYS[#KEYS + 1] = arg[i] end
for i = 3 + numkeys, #arg do ARGV[#ARGV + 1] = arg[i] end
local f = assert(io.open((arg[0]:gsub("harness%.lua$", "script.lua"))))
local result = assert(loadstring(f:read("*a")))()
f:close()
print(result)
for k, e in pairs(store) do print(k .. "\t" .. e.v .. "\t" .. e.u) end
`
const luaDir = mkdtempSync(join(tmpdir(), "rate-limit-lua-"))
writeFileSync(join(luaDir, "harness.lua"), HARNESS)
writeFileSync(join(luaDir, "script.lua"), RATE_LIMIT_SCRIPT)
const luaFailures: string[] = []
after(() => {
	rmSync(luaDir, { recursive: true, force: true })
	assert.deepEqual(luaFailures, [], "every call of the script ran")
})

function fakeValkey(clock: { now: number }) {
	let state = ""
	const calls: string[][] = []
	return {
		calls,
		keys: () => state.split("\n").filter(Boolean).map((line) => line.split("\t")[0]),
		async eval(script: string, numKeys: number, ...args: (string | number)[]) {
			assert.equal(script, RATE_LIMIT_SCRIPT)
			const keys = args.slice(0, numKeys).map(String)
			calls.push(keys)
			const tags = new Set(keys.map((key) => /\{(.+?)\}/.exec(key)?.[1]))
			assert.equal(tags.size, 1, "one hash tag per call")
			const run = spawnSync(
				LUA as string,
				[join(luaDir, "harness.lua"), String(clock.now), String(numKeys), ...args.map(String)],
				{ input: state, encoding: "utf8" },
			)
			// The limiter would count a failed call in memory, which looks the same from outside: fail the file instead.
			if (run.status !== 0) luaFailures.push(run.stderr || String(run.error))
			assert.equal(run.status, 0, run.stderr)
			const [result, ...rest] = run.stdout.split("\n")
			state = rest.join("\n")
			return Number(result)
		},
	}
}

const ENV = { SEARCH_TRUSTED_IP_HEADER: "X-Real-Ip" }
const search = (address?: string, headers: Record<string, string> = {}) =>
	new Request("https://goodwatch.app/api/combined-search", {
		method: "POST",
		headers: { ...(address ? { "X-Real-Ip": address } : {}), ...headers },
		body: "{}",
	})

function setup() {
	const clock = { now: 1_000_000 }
	const valkey = fakeValkey(clock)
	const limiter = createRateLimiter({ redis: () => valkey, now: () => clock.now })
	const check = (request: Request) => checkSearchRate(request, { env: ENV, limiter })
	const run = async (request: () => Request, times: number) => {
		const answers: (Response | null)[] = []
		for (let i = 0; i < times; i++) answers.push(await check(request()))
		return answers
	}
	return { clock, valkey, limiter, check, run }
}

test("the windows are a burst of 10 in 30 seconds and 60 in 10 minutes", () => {
	assert.deepEqual(SEARCH_RATE_WINDOWS, [
		{ limit: 10, seconds: 30 },
		{ limit: 60, seconds: 600 },
	])
})

test("burst: 10 searches pass, the 11th gets 429 with Retry-After and the calm message", needsLua, async () => {
	const { run, check } = setup()
	const answers = await run(() => search("203.0.113.7"), 10)
	assert.ok(answers.every((answer) => answer === null))
	const limited = await check(search("203.0.113.7"))
	assert.ok(limited)
	assert.equal(limited.status, 429)
	assert.equal(limited.headers.get("Retry-After"), "30")
	assert.equal(limited.headers.get("Cache-Control"), "private, no-store")
	assert.deepEqual(await limited.json(), { error: SEARCH_LIMITED_MESSAGE })
})

test("the browser shows the server's own words for the limit", () => {
	assert.equal(BROWSER_MESSAGE, SEARCH_LIMITED_MESSAGE)
})

test("burst: Retry-After counts down, and the burst is back after 30 seconds", needsLua, async () => {
	const { run, check, clock } = setup()
	await run(() => search("203.0.113.7"), 10)
	clock.now += 12_000
	assert.equal((await check(search("203.0.113.7")))?.headers.get("Retry-After"), "18")
	clock.now += 18_000
	assert.equal(await check(search("203.0.113.7")), null)
})

test("a limited visitor who keeps trying doesn't push the wait out", needsLua, async () => {
	const { run, check, clock } = setup()
	await run(() => search("203.0.113.7"), 10)
	for (let i = 0; i < 50; i++) {
		clock.now += 500
		assert.equal((await check(search("203.0.113.7")))?.status, 429)
	}
	clock.now += 5_000
	assert.equal(await check(search("203.0.113.7")), null)
})

test("window: 60 searches in 10 minutes, then 429 until the window ends", needsLua, async () => {
	const { check, clock } = setup()
	// Ten every 31 seconds: never over the burst.
	for (let i = 0; i < 60; i++) {
		if (i && i % 10 === 0) clock.now += 31_000
		assert.equal(await check(search("203.0.113.7")), null, `search ${i + 1}`)
	}
	clock.now += 31_000
	const limited = await check(search("203.0.113.7"))
	assert.equal(limited?.status, 429)
	// The window started with the first search, 6 × 31 = 186 seconds ago.
	assert.equal(limited?.headers.get("Retry-After"), String(600 - 186))
	clock.now += (600 - 186) * 1000
	assert.equal(await check(search("203.0.113.7")), null)
})

test("keying: each address has its own count, and the key holds a hash, not the address", needsLua, async () => {
	const { run, check, valkey } = setup()
	await run(() => search("203.0.113.7"), 10)
	assert.equal((await check(search("203.0.113.7")))?.status, 429)
	assert.equal(await check(search("203.0.113.8")), null)
	const keys = valkey.keys()
	assert.ok(keys.every((key) => /^search-rate:\{[0-9a-f]{32}\}:(30|600)$/.test(key)), keys.join(", "))
	assert.ok(keys.every((key) => !key.includes("203.0.113")))
})

test("keying: an IPv6 visitor counts by its /64", needsLua, async () => {
	const { run, check } = setup()
	await run(() => search("2001:db8:aa:bb::1"), 5)
	await run(() => search("2001:db8:aa:bb:ffff:1:2:3"), 5)
	assert.equal((await check(search("2001:0db8:00aa:00bb::9")))?.status, 429)
	assert.equal(await check(search("2001:db8:aa:bc::1")), null)
	assert.equal(visitorNetwork("2001:db8:aa:bb::1"), "2001:db8:aa:bb::/64")
	assert.equal(visitorNetwork("2001:db8::1"), "2001:db8:0:0::/64")
	assert.equal(visitorNetwork("::ffff:203.0.113.7"), "203.0.113.7")
	assert.equal(visitorNetwork("fe80::1%eth0"), "fe80:0:0:0::/64")
})

test("trusted header: only the configured header counts, and only a valid address", () => {
	assert.equal(trustedClientAddress(search("203.0.113.7"), ENV), "203.0.113.7")
	assert.equal(trustedClientAddress(search(" 203.0.113.7 "), ENV), "203.0.113.7")
	// Not configured: the header is the visitor's own and means nothing.
	assert.equal(trustedClientAddress(search("203.0.113.7"), {}), null)
	// The ingress writes one address; a list or a name isn't one.
	assert.equal(trustedClientAddress(search("203.0.113.7, 10.0.0.1"), ENV), null)
	assert.equal(trustedClientAddress(search("goodwatch.app"), ENV), null)
	// X-Forwarded-For isn't read when X-Real-Ip is the trusted header.
	assert.equal(trustedClientAddress(search(undefined, { "X-Forwarded-For": "203.0.113.7" }), ENV), null)
})

test("trusted header: a visitor who changes other headers keeps the count of the trusted one", needsLua, async () => {
	const { run, check } = setup()
	await run(() => search("203.0.113.7", { "X-Forwarded-For": `198.51.100.${Math.floor(Math.random() * 200)}` }), 10)
	assert.equal((await check(search("203.0.113.7", { "X-Forwarded-For": "198.51.100.250" })))?.status, 429)
})

test("trusted header: without one nobody is limited and nothing is counted", needsLua, async () => {
	const { valkey, limiter } = setup()
	for (let i = 0; i < 100; i++)
		assert.equal(await checkSearchRate(search("203.0.113.7"), { env: {}, limiter }), null)
	for (let i = 0; i < 100; i++) assert.equal(await checkSearchRate(search(), { env: ENV, limiter }), null)
	assert.equal(valkey.calls.length, 0)
})

test("member and guest: a member's cookie doesn't change the count; both count by the address", needsLua, async () => {
	const { run, check } = setup()
	const member = () => search("203.0.113.7", { Cookie: "sb-goodwatch-auth-token=member" })
	const otherMember = () => search("203.0.113.7", { Cookie: "sb-goodwatch-auth-token=someone-else" })
	await run(() => search("203.0.113.7"), 4)
	await run(member, 3)
	await run(otherMember, 3)
	assert.equal((await check(member()))?.status, 429)
	assert.equal((await check(search("203.0.113.7")))?.status, 429)
	// A member on another network has their own count.
	assert.equal(await check(search("198.51.100.4", { Cookie: "sb-goodwatch-auth-token=member" })), null)
})

test("shared count: two processes on the same Valkey count together", needsLua, async () => {
	const clock = { now: 1_000_000 }
	const valkey = fakeValkey(clock)
	const roleA = createRateLimiter({ redis: () => valkey, now: () => clock.now })
	const roleB = createRateLimiter({ redis: () => valkey, now: () => clock.now })
	for (let i = 0; i < 10; i++)
		await checkSearchRate(search("203.0.113.7"), { env: ENV, limiter: i % 2 ? roleA : roleB })
	assert.equal((await checkSearchRate(search("203.0.113.7"), { env: ENV, limiter: roleA }))?.status, 429)
	assert.equal((await checkSearchRate(search("203.0.113.7"), { env: ENV, limiter: roleB }))?.status, 429)
})

test("without Valkey, or when a command fails, the process counts in memory", async () => {
	const clock = { now: 1_000_000 }
	for (const redis of [
		() => null,
		() => ({ eval: async () => { throw new Error("Command timed out") } }),
	]) {
		const limiter = createRateLimiter({ redis, now: () => clock.now })
		const verdicts = []
		for (let i = 0; i < 11; i++) verdicts.push(await limiter.take("search-rate", "client", SEARCH_RATE_WINDOWS))
		assert.ok(verdicts.slice(0, 10).every((verdict) => verdict.allowed && verdict.store === "memory"))
		assert.deepEqual(verdicts[10], { allowed: false, store: "memory", retryAfterSeconds: 30 })
		clock.now += 30_000
		assert.equal((await limiter.take("search-rate", "client", SEARCH_RATE_WINDOWS)).allowed, true)
	}
})

test("the limiter keeps the poster impressions' single window: 60 a minute", needsLua, async () => {
	const { limiter } = setup()
	const window = [{ limit: 60, seconds: 60 }]
	for (let i = 0; i < 60; i++) assert.equal((await limiter.take("poster-rate", "visitor", window)).allowed, true)
	assert.deepEqual(await limiter.take("poster-rate", "visitor", window), {
		allowed: false,
		store: "valkey",
		retryAfterSeconds: 60,
	})
})
