// What a social item loads after its click, worked out from the stored post alone: the source, its permalink and the
// source's own id. Nothing here contacts a third party; the players in players.tsx do, and only once mounted.
//
// The stored shape is doc.social_post (#556): YouTube keeps the video id, Bluesky the post's AT URI, Mastodon and news
// the permalink. A post whose address doesn't fit its source gets no player, only its link.

export type SocialSource = "youtube" | "bluesky" | "mastodon" | "news"

/** One post or article as the facades show it before the click. */
export interface SocialEmbedItem {
	/** Stable id, the post_id of doc.social_post. */
	id: string
	/** First-party stored preview, when available. */
	image?: string | null
	source: SocialSource
	/** The post's own address on its source. */
	url: string
	/** The source's id: the YouTube video id or the Bluesky AT URI. Optional for Mastodon and news. */
	sourceId?: string | null
	/** Publisher, channel or account name. */
	author: string
	/** ISO time of publication. */
	publishedAt: string
	/** The video's or article's title, or the post's own text. */
	text: string
}

export type EmbedTarget =
	| { kind: "youtube"; videoId: string; vertical: boolean }
	| { kind: "bluesky"; did: string; rkey: string }
	| { kind: "mastodon"; embedUrl: string; origin: string }
	| { kind: "link" }

export interface Vendor {
	name: string
	/** The company or server the player contacts, for the line under the button. */
	owner: string
}

export const VENDORS: Record<SocialSource, Vendor> = {
	youtube: { name: "YouTube", owner: "Google" },
	bluesky: { name: "Bluesky", owner: "Bluesky" },
	mastodon: { name: "Mastodon", owner: "the author's server" },
	news: { name: "News", owner: "the publisher" },
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"])
const AT_URI = /^at:\/\/(did:(?:plc|web):[A-Za-z0-9._:%-]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9._~-]+)$/
const MASTODON_PATH = /^\/@[A-Za-z0-9_.-]+(?:@[A-Za-z0-9.-]+)?\/\d+$/

function parse(url: string): URL | null {
	try {
		const parsed = new URL(url)
		return parsed.protocol === "https:" ? parsed : null
	} catch {
		return null
	}
}

/** The video id of a YouTube address, and whether it is a Short. */
export function youtubeVideo(url: string, sourceId?: string | null): { videoId: string; vertical: boolean } | null {
	const parsed = parse(url)
	const vertical = Boolean(parsed && YOUTUBE_HOSTS.has(parsed.hostname) && parsed.pathname.startsWith("/shorts/"))
	if (sourceId && YOUTUBE_ID.test(sourceId)) return { videoId: sourceId, vertical }
	if (!parsed || !YOUTUBE_HOSTS.has(parsed.hostname)) return null
	const candidate =
		parsed.hostname === "youtu.be"
			? parsed.pathname.slice(1)
			: parsed.pathname === "/watch"
				? parsed.searchParams.get("v")
				: parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]
	return candidate && YOUTUBE_ID.test(candidate) ? { videoId: candidate, vertical } : null
}

export function embedTarget(item: Pick<SocialEmbedItem, "source" | "url" | "sourceId">): EmbedTarget {
	switch (item.source) {
		case "youtube": {
			const video = youtubeVideo(item.url, item.sourceId)
			return video ? { kind: "youtube", ...video } : { kind: "link" }
		}
		case "bluesky": {
			const match = item.sourceId?.match(AT_URI)
			return match ? { kind: "bluesky", did: match[1], rkey: match[2] } : { kind: "link" }
		}
		case "mastodon": {
			// Mastodon serves every public post at its permalink plus /embed. A server that isn't Mastodon, or an
			// address of another shape, keeps the link only.
			const parsed = parse(item.url)
			if (!parsed || parsed.search || parsed.hash || !MASTODON_PATH.test(parsed.pathname)) return { kind: "link" }
			return { kind: "mastodon", embedUrl: `${parsed.origin}${parsed.pathname}/embed`, origin: parsed.origin }
		}
		default:
			return { kind: "link" }
	}
}

/** The address the item's link opens, or null when it isn't a safe https address. */
export function safeHref(url: string): string | null {
	return parse(url)?.href ?? null
}

/** The host a link names, without "www.". */
export function hostLabel(url: string): string {
	return parse(url)?.hostname.replace(/^www\./, "") ?? ""
}

/** The line under a load button: who the click contacts. */
export function consentLine(source: SocialSource): string {
	const vendor = VENDORS[source]
	if (source === "news") return `Opens ${vendor.owner}'s site`
	return `Loads ${vendor.name}${vendor.owner !== vendor.name ? ` (${vendor.owner})` : ""}, which may set cookies`
}

export function actionLabel(source: SocialSource): string {
	if (source === "youtube") return "Play"
	if (source === "news") return "Read"
	return "Show post"
}

/** "today", "yesterday", "3 days ago": how old a post is, against `now`. */
export function ago(iso: string, now: number): string {
	const time = Date.parse(iso)
	if (Number.isNaN(time)) return ""
	const days = Math.floor((now - time) / 86_400_000)
	if (days <= 0) return "today"
	if (days === 1) return "yesterday"
	if (days < 14) return `${days} days ago`
	if (days < 60) return `${Math.round(days / 7)} weeks ago`
	return `${Math.round(days / 30)} months ago`
}
