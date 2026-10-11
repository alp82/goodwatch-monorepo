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
//
// A walk is forgotten when the page is left.
import { useMatches, useNavigate } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import type { RelatedMapData } from "~/server/related-map.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import cssPath from "~/ui/related-map/related-map.css?url"
import { assetBase, assetUrl } from "~/utils/asset-url"
import { useHydrated } from "~/utils/hydrated"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const loadClient = reloadOnStaleChunk(() => import("~/ui/related-map/client"))

interface MapWindow {
	__gwRelatedMap?: { boot: () => void; nav: ((href: string) => void) | null }
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

/** The section's data from the title route's loader, or undefined when the page shows the related titles carousel. */
export function useRelatedMap(): RelatedMapData | undefined {
	for (const match of useMatches()) {
		const data = match.data as { relatedMap?: RelatedMapData } | undefined
		if (data?.relatedMap) return data.relatedMap
	}
	return undefined
}

/**
 * The markup of a document's section. The loader's data of a document doesn't carry it (see
 * server/related-map.server.ts): the server reads what the loader drew, and the browser what the document holds.
 */
function documentMarkup(rootKey: string): string {
	if (typeof document === "undefined")
		return (
			(
				globalThis as { __gwRelatedMapMarkup?: Map<string, string> }
			).__gwRelatedMapMarkup?.get(rootKey) ?? ""
		)
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
	// title (a revalidation) doesn't draw over a walk.
	const held = useRef<{ key: string; html: string }>()
	if (map && held.current?.key !== rootKey)
		held.current = { key: rootKey, html: map.html ?? documentMarkup(rootKey) }
	const engineTag = useRef<HTMLScriptElement>(null)
	const css = assetUrl(cssPath)
	const script = map?.script ?? null
	const shown = Boolean(map)
	useEffect(() => {
		if (shown) keepStyle(css, cssPath)
	}, [shown, css])
	// The engine hears about every title this section shows, once the picture is in the document.
	useEffect(() => {
		if (!shown) return
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
	}, [shown, script, navigate, rootKey])
	if (!map) return null
	return (
		<>
			<section
				// The height is the styled section's own: 602 px on a phone, 576 px on a wide screen. Until the style is
				// there the content is hidden, and the style's first rule shows it.
				className="pl pl-map h-[602px] overflow-hidden lg:h-[576px] [&>*]:invisible"
				data-related-map=""
				data-pl-root={rootKey}
				data-pl-title={media.details.title}
				tabIndex={-1}
				aria-label={`Titles like ${media.details.title}`}
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: markup drawn by the engine on the server.
				dangerouslySetInnerHTML={{ __html: held.current?.html ?? "" }}
			/>
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
