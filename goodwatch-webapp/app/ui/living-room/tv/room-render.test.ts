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

test("living-room.css's first paint seats the room where the layouts do, at every size", () => {
	const css = readFileSync("app/ui/living-room/living-room.css", "utf8")
	// One arrangement at every size (2026-10-21): no container query switches the Remote beside the TV.
	assert.doesNotMatch(
		css,
		/@container tvr \(min-width: [\d.]+px\) and \(min-height/,
	)
	assert.doesNotMatch(css, /data-remote-place="beside"/)
	// The desktop, as written there: the TV across the room but for its margins, never taller than the room; the
	// Remote inside the room where it fits down to its streaming keys (--f-fit), else under the TV, below the fold.
	const first = css.slice(css.indexOf('.tvr[data-room="unmeasured"] > * {'))
	assert.match(first, /--f-tvw: calc\(var\(--f-w\) - 2 \* var\(--f-pad\)\);/)
	assert.match(
		first,
		/--f-fit: clamp\(0px, \(var\(--f-under\) - 252\.08px\) \* 10000 \+ 1px, 1px\)/,
	)
	assert.match(first, /--f-rl: calc\(var\(--f-w\) \/ 2 - 156 \* var\(--f-r\)\)/)
	assert.match(
		first,
		/--f-height: max\(var\(--f-h\), var\(--f-rt\) \+ 548 \* var\(--f-r\) \+ 8px\)/,
	)
	assert.match(
		css,
		/\.tvr\[data-room="unmeasured"\] \.tvr-stage \{\s*height: var\(--f-height\);/,
	)
	const pad = (w: number) => Math.max(14, Math.min(28, w * 0.0125))
	for (let w = 768; w <= 2560; w += 61)
		for (let h = 420; h <= 1500; h += 53) {
			// The CSS's math, step by step.
			const tvt = Math.max(6, h * 0.008)
			const tvw = w - 2 * pad(w)
			const tvh = tvw / 1.851515151515
			const under = h - tvt - tvh + 18 - 8
			const fit = Math.min(1, Math.max(0, (under - 252.08) * 10000 + 1))
			const free = Math.min(0.68, Math.max(0.5, h / 1800))
			const r = free + (Math.min(0.8, under / 548) - free) * fit
			const rt = tvt + tvh - 18 + (h - 8 - 548 * r - tvt - tvh + 18) * fit
			const height = Math.max(h, rt + 548 * r + 8)
			const L = layoutRoom(w, h)
			const at = `${w} x ${h}`
			assert.ok(
				Math.abs(L.tv.width - tvw) < 0.01,
				`${at}: the TV ${L.tv.width} vs ${tvw}`,
			)
			assert.ok(Math.abs(L.tv.top - tvt) < 0.01, `${at}: the TV's top`)
			assert.ok(
				Math.abs(L.remote.scale - r) < 1e-6,
				`${at}: the Remote ${L.remote.scale} vs ${r}`,
			)
			assert.ok(
				Math.abs(L.remote.left - (w / 2 - 156 * r)) < 1e-6,
				`${at}: the Remote's left`,
			)
			assert.ok(
				Math.abs(L.remote.top - rt) < 1e-6,
				`${at}: the Remote's top ${L.remote.top} vs ${rt}`,
			)
			assert.ok(
				Math.abs(L.height - height) < 1e-6,
				`${at}: the content's height`,
			)
		}
	// The phone upright: the forms in the hand from 385 px over the picture's full height, and the held Remote's
	// spare height over it but for a grip of 40 of its pixels.
	for (const [w, h] of [
		[390, 686.67],
		[360, 661.67],
		[767, 1001],
	])
		assert.equal(
			layoutPhoneRoom(w, h, 60).form,
			h - 385 >= (w - 28) / 1.2 ? "hand" : "table",
		)
	assert.match(
		css,
		/2px \+ \(var\(--f-h\) - 385px - var\(--f-pw\) \/ 1\.2\) \* 10000/,
	)
	assert.match(
		css,
		/max\(0px, var\(--f-h\) - 97px - var\(--f-ph\) - 288 \* var\(--f-u\) - 40 \* var\(--f-u\)\)/,
	)
	for (let w = 320; w < 768; w += 37)
		for (let h = 520; h <= 1200; h += 41) {
			const L = layoutPhoneRoom(w, h, 60)
			if (L.form !== "hand") continue
			const ph = L.tv.height
			const u = Math.max(
				1,
				Math.min(1.3, (w * 0.68) / 236, (h - 97 - ph) / 288),
			)
			const pt = ph + 31 + Math.max(0, h - 97 - ph - 288 * u - 40 * u)
			assert.ok(
				Math.abs(L.remote.u - u) < 1e-9,
				`${w} x ${h}: the held Remote's size`,
			)
			assert.ok(
				Math.abs(L.remote.top - pt) < 1e-6,
				`${w} x ${h}: the held Remote's top ${L.remote.top} vs ${pt}`,
			)
			assert.equal(L.height, h)
		}
	// The phone in landscape: the TV across the room, a canvas no larger than 1.15, the Remote under it.
	assert.match(
		css,
		/--f-cw: max\(500px, round\(nearest, var\(--f-pw\) \/ 1\.15, 1px\)\)/,
	)
	assert.match(css, /--f-pt: calc\(var\(--f-ph\) \+ 43px\)/)
	assert.match(css, /--f-rtv: 46px;/)
	for (let w = 768; w <= 1400; w += 47)
		for (let h = 348; h <= 540; h += 17) {
			const L = layoutPhoneLandscape(w, h, { tv: 46, remote: 46 })
			if (L.form !== "hand") continue
			const pw = w - 28
			const ph = Math.max(60, Math.min(Math.max(60, h - 46 - 26), pw / 1.2))
			const cw = Math.max(500, Math.round(pw / 1.15))
			const u = Math.max(
				1,
				Math.min(1.3, (w * 0.68) / 236, (h - 16 - 46) / 288),
			)
			const pt = ph + 43
			const height = Math.max(h, pt + 288 * u + 40 + 46)
			const at = `${w} x ${h}`
			assert.ok(
				Math.abs(L.tv.width - pw) < 1e-6 && Math.abs(L.tv.height - ph) < 1e-6,
				`${at}: the TV`,
			)
			assert.equal(L.canvas.w, cw, `${at}: the canvas`)
			assert.ok(Math.abs(L.remote.u - u) < 1e-9, `${at}: the Remote's size`)
			assert.ok(Math.abs(L.remote.top - pt) < 1e-6, `${at}: the Remote's top`)
			assert.ok(
				Math.abs(L.remote.left - (w - 236 * u) / 2) < 1e-6,
				`${at}: centred`,
			)
			assert.ok(
				Math.abs(L.height - height) < 1e-6,
				`${at}: the content's height`,
			)
		}
	// Landscape: in the hand from 348 px of room with the tab, 362 px with the bar.
	for (const [reserve, h] of [
		[{ tv: 46, remote: 46 }, 348],
		[{ tv: 60, remote: 60 }, 362],
	] as const) {
		assert.equal(layoutPhoneLandscape(900, h, reserve).form, "hand")
		assert.equal(layoutPhoneLandscape(900, h - 0.01, reserve).form, "table")
	}
	assert.match(css, /@container tvr \(min-height: 348px\)/)
	assert.match(css, /@container tvr \(min-height: 362px\)/)
	// The held Remote's fingers come round at its streaming keys: 234 of its pixels down.
	assert.match(css, /top: calc\(var\(--f-pt\) \+ 234 \* var\(--f-u\)/)
})

test("the section below the room follows it, with its lip, its 16 titles and its hubs", () => {
	const after = rendered.on.slice(rendered.on.indexOf('<section id="browse"'))
	assert.ok(after.startsWith('<section id="browse"'))
	assert.match(after, /<a href="#browse" class="lrb-lip">/)
	assert.equal([...after.matchAll(/<a href="\/(movie|show)\//g)].length, 16)
	for (const hub of ["/discover", "/explorer", "/taste", "/movies/moods"])
		assert.ok(after.includes(`href="${hub}"`), hub)
})
