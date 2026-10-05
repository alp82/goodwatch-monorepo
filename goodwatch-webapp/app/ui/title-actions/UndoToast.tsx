// A short message at the bottom of the screen with an Undo button, gone after a few seconds.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"

const TOAST_MS = 6000

export interface UndoToastMessage {
	id: number
	text: string
}

export function UndoToast({
	toast,
	onUndo,
	onDismiss,
	className = "bottom-28 lg:bottom-6",
}: {
	toast: UndoToastMessage | null
	onUndo: () => void
	onDismiss: () => void
	/** Where it sits above the bottom edge: clear of the phone navigation by default. */
	className?: string
}) {
	const id = toast?.id
	useEffect(() => {
		if (id == null) return
		const timer = setTimeout(onDismiss, TOAST_MS)
		return () => clearTimeout(timer)
	}, [id, onDismiss])
	return (
		<div
			className={`pointer-events-none fixed inset-x-0 z-[1050] flex justify-center px-4 ${className}`}
			aria-live="polite"
		>
			<AnimatePresence>
				{toast && (
					<motion.div
						key={toast.id}
						initial={{ y: 12, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 12, opacity: 0 }}
						className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-stone-900/95 py-2 pl-4 pr-2 text-sm text-white shadow-2xl shadow-black/60 backdrop-blur"
						data-toast
					>
						<span className="min-w-0">{toast.text}</span>
						<button
							type="button"
							onClick={onUndo}
							className="shrink-0 cursor-pointer rounded-full bg-white/10 px-3 py-1 font-semibold text-amber-300 hover:bg-white/20"
						>
							Undo
						</button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

/**
 * The toast for one surface. `say(text, undo)` shows it; `node` goes anywhere in the surface's markup (it renders at
 * the end of the page, so no ancestor can clip or offset it).
 */
export function useUndoToast(className?: string): { say: (text: string, undo: () => void) => void; node: ReactNode } {
	const [toast, setToast] = useState<(UndoToastMessage & { undo: () => void }) | null>(null)
	// Stays mounted after the first message, so a later one can animate out.
	const [used, setUsed] = useState(false)
	const say = useCallback((text: string, undo: () => void) => {
		setUsed(true)
		setToast({ id: Date.now(), text, undo })
	}, [])
	const dismiss = useCallback(() => setToast(null), [])
	const node = used
		? createPortal(
				<UndoToast
					toast={toast}
					className={className}
					onDismiss={dismiss}
					onUndo={() => {
						toast?.undo()
						setToast(null)
					}}
				/>,
				document.body,
			)
		: null
	return { say, node }
}
