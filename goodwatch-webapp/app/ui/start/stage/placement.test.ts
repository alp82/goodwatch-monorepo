// Where the room sits on the start page (placement.ts, start.css).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { UPRIGHT_PHONE } from "../../../utils/upright-phone.ts"
import { START_ROOM, START_ROOM_PHONE } from "../room/scene.ts"
import {
	GAP_CAP,
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

const PROPERTY: Record<
	Exclude<keyof StageSize, "padVh" | "capBand">,
	string
> = {
	pad: "--start-pad",
	block: "--start-block",
	card: "--start-card",
	cardBottom: "--start-card-bottom",
	gapMin: "--start-gap-min",
	airAbove: "--start-air-above",
	airBelow: "--start-air-below",
	nightTop: "--start-night-top",
}

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
			if (key === "capBand") {
				assert.equal(
					rule.get("--start-band-need")?.startsWith(`min( ${GAP_CAP}px,`) ??
						false,
					value,
					bp.media,
				)
				continue
			}
			if (key === "pad" && bp.size.padVh) continue
			assert.equal(
				rule.get(PROPERTY[key as keyof typeof PROPERTY]),
				`${value}px`,
				`${bp.media} ${key}`,
			)
		}
	}
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
]

const sceneFor = (w: number, h: number) =>
	w < 768 && h > w ? START_ROOM_PHONE : START_ROOM
const close = (a: number, b: number, what: string) =>
	assert.ok(Math.abs(a - b) < 0.01, `${what}: ${a} vs ${b}`)

test("at every listed size the picture is as wide as the stage and the focus band is centered in the gap", () => {
	for (const [w, h] of SIZES) {
		const at = `${w}×${h}`
		const layout = stageLayout(sceneFor(w, h), w, h)
		const { size, band, gap, gapTop, img } = layout
		close(img.left, 0, `${at} left`)
		close(img.width, w, `${at} width`)
		// Inside the gap with its air, centered in it.
		assert.ok(
			band.top >= gapTop + size.airAbove - 0.01,
			`${at} band below the block`,
		)
		assert.ok(
			band.top + band.height <= gapTop + gap - size.airBelow + 0.01,
			`${at} band above the card`,
		)
		close(
			band.top - (gapTop + size.airAbove),
			gapTop + gap - size.airBelow - (band.top + band.height),
			`${at} centered`,
		)
		// The gap takes spare height up to the cap, and is never shorter than the band needs.
		assert.ok(
			gap <=
				Math.max(GAP_CAP, band.height + size.airAbove + size.airBelow) + 0.01,
			`${at} gap cap`,
		)
		assert.ok(gap >= size.gapMin, `${at} gap min`)
		// The picture covers the gap: no night shows behind the sofa.
		assert.ok(
			img.top <= gapTop && img.top + img.height >= gapTop + gap,
			`${at} picture behind the gap`,
		)
	}
})

test("the gap grows into spare height up to the cap, and the column fills the screen", () => {
	const tall = stageLayout(START_ROOM, 1920, 1400)
	assert.equal(tall.gap, GAP_CAP)
	assert.equal(tall.height, 1400 - 64)
	const short = stageLayout(START_ROOM, 1280, 700)
	// No spare height: the gap is the band's need, and the column runs below the fold.
	close(
		short.gap,
		Math.max(100, sceneVars(START_ROOM).band * 1280 + 20),
		"short gap",
	)
	assert.ok(short.height > 700 - 64)
})

test("past the cap the picture zooms out around the focus, and never zooms in", () => {
	const wide = stageLayout(START_ROOM, 3400, 1100)
	assert.ok(wide.img.width < 3400)
	close(
		wide.band.height,
		wide.gap - wide.size.airAbove - wide.size.airBelow,
		"band fills the room",
	)
	const [fx, , fw] = START_ROOM.focus
	close(
		wide.img.left + wide.img.width * (fx + fw / 2),
		1700,
		"focus centered across",
	)
	for (const [w, h] of [
		...SIZES,
		[3400, 1100] as [number, number],
		[2560, 1440] as [number, number],
	])
		assert.ok(
			stageLayout(sceneFor(w, h), w, h).img.width <= w + 0.01,
			`${w}×${h} no zoom in`,
		)
})

test("the breakpoints pick the short desktop and the large screen's sizes", () => {
	assert.equal(stageLayout(START_ROOM, 1280, 800).size.block, 249)
	assert.equal(stageLayout(START_ROOM, 1440, 900).size.block, 281)
	assert.equal(stageLayout(START_ROOM, 1440, 900).pad, 27)
	assert.equal(stageLayout(START_ROOM, 1920, 1080).size.card, 436)
	assert.equal(stageLayout(START_ROOM_PHONE, 375, 740).size.card, 306)
})
