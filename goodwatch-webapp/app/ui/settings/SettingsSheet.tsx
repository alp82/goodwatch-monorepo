// A Settings sheet: each setting's page opens over the Settings tiles, from the right on a wide screen and from the
// bottom on a phone. It is a route of its own (/settings/where-you-watch, /settings/imports, ...), so a link, a reload
// or the back button opens it again. Closing it (the button, Escape, a click beside it) goes back to /settings once it
// has slid away. Motion is transform and opacity only, and none with reduced motion.
import { XMarkIcon } from "@heroicons/react/24/solid"
import { useNavigate } from "@remix-run/react"
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
	const leave = useCallback(
		() => navigate(SETTINGS_PATH, { preventScrollReset: true }),
		[navigate],
	)
	const close = useCallback(() => {
		if (closing) return
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
			return leave()
		setClosing(true)
	}, [closing, leave])
	// The animation's end leaves; a timer stands in should it never end (a hidden tab).
	useEffect(() => {
		if (!closing) return
		const timer = window.setTimeout(leave, 400)
		return () => window.clearTimeout(timer)
	}, [closing, leave])

	useEffect(() => {
		heading.current?.focus({ preventScroll: true })
		// The page under the sheet stays where it is.
		const root = document.documentElement
		const before = root.style.overflow
		root.style.overflow = "hidden"
		return () => {
			root.style.overflow = before
		}
	}, [])
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !e.defaultPrevented) close()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [close])

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
				onAnimationEnd={(e) => {
					if (closing && e.target === e.currentTarget) leave()
				}}
				className={`fixed inset-x-0 top-14 bottom-0 z-[1040] flex flex-col rounded-t-2xl bg-gray-900 shadow-2xl ring-1 ring-white/10 motion-reduce:animate-none md:inset-y-0 md:right-0 md:left-auto md:w-full md:rounded-l-2xl md:rounded-tr-none ${wide ? "md:max-w-3xl" : "md:max-w-xl"} ${closing ? "animate-sheet-out-down md:animate-sheet-out-side" : "animate-sheet-in-up md:animate-sheet-in-side"}`}
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
