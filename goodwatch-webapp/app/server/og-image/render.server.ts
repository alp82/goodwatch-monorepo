// Renders a card element to a 1200x630 PNG: satori lays it out as SVG, resvg rasterizes it.
import { renderAsync } from "@resvg/resvg-js"
import type { ReactElement } from "react"
import satori from "satori"
import antonRegular from "~/server/og-image/fonts/Anton-Regular.ttf?inline"
import gabaritoBlack from "~/server/og-image/fonts/Gabarito-Black.ttf?inline"
import gabaritoBold from "~/server/og-image/fonts/Gabarito-Bold.ttf?inline"
import gabaritoRegular from "~/server/og-image/fonts/Gabarito-Regular.ttf?inline"
import { HEIGHT, WIDTH } from "~/ui/og-image/parts"

const FETCH_TIMEOUT_MS = 5000

// The fonts are bundled as base64 data URIs, so they load the same way in dev and in the build.
const fromDataUri = (uri: string) =>
	Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64")

type Font = {
	name: string
	data: Buffer
	weight: 400 | 700 | 900
	style: "normal"
}
let fonts: Font[] | null = null
const getFonts = () => {
	fonts ??= [
		{
			name: "Gabarito",
			data: fromDataUri(gabaritoRegular),
			weight: 400,
			style: "normal",
		},
		{
			name: "Gabarito",
			data: fromDataUri(gabaritoBold),
			weight: 700,
			style: "normal",
		},
		{
			name: "Gabarito",
			data: fromDataUri(gabaritoBlack),
			weight: 900,
			style: "normal",
		},
		{
			name: "Anton",
			data: fromDataUri(antonRegular),
			weight: 400,
			style: "normal",
		},
	]
	return fonts
}

// Fetches a remote image as a data URI, or null when it can't be loaded.
export async function toDataUri(url: string | null): Promise<string | null> {
	if (!url) return null
	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		})
		if (!response.ok) return null
		const type = response.headers.get("content-type") ?? "image/jpeg"
		return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`
	} catch (error) {
		console.warn("[og-image] image fetch failed", url, error)
		return null
	}
}

// Emoji come from Twemoji. When the fetch fails, the emoji is left out.
const emojiCache = new Map<string, Promise<string>>()
const loadEmoji = (segment: string) => {
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
		emojiCache.set(code, emoji)
	}
	return emoji
}

// The bundled fonts only cover Latin script. For any other script, satori asks for more
// glyphs, and we fetch a Google Fonts subset that holds just the characters it needs.
// Heavy weights keep the fallback close to Anton and Gabarito Black.
const FALLBACK_FONTS: Record<string, { family: string; weight: number }[]> = {
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

type FallbackFont = {
	name: string
	data: ArrayBuffer
	weight: 700 | 900
	style: "normal"
}
const FALLBACK_CACHE_MAX = 500
const fallbackCache = new Map<string, Promise<FallbackFont | null>>()

const loadFallbackFont = (family: string, weight: number, text: string) => {
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
					weight: weight as 700 | 900,
					style: "normal" as const,
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
const fallbackCandidates = (code: string) => {
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
async function loadAdditionalAsset(code: string, segment: string) {
	if (code === "emoji") return loadEmoji(segment)
	const fonts = await Promise.all(
		fallbackCandidates(code).map(({ family, weight }) =>
			loadFallbackFont(family, weight, segment),
		),
	)
	return fonts.filter((font): font is FallbackFont => font !== null)
}

export async function renderPng(element: ReactElement): Promise<Buffer> {
	const svg = await satori(element, {
		width: WIDTH,
		height: HEIGHT,
		fonts: getFonts(),
		loadAdditionalAsset,
	})
	const image = await renderAsync(svg, {
		fitTo: { mode: "width", value: WIDTH },
	})
	return image.asPng()
}
