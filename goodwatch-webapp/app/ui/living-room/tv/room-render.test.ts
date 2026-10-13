// The new room in the server's HTML, and the numbers room-layout.ts shares with room.ts.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/room-render.test-support.tsx",
		],
		// The router's server render warnings go to stderr; a failure still throws with them.
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__ROOM_RENDER__")
		.at(-1) ?? "",
) as {
	on: string
	again: string
	off: string
	numbers: { layout: unknown; room: unknown; lip: number }
}

const roomTag = (html: string) => /<div id="room"[^>]*>/.exec(html)?.[0] ?? ""

test("room-layout.ts has room.ts's numbers for the photos, the hand and the Remote", () => {
	assert.deepEqual(rendered.numbers.layout, rendered.numbers.room)
	// The reserve the tests and the drive script use for the phone's lip.
	assert.equal(rendered.numbers.lip, 60)
})

test("the server renders the room as the block the section below relies on", () => {
	const tag = roomTag(rendered.on)
	assert.match(tag, /class="living-room lr-page tvr /)
	assert.match(tag, /data-room="unmeasured"/)
	assert.match(tag, /data-tv-power="on"/)
	// In the window the room takes input; `inert` comes only while it is away.
	assert.doesNotMatch(tag, /inert/)
	// Not `data-power`: the Remote takes an ancestor with it for its power key.
	assert.doesNotMatch(tag, /\sdata-power=/)
})

test("the room's HTML is the same on every render and holds nothing that depends on the window", () => {
	assert.equal(rendered.on, rendered.again)
	const room = rendered.on.slice(0, rendered.on.indexOf('<section id="browse"'))
	// Until the window is measured there is no TV, no Remote and no photo in it: the first paint is slice 12.
	assert.equal(room, `${roomTag(rendered.on)}</div>`)
	assert.equal(
		rendered.off.replace('data-tv-power="off"', 'data-tv-power="on"'),
		rendered.on,
	)
})

test("the section below the room follows it, with its lip, its 16 titles and its hubs", () => {
	const after = rendered.on.slice(rendered.on.indexOf('<section id="browse"'))
	assert.ok(after.startsWith('<section id="browse"'))
	assert.match(after, /<a href="#browse" class="lrb-lip">/)
	assert.equal([...after.matchAll(/<a href="\/(movie|show)\//g)].length, 16)
	for (const hub of ["/discover", "/explorer", "/taste", "/movies/moods"])
		assert.ok(after.includes(`href="${hub}"`), hub)
})
