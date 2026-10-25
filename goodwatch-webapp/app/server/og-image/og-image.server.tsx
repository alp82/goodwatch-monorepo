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
const inlineAll = (sources: (string | null)[]) =>
	Promise.all(sources.map((src) => toDataUri(src)))
// A photo comes as a data URI already.
const inlineAvatar = async (src: string | null) =>
	src?.startsWith("data:") ? src : toDataUri(src)
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
		case "for-you":
			return { ...content, posters: await inlineAll(content.posters) }
		case "chat":
			return {
				...content,
				posters: await Promise.all(
					content.posters.map(async (poster) => ({
						...poster,
						src: await toDataUri(poster.src),
					})),
				),
			}
		case "title":
			return { ...content, poster: await toDataUri(content.poster) }
		case "profile":
			return {
				...content,
				avatar: await inlineAvatar(content.avatar),
				posters: await inlineAll(content.posters),
			}
		case "profile-everyone":
			return {
				...content,
				avatar: await inlineAvatar(content.avatar),
				takes: await Promise.all(
					content.takes.map(async (t) => ({
						...t,
						poster: (await toDataUri(t.poster)) ?? "",
					})),
				),
			}
		case "profile-sides": {
			const inline = async (side: typeof content.first) => ({
				...side,
				posters: (await inlineAll(side.posters)).filter((p): p is string =>
					Boolean(p),
				),
			})
			return {
				...content,
				avatar: await inlineAvatar(content.avatar),
				first: await inline(content.first),
				second: await inline(content.second),
			}
		}
		case "profile-tab": {
			const visual = content.visual
			return {
				...content,
				avatar: await inlineAvatar(content.avatar),
				visual:
					visual.type === "scores" || visual.type === "posters"
						? { ...visual, posters: await inlineAll(visual.posters) }
						: visual.type === "shows"
							? {
									...visual,
									shows: await Promise.all(
										visual.shows.map(async (s) => ({
											...s,
											poster: await toDataUri(s.poster),
										})),
									),
								}
							: visual.type === "lists"
								? {
										...visual,
										lists: await Promise.all(
											visual.lists.map(async (l) => ({
												...l,
												posters: await inlineAll(l.posters),
											})),
										),
									}
								: visual,
			}
		}
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
const clients = counter(
	"goodwatch_og_card_clients_total",
	"Open Graph card requests by client class and outcome.",
	["client", "result"],
	32,
)
export function countOgCardClient(client: string, result: string) {
	clients.inc([client, result])
}
// Invalid or unset lifetimes use the store defaults.
function lifetime(value: string | undefined) {
	const seconds = Number(value)
	return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}
const store = createOgStore({
	firstSeconds: lifetime(process.env.OG_CARD_FIRST_SECONDS),
	keptSeconds: lifetime(process.env.OG_CARD_KEPT_SECONDS),
	redis: getRedisCluster,
	render,
	canonical: canonicalOgPath,
	count: countOgCard,
	// A member's profile card shows only what they make public, so it must go when they change that.
	resettable: (path) => /^\/(u|movie|show|person)\//.test(path),
})

/** Drops a page's stored card on every instance, e.g. after a member changes what their profile shows. */
export function forgetOgCard(pagePath: string) {
	return store.forget(pagePath)
}
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
