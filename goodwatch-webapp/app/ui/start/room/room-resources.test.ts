// Render the actual image and head descriptors: a mismatch would fetch a second, unused LCP image.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { statSync } from "node:fs"
import { test } from "node:test"
import {
	NOT_UPRIGHT_PHONE,
	UPRIGHT_PHONE,
} from "../../../utils/upright-phone.ts"
import { stageLayout } from "../stage/placement.ts"
import { START_ROOM, START_ROOM_PHONE } from "./scene.ts"

type Preload = {
	media: string
	imageSrcSet: string
	imageSizes: string
	type: string
	as: string
	href?: string
	crossOrigin?: string
	fetchpriority: string
}
const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/room/room-resources.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__ROOM_RESOURCES__")
		.at(-1) ?? "",
) as Record<string, { html: string; preloads: Preload[] }>

const attr = (tag: string, name: string) =>
	new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1]

test("head preloads match the picture's AVIF candidates, widths, orientation and request mode", () => {
	for (const [host, { html, preloads }] of Object.entries(rendered)) {
		const sources = [...html.matchAll(/<source type="image\/avif"[^>]+>/g)].map(
			([tag]) => tag,
		)
		const images = [...html.matchAll(/<img[^>]+>/g)].map(([tag]) => tag)
		assert.equal(preloads.length, 2)
		assert.equal(sources.length, 2)
		assert.deepEqual(
			preloads.map((p) => p.media),
			[NOT_UPRIGHT_PHONE, UPRIGHT_PHONE],
		)
		for (const [i, preload] of preloads.entries()) {
			assert.equal(preload.imageSrcSet, attr(sources[i], "srcSet"))
			assert.equal(preload.imageSizes, attr(sources[i], "sizes"))
			assert.equal(preload.imageSizes, attr(images[i], "sizes"))
			assert.equal(
				preload.href,
				undefined,
				"no fixed fallback preload to race responsive selection",
			)
			assert.equal(
				preload.type,
				"image/avif",
				"only the preferred format preloads",
			)
			assert.equal(preload.as, "image")
			assert.equal(preload.fetchpriority, "high")
			assert.equal(attr(images[i], "fetchpriority"), "high")
			assert.equal(attr(images[i], "elementtiming"), "hero")
			assert.equal(
				preload.crossOrigin,
				host === "static" ? "anonymous" : undefined,
			)
			assert.equal(attr(images[i], "crossorigin"), preload.crossOrigin)
			assert.equal(
				preload.imageSrcSet.includes("https://static.example.com/"),
				host === "static",
			)
		}
		assert.match(
			preloads[0].imageSrcSet,
			/800\.avif 800w, .*1280\.avif 1280w, .*1536\.avif 1536w$/,
		)
		assert.match(
			attr(images[0], "srcSet") ?? "",
			/800\.webp 800w, .*1280\.webp 1280w, .*1536\.webp 1536w$/,
		)
	}
})

/** Split sizes at its top-level commas, retaining commas inside clamp(). */
function rules(sizes: string) {
	let depth = 0
	let start = 0
	const out: string[] = []
	for (let i = 0; i < sizes.length; i++) {
		if (sizes[i] === "(") depth++
		if (sizes[i] === ")") depth--
		if (sizes[i] === "," && depth === 0) {
			out.push(sizes.slice(start, i).trim())
			start = i + 1
		}
	}
	return [...out, sizes.slice(start).trim()]
}

function slot(sizes: string, width: number, height: number): number {
	for (const rule of rules(sizes)) {
		const at = rule.indexOf("clamp(")
		const condition = rule.slice(0, at)
		if (
			[...condition.matchAll(/\((min-width|max-height): ([\d.]+)px\)/g)].some(
				([, name, value]) =>
					name === "min-width" ? width < Number(value) : height > Number(value),
			)
		)
			continue
		// Evaluate only the numeric CSS math emitted by the renderer, independently of placement's arithmetic.
		const expression = rule
			.slice(at)
			.replace(/([\d.]+)(px|vw|svh)/g, (_, n, unit) =>
				String(
					Number(n) *
						(unit === "vw" ? width / 100 : unit === "svh" ? height / 100 : 1),
				),
			)
		assert.match(expression, /^[\d.\s()+*/,-clamp]+$/)
		return Function(
			"clamp",
			"calc",
			`return ${expression}`,
		)(
			(lo: number, value: number, hi: number) =>
				Math.min(hi, Math.max(lo, value)),
			(value: number) => value,
		)
	}
	throw new Error("No sizes rule matched")
}

test("responsive sizes follow room placement across height and width breakpoints", () => {
	for (const width of [360, 639, 640, 767, 768, 800, 1023, 1024, 1365, 1920]) {
		for (const height of [360, 540, 541, 768, 820, 821, 900, 1200]) {
			for (const [i, scene] of [START_ROOM, START_ROOM_PHONE].entries()) {
				assert.ok(
					Math.abs(
						slot(rendered.origin.preloads[i].imageSizes, width, height) -
							stageLayout(scene, width, height).img.width,
					) < 0.01,
					`${width}×${height}, scene ${i}`,
				)
			}
		}
	}
	const landscape = rendered.origin.preloads[0].imageSizes
	for (const [width, height, dpr, expected] of [
		[800, 360, 1, 800],
		[1365, 900, 1, 1280],
		[1365, 900, 2, 1536],
		[1920, 1080, 1, 1536],
	]) {
		const needed = slot(landscape, width, height) * dpr
		assert.equal(
			[800, 1280, 1536].find((candidate) => candidate >= needed) ?? 1536,
			expected,
		)
	}
})

test("the largest landscape AVIF stays below 110 KB and smaller candidates save transfer bytes", () => {
	let previous = 0
	for (const width of [800, 1280, 1536]) {
		const bytes = statSync(
			new URL(
				`../../../img/start-room/start-room-${width}.avif`,
				import.meta.url,
			),
		).size
		assert.ok(bytes > previous && bytes < 110_000)
		previous = bytes
	}
})
