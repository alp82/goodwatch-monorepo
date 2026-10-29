// Where the room sits on the start page (placement.ts, start.css).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { UPRIGHT_PHONE } from "../../../utils/upright-phone.ts"
import { START_ROOM, START_ROOM_PHONE } from "../room/scene.ts"
import {
	CARD_AIR,
	DOCK,
	HEADER,
	LEDGE_MAX,
	PICTURE_MAX,
	PICTURE_MIN,
	STAGE_SIZES,
	type StageSize,
	sceneStyle,
	sceneVars,
	stageLayout,
} from "./placement.ts"

const css = readFileSync(new URL("../start.css", import.meta.url), "utf8")

/** The declarations of the first `.start-stage { … }` rule at the top level (media "") or in `@media <media> { … }`. */
function stageRule(media: string): Map<string, string> {
	let body: string | undefined
	if (!media) body = /^\.start-stage \{([\s\S]*?)\n\}/m.exec(css)?.[1]
	else {
		const at = mediaAt(media)
		assert.ok(at, `start.css has @media ${media}`)
		body = /^\s*\.start-stage \{([\s\S]*?)\n\t\}/.exec(css.slice(at.end))?.[1]
	}
	assert.ok(body, `a .start-stage rule for "${media}"`)
	const out = new Map<string, string>()
	for (const [, name, value] of body.matchAll(/(--start-[\w-]+):\s*([^;]+);/g))
		out.set(name, value.replace(/\s+/g, " ").trim())
	return out
}

/** Where `@media <media> {` ends in start.css, however the query's lines are broken. */
function mediaAt(media: string): { end: number } | null {
	const pattern = media
		.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		.replace(/,\s*/g, ",\\s*")
		.replace(/ /g, "\\s+")
	const match = new RegExp(`@media\\s+${pattern}\\s*\\{`).exec(css)
	return match ? { end: match.index + match[0].length } : null
}

const PROPERTY: Record<"pad" | "block" | "card", string> = {
	pad: "--start-pad",
	block: "--start-block",
	card: "--start-card-want",
}

const vhClamp = ({ min, vh, offset, max }: StageSize["headroom"]) =>
	offset
		? `clamp(${min}px, calc(${vh}svh - ${-offset}px), ${max}px)`
		: `clamp(${min}px, ${vh}svh, ${max}px)`

test("start.css has STAGE_SIZES's values at every breakpoint", () => {
	for (const bp of STAGE_SIZES) {
		const rule = stageRule(bp.media)
		for (const [key, value] of Object.entries(bp.size)) {
			if (key === "padVh") {
				if (value) {
					const { min, vh, max } = value as NonNullable<StageSize["padVh"]>
					assert.equal(
						rule.get("--start-pad"),
						`clamp(${min}px, ${vh}vh, ${max}px)`,
						bp.media,
					)
				}
				continue
			}
			if (key === "pad" && bp.size.padVh) continue
			if (key === "headroom") {
				assert.equal(
					rule.get("--start-headroom"),
					vhClamp(value as StageSize["headroom"]),
					bp.media,
				)
				continue
			}
			if (key === "dock") continue
			if (key === "foot") {
				assert.equal(
					rule.get("--start-foot"),
					bp.size.dock
						? `calc(var(--nav-dock-height, ${DOCK}px) + ${(value as number) - DOCK}px)`
						: `${value}px`,
					bp.media,
				)
				continue
			}
			assert.equal(
				rule.get(PROPERTY[key as keyof typeof PROPERTY]),
				`${value}px`,
				`${bp.media} ${key}`,
			)
		}
	}
})

test("start.css has stageLayout's limits: the picture's zoom and the open card's air", () => {
	const base = stageRule("")
	assert.equal(
		base.get("--start-img-w"),
		`clamp(${Math.round(PICTURE_MIN * 100)}cqw, calc(var(--start-fit) / var(--start-hw)), ${Math.round(PICTURE_MAX * 100)}cqw)`,
	)
	assert.match(base.get("--start-card") ?? "", new RegExp(`- ${CARD_AIR}px -`))
	assert.match(
		base.get("--start-ledge") ?? "",
		new RegExp(`var\\(--start-card\\) \\* ${LEDGE_MAX}\\)`),
	)
})

test("start.css draws the phone's painting by the shared upright phone query", () => {
	assert.ok(mediaAt(UPRIGHT_PHONE))
	const rule = stageRule(UPRIGHT_PHONE)
	for (const key of Object.keys(sceneVars(START_ROOM_PHONE)))
		assert.equal(rule.get(`--start-${key}`), `var(--start-phone-${key})`)
	const base = stageRule("")
	for (const key of Object.keys(sceneVars(START_ROOM)))
		assert.equal(base.get(`--start-${key}`), `var(--start-landscape-${key})`)
	assert.deepEqual(
		Object.keys(sceneStyle(START_ROOM, START_ROOM_PHONE)).sort(),
		[
			...Object.keys(sceneVars(START_ROOM)).map(
				(key) => `--start-landscape-${key}`,
			),
			...Object.keys(sceneVars(START_ROOM)).map(
				(key) => `--start-phone-${key}`,
			),
		].sort(),
	)
})

const SIZES: [number, number][] = [
	[375, 740],
	[390, 844],
	[768, 1024],
	[1280, 800],
	[1440, 900],
	[1920, 1080],
	[2560, 1440],
]

const sceneFor = (w: number, h: number) =>
	w < 768 && h > w ? START_ROOM_PHONE : START_ROOM
const close = (a: number, b: number, what: string) =>
	assert.ok(Math.abs(a - b) < 0.01, `${what}: ${a} vs ${b}`)

test("the waiting search block ends over the window's middle, and the ledge stands on the floor in front of the sofa", () => {
	for (const [w, h] of SIZES) {
		const at = `${w}×${h}`
		const scene = sceneFor(w, h)
		const { size, img, block, ledge } = stageLayout(scene, w, h)
		close(
			block.waiting + size.block,
			img.top + img.height * scene.window.middle,
			`${at} block over the window`,
		)
		const { card } = stageLayout(scene, w, h)
		close(
			ledge.top,
			Math.max(
				img.top + img.height * scene.floor.top,
				ledge.bottom - card.height * LEDGE_MAX,
			),
			`${at} ledge top`,
		)
		close(
			ledge.bottom,
			img.top + img.height * scene.floor.bottom,
			`${at} ledge bottom`,
		)
		// The window's top shows above the waiting block's foot, the sofa between it and the ledge.
		assert.ok(
			img.top + img.height * scene.window.top < block.waiting + size.block,
			at,
		)
		assert.ok(ledge.top > block.waiting + size.block, `${at} sofa in view`)
	}
})

test("the picture fits the screen: the ledge ends at the foot unless the zoom is at its limit", () => {
	for (const [w, h] of SIZES) {
		const at = `${w}×${h}`
		const { size, img, ledge } = stageLayout(sceneFor(w, h), w, h)
		const zoom = img.width / w
		assert.ok(
			zoom >= PICTURE_MIN - 0.001 && zoom <= PICTURE_MAX + 0.001,
			`${at} zoom ${zoom}`,
		)
		if (zoom > PICTURE_MIN + 0.001 && zoom < PICTURE_MAX - 0.001)
			close(ledge.bottom, h - HEADER - size.foot, `${at} ledge at the foot`)
		else
			assert.ok(
				ledge.bottom <= h - HEADER - size.foot + 0.01 ||
					zoom <= PICTURE_MIN + 0.001,
				at,
			)
		// Centered on the sofa.
		close(img.left + img.width * sceneFor(w, h).fcx, w / 2, `${at} centered`)
	}
})

test("the open card stands on the ledge's bottom and stops under the lifted block", () => {
	for (const [w, h] of SIZES) {
		const at = `${w}×${h}`
		const { size, block, ledge, card } = stageLayout(sceneFor(w, h), w, h)
		close(card.top + card.height, ledge.bottom, `${at} card on the ledge`)
		assert.ok(card.height <= size.card + 0.01, `${at} no taller than it wants`)
		assert.ok(
			card.top >= block.open + size.block + CARD_AIR - 0.01,
			`${at} card under the block`,
		)
		// The ledge is the card's bottom strip.
		assert.ok(
			ledge.bottom - ledge.top < card.height,
			`${at} ledge inside the card`,
		)
	}
	// A member's card wants more and gets what the space holds.
	const tall = stageLayout(START_ROOM, 1440, 900, { cardWant: 2000 })
	close(
		tall.card.top,
		tall.block.open + tall.size.block + CARD_AIR,
		"a tall card reaches the block",
	)
})

test("the breakpoints pick the phone's, the short desktop's and the large screen's sizes", () => {
	assert.equal(stageLayout(START_ROOM, 1280, 800).size.block, 249)
	assert.equal(stageLayout(START_ROOM, 1280, 800).pad, 20)
	assert.equal(stageLayout(START_ROOM, 1440, 900).size.block, 281)
	assert.equal(stageLayout(START_ROOM, 1440, 900).pad, 27)
	assert.equal(stageLayout(START_ROOM, 1440, 900).headroom, 160)
	assert.equal(stageLayout(START_ROOM, 2560, 1440).headroom, 260)
	assert.equal(stageLayout(START_ROOM_PHONE, 390, 844).size.foot, DOCK + 10)
	assert.equal(stageLayout(START_ROOM_PHONE, 375, 740).size.card, 330)
})
