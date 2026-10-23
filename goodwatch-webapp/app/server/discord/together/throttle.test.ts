import assert from "node:assert/strict"
import { test } from "node:test"
import { createPublicUpdater, type EditState } from "./throttle.server.ts"
function fixture() {
	let now = 0,
		lockedUntil = 0,
		dirty = false,
		editing = false,
		last: string | null = "0",
		summary = "0"
	const timers: { at: number; work: () => void }[] = [],
		edits: string[] = []
	const state: EditState = {
		acquire: async () => {
			if (now < lockedUntil || editing) return false
			lockedUntil = now + 3000
			dirty = false
			editing = true
			return true
		},
		released: async () => {
			editing = false
			lockedUntil = now + 3000
		},
		dirty: async () => dirty,
		markDirty: async () => {
			dirty = true
		},
		last: async () => last,
		saved: async (_id, s) => {
			last = s
		},
	}
	let duringEdit = async () => {}
	const updater = createPublicUpdater(
		state,
		async () => ({
			signature: summary,
			edit: async () => {
				edits.push(summary)
				await duringEdit()
			},
		}),
		(work, ms) => timers.push({ at: now + ms, work }),
		() => {},
	)
	return {
		updater,
		edits,
		state,
		timers,
		summary: (s: string) => {
			summary = s
		},
		duringEdit: (f: () => Promise<void>) => {
			duringEdit = f
		},
		advance: async (ms: number) => {
			now += ms
			for (const timer of timers.splice(0)) {
				if (timer.at <= now) timer.work()
				else timers.push(timer)
			}
			// Drain async state reads and the edit without real time or network.
			await new Promise<void>((resolve) => setImmediate(resolve))
		},
	}
}
test("public edits coalesce and dirty always flushes the latest summary", async () => {
	const f = fixture()
	f.summary("1")
	await f.updater.changed("s")
	f.summary("2")
	await f.updater.changed("s")
	f.summary("3")
	await f.updater.changed("s")
	assert.deepEqual(f.edits, ["1"])
	await f.advance(2999)
	assert.deepEqual(f.edits, ["1"])
	await f.advance(51)
	assert.deepEqual(f.edits, ["1", "3"])
	await f.advance(3050)
	assert.equal(f.timers.length, 0)
})
test("a press after the holder finishes editing still gets a trailing edit", async () => {
	const f = fixture()
	f.summary("1")
	await f.updater.changed("s")
	await f.advance(1000)
	f.summary("2")
	await f.updater.changed("s")
	await f.advance(2050)
	assert.deepEqual(f.edits, ["1", "2"])
})
test("press during an edit is flushed; unchanged summaries never edit", async () => {
	const f = fixture()
	await f.updater.changed("s")
	assert.deepEqual(f.edits, [])
	await f.advance(3050)
	f.summary("1")
	f.duringEdit(async () => {
		f.summary("2")
		await f.updater.changed("s")
		f.duringEdit(async () => {})
	})
	await f.updater.changed("s")
	await f.advance(3050)
	assert.deepEqual(f.edits, ["1", "2"])
	await f.updater.changed("s")
	await f.advance(3050)
	assert.deepEqual(f.edits, ["1", "2"])
})
test("failed edit remains dirty and retries on the trailing timer", async () => {
	const f = fixture()
	f.summary("1")
	f.duringEdit(async () => {
		throw new Error("Discord unavailable")
	})
	await f.updater.changed("s")
	assert.equal(await f.state.dirty("s"), true)
	assert.equal(await f.state.last("s"), "0")
	f.duringEdit(async () => {})
	await f.advance(3050)
	assert.equal(await f.state.last("s"), "1")
})

test("a slow edit retains an in-flight lease so a newer summary cannot overtake it", async () => {
	const f = fixture()
	let release: () => void = () => {}
	const pending = new Promise<void>((r) => {
		release = r
	})
	f.duringEdit(() => pending)
	f.summary("1")
	const first = f.updater.changed("s")
	await new Promise<void>((r) => setImmediate(r))
	await f.advance(4000)
	f.summary("2")
	await f.updater.changed("s")
	assert.deepEqual(f.edits, ["1"])
	release()
	await first
	f.duringEdit(async () => {})
	await f.advance(3050)
	assert.deepEqual(f.edits, ["1", "2"])
})
