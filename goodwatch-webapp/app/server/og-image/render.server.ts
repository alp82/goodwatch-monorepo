// Renders an Open Graph card element to a 1200x630 JPEG in the card renderer's child processes, and fetches remote
// images as data URIs so that the renderer never fetches a picture itself.
import type { ReactElement } from "react"
import {
	registerFontSet,
	renderCard,
	resolveTree,
} from "~/server/card-renderer/pool.server"
import antonRegular from "~/server/og-image/fonts/Anton-Regular.ttf?inline"
import gabaritoBlack from "~/server/og-image/fonts/Gabarito-Black.ttf?inline"
import gabaritoBold from "~/server/og-image/fonts/Gabarito-Bold.ttf?inline"
import gabaritoRegular from "~/server/og-image/fonts/Gabarito-Regular.ttf?inline"
import { OG_IMAGE } from "~/ui/og-image/format"

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

registerFontSet("og", getFonts())

// The qualities are tried in order until the file fits. Most cards fit at 85, and a card with a busy poster ends at
// 75 or 70. Under 150 KB keeps a burst of link-preview fetches small, and no step shows a visible loss.
/** Renders a card to a JPEG of at most 145 KB. Rejects when the renderer is busy or the render fails. */
export async function renderOgCard(element: ReactElement): Promise<Buffer> {
	const images = await renderCard({
		kind: "card",
		tree: resolveTree(element),
		width: OG_IMAGE.width,
		height: OG_IMAGE.height,
		fontSet: "og",
		dynamicAssets: true,
		outputs: [
			{
				name: "card",
				format: "jpeg",
				width: 1200,
				qualities: [85, 80, 75, 70],
				maxBytes: 145_000,
			},
		],
	})
	return images.card
}
