// PROTOTYPE - throwaway. One facade and one official player per source. Before the click a facade sends no request to
// any third party: it shows text and the title's own TMDB artwork (image.tmdb.org, which the title page loads anyway).
// The click is the consent for that one item; the official player mounts in the facade's place.
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { type SocialItem, type SourceKey, VENDORS, ago } from "./social"

// --- Which items are loaded, shared by the layouts and the state panel ---

type SectionState = { loaded: Set<string>; load: (id: string) => void }
export const SectionContext = createContext<SectionState>({ loaded: new Set(), load: () => {} })
export const useLoaded = (id: string) => {
	const { loaded, load } = useContext(SectionContext)
	return [loaded.has(id), () => load(id)] as const
}

// --- Small shared pieces ---

export function SourceChip({ source, className = "" }: { source: SourceKey; className?: string }) {
	const vendor = VENDORS[source]
	return (
		<span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-gray-200 ${className}`}>
			<span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: vendor.color }} />
			{vendor.name}
		</span>
	)
}

export function Byline({ item, className = "" }: { item: SocialItem; className?: string }) {
	return (
		<span className={`text-xs text-gray-400 ${className}`}>
			{item.author}
			{item.handle && item.handle !== item.author ? <span className="text-gray-500"> {item.handle}</span> : null} · {ago(item.date)}
		</span>
	)
}

export function SampleTag({ item }: { item: SocialItem }) {
	if (!item.sample) return null
	return (
		<span title={item.sample} className="rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-200">
			sample
		</span>
	)
}

/** The consent line under a button: who the click contacts. */
export function consentLine(source: SourceKey) {
	const vendor = VENDORS[source]
	if (vendor.kind === "link") return `Opens ${vendor.owner}'s site`
	return `Loads ${vendor.name}${vendor.owner !== vendor.name ? ` (${vendor.owner})` : ""}, which may set cookies`
}

export function actionLabel(source: SourceKey) {
	if (source === "youtube" || source === "short" || source === "tiktok" || source === "reel" || source === "facebook") return "Play"
	if (source === "news") return "Read"
	return "Show post"
}

export function Art({ item, className = "", width = "w780" }: { item: SocialItem; className?: string; width?: string }) {
	if (!item.art) return null
	return <img src={tmdbImageUrl(item.art.path, width)} alt="" loading="lazy" draggable={false} className={`object-cover ${className}`} />
}

/** The button that loads the player. Says what loads and from where. */
export function LoadButton({ item, onClick, compact = false }: { item: SocialItem; onClick: () => void; compact?: boolean }) {
	const video = actionLabel(item.source) === "Play"
	return (
		<button
			type="button"
			onClick={onClick}
			data-load={item.id}
			className="group/btn inline-flex flex-col items-start gap-0.5 rounded-xl bg-white/95 px-3 py-2 text-left text-black shadow-lg ring-1 ring-black/20 transition hover:bg-white active:scale-[.98]"
		>
			<span className="inline-flex items-center gap-2 text-sm font-bold">
				<span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white" style={{ background: VENDORS[item.source].color === "#d4d4d4" ? "#111" : VENDORS[item.source].color }}>
					{video ? "▶" : "↧"}
				</span>
				{actionLabel(item.source)}
			</span>
			{!compact && <span className="text-[11px] leading-tight text-gray-600">{consentLine(item.source)}</span>}
		</button>
	)
}

// --- The official players ---

const loadedScripts = new Set<string>()

/** Appends the vendor's script. A script element inserted again runs again, so a second embed of the same vendor is
 * picked up without a vendor API (Bluesky, Reddit, Threads, Mastodon). Instagram and Facebook have one. */
function runScript(src: string, attrs: Record<string, string> = {}) {
	const script = document.createElement("script")
	script.src = src
	script.async = true
	for (const [key, value] of Object.entries(attrs)) script.setAttribute(key, value)
	document.body.appendChild(script)
	loadedScripts.add(src)
}

declare global {
	interface Window {
		instgrm?: { Embeds: { process: () => void } }
		FB?: { XFBML: { parse: (el?: Element) => void } }
	}
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")

function ScriptEmbed({ item }: { item: SocialItem }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const e = item.embed
		switch (e.type) {
			case "instagram":
				el.innerHTML = `<blockquote class="instagram-media" data-instgrm-captioned data-instgrm-permalink="${esc(e.permalink)}?utm_source=ig_embed&amp;utm_campaign=loading" data-instgrm-version="14" style="background:#FFF;border:0;border-radius:12px;margin:0;max-width:540px;min-width:326px;padding:0;width:100%;"><a href="${esc(e.permalink)}" target="_blank" rel="noopener">View on Instagram</a></blockquote>`
				if (window.instgrm) window.instgrm.Embeds.process()
				else runScript("https://www.instagram.com/embed.js")
				break
			case "threads":
				el.innerHTML = `<blockquote class="text-post-media" data-text-post-permalink="https://www.threads.com/t/${esc(e.postId)}?utm_source=th_embed&amp;utm_campaign=threads_api" data-text-post-version="0" id="ig-tp-${esc(e.postId)}" data-theme="dark" style="background:#101010;border:1px solid #ffffff26;border-radius:16px;max-width:540px;margin:0;min-width:270px;padding:0;width:100%;"><a href="${esc(e.permalink)}" target="_blank" rel="noopener" style="color:#ddd;display:block;padding:24px">View on Threads</a></blockquote>`
				runScript("https://www.threads.com/embed.js")
				break
			case "facebook":
				if (!document.getElementById("fb-root")) {
					const root = document.createElement("div")
					root.id = "fb-root"
					document.body.prepend(root)
				}
				el.innerHTML = `<div class="fb-video" data-href="${esc(e.href)}" data-width="320" data-show-text="false" data-autoplay="true"></div>`
				if (window.FB) window.FB.XFBML.parse(el)
				else runScript("https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v26.0", { crossorigin: "anonymous" })
				break
			case "bluesky":
				el.innerHTML = `<blockquote class="bluesky-embed" data-bluesky-uri="${esc(e.uri)}" data-bluesky-cid="${esc(e.cid)}" data-bluesky-embed-color-mode="dark"><p>${esc(e.text)}</p>&mdash; <a href="https://bsky.app/profile/${esc(e.authorDid)}?ref_src=embed">${esc(e.authorLabel)}</a> <a href="https://bsky.app/profile/${esc(e.authorDid)}/post/${esc(e.postRkey)}?ref_src=embed">${esc(e.createdAt)}</a></blockquote>`
				runScript("https://embed.bsky.app/static/embed.js", { charset: "utf-8" })
				break
			case "reddit":
				el.innerHTML = `<blockquote class="reddit-embed-bq" data-embed-theme="dark" data-embed-height="316" style="height:316px"><a href="${esc(e.href)}">${esc(e.title)}</a><br> by <a href="https://www.reddit.com/user/${esc(e.author)}/">u/${esc(e.author)}</a> in <a href="https://www.reddit.com/r/${esc(e.subreddit)}/">${esc(e.subreddit)}</a></blockquote>`
				runScript("https://embed.reddit.com/widgets.js", { charset: "UTF-8" })
				break
			case "mastodon":
				el.innerHTML = `<blockquote class="mastodon-embed" data-embed-url="${esc(e.embedUrl)}" style="background:#FCF8FF;border-radius:8px;border:1px solid #C9C4DA;margin:0;max-width:540px;min-width:270px;overflow:hidden;padding:0;"><a href="${esc(e.url)}" target="_blank" rel="noopener" style="display:block;padding:24px;color:#1C1A25">View on Mastodon</a></blockquote>`
				runScript(`${e.instance}embed.js`, { "data-allowed-prefixes": e.instance })
				break
		}
	}, [item])
	return <div ref={ref} data-player={item.id} className="w-full min-w-0 [&_iframe]:max-w-full" />
}

function IframePlayer({ item }: { item: SocialItem }) {
	const e = item.embed
	if (e.type === "youtube") {
		const vertical = item.source === "short"
		return (
			<iframe
				data-player={item.id}
				src={`https://www.youtube-nocookie.com/embed/${e.videoId}?autoplay=1&rel=0&playsinline=1`}
				title={item.text}
				allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
				referrerPolicy="strict-origin-when-cross-origin"
				allowFullScreen
				className={`block w-full border-0 bg-black ${vertical ? "aspect-[9/16]" : "aspect-video"}`}
			/>
		)
	}
	if (e.type === "tiktok") {
		return (
			<iframe
				data-player={item.id}
				src={`https://www.tiktok.com/player/v1/${e.postId}?autoplay=1&description=1&music_info=1&rel=0`}
				title={`TikTok by ${item.handle}`}
				allow="autoplay; encrypted-media; fullscreen"
				referrerPolicy="strict-origin-when-cross-origin"
				className="block aspect-[9/16] w-full border-0 bg-black"
			/>
		)
	}
	return null
}

/** The official player of an item. News has none: its button is a plain link. */
export function Player({ item }: { item: SocialItem }) {
	const kind = VENDORS[item.source].kind
	if (kind === "iframe") return <IframePlayer item={item} />
	if (kind === "script") return <ScriptEmbed item={item} />
	return null
}

/** A hook for a layout's own facade: loaded or not, and the click. */
export function useFacade(item: SocialItem) {
	return useLoaded(item.id)
}

// --- A ready-made facade card most layouts use. Each layout sizes and arranges it. ---

export function ItemCard({ item, shape = "auto", className = "" }: { item: SocialItem; shape?: "video" | "vertical" | "text" | "auto"; className?: string }) {
	const [loaded, load] = useLoaded(item.id)
	const s = shape === "auto" ? shapeOf(item) : shape
	if (item.source === "news") return <NewsCard item={item} className={className} />
	if (loaded)
		return (
			<div className={`overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10 ${className}`} data-item={item.id} data-state="loaded">
				<div className="flex items-center justify-between gap-2 px-3 py-2">
					<SourceChip source={item.source} />
					<SampleTag item={item} />
				</div>
				<div className={s === "text" ? "px-2 pb-2" : ""}>
					<Player item={item} />
				</div>
			</div>
		)
	if (s === "text")
		return (
			<div className={`flex flex-col gap-3 rounded-2xl bg-white/[.06] p-4 ring-1 ring-white/10 ${className}`} data-item={item.id} data-state="facade">
				<div className="flex items-center justify-between gap-2">
					<SourceChip source={item.source} />
					<SampleTag item={item} />
				</div>
				<p className={`line-clamp-5 text-[15px] leading-snug ${item.textKind === "note" ? "italic text-gray-300" : "text-gray-100"}`}>
					{item.textKind === "post" ? `“${item.text}”` : item.text}
				</p>
				<Byline item={item} />
				<div className="mt-auto">
					<LoadButton item={item} onClick={load} />
				</div>
			</div>
		)
	return (
		<div className={`relative overflow-hidden rounded-2xl bg-gray-800 ring-1 ring-white/10 ${s === "vertical" ? "aspect-[9/16]" : "aspect-video"} ${className}`} data-item={item.id} data-state="facade">
			<Art item={item} className="absolute inset-0 h-full w-full" width={item.art?.kind === "poster" ? "w342" : "w780"} />
			<div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
			<div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
				<SourceChip source={item.source} className="rounded-full bg-black/60 px-2 py-1" />
				<SampleTag item={item} />
			</div>
			<div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3">
				<p className={`line-clamp-3 text-sm font-semibold leading-snug text-white ${item.textKind === "note" ? "italic font-normal" : ""}`}>{item.text}</p>
				<Byline item={item} className="text-gray-300" />
				<div>
					<LoadButton item={item} onClick={load} compact={s === "vertical"} />
				</div>
			</div>
		</div>
	)
}

export function NewsCard({ item, className = "" }: { item: SocialItem; className?: string }) {
	return (
		<a
			href={item.url}
			target="_blank"
			rel="noopener noreferrer"
			data-item={item.id}
			className={`group flex flex-col gap-2 rounded-2xl bg-amber-950/30 p-4 ring-1 ring-amber-500/20 transition hover:bg-amber-950/50 ${className}`}
		>
			<span className="flex items-center gap-2 text-xs font-semibold text-amber-200">
				<span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded bg-amber-500/20 text-[11px] font-black text-amber-100">
					{item.author.slice(0, 1)}
				</span>
				{item.author} · {ago(item.date)}
			</span>
			<span className="text-[15px] font-semibold leading-snug text-gray-100 group-hover:underline">{item.text}</span>
			<span className="mt-auto text-xs text-amber-200/70">Read on {new URL(item.url).hostname.replace(/^www\./, "")} ↗</span>
		</a>
	)
}

export function shapeOf(item: SocialItem): "video" | "vertical" | "text" {
	if (item.source === "youtube") return "video"
	if (item.source === "short" || item.source === "tiktok" || item.source === "reel" || item.source === "facebook") return "vertical"
	return "text"
}

/** Section heading every layout shares: what this is and why the title is hot. */
export function SectionHeading({ why, count, children }: { why: string; count: number; children?: React.ReactNode }) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h2 className="flex items-center gap-2 text-2xl font-bold">
					<span aria-hidden="true" className="relative flex h-2.5 w-2.5">
						<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60 motion-reduce:hidden" />
						<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
					</span>
					Talked about now
				</h2>
				<p className="mt-1 text-sm text-gray-400">
					{why} · {count} posts and videos this week
				</p>
			</div>
			{children}
		</div>
	)
}

export function useMounted() {
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	return mounted
}
