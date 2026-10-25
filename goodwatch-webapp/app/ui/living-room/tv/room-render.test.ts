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
	// The phone's Remote: held, its one form (2026-10-22).
	assert.equal(count(room, 'data-tvr-form="hand"'), 1)
	assert.equal(count(room, 'data-tvr-form="table"'), 0)
	assert.equal(count(room, 'data-phone-remote="hand"'), 1)
	assert.equal(count(room, "tvr-f-premote"), 1)
	// The phone Remote's printed words: each key has its own name, so a screen reader does not hear it twice.
	const words = [...room.matchAll(/<span[^>]*text-\[8px\][^>]*>/g)].map(
		(m) => m[0],
	)
	assert.equal(words.length, 4)
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
	// The desktop, as written there: the TV across the room but for its margins; on a wide screen (WIDE_FROM) never
	// taller than the room; the Remote inside the room where it fits down to its streaming keys (--f-fit), else under
	// the TV, below the fold.
	const first = css.slice(css.indexOf('.tvr[data-room="unmeasured"] > * {'))
	assert.match(first, /--f-tvfull: calc\(var\(--f-w\) - 2 \* var\(--f-pad\)\);/)
	assert.match(
		first,
		/--f-wide: clamp\(0px, \(var\(--f-w\) - 1920px\) \* 1000, 1px\);/,
	)
	assert.match(
		first,
		/min\(var\(--f-tvfull\), \(var\(--f-h\) - var\(--f-tvt\) \+ 10px - 280\.6px\) \* 1\.851515151515\)/,
	)
	assert.match(
		first,
		/--f-fit: clamp\(0px, \(var\(--f-under\) - 280\.6px\) \* 10000 \+ 1px, 1px\)/,
	)
	assert.match(first, /--f-rl: calc\(var\(--f-w\) \/ 2 - 156 \* var\(--f-r\)\)/)
	assert.match(
		first,
		/--f-height: max\(var\(--f-h\), var\(--f-rt\) \+ 610 \* var\(--f-r\) \+ 8px\)/,
	)
	assert.match(
		css,
		/\.tvr\[data-room="unmeasured"\] \.tvr-stage \{\s*height: var\(--f-height\);/,
	)
	const pad = (w: number) => Math.max(14, Math.min(28, w * 0.0125))
	for (let w = 768; w <= 2560; w += 61)
		for (let h = 420; h <= 1500; h += 53) {
			// The CSS's math, step by step.
			const wide = Math.min(1, Math.max(0, (w - 1920) * 1000))
			const tvt = Math.max(6, h * (0.008 + 0.017 * wide))
			const full = w - 2 * pad(w)
			const tvw =
				full -
				wide * (full - Math.min(full, (h - tvt + 10 - 280.6) * 1.851515151515))
			const tvh = tvw / 1.851515151515
			const under = h - tvt - tvh + 18 - 8
			const fit = Math.min(1, Math.max(0, (under - 280.6) * 10000 + 1))
			const free = Math.min(0.68, Math.max(0.5, h / 1800))
			const r = free + (Math.min(0.8, under / 610) - free) * fit
			const rt = tvt + tvh - 18 + (h - 8 - 610 * r - tvt - tvh + 18) * fit
			const height = Math.max(h, rt + 610 * r + 8)
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
	// Both phone rooms (2026-10-22), as written there: a 16:9 TV under the reserve, the phone's fixed canvas, the
	// held Remote lower where the room is taller than it needs, its palm at the body's end.
	assert.match(
		css,
		/--f-ph: max\(60px, min\(\(var\(--f-w\) - 28px\) \* 0\.5625, var\(--f-av\) - 105px\)\);/,
	)
	assert.match(
		css,
		/--f-u: max\(1px, min\(1\.3px, var\(--f-w\) \* 0\.68 \/ 236, \(var\(--f-av\) - 18px\) \/ 288\)\);/,
	)
	assert.match(
		css,
		/--f-pt: max\(var\(--f-ph\) \+ 41px, var\(--f-av\) - 10px - 388 \* var\(--f-u\)\);/,
	)
	assert.match(
		css,
		/top: calc\(var\(--f-pt\) \+ 388 \* var\(--f-u\) - 1128 \* 236 \* var\(--f-u\) \/ 382\);/,
	)
	assert.match(css, /--f-cw: 480px;/)
	assert.match(css, /width: var\(--f-cw\);\s*height: 270px;/)
	const seat = (w: number, h: number, reserve: number) => {
		const av = h - reserve
		const ph = Math.max(60, Math.min((w - 28) * 0.5625, av - 105))
		const u = Math.max(1, Math.min(1.3, (w * 0.68) / 236, (av - 18) / 288))
		const pt = Math.max(ph + 41, av - 10 - 388 * u)
		return { ph, pw: ph * 1.777777777778, u, pt }
	}
	const same = (
		L: {
			tv: { width: number; height: number }
			remote: { u: number; top: number; left: number }
			height: number
			h: number
		},
		w: number,
		h: number,
		reserve: number,
	) => {
		const f = seat(w, h, reserve)
		const at = `${w} x ${h}`
		assert.ok(
			Math.abs(L.tv.height - f.ph) < 1e-6,
			`${at}: the TV's height ${L.tv.height} vs ${f.ph}`,
		)
		assert.ok(Math.abs(L.tv.width - f.pw) < 1e-6, `${at}: the TV's width`)
		assert.ok(Math.abs(L.remote.u - f.u) < 1e-9, `${at}: the Remote's size`)
		assert.ok(
			Math.abs(L.remote.top - f.pt) < 1e-6,
			`${at}: the Remote's top ${L.remote.top} vs ${f.pt}`,
		)
		assert.ok(
			Math.abs(L.remote.left - (w - 236 * f.u) / 2) < 1e-6,
			`${at}: centred`,
		)
		assert.equal(L.height, h, `${at}: no scrolling`)
	}
	for (let w = 320; w < 768; w += 37)
		for (let h = 400; h <= 1800; h += 41)
			same(layoutPhoneRoom(w, h, 60), w, h, 60)
	// On its side nothing is reserved at any width: the lip is a tab at the right.
	assert.match(css, /--f-res: 0px;/)
	// On its side the TV takes the width, its canvas 270 tall and as wide as the picture's shape (480 to 810).
	assert.match(
		css,
		/--f-cw: clamp\(480px, round\(nearest, 270px \* tan\(atan2\(var\(--f-wid\), var\(--f-ph\)\)\), 1px\), 810px\);/,
	)
	assert.match(
		css,
		/--f-pw: calc\(var\(--f-ph\) \* tan\(atan2\(var\(--f-cw\), 270px\)\)\);/,
	)
	for (let w = 568; w <= 1400; w += 47)
		for (let h = 300; h <= 540; h += 17) {
			const reserve = 0
			const L = layoutPhoneLandscape(w, h, reserve)
			const f = seat(w, h, reserve)
			const cw = Math.max(
				480,
				Math.min(810, Math.round((270 * (w - 28)) / f.ph)),
			)
			const at = `${w} x ${h}`
			assert.ok(Math.abs(L.tv.height - f.ph) < 1e-6, `${at}: the TV's height`)
			assert.equal(L.canvas.w, cw, `${at}: the canvas`)
			assert.ok(
				Math.abs(L.tv.width - (cw * f.ph) / 270) < 1e-6,
				`${at}: the TV's width`,
			)
			assert.ok(
				Math.abs(L.remote.u - f.u) < 1e-9 &&
					Math.abs(L.remote.top - f.pt) < 1e-6,
				`${at}: the Remote`,
			)
			assert.equal(L.height, h)
		}
})

test("the section below the room follows it, with its lip, its 16 titles and its hubs", () => {
	const after = rendered.on.slice(rendered.on.indexOf('<section id="browse"'))
	assert.ok(after.startsWith('<section id="browse"'))
	assert.match(after, /<a href="#browse" class="lrb-lip">/)
	assert.equal(
		[...after.matchAll(/<a [^>]*href="\/(movie|show)\//g)].length,
		16,
	)
	for (const hub of ["/discover", "/explorer", "/taste", "/movies/moods"])
		assert.ok(after.includes(`href="${hub}"`), hub)
})
