// A small tooltip above its child: on mouse hover or keyboard focus, after a short wait, never after a tap. Opacity and
// transform only. Used by the compact sizes of Ready to watch and For you + Sort, where labels give way to icons.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"

const WAIT_MS = 160

export function Tip({
	tip,
	children,
	off = false,
	align = "center",
	grow = false,
}: {
	tip: ReactNode
	children: ReactNode
	/** The label is on screen already: the child alone. */
	off?: boolean
	/** Where the bubble lines up with its child; "start" and "end" keep it on screen near the page's edges. */
	align?: "center" | "start" | "end"
	/** Take the free width of a flex row, as the child would. */
	grow?: boolean
}) {
	const [shown, setShown] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => () => clearTimeout(timer.current), [])
	if (off)
		return grow ? (
			<span className="flex flex-auto">{children}</span>
		) : (
			<>{children}</>
		)
	const show = () => {
		clearTimeout(timer.current)
		timer.current = setTimeout(() => setShown(true), WAIT_MS)
	}
	const hide = () => {
		clearTimeout(timer.current)
		setShown(false)
	}
	return (
		<span
			className={`relative flex ${grow ? "flex-auto" : ""}`}
			onPointerEnter={(event) => event.pointerType === "mouse" && show()}
			onPointerLeave={hide}
			onFocus={(event) =>
				(event.target as HTMLElement).matches(":focus-visible") && show()
			}
			onBlur={hide}
			onPointerDown={hide}
		>
			{children}
			<AnimatePresence>
				{shown && (
					<span
						className={`pointer-events-none absolute bottom-full z-[60] mb-2 ${align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2"}`}
					>
						<motion.span
							role="tooltip"
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 4 }}
							transition={{ duration: 0.12 }}
							className="block rounded-xl bg-gray-900 px-3 py-2 text-left text-xs whitespace-nowrap text-gray-300 shadow-[0_14px_40px_-10px_rgba(0,0,0,.9)] ring-1 ring-white/10"
						>
							{tip}
						</motion.span>
					</span>
				)}
			</AnimatePresence>
		</span>
	)
}

/** A tooltip's two lines: the name with an On or Off badge, and what it does. */
export function TipText({
	name,
	on,
	line,
}: {
	name: string
	on?: boolean
	line?: string
}) {
	return (
		<>
			<span className="flex items-center gap-2 text-[13px] font-bold text-white">
				{name}
				{on !== undefined && (
					<span
						className={`rounded-full px-1.5 py-px text-[10px] font-bold ${on ? "bg-amber-500 text-gray-950" : "text-gray-400 ring-1 ring-inset ring-white/15"}`}
					>
						{on ? "On" : "Off"}
					</span>
				)}
			</span>
			{line && <span className="mt-0.5 block text-gray-400">{line}</span>}
		</>
	)
}
