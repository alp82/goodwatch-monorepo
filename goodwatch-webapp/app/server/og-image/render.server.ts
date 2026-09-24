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

export async function renderPng(element: ReactElement): Promise<Buffer> {
	const svg = await satori(element, {
		width: WIDTH,
		height: HEIGHT,
		fonts: getFonts(),
		loadAdditionalAsset: async (code, segment) =>
			code === "emoji" ? loadEmoji(segment) : "",
	})
	const image = await renderAsync(svg, {
		fitTo: { mode: "width", value: WIDTH },
	})
	return image.asPng()
}
