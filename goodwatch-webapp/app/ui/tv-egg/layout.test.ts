import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { REMOTE_H, REMOTE_W } from "../living-room/tv/room-layout.ts"
import { DOCK_H, layoutEgg } from "./layout.ts"

const SIZES: [number, number][] = [
	[1366, 616],
	[1440, 836],
	[1920, 1016],
	[2560, 1376],
	[3440, 1376],
	[1024, 704],
]

describe("layoutEgg on a desktop", () => {
	for (const [w, h] of SIZES) {
		it(`covers a ${w}x${h} scene with the room photo`, () => {
			const { photo } = layoutEgg(w, h)
			assert.ok(photo.left <= 0.5 && photo.top <= 0.5)
			assert.ok(photo.left + photo.width >= w - 0.5)
			assert.ok(photo.top + photo.height >= h - 0.5)
		})

		it(`keeps the TV centred and the room around it at ${w}x${h}`, () => {
			const { tv } = layoutEgg(w, h)
			assert.ok(Math.abs(tv.left + tv.width / 2 - w / 2) < 0.01)
			assert.ok(tv.top > 0)
			assert.ok(tv.width < w * 0.7)
		})

		it(`shows the Remote's keys inside a ${w}x${h} scene`, () => {
			const { remote } = layoutEgg(w, h)
			const dock = w < 1024 ? DOCK_H : 0
			assert.ok(remote.top + 530 * remote.scale <= h - dock)
			assert.ok(Math.abs(remote.left + (REMOTE_W * remote.scale) / 2 - w / 2) < 0.01)
		})
	}

	it("shows the whole Remote where no bottom bar covers it", () => {
		const { remote } = layoutEgg(1440, 836)
		assert.ok(remote.top + REMOTE_H * remote.scale <= 836)
	})
})

describe("layoutEgg on a phone or an upright tablet", () => {
	it("takes the portrait room for a window taller than wide", () => {
		const { tv, phone } = layoutEgg(900, 1100)
		assert.equal(phone, true)
		assert.ok(tv.width < 900 * 0.7)
	})

	it("puts the TV at the top and the Remote's keys above the bottom bar", () => {
		const { tv, remote, phone } = layoutEgg(390, 780)
		assert.equal(phone, true)
		assert.ok(tv.top < 100)
		assert.ok(remote.top > tv.top + tv.height)
		assert.ok(remote.top + 530 * remote.scale <= 780 - DOCK_H)
	})
})

describe("layoutEgg on a short window", () => {
	for (const [w, h] of [
		[667, 311],
		[844, 326],
		[932, 366],
	]) {
		it(`grows the ${w}x${h} scene so the Remote's keys are above the bottom bar`, () => {
			const { remote, height } = layoutEgg(w, h)
			assert.ok(height >= h)
			assert.ok(remote.top + 530 * remote.scale <= height - DOCK_H)
		})
	}
})
