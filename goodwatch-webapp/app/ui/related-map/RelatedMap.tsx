// The related titles section of a title page as a map: one title in the middle, the related titles on rings around
// it by similarity, trait chips that bend who is on the map, and a walk from poster to poster that never leaves the
// page. What a title page carries of it, by weight:
// 1. The server's HTML: the picture of the page's title, drawn by the engine itself, and the plain title links.
// 2. Two files of the build with hashed names, cached for a year: the engine as a script (inline.ts) and the style
//    (related-map.css). Neither blocks the first paint, and neither waits for hydration: the script is `async`, and a
//    few lines of inline script ask for the style and remember a tap that comes before the engine.
// 3. Until the style is there, the section holds its height and hides its content, so nothing is seen unstyled and
//    nothing moves.
// A page opened by a navigation inside the app asks for both files when the section mounts, once per document.
// When the server ran out of time before the page title's pack was there, the section holds its height with only its
// heading, asks for the pack from the browser, and the engine draws the picture.
//
// A walk is forgotten when the page is left.
import { useMatches, useNavigate, useNavigation } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import type { RelatedMapData } from "~/server/related-map.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { RawPack } from "~/ui/related-map/engine"
import cssPath from "~/ui/related-map/related-map.css?url"
import { assetBase, assetUrl } from "~/utils/asset-url"
import { useHydrated } from "~/utils/hydrated"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const loadClient = reloadOnStaleChunk(() => import("~/ui/related-map/client"))

interface MapWindow {
	/** True while the app loads another page. An engine that loads later reads it when it starts (engine.ts). */
	__gwAppLoading?: boolean
	__gwRelatedMap?: {
		boot: () => void
		nav: ((href: string) => void) | null
		navigating?: (on: boolean) => void
		render: (input: {
			root: string
			title: string
			pack: RawPack
			links: { href: string; text: string }[]
			language: string
		}) => string
	}
}

const STYLE = "link[data-related-map-css]"
const ENGINE = "script[data-related-map-engine]"

/**
 * The document's few lines of inline script, run while the document is parsed:
 * - They ask for the style without blocking the paint. The link goes into an element that React leaves alone.
 * - They remember the last tap on a poster or a chip that comes before the engine, which then does what was tapped
 *   (engine.ts).
 */
const earlyScript = (css: string, crossOrigin: boolean) =>
	`(function(d,w){var b=d.querySelector("[data-related-map-assets]");if(b&&!d.querySelector('${STYLE}')){var l=d.createElement("link");l.rel="stylesheet";${
		crossOrigin ? 'l.crossOrigin="anonymous";' : ""
	}l.href=${JSON.stringify(css)};l.setAttribute("data-related-map-css","");b.appendChild(l)}if(!w.__gwRelatedMap&&!w.__gwRelatedMapTap){var q=w.__gwRelatedMapTap={el:null,on:function(e){var t=e.target&&e.target.closest&&e.target.closest("[data-related-map] [data-pl-step],[data-related-map] [data-pl-act]");if(t)q.el=t}};w.addEventListener("click",q.on,true)}})(document,window)`.replace(
		/</g,
		"\\u003c",
	)

const escapeHtml = (text: string) =>
	text.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)

/** The style in the document's head, where it stays for every page that is opened from here. Asked for once. */
function keepStyle(href: string, path: string) {
	if (document.head.querySelector(STYLE)) return
	const link = document.createElement("link")
	link.rel = "stylesheet"
	if (href !== path) link.crossOrigin = "anonymous"
	link.setAttribute("data-related-map-css", "")
	// The site's own host has every file of the build too.
	link.onerror = () => {
		if (link.getAttribute("href") === path) return
		link.removeAttribute("crossorigin")
		link.href = path
	}
	link.href = href
	document.head.appendChild(link)
}

/**
 * Calls `run` once the engine is there. The document's own script tag may still be on its way. A page that was opened
 * inside the app has no script tag that ran, and asks for the script now. Without the script's address, or when the
 * script fails to load, the engine comes as a lazy chunk of the app.
 */
function whenEngine(
	src: string | null,
	own: HTMLScriptElement | null,
	run: () => void,
): () => void {
	const w = window as MapWindow
	let gone = false
	let late: ReturnType<typeof setTimeout> | undefined
	const done = () => {
		clearTimeout(late)
		if (!gone && w.__gwRelatedMap) run()
	}
	const fromChunk = () => {
		if (gone || w.__gwRelatedMap) return done()
		loadClient().then((chunk) => {
			chunk.start()
			done()
		})
	}
	if (w.__gwRelatedMap) done()
	else if (!src) fromChunk()
	else {
		let tag = own ?? document.head.querySelector<HTMLScriptElement>(ENGINE)
		if (!tag) {
			tag = document.createElement("script")
			tag.async = true
			if (assetBase()) tag.crossOrigin = "anonymous"
			tag.setAttribute("data-related-map-engine", "")
			tag.src = assetUrl(src)
			document.head.appendChild(tag)
		}
		tag.addEventListener("load", done)
		tag.addEventListener("error", fromChunk)
		// A script tag that failed before anyone listened says nothing: after a while the chunk stands in.
		late = setTimeout(fromChunk, 8000)
	}
	return () => {
		gone = true
		clearTimeout(late)
	}
}

/**
 * Tells the engine while the app loads another page, so that the packs it asks for ahead don't share the connection
 * with the next page's data. Its own component, so that a page change doesn't render the section again.
 */
function NavigationWatch() {
	const loading = useNavigation().state !== "idle"
	useEffect(() => {
		const w = window as MapWindow
		w.__gwAppLoading = loading
		w.__gwRelatedMap?.navigating?.(loading)
	}, [loading])
	useEffect(
		() => () => {
			const w = window as MapWindow
			w.__gwAppLoading = false
			w.__gwRelatedMap?.navigating?.(false)
		},
		[],
	)
	return null
}

/** The section's data from the title route's loader, or undefined when the page shows the related titles carousel. */
export function useRelatedMap(): RelatedMapData | undefined {
	for (const match of useMatches()) {
		const data = match.data as { relatedMap?: RelatedMapData } | undefined
		if (data?.relatedMap) return data.relatedMap
	}
	return undefined
}

/**
 * The markup of a document's section, in the browser. A document's page data doesn't carry it (see
 * server/related-map-handoff.ts): the server renders it from the loader's data, and the browser reads what the
 * document holds.
 */
function documentMarkup(rootKey: string): string {
	if (typeof document === "undefined") return ""
	return (
		document.querySelector(`[data-related-map][data-pl-root="${rootKey}"]`)
			?.innerHTML ?? ""
	)
}

export default function RelatedMap({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const map = useRelatedMap()
	const navigate = useNavigate()
	const rootKey = `${media.mediaType === "movie" ? "m" : "s"}${media.details.tmdb_id}`
	// True for the section of a document: the server's HTML holds the inline script and the script tag, and they ran.
	// A section that React made in the browser has neither, and asks for the files itself.
	const hydrated = useHydrated()
	const [inDocument] = useState(!hydrated)
	// One markup per title, for as long as the section shows that title: a later answer of the loader for the same
	// title (a revalidation) doesn't draw over a walk. `drawn`: the markup is the engine's picture, not the heading
	// that holds the place of a late one.
	const held = useRef<{ key: string; html: string; drawn: boolean; language?: string }>()
	const localizedKey = `${rootKey}:${map?.language ?? "canonical"}`
	if (map && held.current?.key !== localizedKey) {
		const html = map.late ? "" : (map.html ?? documentMarkup(rootKey))
		held.current = html
			? { key: localizedKey, html, drawn: true }
			: { key: localizedKey, html: `<h2 class="pl-h">Titles like ${escapeHtml(media.details.title)}</h2>`, drawn: false }
	}
	const drawn = Boolean(held.current?.drawn)
	const [, redraw] = useState(0)
	const [missing, setMissing] = useState<string | null>(null)
	const title = media.details.title
	const engineTag = useRef<HTMLScriptElement>(null)
	const css = assetUrl(cssPath)
	const script = map?.script ?? null
	const shown = Boolean(map)
	useEffect(() => {
		if (shown) keepStyle(css, cssPath)
	}, [shown, css])
	// A late section: the pack is asked for from the browser, again and again further apart when a request fails, and the
	// engine draws the picture from it.
	useEffect(() => {
		if (!shown || drawn) return
		const w = window as MapWindow
		const language = map?.language ?? "en"
		const key = localizedKey
		let gone = false
		let tries = 0
		let timer: ReturnType<typeof setTimeout> | undefined
		let stop = () => {}
		const attempt = () => {
			fetch(`/api/related-map?key=${rootKey}&displayLanguage=${encodeURIComponent(language)}`)
				.then((response) => {
					if (response.status === 404) return null
					if (!response.ok) throw new Error(String(response.status))
					return response.json() as Promise<RawPack>
				})
				.then((pack) => {
					if (gone) return
					if (!pack) return setMissing(key)
					stop = whenEngine(script, engineTag.current, () => {
						if (gone || !w.__gwRelatedMap || held.current?.key !== key) return
						const spoken = pack.language ?? language
						const html = w.__gwRelatedMap.render({ root: rootKey, title, pack, links: [], language: spoken })
						held.current = { key, html, drawn: true, language: spoken }
						redraw((n) => n + 1)
					})
				})
				.catch(() => {
					if (gone) return
					tries++
					timer = setTimeout(attempt, tries <= 4 ? 1200 * tries : 15000)
				})
		}
		attempt()
		return () => {
			gone = true
			clearTimeout(timer)
			stop()
		}
	}, [shown, drawn, localizedKey, rootKey, map?.language, script, title])
	// The engine hears about every title this section shows, once the picture is in the document.
	useEffect(() => {
		if (!shown || !drawn) return
		const w = window as MapWindow
		const stop = whenEngine(script, engineTag.current, () => {
			if (!w.__gwRelatedMap) return
			w.__gwRelatedMap.nav = (href) => navigate(href)
			w.__gwRelatedMap.boot()
		})
		return () => {
			stop()
			if (w.__gwRelatedMap) w.__gwRelatedMap.nav = null
		}
	}, [shown, drawn, script, navigate, localizedKey])
	// A title without related titles after all: the section goes.
	if (!map || missing === localizedKey) return null
	return (
		<>
			<section
				// The height is the styled section's own: 602 px on a phone, 576 px on a wide screen. Until the style is
				// there the content is hidden, and the style's first rule shows it.
				className="pl pl-map h-[602px] overflow-hidden lg:h-[576px] [&>*]:invisible"
				data-related-map=""
				data-media-language={held.current?.language ?? map.language ?? "en"}
				data-pl-root={rootKey}
				data-pl-title={media.details.title}
				data-title-language={media.details.presentation?.title.language}
				data-canonical-title={media.details.canonical_title}
				tabIndex={-1}
				aria-label={`Titles like ${media.details.title}`}
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: markup drawn by the engine on the server.
				dangerouslySetInnerHTML={{ __html: held.current?.html ?? "" }}
			/>
			<NavigationWatch />
			{inDocument && (
				<>
					{/* The inline script puts the style's link in here. React never looks inside. */}
					<div
						hidden={true}
						data-related-map-assets=""
						suppressHydrationWarning={true}
						// biome-ignore lint/security/noDangerouslySetInnerHtml: empty, so that React leaves its children alone.
						dangerouslySetInnerHTML={{ __html: "" }}
					/>
					<script
						// biome-ignore lint/security/noDangerouslySetInnerHtml: a constant with the style's address.
						dangerouslySetInnerHTML={{
							__html: earlyScript(css, css !== cssPath),
						}}
					/>
					{/* After the section, so that the engine finds it. */}
					{script && (
						<script
							ref={engineTag}
							async={true}
							src={assetUrl(script)}
							crossOrigin={assetBase() ? "anonymous" : undefined}
							data-related-map-engine=""
						/>
					)}
				</>
			)}
		</>
	)
}
