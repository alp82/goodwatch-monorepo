// The new room's layouts against the numbers the approved prototype measured
// (docs/prototypes/tv-screen-design/README.md on prototype/tv-screen-flow, "The room" and "The phone").
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	HAND,
	PHONE_REMOTE,
	PHONE_ROOM_PHOTO,
	PHONE_TV_CANVAS,
	REMOTE_H,
	REMOTE_W,
	ROOM_PHOTO,
	TV_CANVAS,
	TV_MIN_WIDTH,
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
	// Window, place, TV, canvas scale, Remote's size, where its streaming row ends (from the window's top).
	const rows = [
		[1920, 1080, "below", 1271, 686, 1.06, 0.62, 1064],
		[1920, 940, "below", 1080, 583, 0.9, 0.55, 926],
		[2560, 1300, "below", 1556, 841, 1.3, 0.74, 1281],
		[1536, 730, "beside", 1080, 583, 0.9, 0.72, 474],
		[1440, 800, "beside", 1080, 583, 0.9, 0.54, 605],
		[1366, 650, "beside", 998, 539, 0.83, 0.5, 471],
		[1280, 720, "beside", 949, 513, 0.79, 0.5, 541],
	] as const
	for (const [w, h, place, tvW, tvH, shown, size, rowEnds] of rows)
		it(`${w} x ${h}: ${place}, a TV of ${tvW} x ${tvH}`, () => {
			const L = desktop(w, h)
			assert.equal(L.place, place)
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
			assert.ok(
				L.remote.top + STREAMING_END * L.remote.scale < h - HEADER,
				"the streaming row ends inside the window",
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

	it("beside the TV the whole Remote is inside the scene, right of the TV", () => {
		for (const [w, h] of [
			[1536, 730],
			[1440, 800],
			[1366, 650],
			[1280, 720],
		]) {
			const L = desktop(w, h)
			assert.ok(L.remote.top >= 6)
			assert.ok(L.remote.top + REMOTE_H * L.remote.scale <= h - HEADER)
			assert.ok(L.remote.left > L.tv.left + L.tv.width)
			assert.ok(L.remote.left + REMOTE_W * L.remote.scale < w - GUTTER)
		}
	})

	it("beside the TV, the lip's tab at the scene's bottom right is right of the TV", () => {
		// The tab is its first line alone there (living-room.css): about 175 px wide, 24 px from the right edge.
		for (let w = 768; w <= 2560; w += 37)
			for (let h = 420; h <= 1100; h += 41) {
				const L = layoutRoom(w, h, "beside")
				assert.ok(L.tv.left + L.tv.width <= w - 24 - 175, `${w} x ${h}`)
			}
	})

	it("holds 18 px type at 1440 x 800, 1536 x 730, 1920 x 940 and larger, and not at the two smallest", () => {
		const smallest = (w: number, h: number) => 20 * desktop(w, h).canvas.scale
		for (const [w, h] of [
			[1440, 800],
			[1536, 730],
			[1920, 940],
			[1920, 1080],
			[2560, 1300],
		])
			assert.ok(smallest(w, h) >= 18, `${w} x ${h}`)
		// 21 canvas pixels are Cinema's smallest type: 17.5 and 16.6 px there, as the prototype's table says.
		near((smallest(1366, 650) * 21) / 20, 17.5, 0.05, "1366 x 650")
		near((smallest(1280, 720) * 21) / 20, 16.6, 0.05, "1280 x 720")
	})
})

describe("under the TV or beside it", () => {
	it("needs a window about 918 px tall: 1920 x 918 is under, 1920 x 910 beside", () => {
		assert.equal(desktop(1920, 918).place, "below")
		assert.equal(desktop(1920, 917).place, "beside")
		assert.equal(desktop(1920, 910).place, "beside")
	})

	it("needs a scene about 1107 px wide, by the formula: not the 1140 of the prototype's code comment", () => {
		assert.equal(layoutRoom(1108, 1016).place, "below")
		assert.equal(layoutRoom(1107, 1016).place, "beside")
		// The prototype's notes say "about 1110 px wide" for the window. With the gutter that window is 1122.
		assert.equal(desktop(1123, 1080).place, "below")
		assert.equal(desktop(1121, 1080).place, "beside")
	})

	it("under the TV the type is 18 px or more, whatever the size", () => {
		for (let w = 1108; w <= 3840; w += 97)
			for (let h = 854; h <= 2160; h += 53) {
				const L = layoutRoom(w, h)
				assert.equal(L.place, "below", `${w} x ${h}`)
				assert.ok(L.tv.width >= TV_MIN_WIDTH - 1, `${w} x ${h}: ${L.tv.width}`)
				assert.ok(L.remote.scale >= 0.46 && L.remote.scale <= 0.8)
			}
	})

	it("`want` forces a place", () => {
		assert.equal(layoutRoom(1905, 1016, "beside").place, "beside")
		assert.equal(layoutRoom(1265, 656, "below").place, "below")
	})
})

describe("the desktop room, at any size", () => {
	const sizes: [number, number][] = []
	for (let w = 768; w <= 2560; w += 64)
		for (let h = 420; h <= 1536; h += 62) sizes.push([w, h])

	it("the TV has the photo TV's shape and is inside the scene", () => {
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
			assert.ok(L.tv.top + L.tv.height <= h + 0.001, `${w} x ${h}`)
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

	it("the hand's placeholder is the Remote's box, and the streaming row ends inside the scene", () => {
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
				L.remote.top + STREAMING_END * L.remote.scale <= h,
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
		[390, 844, "auto", "hand", 362, 302, 372, 312, 417, 0.72, 265, 49, 451],
		[390, 844, "table", "table", 362, 302, 372, 312, 417, 0.72, 365, 48, 526],
		[360, 740, "auto", "hand", 332, 277, 342, 287, 417, 0.66, 245, 46, 396],
		[360, 740, "table", "table", 332, 277, 342, 287, 417, 0.66, 337, 44, 451],
		[375, 667, "auto", "table", 347, 289, 357, 299, 417, 0.69, 351, 46, 391],
		[375, 667, "hand", "hand", 347, 260, 357, 270, 375, 0.69, 236, 44, 355],
		[430, 932, "auto", "hand", 402, 335, 412, 345, 417, 0.8, 292, 55, 498],
		[430, 932, "table", "table", 402, 335, 412, 345, 417, 0.8, 402, 53, 580],
		[390, 700, "auto", "table", 362, 302, 372, 312, 417, 0.72, 365, 48, 414],
		[390, 700, "hand", "hand", 362, 293, 372, 303, 405, 0.72, 236, 44, 388],
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
			[360, 684],
			[375, 697],
			[390, 709],
			[430, 742],
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
	it("390 x 844, 360 x 740 and 430 x 932 hold the Remote in the hand, with the TV at its full height", () => {
		for (const [w, h, pw, ph] of [
			[390, 844, 362, 302],
			[360, 740, 332, 277],
			[430, 932, 402, 335],
		]) {
			const L = realPhone(w, h)
			assert.equal(L.form, "hand", `${w} x ${h}`)
			assert.equal(Math.round(L.tv.width), pw)
			assert.equal(Math.round(L.tv.height), ph)
			assert.equal(Math.round(L.canvas.h), 417)
		}
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

	it("takes the hand from a window height of 757 px at 390 wide", () => {
		assert.equal(realPhone(390, 757).form, "hand")
		assert.equal(realPhone(390, 756).form, "table")
	})

	it("the reserve moves the threshold and nothing else: scene >= reserve + 259 + (w - 28) / 1.2", () => {
		for (const reserve of [0, 20, 60, 90])
			for (const w of [320, 360, 390, 430, 767]) {
				const from = Math.ceil(reserve + 259 + (w - 28) / 1.2)
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
				if (want === "hand" && h < LIP + 259 + 60) continue
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

// In landscape the room is the whole window, and the lip is a tab of 46 px that living-room.css moves
// under the Remote.
const TAB = { tv: 0, remote: 46 }

describe("the phone's room in landscape", () => {
	// Window, picture, shown at, the Remote's width.
	const rows = [
		[844, 390, 488, 364, 0.98, 243],
		[932, 430, 541, 404, 1.08, 270],
		[915, 412, 517, 386, 1.03, 275],
	] as const
	for (const [w, h, pw, ph, shown, rw] of rows)
		it(`${w} x ${h}: a picture of ${pw} x ${ph} on the left, the Remote in the hand on the right`, () => {
			const L = layoutPhoneLandscape(w, h, TAB)
			assert.equal(L.form, "hand")
			assert.equal(Math.round(L.tv.width), pw)
			assert.equal(Math.round(L.tv.height), ph)
			near(L.canvas.scale, shown, 0.005, "shown at")
			assert.equal(L.canvas.w, 500)
			assert.equal(Math.round(L.canvas.h), 373)
			assert.equal(Math.round(L.remote.width), rw)
			// The TV takes the height but for its bezel and a little wall.
			near(L.outer.top, 8, 1e-9, "the TV's top")
			near(h - (L.outer.top + L.outer.height), 8, 1e-9, "under the TV")
			assert.ok(20 * L.canvas.scale >= 18, "18 px type")
		})

	const sizes: [number, number][] = []
	for (let w = 768; w <= 1400; w += 31)
		for (let h = 300; h <= 540; h += 16) sizes.push([w, h])

	it("the TV is left of the Remote and of the fingers that hold it, and both are inside the scene", () => {
		for (const [w, h] of sizes) {
			const L = layoutPhoneLandscape(w, h, TAB)
			const at = `${w} x ${h}`
			const fingers = L.form === "hand" ? 0.3 * L.remote.width : 0
			assert.ok(L.remote.left - fingers >= L.outer.left + L.outer.width, at)
			assert.ok(L.remote.left + L.remote.width <= w, at)
			assert.ok(L.outer.left >= 0 && L.outer.top >= 0, at)
			assert.ok(L.outer.top + L.outer.height <= h, at)
		}
	})

	it("the picture is 1.2 to 1.34 times wider than tall, so its canvas is 373 to 417 px tall", () => {
		for (const [w, h] of sizes) {
			const L = layoutPhoneLandscape(w, h, TAB)
			const aspect = L.tv.width / L.tv.height
			assert.ok(
				aspect >= 1.2 - 1e-9 && aspect <= 1.34 + 1e-9,
				`${w} x ${h}: ${aspect}`,
			)
			near(L.canvas.w * L.canvas.scale, L.tv.width, 1e-6, "across")
			near(L.canvas.h * L.canvas.scale, L.tv.height, 1e-6, "down")
			assert.ok(L.canvas.h >= 373 && L.canvas.h <= 417 + 1e-6)
		}
	})

	it("every key is 44 px or more and the keys end above the tab", () => {
		for (const [w, h] of sizes) {
			const L = layoutPhoneLandscape(w, h, TAB)
			assert.ok(L.remote.u >= 1 && L.remote.u <= PHONE_REMOTE[L.form].grow)
			assert.ok(
				L.remote.keysEnd <= h - TAB.remote,
				`${w} x ${h}: ${L.remote.keysEnd}`,
			)
			assert.equal(L.hand !== null, L.form === "hand")
		}
	})

	it("the photo covers the scene, with its TV's middle behind ours", () => {
		for (const [w, h] of sizes) {
			const L = layoutPhoneLandscape(w, h, TAB)
			const at = `${w} x ${h}`
			assert.ok(L.photo.left <= 1e-6 && L.photo.top <= 1e-6, at)
			assert.ok(L.photo.left + L.photo.width >= w - 1e-6, at)
			assert.ok(L.photo.top + L.photo.height >= h - 1e-6, at)
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
		// Held, its keys need 222 px between the top margin and the tab: a scene of 282 px.
		assert.equal(layoutPhoneLandscape(844, 282, TAB).form, "hand")
		const lying = layoutPhoneLandscape(844, 281, TAB)
		assert.equal(lying.form, "table")
		assert.equal(lying.hand, null)
		assert.equal(layoutPhoneLandscape(844, 390, TAB, "table").form, "table")
		assert.equal(layoutPhoneLandscape(844, 390, TAB, "table").auto, "hand")
	})

	it("the Remote may turn toward the picture until its top corner is 3 px from the picture's edge", () => {
		for (const [w, h] of sizes) {
			const L = layoutPhoneLandscape(w, h, TAB)
			const at = `${w} x ${h}`
			const { rig } = L
			assert.equal(rig.tv, "left")
			assert.ok(
				rig.swing > 0 && rig.swing <= (L.form === "hand" ? 22 : 3.5),
				at,
			)
			// Turned as far as it may, the corner on the TV's side is still right of the picture.
			const turn = (rig.swing * Math.PI) / 180
			const corner =
				rig.x - (rig.half * Math.cos(turn) + rig.arm * Math.sin(turn))
			assert.ok(corner >= L.tv.left + L.tv.width + 3 - 1e-6, at)
			// It turns by the angle to the spot's share of a quarter turn.
			near(rig.turn * 90, rig.swing, 1e-9, at)
			// The grip is the Remote's middle across, under its keys when held and at half their height when lying.
			near(rig.x, L.remote.left + L.remote.width / 2, 1e-9, at)
			assert.ok(
				L.form === "hand" ? rig.y > L.remote.keysEnd : rig.y < L.remote.keysEnd,
				at,
			)
		}
	})

	it("held, it has 18 to 22 degrees to turn by on the phones measured", () => {
		for (const [w, h] of [
			[844, 390],
			[932, 430],
			[915, 412],
		]) {
			const { rig } = layoutPhoneLandscape(w, h, TAB)
			assert.ok(rig.swing >= 18 && rig.swing <= 22, `${w} x ${h}: ${rig.swing}`)
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
