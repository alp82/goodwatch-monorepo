// The new room in the server's HTML, and the numbers room-layout.ts shares with room.ts.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
	layoutPhoneLandscape,
	layoutPhoneRoom,
	layoutRoom,
} from "./room-layout.ts"

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

const count = (html: string, text: string) => html.split(text).length - 1
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
	// Before the window is measured the room holds every layout's parts, which living-room.css places (the first paint):
	// nothing in a style attribute depends on the window, every part says where living-room.css takes it.
	const styles = [...room.matchAll(/style="([^"]*)"/g)].map((m) => m[1])
	for (const style of styles)
		assert.doesNotMatch(style, /\b(left|top|transform):/, style)
	for (const part of [
		"tvr-f-photo",
		"tvr-f-tv",
		"tvr-f-cv-desktop",
		"tvr-f-cv-phone",
		"tvr-f-remote",
		"tvr-f-dhand",
		"tvr-f-rscale",
		"tvr-f-wall",
		"tvr-f-floor",
		"tvr-f-pbody",
		"tvr-f-lbody",
		"tvr-f-rig",
		"tvr-f-phand",
	])
		assert.equal(count(room, `${part}"`) + count(room, `${part} `), 1, part)
	// The phone's Remote in both its forms, each by itself.
	assert.equal(count(room, 'data-tvr-form="hand"'), 1)
	assert.equal(count(room, 'data-tvr-form="table"'), 1)
	assert.equal(count(room, 'data-phone-remote="hand"'), 1)
	assert.equal(count(room, 'data-phone-remote="table"'), 1)
	assert.equal(count(room, "tvr-f-premote"), 2)
	// The phone Remote's printed words: each key has its own name, so a screen reader does not hear it twice.
	const words = [...room.matchAll(/<span[^>]*text-\[8px\][^>]*>/g)].map(
		(m) => m[0],
	)
	assert.equal(words.length, 8)
	for (const word of words) assert.match(word, /aria-hidden="true"/)
	// Each photo asks for nothing where the other room is drawn: the desktop's once, the phone's twice.
	assert.equal(
		count(
			room,
			'<source media="(max-width: 767.98px) and (orientation: portrait), (max-width: 767.98px) and (min-height: 540.02px)" srcSet="data:image/gif',
		),
		1,
	)
	assert.equal(
		count(
			room,
			'<source media="(min-width: 768px), (orientation: landscape) and (max-height: 540px)" srcSet="data:image/gif',
		),
		2,
	)
	// The first screen's pictures come first: the desktop's photo, the phone's wall, and the hand in both Remotes.
	assert.equal(count(room, 'fetchpriority="high"'), 4)
	// The start page's scripts wait for these to paint (utils/start-after-paint.ts): both photos, the phone's twice, and
	// the hand in both Remotes.
	assert.equal(count(room, 'elementtiming="hero"'), 5)
	// The screen once per edition.
	assert.equal(count(room, '<div data-screen="true"></div>'), 2)
	// A TV that is off draws no screen.
	assert.equal(count(rendered.off, '<div data-screen="true"></div>'), 0)
})

test("living-room.css's first paint seats the desktop's Remote under the TV where layoutRoom does", () => {
	const css = readFileSync("app/ui/living-room/living-room.css", "utf8")
	const [, w, h] =
		/@container tvr \(min-width: ([\d.]+)px\) and \(min-height: ([\d.]+)px\)/.exec(
			css,
		) ?? []
	const [width, height] = [Number(w), Number(h)]
	assert.equal(layoutRoom(width, 2000).place, "below")
	assert.equal(layoutRoom(width - 0.002, 2000).place, "beside")
	assert.equal(layoutRoom(3000, height).place, "below")
	assert.equal(layoutRoom(3000, height - 0.002).place, "beside")
	// The phone's forms: in the hand from 319 px over the picture's full height, as layoutPhoneRoom says.
	for (const [w, h] of [
		[390, 620.67],
		[360, 595.67],
		[767, 935],
	])
		assert.equal(
			layoutPhoneRoom(w, h, 60).form,
			h - 319 >= (w - 28) / 1.2 ? "hand" : "table",
		)
	assert.match(
		css,
		/2px \+ \(var\(--f-h\) - 319px - var\(--f-pw\) \/ 1\.2\) \* 10000/,
	)
	// Landscape: in the hand from 282 px of room with the tab, 296 px with the bar.
	for (const [reserve, h] of [
		[{ tv: 0, remote: 46 }, 282],
		[{ tv: 60, remote: 60 }, 296],
	] as const) {
		assert.equal(layoutPhoneLandscape(900, h, reserve).form, "hand")
		assert.equal(layoutPhoneLandscape(900, h - 0.01, reserve).form, "table")
	}
	assert.match(css, /@container tvr \(min-height: 282px\)/)
	assert.match(css, /@container tvr \(min-height: 296px\)/)
})

test("the section below the room follows it, with its lip, its 16 titles and its hubs", () => {
	const after = rendered.on.slice(rendered.on.indexOf('<section id="browse"'))
	assert.ok(after.startsWith('<section id="browse"'))
	assert.match(after, /<a href="#browse" class="lrb-lip">/)
	assert.equal([...after.matchAll(/<a href="\/(movie|show)\//g)].length, 16)
	for (const hub of ["/discover", "/explorer", "/taste", "/movies/moods"])
		assert.ok(after.includes(`href="${hub}"`), hub)
})
