// The new room's layouts against the numbers the approved prototype measured
// (docs/prototypes/tv-screen-design/README.md on prototype/tv-screen-flow, "The room" and "The phone").
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	HAND,
	PHONE_PEEK,
	PHONE_REMOTE,
	PHONE_ROOM_PHOTO,
	PHONE_TV_ASPECT,
	PHONE_TV_CANVAS,
	REMOTE_H,
	REMOTE_W,
	ROOM_PHOTO,
	TV_CANVAS,
	WIDE_FROM,
	layoutPhoneLandscape,
	layoutPhoneRoom,
	layoutRoom,
	turnLimit,
} from "./room-layout.ts"

const near = (actual: number, expected: number, within: number, what: string) =>
	assert.ok(
		Math.abs(actual - expected) <= within,
		`${what}: ${actual} is not within ${within} of ${expected}`,
	)

// The prototype's tables give window sizes. Its scene was the window without the site's header (64 px) and,
// in the browser that measured it, without the scrollbar's gutter (15 px).
const HEADER = 64
const GUTTER = 15
const desktop = (w: number, h: number) => layoutRoom(w - GUTTER, h - HEADER)

/** How far down the Remote its streaming keys end, in Remote pixels. */
const STREAMING_END = 522

describe("the desktop room, at the prototype's window sizes", () => {
	// Window, TV, canvas scale, Remote's size, where its streaming row ends (from the window's top), the room's
	// content height. The TV is as wide as the scene but for its margins, whatever the height, and the Remote is
	// centred under it (the owner, 2026-10-21: only full-width TVs, with the Remote centred). Where the two don't
	// both fit the window, the Remote is below the fold and the room scrolls to it (`height`).
	const rows = [
		[1920, 1080, 1857, 1003, 1.548, 0.564, 1352, 1346],
		[1920, 940, 1857, 1003, 1.548, 0.5, 1317, 1305],
		// A wide screen (WIDE_FROM): the TV leaves the whole Remote under it.
		[2560, 1300, 1730, 934, 1.44, 0.46, 1252, 1236],
		[1536, 730, 1483, 801, 1.236, 0.5, 1114, 1102],
		[1440, 800, 1389, 750, 1.158, 0.5, 1063, 1051],
		[1366, 650, 1317, 711, 1.098, 0.5, 1024, 1012],
		[1280, 720, 1233, 666, 1.028, 0.5, 979, 967],
	] as const
	for (const [w, h, tvW, tvH, shown, size, rowEnds, height] of rows)
		it(`${w} x ${h}: under the TV, a TV of ${tvW} x ${tvH}`, () => {
			const L = desktop(w, h)
			assert.equal(L.place, "below")
			assert.equal(Math.round(L.tv.width), tvW)
			assert.equal(Math.round(L.tv.height), tvH)
			near(L.canvas.scale, shown, 0.005, "the canvas scale")
			near(L.remote.scale, size, 0.005, "the Remote's size")
			near(
				HEADER + L.remote.top + STREAMING_END * L.remote.scale,
				rowEnds,
				1,
				"the streaming row's end",
			)
			near(L.height, height, 1, "the room's content height")
			assert.ok(
				L.remote.top + STREAMING_END * L.remote.scale < L.height,
				"the streaming row ends inside the room's content",
			)
		})

	it("under the TV the Remote's top reaches 18 px over the picture, and the TV is 8 px from the top", () => {
		const L = desktop(1920, 1080)
		near(L.tv.top, 8, 0.5, "the TV's top")
		near(L.tv.top + L.tv.height - L.remote.top, 18, 0.01, "the overlap")
		near(
			L.tv.left + L.tv.width / 2,
			(1920 - GUTTER) / 2,
			0.01,
			"the TV's middle",
		)
		near(
			L.remote.left + (REMOTE_W * L.remote.scale) / 2,
			(1920 - GUTTER) / 2,
			0.01,
			"the Remote's middle",
		)
	})

	it("a laptop's window keeps nearly 18 px type: the TV takes the width, not what the Remote leaves", () => {
		const type = (w: number, h: number) => 20 * desktop(w, h).canvas.scale
		for (const [w, h] of [
			[1920, 940],
			[1920, 1080],
			[2560, 1300],
			[1440, 800],
			[1536, 730],
		])
			assert.ok(type(w, h) >= 18, `${w} x ${h}`)
		for (const [w, h] of [
			[1366, 650],
			[1280, 720],
		])
			assert.ok(type(w, h) >= 17.5, `${w} x ${h}`)
	})
})

describe("the Remote is under the TV, centred, at every size", () => {
	// Regressions (2026-10-21): below about 1107 x 853 the Remote stood beside a TV pushed to the left; and a laptop's
	// window got a TV as small as the Remote left it. Now the TV is full width, the Remote centred under it, and the
	// room scrolls to the Remote where both don't fit.
	const pad = (w: number) => Math.max(14, Math.min(28, w * 0.0125))
	const top = (h: number) => Math.max(6, h * 0.008)
	// It shows whole since 2026-10-22: its length is its keys and a short grip.
	const SHOWN = REMOTE_H
	it("from 768 to 1600 px wide and 500 to 1400 tall: centred, full width, Remote in reach", () => {
		for (let w = 768; w <= 1600; w += 40)
			for (let h = 500; h <= 1400; h += 50) {
				const L = layoutRoom(w, h)
				const at = `${w} x ${h}`
				assert.equal(L.place, "below", at)
				near(L.tv.left + L.tv.width / 2, w / 2, 0.5, `${at}: the TV's middle`)
				near(
					L.remote.left + (REMOTE_W * L.remote.scale) / 2,
					w / 2,
					0.5,
					`${at}: the Remote's middle`,
				)
				near(
					L.tv.width,
					w - 2 * pad(w),
					0.5,
					`${at}: the TV takes the width, whatever the height`,
				)
				near(L.tv.top, top(h), 1e-6, `${at}: the TV's top at the top margin`)
				assert.ok(
					L.tv.top + L.tv.height <= L.height + 1e-6,
					`${at}: the TV's bottom (${L.tv.top + L.tv.height}) within the room's content (${L.height})`,
				)
				assert.ok(
					L.remote.top >= L.tv.top + L.tv.height - 18 - 1e-6,
					`${at}: the Remote's top ${L.remote.top} under the TV's bottom ${L.tv.top + L.tv.height}`,
				)
				assert.ok(
					L.height >= L.remote.top + SHOWN * L.remote.scale - 1e-6 &&
						L.height >= h,
					`${at}: the room's content (${L.height}) holds the Remote down to its streaming keys`,
				)
			}
	})

	it("a wide, short window (1600 x 640, a scene of 1600 x 576): a TV of 1560 px, not one fitted to the height", () => {
		// Regression (Spec review, 2026-10-22): the TV was capped at the scene's height, 1162.75 px of 1560 here.
		const L = layoutRoom(1600, 576)
		near(L.tv.width, 1560, 0.01, "the TV's width")
		assert.ok(
			L.tv.height > 576 - 2 * top(576),
			"taller than the scene: the room scrolls to its bottom",
		)
		assert.ok(L.height > 576, "the room's content is taller than the scene")
	})

	it("on a wide screen the TV sits a little lower and leaves the whole Remote under it, nothing scrolls (the owner, 2026-10-25)", () => {
		// The owner's ultrawide window: 2524 x 975, a scene of 2509 x 911. It was a TV of 2453 x 1325, then one that
		// fitted the height with only the Remote's top showing.
		for (const [w, h] of [
			[2509, 911],
			[1921, 576],
			[3440, 1300],
			[5000, 1300],
			[2545, 1500],
		] as const) {
			const L = layoutRoom(w, h)
			const at = `${w} x ${h}`
			near(L.tv.top, Math.max(6, h * 0.025), 1e-6, `${at}: the TV's top margin`)
			assert.ok(
				L.tv.width <= w - 2 * pad(w) + 1e-6,
				`${at}: no wider than the scene's margins`,
			)
			near(L.tv.left + L.tv.width / 2, w / 2, 0.5, `${at}: the TV's middle`)
			assert.ok(L.remote.scale >= 0.46, `${at}: the Remote's size`)
			assert.ok(
				L.remote.top + SHOWN * L.remote.scale <= h + 1e-6,
				`${at}: the whole Remote inside the scene`,
			)
			assert.equal(L.height, h, `${at}: no scrolling`)
		}
		near(layoutRoom(2509, 911).tv.width, 1143.5, 0.1, "the owner's window")
	})

	it("up to WIDE_FROM a short window keeps the full-width TV", () => {
		const L = layoutRoom(WIDE_FROM, 576)
		near(L.tv.width, WIDE_FROM - 2 * pad(WIDE_FROM), 1e-6, "full width")
		assert.ok(L.tv.height > 576, "taller than the scene")
	})

	it("where the width limits it, the TV is as wide as the scene but for its margins", () => {
		for (let w = 768; w <= 1600; w += 40) {
			const L = layoutRoom(w, 1400)
			near(L.tv.width, w - 2 * pad(w), 0.5, `${w} x 1400`)
		}
	})

	it("a tablet in portrait (876 x 1248): a TV of 848 px, the Remote under it inside the scene", () => {
		const L = layoutRoom(876, 1248)
		near(L.tv.width, 848, 0.5, "the TV's width")
		near(
			L.remote.left + (REMOTE_W * L.remote.scale) / 2,
			438,
			0.5,
			"the Remote's middle",
		)
		assert.equal(L.height, 1248, "no scrolling")
	})

	it("the Remote stays inside the scene where it fits, and the room scrolls only where it doesn't", () => {
		for (let w = 768; w <= 2560; w += 97)
			for (let h = 420; h <= 1600; h += 53) {
				const L = layoutRoom(w, h)
				assert.ok(
					L.remote.scale >= 0.46 && L.remote.scale <= 0.8,
					`${w} x ${h}`,
				)
				const end = L.remote.top + SHOWN * L.remote.scale
				if (L.height > h)
					near(
						L.height,
						end + 8,
						1e-6,
						`${w} x ${h}: scrolls to the Remote's end`,
					)
				else
					assert.ok(end <= h + 1e-6, `${w} x ${h}: the Remote inside the scene`)
			}
	})
})

describe("the desktop room, at any size", () => {
	const sizes: [number, number][] = []
	for (let w = 768; w <= 2560; w += 64)
		for (let h = 420; h <= 1536; h += 62) sizes.push([w, h])

	it("the TV has the photo TV's shape and is inside the room's content", () => {
		for (const [w, h] of sizes) {
			const L = layoutRoom(w, h)
			near(
				L.tv.width / L.tv.height,
				ROOM_PHOTO.tv.w / ROOM_PHOTO.tv.h,
				1e-9,
				"aspect",
			)
			assert.ok(L.tv.left >= 0 && L.tv.top >= 0, `${w} x ${h}`)
			assert.ok(L.tv.left + L.tv.width <= w + 0.001, `${w} x ${h}`)
			assert.ok(L.tv.top + L.tv.height <= L.height + 0.001, `${w} x ${h}`)
		}
	})

	it("the photo is scaled so its TV sits exactly where ours is, and the canvas covers the TV", () => {
		for (const [w, h] of sizes) {
			const L = layoutRoom(w, h)
			const s = L.photo.width / ROOM_PHOTO.w
			near(L.photo.height / ROOM_PHOTO.h, s, 1e-9, "one scale")
			near(L.photo.left + ROOM_PHOTO.tv.x * s, L.tv.left, 1e-6, "left")
			near(L.photo.top + ROOM_PHOTO.tv.y * s, L.tv.top, 1e-6, "top")
			near(ROOM_PHOTO.tv.w * s, L.tv.width, 1e-6, "width")
			assert.ok(TV_CANVAS.w * L.canvas.scale >= L.tv.width - 1e-6)
			assert.ok(TV_CANVAS.h * L.canvas.scale >= L.tv.height - 1e-6)
			near(
				L.canvas.x * 2 + TV_CANVAS.w * L.canvas.scale,
				L.tv.width,
				1e-6,
				"centred across",
			)
			near(
				L.canvas.y * 2 + TV_CANVAS.h * L.canvas.scale,
				L.tv.height,
				1e-6,
				"centred down",
			)
		}
	})

	it("the Remote is as wide as the hand's placeholder and ends in its palm, and the streaming row ends inside the room's content", () => {
		for (const [w, h] of sizes) {
			const L = layoutRoom(w, h)
			const k = (REMOTE_W * L.remote.scale) / HAND.pw
			near(L.hand.left + HAND.x * k, 0, 1e-6, "the placeholder's left")
			near(
				L.hand.top + (HAND.y + HAND.ph) * k,
				REMOTE_H * L.remote.scale,
				1e-6,
				"the placeholder's end, at the Remote's",
			)
			near(
				L.hand.width / L.hand.height,
				HAND.w / HAND.h,
				1e-9,
				"the hand's shape",
			)
			assert.ok(
				L.remote.top + STREAMING_END * L.remote.scale <= L.height,
				`${w} x ${h}: ${L.place}`,
			)
			assert.ok(L.remote.scale >= 0.46)
		}
	})
})

// ---------------------------------------------------------------------------------------------------------

// The phone (the owner, 2026-10-22): a wide TV at every size, the Remote held under it, nothing scrolls.

// The real page: the header, the dock of 72 px (ui/navigation/MobileDock.tsx), and the lip of the section below
// the room over the room's bottom edge (PHONE_LIP in room.ts).
const REAL_CHROME = 136
const LIP = 60
const realPhone = (w: number, h: number) =>
	layoutPhoneRoom(w, h - REAL_CHROME, LIP)
const HELD = PHONE_REMOTE.hand

const UPRIGHT = [
	[320, 568],
	[360, 740],
	[375, 667],
	[390, 844],
	[412, 915],
	[430, 932],
	[549, 1866],
] as const

describe("the phone's room upright", () => {
	it("the TV is 16:9, as wide as the window but for the wall, centred, with its canvas of 480 x 270", () => {
		for (const [w, h] of UPRIGHT) {
			const L = realPhone(w, h)
			near(
				L.tv.width / L.tv.height,
				PHONE_TV_ASPECT,
				1e-9,
				`${w} x ${h}: the shape`,
			)
			near(L.tv.width, w - 28, 1e-9, `${w} x ${h}: the width`)
			near(L.tv.left + L.tv.width / 2, w / 2, 1e-9, `${w} x ${h}: centred`)
			assert.deepEqual(
				[L.canvas.w, L.canvas.h],
				[PHONE_TV_CANVAS.w, PHONE_TV_CANVAS.h],
			)
			near(
				L.canvas.scale * PHONE_TV_CANVAS.w,
				L.tv.width,
				1e-9,
				`${w} x ${h}: the canvas covers the TV`,
			)
			near(
				L.canvas.scale * PHONE_TV_CANVAS.h,
				L.tv.height,
				1e-9,
				`${w} x ${h}: and its height`,
			)
			assert.equal(L.height, h - REAL_CHROME, "the room never scrolls")
		}
	})

	it("every key of the Remote is 44 px or more, and its top shows under the TV at rest", () => {
		for (const [w, h] of UPRIGHT) {
			const L = realPhone(w, h)
			const avail = L.h - LIP
			assert.ok(L.remote.u >= 1, `${w} x ${h}: keys of 44 px`)
			assert.ok(
				L.remote.top >= L.outer.top + L.outer.height,
				`${w} x ${h}: under the TV`,
			)
			assert.ok(
				avail - L.remote.top >= PHONE_PEEK - 1e-9,
				`${w} x ${h}: its top shows`,
			)
		}
	})

	it("where its keys don't all show at rest, a tap raises it until they do, over the TV, never above it", () => {
		for (const [w, h] of UPRIGHT) {
			const L = realPhone(w, h)
			const avail = L.h - LIP
			const { remote } = L
			if (remote.keysEnd + 10 <= avail) {
				assert.equal(remote.lift, 0, `${w} x ${h}: whole at rest`)
				assert.equal(remote.peek, false)
				continue
			}
			assert.equal(remote.peek, true, `${w} x ${h}`)
			assert.ok(
				remote.top - remote.lift >= L.outer.top - 1e-9,
				`${w} x ${h}: never above the TV`,
			)
			assert.ok(
				remote.keysEnd - remote.lift <= avail - 10 + 1e-9,
				`${w} x ${h}: raised, its keys end over the lip`,
			)
		}
		assert.equal(
			realPhone(375, 667).remote.peek,
			true,
			"375 x 667 rests with its top showing",
		)
		assert.equal(
			realPhone(390, 844).remote.peek,
			false,
			"390 x 844 shows it whole",
		)
		assert.equal(
			realPhone(412, 915).remote.peek,
			false,
			"412 x 915 shows it whole",
		)
	})

	it("the Remote is as long as its keys and a short grip, and its body ends in the hand's palm", () => {
		for (const [w, h] of UPRIGHT) {
			const L = realPhone(w, h)
			const { remote, hand } = L
			near(
				remote.bodyEnd - remote.top,
				HELD.body * remote.u,
				1e-9,
				"its length",
			)
			assert.ok(HELD.body / HELD.w < 1.7, "a natural remote's proportions")
			const kh = remote.width / HAND.pw
			near(
				hand.top + (HAND.y + HAND.ph) * kh,
				remote.bodyEnd,
				1e-9,
				`${w} x ${h}: the palm holds its end`,
			)
			near(
				hand.left + HAND.x * kh,
				remote.left,
				1e-9,
				`${w} x ${h}: the placeholder's left`,
			)
		}
	})

	it("in a tall, narrow window the whole Remote shows above the lip, the room's sideboard above it, and no empty body", () => {
		const L = realPhone(549, 1866)
		near(L.remote.bodyEnd, L.h - LIP - 10, 1e-9, "the body ends over the lip")
		assert.ok(
			L.remote.top > L.outer.top + L.outer.height + 400,
			"the room shows between the TV and the Remote",
		)
		assert.ok(
			L.remote.bodyEnd - L.remote.keysEnd <= 100 * L.remote.u + 1e-9,
			"the grip under the keys is short",
		)
	})

	it("the wall and the furniture cover the scene's width, and meet at the seam", () => {
		for (const [w, h] of UPRIGHT) {
			const L = realPhone(w, h)
			assert.ok(
				L.wall.left <= 1e-9 && L.wall.left + L.wall.width >= w - 1e-9,
				`${w} x ${h}: the wall`,
			)
			assert.ok(
				L.floor.left <= 1e-9 && L.floor.left + L.floor.width >= w - 1e-9,
				`${w} x ${h}: the floor`,
			)
			near(L.seam, L.outer.top + L.outer.height + 9, 1e-9, "the stand's foot")
		}
	})
})

describe("the phone's room on its side", () => {
	// On its side the lip is a tab at the right, clear of the Remote: nothing is reserved under it.
	const SIDE = [
		[844, 390, 0],
		[932, 430, 0],
		[812, 375, 0],
		// The room covers the window on its side at every width since 2026-10-22: the lip is the tab there too.
		[740, 360, 0],
		[667, 375, 0],
	] as const
	it("the TV takes the width, never taller than 16:9, wider where the height caps it; its canvas is 270 tall and as wide as its shape", () => {
		for (const [w, h, reserve] of SIDE) {
			const L = layoutPhoneLandscape(w, h, reserve)
			assert.ok(
				L.tv.width / L.tv.height >= PHONE_TV_ASPECT - 1e-9,
				`${w} x ${h}: never taller than 16:9`,
			)
			near(L.tv.left + L.tv.width / 2, w / 2, 1e-9, `${w} x ${h}: centred`)
			assert.equal(L.canvas.h, PHONE_TV_CANVAS.h)
			assert.ok(
				L.canvas.w >= 480 && L.canvas.w <= 810,
				`${w} x ${h}: canvas ${L.canvas.w}`,
			)
			near(
				L.canvas.scale * L.canvas.w,
				L.tv.width,
				1e-9,
				`${w} x ${h}: the canvas covers the TV`,
			)
			near(
				L.canvas.scale * L.canvas.h,
				L.tv.height,
				1e-9,
				`${w} x ${h}: and its height`,
			)
			// Full width, to the canvas's rounding, unless the picture would be wider than 3:1.
			if (L.canvas.w < 810)
				near(L.tv.width, w - 28, L.canvas.scale, `${w} x ${h}: full width`)
			else assert.ok(L.tv.width <= w - 28 + 1e-9)
			near(
				h - reserve - L.remote.top,
				PHONE_PEEK,
				1e-9,
				`${w} x ${h}: the Remote's top shows`,
			)
			assert.equal(L.height, h, "the room never scrolls")
		}
		// The phone of the owner's report: 816 x 285 on a canvas of 773 x 270.
		const L = layoutPhoneLandscape(844, 390, 0)
		assert.deepEqual(
			[Math.round(L.tv.width), Math.round(L.tv.height), L.canvas.w],
			[816, 285, 773],
		)
		// Upright keeps its fixed canvas.
		assert.equal(realPhone(390, 844).canvas.w, 480)
	})
	it("a tap raises the Remote over the TV until its keys show, its keys 44 px or more", () => {
		for (const [w, h, reserve] of SIDE) {
			const L = layoutPhoneLandscape(w, h, reserve)
			assert.equal(L.remote.peek, true)
			assert.ok(L.remote.u >= 1)
			// Raised until its keys end 10 px over the reserve, or as far as the TV's top allows (a short window under
			// 768 px of width), still over the reserve.
			assert.ok(
				L.remote.keysEnd - L.remote.lift <= h - reserve + 1e-9,
				`${w} x ${h}: raised`,
			)
			assert.ok(L.remote.top - L.remote.lift >= L.outer.top - 1e-9)
		}
	})
	it("the photo covers the scene, with its TV's middle behind ours", () => {
		for (const [w, h, reserve] of SIDE) {
			const L = layoutPhoneLandscape(w, h, reserve)
			assert.ok(L.photo.left <= 1e-9 && L.photo.top <= 1e-9, `${w} x ${h}`)
			assert.ok(
				L.photo.left + L.photo.width >= w - 1e-9 &&
					L.photo.top + L.photo.height >= h - 1e-9,
			)
			const s = L.photo.width / ROOM_PHOTO.w
			near(
				L.photo.left + (ROOM_PHOTO.tv.x + ROOM_PHOTO.tv.w / 2) * s,
				w / 2,
				1e-6,
				"its TV's middle",
			)
		}
	})
})

describe("turnLimit", () => {
	it("none without room, all of it with room to spare, the corner's angle between", () => {
		assert.equal(turnLimit(100, 100, 300, 22), 0)
		assert.equal(turnLimit(60, 100, 300, 22), 0)
		assert.equal(turnLimit(400, 100, 300, 22), 22)
		const limit = turnLimit(180, 100, 300, 22)
		assert.ok(limit > 0 && limit < 22)
	})
})
