// The full score picker of the title page: Dislike / Okay / Good / Excellent over the 1-10 strip, with Clear score
// inside. OwnScore.tsx loads this module when a visitor reaches for the score rectangle.
//
// A sheet from the bottom edge on a phone, a dialog in the middle of the screen from md up. It is fixed to the
// screen and rendered into the body, so it is inside the screen wherever the page is scrolled and whatever its
// opener sits in.
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import type { Score } from "~/server/scores.server"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"

const FOCUSABLE = "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"

export default function ScoreDialog({
	title,
	open,
	value,
	busy,
	opener,
	onRate,
	onClear,
	onClose,
}: {
	title: string
	open: boolean
	value: Score | null
	busy: boolean
	/** What opened it: the focus returns there. */
	opener: RefObject<HTMLElement | null>
	onRate: (score: Score) => void
	onClear: () => void
	onClose: () => void
}) {
	if (!open) return null
	return <Panel title={title} value={value} busy={busy} opener={opener} onRate={onRate} onClear={onClear} onClose={onClose} />
}

function Panel({ title, value, busy, opener, onRate, onClear, onClose }: Omit<Parameters<typeof ScoreDialog>[0], "open">) {
	const panel = useRef<HTMLDivElement>(null)
	const shade = useRef<HTMLDivElement>(null)
	const closeRef = useRef(onClose)
	closeRef.current = onClose

	// It comes up from the bottom edge on a phone and fades in from md up; neither with "reduce motion".
	useLayoutEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		const sheet = !window.matchMedia("(min-width: 768px)").matches
		shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" })
		panel.current?.animate(sheet ? [{ transform: "translateY(100%)" }, { transform: "none" }] : [{ opacity: 0 }, { opacity: 1 }], {
			duration: sheet ? 240 : 160,
			easing: "cubic-bezier(.2,.8,.2,1)",
		})
	}, [])

	useEffect(() => {
		const from = opener.current
		const scroll = document.body.style.overflow
		document.body.style.overflow = "hidden"
		panel.current?.focus({ preventScroll: true })
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") return closeRef.current()
			if (event.key !== "Tab") return
			// The focus stays in the dialog while it is up.
			const stops = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
			if (!stops.length) return
			const first = stops[0]
			const last = stops[stops.length - 1]
			const at = document.activeElement
			if (event.shiftKey ? at === first || at === panel.current : at === last) {
				event.preventDefault()
				;(event.shiftKey ? last : first).focus()
			}
		}
		window.addEventListener("keydown", onKey)
		return () => {
			window.removeEventListener("keydown", onKey)
			document.body.style.overflow = scroll
			from?.focus({ preventScroll: true })
		}
	}, [opener])

	return createPortal(
		<div data-score-dialog className="fixed inset-0 z-[1100] flex items-end justify-center md:items-center md:p-4">
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it, and the Close button is the keyboard's way. */}
			<div ref={shade} onClick={onClose} className="absolute inset-0 bg-black/70" />
			<div
				ref={panel}
				// biome-ignore lint/a11y/useSemanticElements: a <dialog> can't be a sheet that comes up from the bottom edge.
				role="dialog"
				aria-modal="true"
				aria-label={`Your score for ${title}`}
				tabIndex={-1}
				className="relative w-full rounded-t-3xl border-t border-white/15 bg-stone-900 px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-3 text-white shadow-[0_-12px_48px_rgba(0,0,0,.6)] outline-none md:w-[30rem] md:rounded-2xl md:border md:p-5 md:shadow-2xl"
			>
				<div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 md:hidden" aria-hidden="true" />
				<div className="mb-3 flex items-center justify-between gap-3">
					<h2 className="min-w-0 truncate text-base font-bold">{title}</h2>
					<button
						type="button"
						data-score-dialog-close
						onClick={onClose}
						aria-label="Close"
						className="-mr-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
					>
						<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
							<path d="M5 5l10 10M15 5L5 15" />
						</svg>
					</button>
				</div>
				<ScoreControl value={value} busy={busy} onRate={onRate} onClear={onClear} />
			</div>
		</div>,
		document.body,
	)
}
