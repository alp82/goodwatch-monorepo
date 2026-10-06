// Renders share cards (PNG) and their link previews (JPEG) in the card renderer's child processes, so a render never
// blocks the web server.
import { renderCard, resolveTree } from "~/server/card-renderer/pool.server"
import { toDataUri } from "~/server/og-image/render.server"
import { SHARE_CARD_PREVIEW } from "~/ui/share-card/links"
import type { CardDesign, CardProps, CardTitle } from "~/ui/share-card/model"
// A 9:16 card at 900 pixels wide needs about quality 52 to stay under 145 KB, and the busiest design needs about 40.
// There is no chroma subsampling, so text edges stay clean.
export const PREVIEW_QUALITIES = [
	SHARE_CARD_PREVIEW.quality,
	70,
	60,
	52,
	46,
	40,
]

// Posters and backdrops repeat across cards and renders, so their data URIs are shared, with one retry.
const IMAGE_CACHE_MAX = 300
const imageCache = new Map<string, Promise<string | null>>()
function cachedImage(url: string | null): Promise<string | null> {
	if (!url) return Promise.resolve(null)
	let image = imageCache.get(url)
	if (!image) {
		image = toDataUri(url)
			.then((uri) => uri ?? toDataUri(url))
			.then((uri) => {
				if (!uri) imageCache.delete(url)
				return uri
			})
		if (imageCache.size >= IMAGE_CACHE_MAX)
			imageCache.delete(imageCache.keys().next().value as string)
		imageCache.set(url, image)
	}
	return image
}

const inlineTitle = async (item: CardTitle): Promise<CardTitle> => ({
	...item,
	poster: await cachedImage(item.poster),
	backdrop: await cachedImage(item.backdrop),
})

/** A card as a PNG at its design's native size, and the same card as a small JPEG for link previews. */
export type ShareCardImages = { card: Buffer; preview: Buffer }

/** Renders a card and its link preview. Rejects when the render fails, times out, or crashes the renderer. */
export async function renderShareCard(
	design: CardDesign,
	props: Omit<CardProps, "editing">,
	editing = false,
): Promise<ShareCardImages> {
	const items = await Promise.all(props.items.map(inlineTitle))
	const tree = resolveTree(
		<design.Card {...props} items={items} editing={editing} />,
	)
	const images = await renderCard({
		kind: "list",
		tree,
		width: design.w,
		height: design.h,
		fontSet: "share",
		dynamicAssets: false,
		outputs: [
			{ name: "card", format: "png", width: design.w },
			{
				name: "preview",
				format: "jpeg",
				width: SHARE_CARD_PREVIEW.width,
				// The preview stays under 145 KB: a lower quality is tried when the first one is too large.
				qualities: PREVIEW_QUALITIES,
				maxBytes: 145_000,
			},
		],
	})
	return { card: images.card, preview: images.preview }
}

/** Ends the renderer processes, so a script can exit. */
export { stopCardRenderers as stopShareCardRenderers } from "~/server/card-renderer/pool.server"
