import assert from "node:assert/strict"
import test from "node:test"
import { TitleWrites, answerPlan } from "./title-writes.ts"

/** A write that settles when the test says so, and records when it ran. */
function deferred(log: string[], name: string) {
	let resolve!: () => void
	let reject!: (e: Error) => void
	const write = () => {
		log.push(`${name} sent`)
		return new Promise<void>((res, rej) => {
			resolve = () => {
				log.push(`${name} saved`)
				res()
			}
			reject = (e) => rej(e)
		})
	}
	return { write, resolve: () => resolve(), reject: (e: Error) => reject(e) }
}

const tick = () => new Promise((r) => setImmediate(r))

test("a score pressed while a clear of the same title is on its way is turned down, and goes through after it", async () => {
	const log: string[] = []
	const writes = new TitleWrites()
	const clear = deferred(log, "clear")
	const score = deferred(log, "score 8")
	const clearing = writes.run("movie-1", clear.write)
	assert.ok(clearing)
	assert.equal(writes.busy("movie-1"), true)
	// Score 8 at once: blocked, nothing sent, so the late clear can't delete it.
	assert.equal(writes.run("movie-1", score.write), null)
	clear.resolve()
	await clearing
	assert.equal(writes.busy("movie-1"), false)
	const scoring = writes.run("movie-1", score.write)
	assert.ok(scoring)
	score.resolve()
	await scoring
	assert.deepEqual(log, ["clear sent", "clear saved", "score 8 sent", "score 8 saved"])
})

test("a clear while a score is on its way is turned down, so the score can't bring a cleared answer back", async () => {
	const log: string[] = []
	const writes = new TitleWrites()
	const score = deferred(log, "score 8")
	const scoring = writes.run("show-2", score.write)
	assert.ok(scoring)
	// The acknowledgement is cancelled (the title opened again): the lock is the write's, and holds.
	assert.equal(writes.run("show-2", deferred(log, "clear").write), null)
	assert.equal(writes.busy("show-2"), true)
	score.resolve()
	await scoring
	assert.equal(writes.busy("show-2"), false)
	assert.deepEqual(log, ["score 8 sent", "score 8 saved"])
})

test("a failed write ends the lock too, and other titles are never held", async () => {
	const log: string[] = []
	let changes = 0
	const writes = new TitleWrites(() => changes++)
	const failing = deferred(log, "a")
	const a = writes.run("movie-1", failing.write)
	assert.ok(a)
	const other = deferred(log, "b")
	const b = writes.run("movie-2", other.write)
	assert.ok(b, "another title is not locked")
	failing.reject(new Error("refused"))
	await assert.rejects(a, /refused/)
	assert.equal(writes.busy("movie-1"), false)
	assert.equal(writes.busy("movie-2"), true)
	other.resolve()
	await b
	await tick()
	assert.equal(changes, 4)
	// A write that throws before it returns a promise ends the lock as well.
	const thrown = writes.run("movie-3", () => {
		throw new Error("at once")
	})
	assert.ok(thrown)
	await assert.rejects(thrown, /at once/)
	assert.equal(writes.busy("movie-3"), false)
	assert.equal(writes.busy(null), false)
})

test("the same answer again saves nothing only when the store is confirmed to hold it", () => {
	const plan = { type: "plan" as const }
	// A member's Want to See whose clear half failed: the local answer still says Want to See, the account doesn't.
	assert.equal(answerPlan({ before: plan, given: plan, member: true, stored: false }), "save")
	assert.equal(answerPlan({ before: plan, given: plan, member: true, stored: true }), "nothing")
	assert.equal(answerPlan({ before: plan, given: plan, member: false, stored: false }), "nothing")
	const eight = { type: "score" as const, score: 8 }
	assert.equal(answerPlan({ before: eight, given: { type: "score", score: 7 }, member: true, stored: false }), "save")
	assert.equal(answerPlan({ before: eight, given: plan, member: true, stored: false }), "clear-then-save")
	assert.equal(answerPlan({ before: eight, given: plan, member: false, stored: false }), "save")
	assert.equal(answerPlan({ before: null, given: eight, member: true, stored: true }), "save")
})
