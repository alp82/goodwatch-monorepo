import "react"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import type { ChildProcess } from "node:child_process"
import { EventEmitter } from "node:events"
import { afterEach, beforeEach, test } from "node:test"
const {
	renderCard,
	registerFontSet,
	setCardRendererForkForTest,
	stopCardRenderers,
	cardRendererStats,
	CardRendererBusyError,
	IDLE_EXIT_MS,
	POOL_SIZE,
} = await import("./pool.server.ts")
class Child extends EventEmitter {
	messages: Record<string, unknown>[] = []
	killed = false
	send(message: Record<string, unknown>) {
		this.messages.push(message)
		return true
	}
	kill(signal: string) {
		this.killed = signal === "SIGKILL"
		return true
	}
	ready() {
		this.emit("message", { ready: true })
	}
	finish() {
		const job = this.messages
			.slice()
			.reverse()
			.find((m) => m.id)
		this.emit("message", { id: job?.id, images: { card: Buffer.from("jpeg") } })
	}
}
let children: Child[] = []
const input = (kind: "card" | "list") => ({
	kind,
	tree: null,
	width: 1200,
	height: 630,
	fontSet: "og" as const,
	dynamicAssets: true,
	outputs: [],
})
const submit = (kind: "card" | "list") => {
	const p = renderCard(input(kind))
	void p.catch(() => {})
	return p
}
beforeEach(() => {
	children = []
	setCardRendererForkForTest(() => {
		const child = new Child()
		children.push(child)
		return child as unknown as ChildProcess
	})
})
afterEach(() => stopCardRenderers())
test("pool capacity, priority, and list reservation", async () => {
	assert.equal(POOL_SIZE, 2)
	const first = submit("list")
	const list = submit("list")
	assert.equal(children.length, 1)
	const card = submit("card")
	const queuedList = submit("list")
	const queuedCard = submit("card")
	assert.deepEqual(cardRendererStats(), {
		running: 2,
		waitingCards: 1,
		waitingLists: 2,
	})
	children.forEach((c) => c.ready())
	children[0].finish()
	await first
	assert.equal(
		children[0].messages
			.slice()
			.reverse()
			.find((m) => m.id)?.kind,
		"card",
	)
	children[1].finish()
	await card
	assert.equal(
		children[1].messages
			.slice()
			.reverse()
			.find((m) => m.id)?.kind,
		"list",
	)
	children[0].finish()
	await queuedCard
	assert.equal(cardRendererStats().running, 1)
	children[1].finish()
	await list
	children[0].finish()
	await queuedList
	assert.equal(cardRendererStats().running, 0)
})
test("waiting bounds exclude running jobs", async () => {
	submit("card")
	submit("card")
	for (let i = 0; i < 24; i++) submit("card")
	for (let i = 0; i < 8; i++) submit("list")
	await assert.rejects(submit("card"), CardRendererBusyError)
	await assert.rejects(submit("list"), CardRendererBusyError)
	assert.equal(cardRendererStats().running, 2)
})
test("timeout starts at dispatch and kills the child", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const job = submit("card")
	t.mock.timers.tick(1000)
	children[0].ready()
	t.mock.timers.tick(14999)
	assert.equal(children[0].killed, false)
	t.mock.timers.tick(1)
	await assert.rejects(job, /timed out/)
	assert.equal(children[0].killed, true)
	t.mock.timers.reset()
})
test("list jobs have sixty seconds", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const job = submit("list")
	children[0].ready()
	t.mock.timers.tick(59999)
	assert.equal(children[0].killed, false)
	t.mock.timers.tick(1)
	await assert.rejects(job, /60000/)
	t.mock.timers.reset()
})
test("crash replaces child and fonts precede first job exactly once", async () => {
	registerFontSet("og", [
		{ name: "Test", weight: 400, style: "normal", data: Buffer.from("font") },
	])
	const first = submit("card")
	children[0].ready()
	assert.ok(children[0].messages[0].fonts)
	assert.ok(children[0].messages[1].id)
	children[0].finish()
	await first
	const second = submit("card")
	assert.equal(children[0].messages.filter((m) => m.fonts).length, 1)
	children[0].emit("exit", 1)
	await assert.rejects(second, /exited/)
	const third = submit("card")
	assert.equal(children.length, 2)
	children[1].ready()
	assert.ok(children[1].messages[0].fonts)
	children[1].finish()
	await third
})
test("a child without a job for ten minutes is ended, and the next job starts a new one", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const first = submit("card")
	children[0].ready()
	children[0].finish()
	await first
	t.mock.timers.tick(IDLE_EXIT_MS - 1)
	assert.equal(children[0].killed, false)
	// A job inside the window keeps the child and restarts the wait.
	const second = submit("card")
	children[0].finish()
	await second
	t.mock.timers.tick(IDLE_EXIT_MS - 1)
	assert.equal(children[0].killed, false)
	t.mock.timers.tick(1)
	assert.equal(children[0].killed, true)
	const third = submit("card")
	assert.equal(children.length, 2)
	children[1].ready()
	children[1].finish()
	await third
	t.mock.timers.reset()
})
