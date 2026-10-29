import assert from "node:assert/strict"
import { afterEach, beforeEach, mock, test } from "node:test"
import { readTitleSocial, EMPTY } from "./title-read.ts"
import { createSocialFillGate } from "./read-budget.ts"
import type { TitleSocial } from "../../ui/talked-about-now/query.ts"

const item = { id: "post", source: "news", url: "https://example.com/post", sourceId: null, author: "Writer", publishedAt: "2026-10-29", text: "News", image: null } satisfies TitleSocial["items"][number]
const never = () => new Promise<never>(() => {})
async function advance(ms: number) {
	for (let i = 0; i < 10; i++) await Promise.resolve()
	mock.timers.tick(ms)
	for (let i = 0; i < 10; i++) await Promise.resolve()
}
beforeEach(() => mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 }))
afterEach(() => mock.timers.reset())

test("a cold stalled title answers empty within 120 ms", async () => {
	const buzz = mock.fn(async () => ({}))
	const read = readTitleSocial("movie:603", { items: never, buzz })
	await advance(120)
	assert.deepEqual(await read, EMPTY)
	assert.equal(buzz.mock.callCount(), 0)
})
test("optional stalled buzz keeps the posts and costs at most 20 ms", async () => {
	const read = readTitleSocial("movie:603", { items: async () => ({ items: [item] }), buzz: never })
	await advance(20)
	assert.deepEqual(await read, { items: [item], buzz: null })
})
test("keeps response shape and degrades errors without rejecting", async () => {
	const buzz = { lift: 2, views: 100, day: "2026-10-29" }
	assert.deepEqual(await readTitleSocial("movie:603", { items: async () => ({ items: [item] }), buzz: async () => ({ "movie:603": buzz }) }), { items: [item], buzz })
	assert.deepEqual(await readTitleSocial("movie:603", { items: async () => { throw Error("offline") }, buzz: never }), EMPTY)
})
test("bounds fills across titles and backs off failed keys for five seconds", async () => {
	const gate = createSocialFillGate(1)
	let release!: () => void
	const first = gate("a", () => new Promise<void>((resolve) => { release = resolve }))
	await assert.rejects(gate("b", async () => 1), /deferred/)
	release()
	await first
	await assert.rejects(gate("b", async () => { throw Error("offline") }), /offline/)
	await assert.rejects(gate("b", async () => 1), /deferred/)
	await advance(5000)
	assert.equal(await gate("b", async () => 1), 1)
})
