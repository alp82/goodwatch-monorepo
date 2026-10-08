// PROTOTYPE for "Prototype native-scroll carousels on title pages", seventh round. Throwaway code: not for production.
//
// The related titles section of the play forms (play1 to play10). Three layers, by weight:
// 1. The server's HTML: the form's picture of the page's title, drawn by the engine itself, and the plain title
//    links.
// 2. The inline script: the engine and the page's one form (see play-engine.ts). Taps work before hydration. The script and
//    the style come from the server only, so neither is part of the title route's own script.
// 3. Nothing else. A page opened by a navigation inside the app has no inline script: it loads the engine as a lazy
//    chunk when the section mounts.
//
// Real: the titles, the fingerprint levels behind every direction, mark, and filter. Faked: no title actions on
// posters, and a walk is forgotten when the page is left.
import { useNavigate } from "@remix-run/react"
import { useEffect } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { useCarouselPrototype } from "~/ui/prototype-carousels/variant"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const loadEngine = reloadOnStaleChunk(
	() => import("~/ui/prototype-carousels/play-client"),
)

interface PlayWindow {
	__gwPlay?: { boot: () => void; nav: ((href: string) => void) | null }
}
/** Set by server/prototype-play.server.ts. Not there in the browser. */
const headOf = (variant: string) =>
	typeof document === "undefined"
		? (
				globalThis as {
					__gwPlayHead?: Record<string, { css: string; script: string }>
				}
			).__gwPlayHead?.[variant]
		: undefined

export default function PlaySection({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const prototype = useCarouselPrototype()
	const navigate = useNavigate()
	const html = prototype?.play?.html
	const rootKey = `${media.mediaType === "movie" ? "m" : "s"}${media.details.tmdb_id}`
	useEffect(() => {
		const w = window as PlayWindow
		let gone = false
		const ready = () => {
			if (gone || !w.__gwPlay) return
			w.__gwPlay.nav = (href) => navigate(href)
			w.__gwPlay.boot()
		}
		if (w.__gwPlay) ready()
		else
			loadEngine().then((chunk) => {
				chunk.start()
				ready()
			})
		return () => {
			gone = true
			if (w.__gwPlay) w.__gwPlay.nav = null
		}
	}, [navigate, rootKey])
	if (!html || !prototype) return null
	const head = headOf(prototype.variant)
	return (
		<>
			<style
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of play-css.ts, from the server.
				dangerouslySetInnerHTML={{ __html: head?.css ?? "" }}
			/>
			<section
				className={`pl pl-${prototype.variant}`}
				data-play={prototype.variant}
				data-pl-root={rootKey}
				data-pl-title={media.details.title}
				tabIndex={-1}
				aria-label={`Titles like ${media.details.title}`}
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: markup drawn by the engine on the server.
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			{/* After the section, so that it finds it while the document is parsed. */}
			<script
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: the engine's own source, from the server.
				dangerouslySetInnerHTML={{ __html: head?.script ?? "" }}
			/>
		</>
	)
}
