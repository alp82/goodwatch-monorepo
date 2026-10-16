// A Settings sheet: each setting's page opens over the Settings tiles, from the right on a wide screen and from the
// bottom on a phone. It is a route of its own (/settings/where-you-watch, /settings/imports, ...), so a link, a reload
// or the back button opens it again. Closing it (the button, Escape, a click beside it) goes back to /settings once it
// has slid away. Motion is transform and opacity only, and none with reduced motion.
import { XMarkIcon } from "@heroicons/react/24/solid"
import { useLocation, useNavigate } from "@remix-run/react"
import type React from "react"
import {
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import { SETTINGS_PATH } from "./paths"

export function SettingsSheet({
	title,
	subtitle,
	wide = false,
	children,
}: {
	title: string
	subtitle?: ReactNode
	/** A wider sheet on a wide screen, for a page with a lot in it (Imports). */
	wide?: boolean
	children: ReactNode
}) {
	const navigate = useNavigate()
	const headingId = useId()
	const heading = useRef<HTMLHeadingElement>(null)
	const [closing, setClosing] = useState(false)
	// Back to the tiles the sheet was opened from, or in place of the sheet's entry (a link from elsewhere, a reload):
	// either way, Back then leaves Settings rather than open the sheet again.
	const fromTiles = Boolean(
		(useLocation().state as { openedFromTiles?: boolean } | null)
			?.openedFromTiles,
	)
	// Once only: going back twice (the animation's end and its timer, a double click) would leave Settings.
	const left = useRef(false)
	const leave = useCallback(() => {
		if (left.current) return
		left.current = true
		if (fromTiles) navigate(-1)
		else navigate(SETTINGS_PATH, { replace: true, preventScrollReset: true })
	}, [navigate, fromTiles])
	const close = useCallback(() => {
		if (closing) return
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
			return leave()
		setClosing(true)
	}, [closing, leave])
	// Tab stays in the sheet: the page under it is out of reach while it is open. Focus that gets out anyway (from the
	// page's body, past a radio group) comes back to the heading; a dialog over the sheet and the toast may have it.
	const sheet = useRef<HTMLDivElement>(null)
	// Before the effect below, so this listener is gone when that one hands the focus back to the tile.
	useEffect(() => {
		const onFocus = (e: FocusEvent) => {
			const at = e.target
			if (!(at instanceof Element) || !sheet.current) return
			if (sheet.current.contains(at)) return
			if (at.closest('[role="dialog"], [data-toast]')) return
			heading.current?.focus({ preventScroll: true })
		}
		document.addEventListener("focusin", onFocus)
		return () => document.removeEventListener("focusin", onFocus)
	}, [])
	// The animation's end leaves; a timer stands in should it never end (a hidden tab).
	useEffect(() => {
		if (!closing) return
		const timer = window.setTimeout(leave, 400)
		return () => window.clearTimeout(timer)
	}, [closing, leave])

	useEffect(() => {
		// What opened the sheet (a tile) gets the focus back when it closes.
		const opener =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null
		heading.current?.focus({ preventScroll: true })
		// The page under the sheet stays where it is, its scrollbar's room kept so nothing shifts.
		const root = document.documentElement
		const before = {
			overflow: root.style.overflow,
			gutter: root.style.scrollbarGutter,
		}
		if (window.innerWidth > root.clientWidth)
			root.style.scrollbarGutter = "stable"
		root.style.overflow = "hidden"
		return () => {
			root.style.overflow = before.overflow
			root.style.scrollbarGutter = before.gutter
			// At once, not on a later frame: a mount right after (React's development double run) records the opener again.
			if (opener?.isConnected) opener.focus({ preventScroll: true })
		}
	}, [])
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || e.defaultPrevented) return
			// Escape belongs to a dialog open over the sheet (search, the menu, a how-to), and in a search field with
			// text it doesn't throw the sheet away.
			if (document.querySelector('[role="dialog"]:not([data-settings-sheet])'))
				return
			const at = e.target
			if (
				at instanceof HTMLInputElement &&
				at.matches("input:not([type]), input[type=text], input[type=search]") &&
				at.value
			)
				return
			close()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [close])
	const keepFocus = (e: React.KeyboardEvent) => {
		if (e.key !== "Tab" || !sheet.current) return
		const reachable = [
			...sheet.current.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
			),
		].filter((element) => element.getClientRects().length > 0)
		const first = reachable[0]
		const last = reachable[reachable.length - 1]
		if (!first || !last) return
		if (
			e.shiftKey &&
			(document.activeElement === first ||
				document.activeElement === heading.current)
		) {
			e.preventDefault()
			last.focus()
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault()
			first.focus()
		}
	}

	return (
		<>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: a pointer's way out; Escape and the Close button are the keyboard's. */}
			<div
				aria-hidden="true"
				onClick={close}
				className={`fixed inset-0 z-[1030] bg-black/60 motion-reduce:animate-none ${closing ? "animate-fade-out" : "animate-fade-in"}`}
			/>
			{/* biome-ignore lint/a11y/useSemanticElements: a route's sheet, not a <dialog> opened by showModal. */}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={headingId}
				data-settings-sheet
				ref={sheet}
				onKeyDown={keepFocus}
				onAnimationEnd={(e) => {
					if (closing && e.target === e.currentTarget) leave()
				}}
				className={`fixed inset-x-0 top-14 bottom-0 z-[1040] flex flex-col rounded-t-2xl bg-gray-900 shadow-2xl ring-1 ring-white/10 motion-reduce:animate-none md:inset-y-0 md:right-0 md:left-auto md:w-full md:rounded-l-2xl md:rounded-tr-none md:motion-reduce:animate-none ${wide ? "md:max-w-3xl" : "md:max-w-xl"} ${closing ? "animate-sheet-out-down md:animate-sheet-out-side" : "animate-sheet-in-up md:animate-sheet-in-side"}`}
			>
				<div className="flex items-start gap-3 border-b border-white/10 px-5 py-4 md:px-6">
					<div className="min-w-0 flex-1">
						<h2
							id={headingId}
							ref={heading}
							tabIndex={-1}
							className="text-lg font-bold text-white outline-none md:text-xl"
						>
							{title}
						</h2>
						{subtitle && (
							<p className="mt-0.5 text-sm text-gray-400">{subtitle}</p>
						)}
					</div>
					<button
						type="button"
						onClick={close}
						aria-label="Close"
						className="-mr-1.5 cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10 hover:text-white"
					>
						<XMarkIcon className="h-6 w-6" />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6">
					{children}
				</div>
			</div>
		</>
	)
}

/** A titled part of a sheet: Watching from, Your services. */
export function SheetSection({
	title,
	subtitle,
	children,
}: {
	title: string
	subtitle?: ReactNode
	children: ReactNode
}) {
	return (
		<section className="flex flex-col gap-2">
			<div>
				<h3 className="text-base font-semibold text-white">{title}</h3>
				{subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
			</div>
			{children}
		</section>
	)
}
