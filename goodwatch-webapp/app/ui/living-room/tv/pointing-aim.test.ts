// Where the Remote aims, against what the approved prototype measured in the browser
// (docs/prototypes/tv-screen-design/README.md on prototype/tv-screen-flow, "Pointing the Remote at the screen"
// and "Proof"), and for the phone in landscape, which the prototype did not have, against the owner's decision:
// the Remote turns toward the spot and never crosses the picture.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	AIM_PAD,
	AROUND,
	type AimScene,
	DRAG,
	FLAT,
	LIFT,
	LIFT_MS,
	REST,
	SWING,
	type Spot,
	aimFor,
	aimTransform,
	liftAt,
	ringFor,
} from "./pointing-aim.ts"
import {
	type PhoneRig,
	REMOTE_H,
	REMOTE_W,
	type Rect,
	layoutPhoneLandscape,
	layoutPhoneRoom,
	layoutRoom,
} from "./room-layout.ts"

const at = (x: number, y: number, tap = false): Spot => ({
	x,
	y,
	here: true,
	tap,
})

/** The desktop's scene, as the room hands it to pointing (TvRoom.tsx). */
function desktop(w: number, h: number, live = true): AimScene {
	const L = layoutRoom(w, h)
	return {
		tv: L.tv,
		width: w,
		height: h,
		live,
		hand: { ...L.remote, place: L.place },
		rig: null,
	}
}
const phone = (
	L: { tv: Rect; rig: PhoneRig; w: number; h: number },
	live = true,
): AimScene => ({
	tv: L.tv,
	width: L.w,
	height: L.h,
	live,
	hand: null,
	rig: L.rig,
})

/** The farthest spots the Remote still aims at, a pixel inside the picture's corners: top left, top right, bottom
 * left, bottom right. */
const corners = ({ tv }: AimScene) => {
	const pad = AIM_PAD - 1
	const [l, t] = [tv.left - pad, tv.top - pad]
	const [r, b] = [tv.left + tv.width + pad, tv.top + tv.height + pad]
	return [
		[l, t],
		[r, t],
		[l, b],
		[r, b],
	].map(([x, y]) => at(x, y))
}

describe("the Remote in the hand, under the TV", () => {
	// 1920 x 1080 without the site's header and the scrollbar's gutter.
	const scene = desktop(1905, 1016)

	it("is under the TV there", () => {
		assert.equal(scene.hand?.place, "below")
	})

	it("swings far toward each corner, and no further than 42 degrees", () => {
		const [tl, tr, bl, br] = corners(scene).map((c) => aimFor(scene, c, false))
		assert.ok(tl.rz < -30 && bl.rz < -30, `left: ${tl.rz}, ${bl.rz}`)
		assert.ok(tr.rz > 30 && br.rz > 30, `right: ${tr.rz}, ${br.rz}`)
		for (const a of [tl, tr, bl, br]) assert.ok(Math.abs(a.rz) <= SWING.below)
	})

	it("leans back further for the top corners than for the bottom ones", () => {
		const [tl, tr, bl, br] = corners(scene).map((c) => aimFor(scene, c, false))
		assert.ok(tl.rx > bl.rx + 1 && tr.rx > br.rx + 1)
	})

	it("rolls and moves toward the cursor's side, and lifts as it turns", () => {
		const { tv } = scene
		const y = tv.top + tv.height * 0.3
		const left = aimFor(scene, at(tv.left + tv.width * 0.05, y), false)
		const right = aimFor(scene, at(tv.left + tv.width * 0.95, y), false)
		assert.ok(left.ry < 0 && left.tx < 0 && right.ry > 0 && right.tx > 0)
		// The streaming key on the far side would dip: the hand lifts the Remote.
		assert.ok(left.ty < 0 && right.ty < 0)
	})

	it("settles at rest over its own keys, so they are hit where they are drawn", () => {
		const hand = scene.hand
		assert.ok(hand)
		const over = at(
			hand.left + (REMOTE_W * hand.scale) / 2,
			hand.top + REMOTE_H * hand.scale * 0.3,
		)
		assert.equal(aimFor(scene, over, false), REST)
		// A finger that landed on the picture where the Remote's top reaches over it still points.
		assert.notEqual(aimFor(scene, { ...over, tap: true }, false), REST)
	})

	it("aims only while the cursor is over the picture, and rests a pixel outside any edge", () => {
		const { tv } = scene
		const [l, t, r, b] = [tv.left, tv.top, tv.left + tv.width, tv.top + tv.height]
		const [mx, my] = [l + tv.width / 2, t + tv.height / 2]
		assert.equal(AIM_PAD, 0)
		// Just inside each edge: it aims. The bottom edge is tried off centre: in the middle the Remote's own top
		// reaches over the picture, and over the Remote it rests (the test before this one).
		for (const [x, y] of [[l + 1, my], [r - 1, my], [mx, t + 1], [l + 60, b - 1]])
			assert.notEqual(aimFor(scene, at(x, y), false), REST, `inside at ${x},${y}`)
		// 1, 10 and 39 px outside each edge: it rests.
		for (const d of [1, 10, 39])
			for (const [x, y] of [[l - d, my], [r + d, my], [mx, t - d], [mx, b + d]])
				assert.equal(aimFor(scene, at(x, y), false), REST, `${d} px outside at ${x},${y}`)
	})

	it("is at rest once the cursor left, while the TV is off, and with reduced motion", () => {
		const spot = at(scene.tv.left + 100, scene.tv.top + 100)
		assert.equal(aimFor(scene, { ...spot, here: false }, false), REST)
		assert.equal(aimFor(desktop(1905, 1016, false), spot, false), REST)
		assert.equal(aimFor(scene, spot, true), REST)
		assert.notEqual(aimFor(scene, spot, false), REST)
	})

	it("at rest its transform is the room's own: 12 degrees back, nothing else", () => {
		assert.equal(
			aimTransform(REST),
			"translate3d(0.0px, 0.0px, 0) perspective(1400px) rotateZ(0.00deg) rotateX(12.00deg) rotateY(0.00deg)",
		)
	})
})

describe("the Remote in the hand, beside the TV", () => {
	// 1440 x 800, where the Remote stands beside the TV.
	const scene = desktop(1425, 736)

	it("is beside the TV there", () => {
		assert.equal(scene.hand?.place, "beside")
	})

	it("nods toward the picture on its left, further for its far corners, 13 degrees at most", () => {
		const [tl, tr, bl, br] = corners(scene).map((c) => aimFor(scene, c, false))
		assert.ok(tl.rz < -8 && bl.rz < -8, `left: ${tl.rz}, ${bl.rz}`)
		assert.ok(tl.rz < tr.rz && bl.rz <= br.rz, `right: ${tr.rz}, ${br.rz}`)
		for (const a of [tl, tr, bl, br])
			assert.ok(Math.abs(a.rz) <= SWING.beside + 1e-9)
	})

	it("rolls more instead of turning: up to 26 degrees", () => {
		const [tl] = corners(scene).map((c) => aimFor(scene, c, false))
		assert.ok(tl.ry < -16 && tl.ry >= -26)
	})
})

describe("the phone's Remote under the TV", () => {
	const held = layoutPhoneRoom(390, 708, 60)
	const lying = layoutPhoneRoom(375, 531, 60)
	const spots = (tv: Rect) => {
		const out: Spot[] = []
		for (let x = tv.left; x <= tv.left + tv.width; x += tv.width / 12)
			for (let y = tv.top; y <= tv.top + tv.height; y += tv.height / 8)
				out.push(at(x, y, true))
		return out
	}

	it("is held at 390 x 844 and lies on the table at 375 x 667", () => {
		assert.equal(held.form, "hand")
		assert.equal(lying.form, "table")
	})

	it("held, it turns 11 degrees at most, leans back up to 11 and slides up to 8 px", () => {
		const scene = phone(held)
		let most = 0
		for (const spot of spots(held.tv)) {
			const a = aimFor(scene, spot, false)
			assert.ok(Math.abs(a.rz) <= 11 && a.rx > 3 && a.rx <= 11)
			assert.ok(Math.abs(a.tx) <= 8)
			most = Math.max(most, Math.abs(a.rz))
		}
		assert.equal(most, 11)
		// Further back for a spot higher up.
		const { tv } = held
		const top = aimFor(scene, at(tv.left + tv.width / 2, tv.top + 4), false)
		const low = aimFor(
			scene,
			at(tv.left + tv.width / 2, tv.top + tv.height - 4),
			false,
		)
		assert.ok(top.rx > low.rx)
		// Toward the spot's side.
		const left = aimFor(scene, at(tv.left + 10, tv.top + 100), false)
		assert.ok(left.rz < 0 && left.ry < 0 && left.tx < 0)
	})

	it("lying, it turns 3.5 degrees at most and does not lean", () => {
		const scene = phone(lying)
		for (const spot of spots(lying.tv)) {
			const a = aimFor(scene, spot, false)
			assert.ok(Math.abs(a.rz) <= 3.5 && Math.abs(a.tx) <= 6)
			assert.equal(a.rx, 0)
			assert.equal(Math.abs(a.ry), 0)
		}
	})

	it("turned, its leading corner never rises into the TV: the hand lowers it by as much", () => {
		for (const L of [
			held,
			lying,
			layoutPhoneRoom(360, 604, 60),
			layoutPhoneRoom(430, 796, 60),
			layoutPhoneRoom(390, 564, 60),
		]) {
			const scene = phone(L)
			for (const spot of spots(L.tv)) {
				const a = aimFor(scene, spot, false)
				const turn = (Math.abs(a.rz) * Math.PI) / 180
				const rise =
					L.rig.half * Math.sin(turn) - L.rig.arm * (1 - Math.cos(turn))
				assert.ok(rise - a.ty <= L.rig.clear + 1e-9, `${L.w} x ${L.h}`)
				assert.ok(a.ty >= 0)
			}
		}
	})

	it("aims only at the picture: its own keys are found where they are drawn", () => {
		const scene = phone(held)
		const keys = at(held.rig.x, held.remote.top + 60, true)
		assert.equal(aimFor(scene, keys, false), FLAT)
		assert.equal(
			aimFor(scene, at(195, held.tv.top + held.tv.height + AROUND + 1), false),
			FLAT,
		)
		assert.notEqual(aimFor(scene, at(195, held.tv.top + 100), false), FLAT)
	})

	it("is flat while the TV is off, once the finger is gone, and with reduced motion", () => {
		const spot = at(100, held.tv.top + 100, true)
		assert.equal(aimFor(phone(held, false), spot, false), FLAT)
		assert.equal(aimFor(phone(held), { ...spot, here: false }, false), FLAT)
		assert.equal(aimFor(phone(held), spot, true), FLAT)
	})
})

describe("the phone's Remote beside the TV, in landscape", () => {
	const TAB = { tv: 0, remote: 46 }
	const BAR = { tv: 60, remote: 60 }
	const layouts = [
		layoutPhoneLandscape(844, 390, TAB),
		layoutPhoneLandscape(932, 430, TAB),
		layoutPhoneLandscape(915, 412, TAB),
		layoutPhoneLandscape(667, 375, BAR),
		layoutPhoneLandscape(1100, 500, TAB),
		// Too short to hold it: it lies on the table.
		layoutPhoneLandscape(844, 281, TAB),
	]
	const spots = (tv: Rect) => {
		const out: Spot[] = []
		for (let i = 0; i <= 16; i++)
			for (let j = 0; j <= 12; j++)
				out.push(
					at(
						tv.left + (tv.width * i) / 16,
						tv.top + (tv.height * j) / 12,
						true,
					),
				)
		return out
	}
	/** Where a point of the Remote is once it has turned: `out` left of the grip and `up` above it at rest. */
	const turned = (rig: PhoneRig, out: number, up: number, deg: number) => {
		const t = (Math.abs(deg) * Math.PI) / 180
		return {
			x: rig.x - (out * Math.cos(t) + up * Math.sin(t)),
			y: rig.y - (up * Math.cos(t) - out * Math.sin(t)),
		}
	}

	it("turns toward the picture on its left, for every spot on it", () => {
		for (const L of layouts)
			for (const spot of spots(L.tv)) {
				const a = aimFor(phone(L), spot, false)
				assert.ok(a.rz < 0, `${L.w} x ${L.h}: ${a.rz}`)
				assert.ok(a.rz >= -L.rig.swing - 1e-9)
				assert.equal(a.tx, 0)
			}
	})

	it("its top corner never crosses the picture's edge, wherever it points", () => {
		for (const L of layouts) {
			const edge = L.tv.left + L.tv.width
			for (const spot of spots(L.tv)) {
				const a = aimFor(phone(L), spot, false)
				const corner = turned(L.rig, L.rig.half, L.rig.arm, a.rz)
				assert.ok(
					corner.x >= edge + 3 - 1e-6,
					`${L.w} x ${L.h}: ${corner.x} against ${edge}`,
				)
			}
		}
	})

	it("held, it has about 20 degrees to turn by, and uses them", () => {
		for (const L of layouts.filter((l) => l.form === "hand")) {
			assert.ok(L.rig.swing >= 18 && L.rig.swing <= 22, `${L.rig.swing}`)
			const { tv } = L
			// A spot level with the grip is a quarter turn away: as far as it goes.
			const low = aimFor(phone(L), at(tv.left + 20, L.rig.y - 20), false)
			assert.ok(-low.rz > L.rig.swing * 0.9, `${low.rz}`)
			// The picture's top right corner is the nearest to straight up: less than half of it.
			const high = aimFor(phone(L), at(tv.left + tv.width, tv.top), false)
			assert.ok(-high.rz < L.rig.swing * 0.5 && -high.rz > 3, `${high.rz}`)
		}
	})

	it("turns further for a spot further left and for one lower down", () => {
		const L = layouts[0]
		const { tv } = L
		const row = [0.9, 0.6, 0.3, 0.05].map(
			(x) =>
				-aimFor(phone(L), at(tv.left + tv.width * x, tv.top + 120), false).rz,
		)
		const column = [0.1, 0.4, 0.7, 0.95].map(
			(y) =>
				-aimFor(phone(L), at(tv.left + 250, tv.top + tv.height * y), false).rz,
		)
		for (const run of [row, column])
			for (let i = 1; i < run.length; i++)
				assert.ok(run[i] > run[i - 1], JSON.stringify(run))
	})

	it("leans back further for a spot higher up and rolls toward the TV for one further left", () => {
		const L = layouts[0]
		const { tv } = L
		const scene = phone(L)
		const high = aimFor(scene, at(tv.left + 250, tv.top + 10), false)
		const low = aimFor(scene, at(tv.left + 250, tv.top + tv.height - 10), false)
		assert.ok(high.rx > low.rx + 2 && high.rx <= 11 && low.rx > 3)
		const far = aimFor(scene, at(tv.left + 10, tv.top + 150), false)
		const near = aimFor(scene, at(tv.left + tv.width - 10, tv.top + 150), false)
		assert.ok(far.ry < near.ry - 2 && near.ry < 0 && far.ry >= -11 * 0.9)
	})

	it("lifts a little for a spot high up, and its turned corner stays inside the scene", () => {
		for (const L of layouts)
			for (const spot of spots(L.tv)) {
				const a = aimFor(phone(L), spot, false)
				assert.ok(a.ty >= -L.rig.slide - 1e-9)
				const corner = turned(L.rig, L.rig.half, L.rig.arm, a.rz)
				assert.ok(corner.y + a.ty >= 3 - 1e-6, `${L.w} x ${L.h}: ${corner.y}`)
			}
	})

	it("lying, it only shifts on the table: 3.5 degrees at most, no lean", () => {
		const L = layouts.at(-1)
		assert.ok(L)
		assert.equal(L.form, "table")
		for (const spot of spots(L.tv)) {
			const a = aimFor(phone(L), spot, false)
			assert.ok(-a.rz <= 3.5)
			assert.equal(a.rx, 0)
			assert.equal(Math.abs(a.ry), 0)
		}
	})

	it("rests flat off the picture, while the TV is off, and with reduced motion", () => {
		const L = layouts[0]
		const spot = at(L.tv.left + 200, L.tv.top + 200, true)
		assert.equal(aimFor(phone(L), at(L.rig.x, L.remote.top + 80), false), FLAT)
		assert.equal(aimFor(phone(L, false), spot, false), FLAT)
		assert.equal(aimFor(phone(L), spot, true), FLAT)
		assert.notEqual(aimFor(phone(L), spot, false), FLAT)
	})
})

describe("the ring over a finger", () => {
	const tv: Rect = { left: 14, top: 13, width: 362, height: 302 }

	it("stays under a finger that has moved 10 px or less", () => {
		assert.equal(DRAG, 10)
		assert.deepEqual(ringFor({ x: 100, y: 200 }, tv, 0), {
			x: 100,
			y: 200,
			on: true,
		})
	})

	it("steps out 46 px above a dragging finger, over 0.22 s, and at once with reduced motion", () => {
		assert.equal(liftAt(0, false), 0)
		assert.ok(liftAt(LIFT_MS / 2, false) > LIFT / 2)
		assert.equal(liftAt(LIFT_MS, false), LIFT)
		assert.equal(liftAt(5000, false), LIFT)
		assert.equal(liftAt(0, true), LIFT)
		assert.equal(LIFT, 46)
		assert.deepEqual(ringFor({ x: 100, y: 200 }, tv, LIFT), {
			x: 100,
			y: 154,
			on: true,
		})
	})

	it("cannot leave the picture", () => {
		const ring = ringFor({ x: 5, y: 20 }, tv, LIFT)
		assert.deepEqual(ring, { x: 18, y: 17, on: true })
		const right = ringFor({ x: 390, y: 380 }, tv, LIFT)
		assert.deepEqual(right, { x: 372, y: 311, on: true })
	})

	it("points at nothing once the finger has left the picture by more than 24 px", () => {
		assert.equal(ringFor({ x: 100, y: tv.top - 25 }, tv, LIFT).on, false)
		assert.equal(ringFor({ x: 14 + 362 + 25, y: 100 }, tv, LIFT).on, false)
		// Under the picture the finger may be as far as the ring stands above it.
		assert.equal(
			ringFor({ x: 100, y: 13 + 302 + LIFT + 24 }, tv, LIFT).on,
			true,
		)
		assert.equal(
			ringFor({ x: 100, y: 13 + 302 + LIFT + 25 }, tv, LIFT).on,
			false,
		)
	})
})
