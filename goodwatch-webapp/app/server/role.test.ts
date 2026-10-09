import assert from "node:assert/strict"
import { test } from "node:test"
import { logProcessRole, processRole, roleStartupLine, runsSearch } from "./role.server.ts"

for (const [value, expected] of [
	[undefined, "both"], ["", "both"], ["   ", "both"],
	["page", "page"], ["search", "search"], ["both", "both"],
	[" PAGE ", "page"], [" SEARCH ", "search"], [" BOTH ", "both"],
	["unknown", "both"],
] as const) {
	test(`process role for ${JSON.stringify(value)}`, () => {
		const env = { WEBAPP_ROLE: value }
		assert.equal(processRole(env), expected)
		assert.equal(runsSearch(env), expected !== "page")
		const line = roleStartupLine(env)
		if (value === "unknown") {
			assert.match(line, /isn't one of page, search, both/)
			assert.match(line, /running as both/)
		} else assert.equal(line, `Process role: ${expected}`)
		assert.doesNotMatch(line, /failed|Error|not loaded|[\r\n]/)
	})
}

test("unknown role diagnostics never echo unsafe or long input", () => {
	for (const value of ["failed Error not loaded\nsearch", "x".repeat(100)]) {
		const line = roleStartupLine({ WEBAPP_ROLE: value })
		assert.match(line, /^Process role: both/)
		assert.doesNotMatch(line, /failed|Error|not loaded|[\r\n]|x{41}/)
	}
})

test("default arguments read the role at call time", () => {
	const original = process.env.WEBAPP_ROLE
	try {
		for (const role of ["page", "search", "both"] as const) {
			process.env.WEBAPP_ROLE = role
			assert.equal(processRole(), role)
			assert.equal(runsSearch(), role !== "page")
			assert.equal(roleStartupLine(), `Process role: ${role}`)
		}
	} finally {
		if (original === undefined) delete process.env.WEBAPP_ROLE
		else process.env.WEBAPP_ROLE = original
	}
})

test("startup logging happens once across module reloads", async (t) => {
	const key = Symbol.for("goodwatch.role.logged")
	const original = Object.getOwnPropertyDescriptor(globalThis, key)
	Reflect.deleteProperty(globalThis, key)
	t.after(() => {
		if (original) Object.defineProperty(globalThis, key, original)
		else Reflect.deleteProperty(globalThis, key)
	})
	const info = t.mock.method(console, "info", () => {})
	logProcessRole()
	logProcessRole()
	const reloaded = await import(new URL("./role.server.ts?reload", import.meta.url).href)
	reloaded.logProcessRole()
	assert.equal(info.mock.callCount(), 1)
	assert.deepEqual(info.mock.calls[0].arguments, [roleStartupLine()])
})
