// Open Graph cards for every page: resolve what the card shows, render it in the card renderer, and keep it in the
// card store (store.server.ts). Also the generic card that a request gets when its own card can't be drawn in time.
import { counter } from "~/server/metrics/registry.server"
import {
	canonicalOgPath,
	resolveOgContent,
} from "~/server/og-image/content.server"
import { renderOgCard, toDataUri } from "~/server/og-image/render.server"
import { createOgStore } from "~/server/og-image/store.server"
import { OgCard, type OgContent } from "~/ui/og-image/OgCard"
import { HOME_COPY } from "~/ui/og-image/copy"
import { getRedisCluster } from "~/utils/cache"
export { OG_WAIT_MS } from "~/server/og-image/store.server"
async function inlineImages(content: OgContent): Promise<OgContent> {
	switch (content.kind) {
		case "discovery":
			return {
				...content,
				groups: await Promise.all(
					content.groups.map(async (group) => ({
						...group,
						posters: await Promise.all(
							group.posters.map(async (poster) => ({
								...poster,
								src: await toDataUri(poster.src),
							})),
						),
					})),
				),
			}
		case "title":
			return { ...content, poster: await toDataUri(content.poster) }
		case "person":
			return { ...content, photo: await toDataUri(content.photo) }
		default:
			return { ...content, backdrop: await toDataUri(content.backdrop) }
	}
}

// Errors while resolving the content propagate, so an outage isn't answered with a 404.
async function render(path: string): Promise<Buffer | null> {
	const started = Date.now()
	const content = await resolveOgContent(path)
	if (!content) return null
	const image = await renderOgCard(
		<OgCard content={await inlineImages(content)} />,
	)
	console.info(
		`[og-image] rendered ${path} in ${Date.now() - started} ms: ${image.length} bytes`,
	)
	return image
}

const outcomes = counter(
	"goodwatch_og_cards_total",
	"Open Graph card request outcomes.",
	["result"],
	7,
)
export function countOgCard(result: string) {
	outcomes.inc([result])
}
const store = createOgStore({
	redis: getRedisCluster,
	render,
	canonical: canonicalOgPath,
	count: countOgCard,
})
// The generic card: the home page's headline without a picture. It is drawn once per process, on the first card
// request, and kept for the life of the process, so that it exists when the renderer is busy.
let fallback: Buffer | null = null
let fallbackPending = false
/** The generic card for the busy and failed answers, or null until it has been drawn. */
export function getFallbackCard(): Buffer | null {
	return fallback
}
/** The card for a page path. See createOgStore for the outcomes. */
export function getOgImage(pagePath: string, options?: { waitMs?: number }) {
	if (!fallback && !fallbackPending) {
		fallbackPending = true
		renderOgCard(
			<OgCard content={{ kind: "page", ...HOME_COPY, backdrop: null }} />,
		)
			.then((image) => {
				fallback = image
			})
			.catch((error) =>
				console.warn("[og-image] fallback render failed", error),
			)
			.finally(() => {
				fallbackPending = false
			})
	}
	return store.getOgImage(pagePath, options)
}
