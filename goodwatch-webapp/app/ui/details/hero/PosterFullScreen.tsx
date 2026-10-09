// The poster over the whole screen. Trailer.tsx loads this module when a visitor reaches for the hero's poster.
//
// It grows out of the small poster's place and goes back into it: the big image is laid out where it ends, then
// moved from, or to, the small one's box with a transform (first, last, invert, play). With "reduce motion" it
// fades instead. A press anywhere, Escape or the close button closes it.
import { XMarkIcon } from "@heroicons/react/24/solid"
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import type { SizeRule } from "~/utils/tmdb-image"

const IN_MS = 320
const OUT_MS = 260
// As wide as the screen allows, and no taller than it: a poster is 2:3.
const BOX = "w-[min(92vw,calc(92dvh*2/3))]"
const SIZES: SizeRule[] = [[null, "92vw"]]

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

export default function PosterFullScreen({
	media,
	open,
	thumb,
	onClose,
}: {
	media: MovieResult | ShowResult
	open: boolean
	/** The small poster it grows out of and returns to. */
	thumb: RefObject<HTMLButtonElement | null>
	onClose: () => void
}) {
	if (!open || !media.details.poster_path) return null
	return <View title={media.details.title} path={media.details.poster_path} thumb={thumb} onClose={onClose} />
}

function View({ title, path, thumb, onClose }: { title: string; path: string; thumb: RefObject<HTMLButtonElement | null>; onClose: () => void }) {
	const picture = useRef<HTMLDivElement>(null)
	const shade = useRef<HTMLDivElement>(null)
	const closer = useRef<HTMLButtonElement>(null)
	const leaving = useRef(false)

	/** The transform that puts the big picture exactly over the small one. */
	const overThumb = () => {
		const small = thumb.current?.getBoundingClientRect()
		const big = picture.current?.getBoundingClientRect()
		if (!small || !big || !big.width || !small.width) return "none"
		return `translate(${small.left - big.left}px, ${small.top - big.top}px) scale(${small.width / big.width}, ${small.height / big.height})`
	}
	const close = () => {
		if (leaving.current) return
		leaving.current = true
		const box = picture.current
		if (still() || !box) return onClose()
		shade.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT_MS, easing: "ease-in", fill: "forwards" })
		const back = box.animate([{ transform: "none" }, { transform: overThumb() }], { duration: OUT_MS, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" })
		back.onfinish = onClose
		back.oncancel = onClose
		// A browser that drops the animation (a hidden tab, a busy page) must not leave the poster up.
		window.setTimeout(onClose, OUT_MS + 140)
	}
	const closeRef = useRef(close)
	closeRef.current = close

	// Before the first paint: the picture starts on the small poster, which is hidden while this one is up.
	useLayoutEffect(() => {
		const small = thumb.current
		const moving = !still()
		shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: moving ? IN_MS : 150, easing: "ease-out" })
		if (moving) picture.current?.animate([{ transform: overThumb() }, { transform: "none" }], { duration: IN_MS, easing: "cubic-bezier(.2,.8,.2,1)" })
		else picture.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 })
		if (small) small.style.visibility = "hidden"
		return () => {
			if (small) small.style.visibility = ""
		}
	}, [])

	useEffect(() => {
		const small = thumb.current
		closer.current?.focus({ preventScroll: true })
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeRef.current()
			// The close button is the one thing to focus.
			if (event.key === "Tab") {
				event.preventDefault()
				closer.current?.focus()
			}
		}
		window.addEventListener("keydown", onKey)
		return () => {
			window.removeEventListener("keydown", onKey)
			small?.focus({ preventScroll: true })
		}
	}, [])

	return createPortal(
		// biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it, and the close button is the keyboard's way.
		<div
			data-poster-view
			// biome-ignore lint/a11y/useSemanticElements: a <dialog> can't play the way back before it closes.
			role="dialog"
			aria-modal="true"
			aria-label={`Poster for ${title}`}
			onClick={close}
			className="fixed inset-0 z-[1100] flex cursor-zoom-out items-center justify-center p-4"
		>
			<div ref={shade} className="absolute inset-0 bg-black/90" />
			<div ref={picture} className={`relative aspect-[2/3] origin-top-left overflow-hidden rounded-xl bg-white/5 shadow-2xl ${BOX}`}>
				<TmdbImage kind="poster" path={path} sizes={SIZES} maxWidth={500} priority="eager" alt={`Poster for ${title}`} className="h-full w-full object-cover" draggable={false} />
			</div>
			<button
				ref={closer}
				type="button"
				data-poster-close
				aria-label="Close"
				onClick={close}
				className="absolute right-3 top-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
			>
				<XMarkIcon className="h-6 w-6" />
			</button>
		</div>,
		document.body,
	)
}
