// The card renderer's child process, started by pool.server.ts.
//
// satori lays a card out as SVG and resvg rasterizes it. Both block their thread and resvg aborts its whole process on
// some inputs, so they run here instead of in the web server.
// Messages in:
// - { fonts: { <set>: [{ name, weight, style, data }] } }: a font set that exists only as bytes in the server bundle.
// - { id, tree, width, height, fontSet, dynamicAssets, outputs }: a job. tree is a card with every component already
//   resolved to plain elements. Each output is { name, format: "png" | "jpeg", width, qualities, maxBytes }. One satori
//   layout serves every output, and one resvg render serves every output of the same width. A JPEG is encoded at each
//   quality in turn until it fits into maxBytes, so a card with a busy photo gets a lower quality instead of a larger
//   file. jpeg-js doesn't subsample color, which keeps dark text on a saturated panel sharp.
//   dynamicAssets lets satori load emoji and fonts for scripts that the bundled fonts don't cover.
// Messages out: { ready: true } once, then { id, images: { <name>: Buffer } } or { id, error } per job. One job at a
// time.
//
// This file is plain JavaScript because the server bundle can't hold a separate entry: vite.config.js copies it
// next to build/server/index.js, and in development it runs from this folder.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import jpeg from "jpeg-js"
import { createElement } from "react"
import satori from "satori"
const { fontDir, fonts: fontList } = JSON.parse(process.argv[2])
const share = fontList.map((f) => ({
	name: f.name,
	weight: f.weight,
	style: f.style,
	data: readFileSync(join(fontDir, f.file)),
}))
const toElement = (node) => {
	if (node === null || typeof node !== "object") return node
	if (Array.isArray(node)) return node.map(toElement)
	const { children, ...props } = node.props
	return createElement(
		node.type,
		props,
		...(Array.isArray(children) ? children : [children]).map(toElement),
	)
}
const fontSets = { share }
const FETCH_TIMEOUT_MS = 5000
// Emoji come from Twemoji. When the fetch fails, the emoji is left out.
const emojiCache = new Map()
const loadEmoji = (segment) => {
	const code = [...segment]
		.map((c) => c.codePointAt(0)?.toString(16))
		.filter((c) => c !== "fe0f")
		.join("-")
	let emoji = emojiCache.get(code)
	if (!emoji) {
		emoji = fetch(
			`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg`,
			{
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			},
		)
			.then(async (response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				return `data:image/svg+xml;base64,${Buffer.from(await response.text()).toString("base64")}`
			})
			.catch(() => {
				emojiCache.delete(code)
				return ""
			})
		if (emojiCache.size >= 500)
			emojiCache.delete(emojiCache.keys().next().value)
		emojiCache.set(code, emoji)
	}
	return emoji
}
// The bundled fonts only cover Latin script. For any other script, satori asks for more
// glyphs, and we fetch a Google Fonts subset that holds just the characters it needs.
// Heavy weights keep the fallback close to Anton and Gabarito Black.
const FALLBACK_FONTS = {
	"ja-JP": [{ family: "Noto Sans JP", weight: 900 }],
	"ko-KR": [{ family: "Noto Sans KR", weight: 900 }],
	"zh-CN": [{ family: "Noto Sans SC", weight: 900 }],
	"zh-TW": [{ family: "Noto Sans TC", weight: 900 }],
	"zh-HK": [{ family: "Noto Sans HK", weight: 900 }],
	"th-TH": [{ family: "Noto Sans Thai", weight: 900 }],
	"ar-AR": [{ family: "Noto Sans Arabic", weight: 900 }],
	"he-IL": [{ family: "Noto Sans Hebrew", weight: 900 }],
	"bn-IN": [{ family: "Noto Sans Bengali", weight: 900 }],
	"ta-IN": [{ family: "Noto Sans Tamil", weight: 900 }],
	"te-IN": [{ family: "Noto Sans Telugu", weight: 900 }],
	"ml-IN": [{ family: "Noto Sans Malayalam", weight: 900 }],
	devanagari: [{ family: "Noto Sans Devanagari", weight: 900 }],
	kannada: [{ family: "Noto Sans Kannada", weight: 900 }],
	// Cyrillic, Greek, and anything else: Oswald is condensed like Anton, Noto Sans fills gaps.
	unknown: [
		{ family: "Oswald", weight: 700 },
		{ family: "Noto Sans", weight: 900 },
	],
}
const FALLBACK_CACHE_MAX = 500
const fallbackCache = new Map()
const loadFallbackFont = (family, weight, text) => {
	const key = `${family}:${weight}:${text}`
	let font = fallbackCache.get(key)
	if (!font) {
		const css = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`
		const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
		// An old user agent makes Google Fonts answer with TrueType, which satori can read.
		font = fetch(css, { signal, headers: { "User-Agent": "Mozilla/4.0" } })
			.then((response) => (response.ok ? response.text() : ""))
			.then(async (stylesheet) => {
				const url = stylesheet.match(/src: url\((.+?)\)/)?.[1]
				if (!url) return null
				const response = await fetch(url, { signal })
				if (!response.ok) return null
				return {
					name: family,
					data: await response.arrayBuffer(),
					weight: weight,
					style: "normal",
				}
			})
			.catch(() => null)
			.then((loaded) => {
				if (!loaded) fallbackCache.delete(key)
				return loaded
			})
		if (fallbackCache.size >= FALLBACK_CACHE_MAX) {
			const oldest = fallbackCache.keys().next().value
			if (oldest) fallbackCache.delete(oldest)
		}
		fallbackCache.set(key, font)
	}
	return font
}
// Han characters come with every language that uses them ("ja-JP|zh-CN|zh-TW|zh-HK").
// Simplified Chinese covers the most of them, Japanese fills in the rest.
const fallbackCandidates = (code) => {
	const codes = code.split("|")
	const ordered = [
		...codes.filter((c) => c !== "ja-JP"),
		...codes.filter((c) => c === "ja-JP"),
	]
	const families = ordered.flatMap((c) => FALLBACK_FONTS[c] ?? [])
	const unique = families.filter(
		(f, i) => families.findIndex((g) => g.family === f.family) === i,
	)
	return unique.length ? unique.slice(0, 2) : FALLBACK_FONTS.unknown
}
// Missing glyphs render as boxes rather than failing the card.
async function loadAdditionalAsset(code, segment) {
	if (code === "emoji") return loadEmoji(segment)
	const fonts = await Promise.all(
		fallbackCandidates(code).map(({ family, weight }) =>
			loadFallbackFont(family, weight, segment),
		),
	)
	return fonts.filter((font) => font !== null)
}
process.on(
	"message",
	async ({
		fonts,
		id,
		tree,
		width,
		height,
		fontSet,
		dynamicAssets,
		outputs,
	}) => {
		if (fonts) {
			Object.assign(fontSets, fonts)
			return
		}
		try {
			const svg = await satori(toElement(tree), {
				width,
				height,
				fonts: fontSets[fontSet],
				...(dynamicAssets ? { loadAdditionalAsset } : {}),
			})
			const renders = new Map()
			const images = {}
			for (const output of outputs) {
				let render = renders.get(output.width)
				if (!render) {
					render = new Resvg(svg, {
						fitTo: { mode: "width", value: output.width },
					}).render()
					renders.set(output.width, render)
				}
				if (output.format === "png")
					images[output.name] = Buffer.from(render.asPng())
				else
					for (const quality of output.qualities ?? [85]) {
						const { data } = jpeg.encode(
							{
								data: render.pixels,
								width: render.width,
								height: render.height,
							},
							quality,
						)
						images[output.name] = Buffer.from(data)
						if (!output.maxBytes || data.length <= output.maxBytes) break
					}
			}
			process.send({ id, images })
		} catch (error) {
			process.send({
				id,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	},
)
process.send({ ready: true })
