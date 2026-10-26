// A title page's late sections (related map, Talked about now) wait for the page's own navigation work (#753).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const out = execFileSync(
	"node_modules/.bin/vite-node",
	[
		"--config",
		"app/ui/imports/source-import-test-vite.config.ts",
		"app/navigation/section-wait.test-support.ts",
	],
	{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
)
const t = JSON.parse(out.split("__SECTION_WAIT__").at(-1) ?? "") as Record<
	string,
	number
>

test("before the page watches scrolls, a wait counts as just after a scroll", () => {
	assert.equal(t.unwatchedEarly, -1)
	assert.ok(t.unwatchedAt >= 400 && t.unwatchedAt < 700, String(t.unwatchedAt))
})

test("with nothing going on, a section's request starts soon", () => {
	assert.ok(t.idleAt >= 0 && t.idleAt < 300, String(t.idleAt))
})

test("after a scroll, it waits until the phone's prefetch of what is on screen has had its turn", () => {
	assert.equal(t.scrolledEarly, -1)
	assert.ok(t.scrolledAt >= 400 && t.scrolledAt < 700, String(t.scrolledAt))
})

test("while a page prefetch loads it waits, and starts when that ends", () => {
	assert.equal(t.busyDuring, -1)
	assert.ok(t.busyAt >= 800 && t.busyAt < 1100, String(t.busyAt))
})

test("it never waits longer than the cap, and a cancelled wait never runs", () => {
	assert.ok(t.stuckAt >= 2400 && t.stuckAt < 2800, String(t.stuckAt))
	assert.equal(t.goneAt, -1)
})
