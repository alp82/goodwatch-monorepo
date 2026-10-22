// The new room's layouts against the numbers the approved prototype measured
// (docs/prototypes/tv-screen-design/README.md on prototype/tv-screen-flow, "The room" and "The phone").
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	HAND,
	PHONE_REMOTE,
	PHONE_ROOM_PHOTO,
	PHONE_TV_CANVAS,
	REMOTE_W,
	ROOM_PHOTO,
	TV_CANVAS,
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
		[1920, 1080, 1857, 1003, 1.548, 0.564, 1352, 1311],
		[1920, 940, 1857, 1003, 1.548, 0.5, 1317, 1274],
		[2560, 1300, 2489, 1344, 2.075, 0.68, 1755, 1717],
		[1536, 730, 1483, 801, 1.236, 0.5, 1114, 1071],
		[1440, 800, 1389, 750, 1.158, 0.5, 1063, 1020],
		[1366, 650, 1317, 711, 1.098, 0.5, 1024, 981],
		[1280, 720, 1233, 666, 1.028, 0.5, 979, 936],
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
	const SHOWN = 548
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

	it("the hand's placeholder is the Remote's box, and the streaming row ends inside the room's content", () => {
		for (const [w, h] of sizes) {
			const L = layoutRoom(w, h)
			const k = (REMOTE_W * L.remote.scale) / HAND.pw
			near(L.hand.left + HAND.x * k, 0, 1e-6, "the placeholder's left")
			near(L.hand.top + HAND.y * k, 0, 1e-6, "the placeholder's top")
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

// The prototype measured the phone in a scene that was the window without the header and a dock of 64 px, and
// kept the Remote's keys out of the 20 px the dock's key reaches into it.
const PROTOTYPE_CHROME = 128
const PROTOTYPE_RESERVE = 20
const prototypePhone = (
	w: number,
	h: number,
	want: "auto" | "hand" | "table" = "auto",
) => layoutPhoneRoom(w, h - PROTOTYPE_CHROME, PROTOTYPE_RESERVE, want)

// The real page: the header, the dock of 72 px (ui/navigation/MobileDock.tsx), and the lip of the section below
// the room over the room's bottom edge (PHONE_LIP in room.ts).
const REAL_CHROME = 136
const LIP = 60
const realPhone = (w: number, h: number) =>
	layoutPhoneRoom(w, h - REAL_CHROME, LIP)

describe("the phone's room, at the prototype's sizes", () => {
	// Window, the form asked for, the form shown, picture, TV with its bezel, canvas height, shown at, the Remote's
	// width, its smallest key, where it starts (from the window's top).
	const rows = [
		// The held Remote's keys take 288 of its pixels since 2026-10-21 (222 before): 360 x 740 lies on the table.
		[390, 844, "auto", "hand", 362, 302, 372, 312, 417, 0.72, 265, 49, 396.7],
		[390, 844, "table", "table", 362, 302, 372, 312, 417, 0.72, 365, 48, 526.4],
		[360, 740, "auto", "table", 332, 277, 342, 287, 417, 0.66, 337, 44, 451.2],
		[360, 740, "table", "table", 332, 277, 342, 287, 417, 0.66, 337, 44, 451.2],
		[375, 667, "auto", "table", 347, 289, 357, 299, 417, 0.69, 351, 46, 391.3],
		[375, 667, "hand", "hand", 347, 194, 357, 204, 280, 0.69, 236, 44, 289],
		[430, 932, "auto", "hand", 402, 335, 412, 345, 417, 0.8, 292, 55, 435.6],
		[430, 932, "table", "table", 402, 335, 412, 345, 417, 0.8, 402, 53, 580],
		[390, 700, "auto", "table", 362, 302, 372, 312, 417, 0.72, 365, 48, 414.1],
		[390, 700, "hand", "hand", 362, 227, 372, 237, 314, 0.72, 236, 44, 322],
	] as const
	for (const [
		w,
		h,
		want,
		form,
		pw,
		ph,
		ow,
		oh,
		ch,
		shown,
		rw,
		key,
		starts,
	] of rows)
		it(`${w} x ${h}, ${want}: the Remote ${form === "hand" ? "in the hand" : "on the table"}, a picture of ${pw} x ${ph}`, () => {
			const L = prototypePhone(w, h, want)
			assert.equal(L.form, form)
			assert.equal(Math.round(L.tv.width), pw)
			assert.equal(Math.round(L.tv.height), ph)
			assert.equal(Math.round(L.outer.width), ow)
			assert.equal(Math.round(L.outer.height), oh)
			assert.equal(L.canvas.w, 500)
			assert.equal(Math.round(L.canvas.h), ch)
			near(L.canvas.scale, shown, 0.005, "shown at")
			assert.equal(Math.round(L.remote.width), rw)
			assert.equal(Math.round(44 * L.remote.u), key)
			near(64 + L.remote.top, starts, 0.5, "the Remote's start")
		})

	it("takes the hand from the window heights of the prototype's table", () => {
		for (const [w, from] of [
			[360, 750],
			[375, 763],
			[390, 775],
			[430, 808],
		]) {
			assert.equal(prototypePhone(w, from).form, "hand", `${w} x ${from}`)
			assert.equal(
				prototypePhone(w, from - 1).form,
				"table",
				`${w} x ${from - 1}`,
			)
		}
	})

	it("`auto` says what the height would choose while a form is forced", () => {
		const forced = prototypePhone(375, 667, "hand")
		assert.equal(forced.form, "hand")
		assert.equal(forced.auto, "table")
	})
})

describe("the phone's room on the real page, under the lip", () => {
	// 48 px less than the prototype measured: the lip takes 60 where it kept 20 free, and the dock is 72, not 64.
	it("390 x 844, 412 x 915 and 430 x 932 hold the Remote in the hand, with the TV at its full height", () => {
		for (const [w, h, pw, ph] of [
			[390, 844, 362, 302],
			[412, 915, 384, 320],
			[430, 932, 402, 335],
		]) {
			const L = realPhone(w, h)
			assert.equal(L.form, "hand", `${w} x ${h}`)
			assert.equal(Math.round(L.tv.width), pw)
			assert.equal(Math.round(L.tv.height), ph)
			assert.equal(Math.round(L.canvas.h), 417)
		}
	})

	it("360 x 740 has it on the table, with the TV at its full height", () => {
		const L = realPhone(360, 740)
		assert.equal(L.form, "table")
		assert.equal(Math.round(L.tv.height), 277)
		assert.equal(Math.round(L.canvas.h), 417)
	})

	it("375 x 667 and 390 x 700 have it on the table, and a shorter TV: 258 and 291 px", () => {
		const small = realPhone(375, 667)
		assert.equal(small.form, "table")
		assert.equal(Math.round(small.tv.height), 258)
		assert.equal(Math.round(small.canvas.h), 372)
		const short = realPhone(390, 700)
		assert.equal(short.form, "table")
		assert.equal(Math.round(short.tv.height), 291)
		assert.equal(Math.round(short.canvas.h), 402)
	})

	// Regression (2026-10-21): held, the Remote's keys were crowded at the top of a body that ran on under them,
	// 31 to 55 px of it on these phones over the lip. Its keys take more of it now, and the spare height goes
	// over it (the sideboard shows), so under its keys there is little more than the grip.
	it("held on today's phones, under 0.6 of a key of its body shows under its keys", () => {
		for (const [w, h] of [
			[375, 812],
			[390, 844],
			[393, 852],
			[412, 915],
			[414, 896],
			[428, 926],
			[430, 932],
		]) {
			const L = realPhone(w, h)
			assert.equal(L.form, "hand", `${w} x ${h}`)
			const under = L.h - LIP - L.remote.keysEnd
			assert.ok(
				under >= 0 && under <= 0.6 * 44 * L.remote.u,
				`${w} x ${h}: ${under} px of body under the keys`,
			)
		}
	})

	// Regression (2026-10-21): a tall, narrow window (320 to 440 wide, 900 to 1180 tall) left up to 420 px of
	// empty Remote body under the keys. Held, all spare height but a grip of 40 of its pixels goes above it.
	it("held in a tall, narrow window, under its keys is only the grip", () => {
		for (let w = 320; w <= 440; w += 20)
			for (let h = 900; h <= 1180; h += 20) {
				const L = layoutPhoneRoom(w, h, 60)
				assert.equal(L.form, "hand", `${w} x ${h}`)
				const under = h - 60 - L.remote.keysEnd
				assert.ok(
					under >= 0 && under <= 40 * L.remote.u + 6 + 1e-6,
					`${w} x ${h}: ${under} px of body under the keys`,
				)
			}
	})

	it("takes the hand from a window height of 823 px at 390 wide", () => {
		assert.equal(realPhone(390, 823).form, "hand")
		assert.equal(realPhone(390, 822).form, "table")
	})

	it("the reserve moves the threshold and nothing else: scene >= reserve + 325 + (w - 28) / 1.2", () => {
		for (const reserve of [0, 20, 60, 90])
			for (const w of [320, 360, 390, 430, 767]) {
				const from = Math.ceil(reserve + 325 + (w - 28) / 1.2)
				assert.equal(layoutPhoneRoom(w, from, reserve).form, "hand")
				assert.equal(layoutPhoneRoom(w, from - 1, reserve).form, "table")
			}
	})
})

describe("the phone's room, at any size", () => {
	const sizes: [number, number][] = []
	// From the smallest phone still in use (320 x 568, a scene of 432) to a tall, wide one.
	for (let w = 320; w < 768; w += 23)
		for (let h = 432; h <= 1100; h += 37) sizes.push([w, h])
	const each = (
		check: (L: ReturnType<typeof layoutPhoneRoom>, at: string) => void,
	) => {
		for (const [w, h] of sizes)
			for (const want of ["auto", "hand", "table"] as const) {
				// A forced hand in a scene too short for it is not a layout the page ever shows.
				if (want === "hand" && h < LIP + 325 + 60) continue
				check(layoutPhoneRoom(w, h, LIP, want), `${w} x ${h} ${want}`)
			}
	}

	it("the TV is wider than tall, has its bezel on every side and wall beside it", () => {
		each((L, at) => {
			assert.ok(L.tv.height > 0, at)
			assert.ok(L.tv.width / L.tv.height >= 1.2 - 1e-9, at)
			assert.equal(L.tv.left - L.outer.left, 5)
			assert.equal(L.tv.top - L.outer.top, 5)
			near(L.outer.width - L.tv.width, 10, 1e-9, at)
			near(L.outer.height - L.tv.height, 10, 1e-9, at)
			assert.equal(L.outer.left, 9)
			near(L.w - (L.outer.left + L.outer.width), 9, 1e-9, at)
		})
	})

	it("the canvas keeps its width and shows as much height as the picture has", () => {
		each((L, at) => {
			assert.equal(L.canvas.w, PHONE_TV_CANVAS.w)
			near(L.canvas.w * L.canvas.scale, L.tv.width, 1e-6, at)
			near(L.canvas.h * L.canvas.scale, L.tv.height, 1e-6, at)
			assert.ok(L.canvas.h <= PHONE_TV_CANVAS.h + 1e-6, at)
		})
	})

	it("every key of the Remote is 44 px or more, and its keys end above the lip", () => {
		each((L, at) => {
			assert.ok(L.remote.u >= 1, at)
			assert.ok(L.remote.u <= PHONE_REMOTE[L.form].grow, at)
			assert.ok(
				L.remote.keysEnd <= L.h - LIP + 1e-6,
				`${at}: ${L.remote.keysEnd}`,
			)
			near(L.remote.left + L.remote.width / 2, L.w / 2, 1e-9, at)
			// Its keys are inside the scene at every width. Its body too, from 336 px: lying, it is 336 px wide at
			// its smallest, so on a phone narrower than that its rounded ends run past the edges (8 px at 320).
			const firstKey = L.form === "table" ? 24 * L.remote.u : 10 * L.remote.u
			assert.ok(L.remote.left + firstKey >= 0, at)
			if (L.w >= PHONE_REMOTE.table.w) assert.ok(L.remote.left >= 0, at)
		})
	})

	it("lying on a phone of 320 px its body is 8 px wider than the scene on either side, its keys are not", () => {
		const L = layoutPhoneRoom(320, 432, LIP)
		assert.equal(L.form, "table")
		assert.equal(L.remote.left, -8)
		assert.equal(L.remote.u, 1)
	})

	it("the Remote starts under the TV's stand", () => {
		each((L, at) => {
			assert.ok(L.remote.top >= L.seam + 4 - 1e-6, at)
			assert.ok(L.seam > L.outer.top + L.outer.height, at)
		})
	})

	it("only the held Remote has a hand, and its fingers come round at the streaming keys", () => {
		each((L, at) => {
			assert.equal(L.hand !== null, L.form === "hand", at)
			if (!L.hand) return
			const kh = L.remote.width / HAND.pw
			near(L.hand.left + HAND.x * kh, L.remote.left, 1e-6, at)
			near(L.hand.width / L.hand.height, HAND.w / HAND.h, 1e-9, at)
		})
	})

	it("the wall and the furniture cover the scene's width, and meet at the seam", () => {
		each((L, at) => {
			for (const photo of [L.wall, L.floor]) {
				assert.ok(photo.left <= 0, at)
				assert.ok(photo.left + photo.width >= L.w, at)
			}
			// The wall is stretched so that the photo's row under the wall is at the seam; the furniture starts there.
			near(
				L.wall.top + (478 / PHONE_ROOM_PHOTO.h) * L.wall.height,
				L.seam,
				1e-6,
				at,
			)
			near(
				L.floor.top + (478 / PHONE_ROOM_PHOTO.h) * L.floor.height,
				0,
				1e-6,
				at,
			)
			assert.ok(L.wall.top <= 0, at)
		})
	})
})

// ---------------------------------------------------------------------------------------------------------

// In landscape the room is the whole window, and the lip is a tab of 46 px at its bottom edge (TvRoom.tsx,
// LANDSCAPE_TAB): the full-width TV ends above it, and the Remote's keys stay clear of it.
const TAB = { tv: 46, remote: 46 }

describe("the phone's room in landscape", () => {
	// Window, picture, canvas width, shown at, canvas height, the Remote's width, the room's content height.
	// Regression (2026-10-21): the TV stood on the left at about half the width and the Remote beside it; now the TV
	// takes the width (the owner: only full-width TVs, with the Remote centred) and the Remote is under it.
	const rows = [
		[844, 390, 816, 318, 710, 1.149, 277, 269, 775],
		[932, 430, 904, 358, 786, 1.15, 311, 302, 855],
		[915, 412, 887, 340, 771, 1.15, 296, 287, 819],
		[667, 375, 639, 303, 556, 1.149, 264, 256, 745],
	] as const
	for (const [w, h, pw, ph, cw, shown, ch, rw, height] of rows)
		it(`${w} x ${h}: a picture of ${pw} x ${ph} across, the Remote in the hand under it`, () => {
			const L = layoutPhoneLandscape(w, h, TAB)
			assert.equal(L.form, "hand")
			assert.equal(Math.round(L.tv.width), pw)
			assert.equal(Math.round(L.tv.height), ph)
			assert.equal(L.canvas.w, cw)
			near(L.canvas.scale, shown, 0.005, "shown at")
			assert.equal(Math.round(L.canvas.h), ch)
			assert.equal(Math.round(L.remote.width), rw)
			assert.equal(Math.round(L.height), height)
			near(L.tv.width, w - 28, 1e-9, "full width")
			near(
				L.remote.left + L.remote.width / 2,
				w / 2,
				1e-9,
				"the Remote's middle",
			)
		})

	const sizes: [number, number][] = []
	for (let w = 568; w <= 1400; w += 31)
		for (let h = 300; h <= 540; h += 16) sizes.push([w, h])

	it("the TV takes the width and shows whole above the tab; the Remote is centred under it", () => {
		for (const [w, h] of sizes) {
			const L = layoutPhoneLandscape(w, h, TAB)
			const at = `${w} x ${h}`
			near(L.tv.width, w - 28, 1e-9, at)
			near(L.outer.left, 9, 1e-9, at)
			assert.ok(
				L.outer.top + L.outer.height <= h - TAB.tv + 1e-6,
				`${at}: above the tab`,
			)
			near(L.remote.left + L.remote.width / 2, w / 2, 1e-9, `${at}: centred`)
			assert.ok(
				L.remote.top >= L.outer.top + L.outer.height,
				`${at}: under the TV`,
			)
		}
	})

	it("the canvas is a phone's, drawn at no more than 1.15: wider than 500 where the picture is", () => {
		for (const [w, h] of sizes) {
			const L = layoutPhoneLandscape(w, h, TAB)
			const at = `${w} x ${h}`
			// The canvas's width is a whole pixel: half a pixel of rounding over 1.15 at most.
			assert.ok(
				L.canvas.scale <= L.tv.width / (L.tv.width / 1.15 - 0.5) + 1e-9,
				`${at}: ${L.canvas.scale}`,
			)
			assert.ok(L.canvas.w >= PHONE_TV_CANVAS.w, at)
			near(L.canvas.w * L.canvas.scale, L.tv.width, 1e-6, `${at}: across`)
			near(L.canvas.h * L.canvas.scale, L.tv.height, 1e-6, `${at}: down`)
		}
	})

	it("every key is 44 px or more, the keys all fit the window at once, and the room's content holds them above the tab", () => {
		for (const [w, h] of sizes) {
			const L = layoutPhoneLandscape(w, h, TAB)
			const at = `${w} x ${h}`
			const R = PHONE_REMOTE[L.form]
			assert.ok(L.remote.u >= 1 && L.remote.u <= R.grow, at)
			if (L.remote.u > 1)
				assert.ok(
					R.keys * L.remote.u <= h - 16 - TAB.remote + 1e-6,
					`${at}: fits the window`,
				)
			assert.ok(
				L.remote.keysEnd <= L.height - TAB.remote + 1e-6,
				`${at}: ${L.remote.keysEnd} of ${L.height}`,
			)
			assert.ok(L.height >= h, at)
			assert.equal(L.hand !== null, L.form === "hand")
		}
	})

	it("the photo covers the room's content, with its TV's middle behind ours", () => {
		for (const [w, h] of sizes) {
			const L = layoutPhoneLandscape(w, h, TAB)
			const at = `${w} x ${h}`
			assert.ok(L.photo.left <= 1e-6 && L.photo.top <= 1e-6, at)
			assert.ok(L.photo.left + L.photo.width >= w - 1e-6, at)
			assert.ok(L.photo.top + L.photo.height >= L.height - 1e-6, at)
			const s = L.photo.width / ROOM_PHOTO.w
			near(
				L.photo.left + (ROOM_PHOTO.tv.x + ROOM_PHOTO.tv.w / 2) * s,
				L.outer.left + L.outer.width / 2,
				1e-6,
				at,
			)
		}
	})

	it("the Remote lies on the table where the height is too short to hold it", () => {
		// Held, its keys need 288 px between the top margin and the tab: a scene of 348 px.
		assert.equal(layoutPhoneLandscape(844, 348, TAB).form, "hand")
		const lying = layoutPhoneLandscape(844, 347, TAB)
		assert.equal(lying.form, "table")
		assert.equal(lying.hand, null)
		assert.equal(layoutPhoneLandscape(844, 390, TAB, "table").form, "table")
		assert.equal(layoutPhoneLandscape(844, 390, TAB, "table").auto, "hand")
	})

	it("under the picture it aims as a phone upright does: about its grip, a few degrees", () => {
		for (const [w, h] of sizes) {
			const L = layoutPhoneLandscape(w, h, TAB)
			const at = `${w} x ${h}`
			const { rig } = L
			assert.equal(rig.tv, "above", at)
			assert.equal(rig.swing, L.form === "hand" ? 11 : 3.5, at)
			near(rig.x, w / 2, 1e-9, at)
			assert.ok(
				L.form === "hand" ? rig.y > L.remote.keysEnd : rig.y < L.remote.keysEnd,
				at,
			)
		}
	})

	it("the turn limit: none without room, all of it with room to spare, the corner's angle between", () => {
		// A Remote 200 wide whose grip is 300 under its top: its corner is 100 beside the grip at rest.
		assert.equal(turnLimit(100, 100, 300, 22), 0)
		assert.equal(turnLimit(60, 100, 300, 22), 0)
		assert.equal(turnLimit(400, 100, 300, 22), 22)
		const limit = turnLimit(180, 100, 300, 22)
		const turn = (limit * Math.PI) / 180
		near(100 * Math.cos(turn) + 300 * Math.sin(turn), 180, 1e-9, "the corner")
		assert.ok(limit > 16 && limit < 17, String(limit))
	})

	it("a bar across the scene's bottom takes its height from the TV too", () => {
		// A landscape window under 768 px of width: the room is not the whole window there, and the lip is a bar.
		const L = layoutPhoneLandscape(667, 239, { tv: 60, remote: 60 })
		assert.ok(L.outer.top + L.outer.height <= 239 - 60)
		assert.ok(L.tv.width > 0 && L.tv.height > 0)
	})
})
