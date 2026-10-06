// The undo toast for one surface. The toast and the animation library behind it load on first use: no page needs them
// before a person has acted.
import { type ReactNode, Suspense, lazy, useCallback, useState } from "react"
import { createPortal } from "react-dom"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { UndoToastMessage } from "./UndoToast"

const loadUndoToast = reloadOnStaleChunk(() => import("./UndoToast"))
const UndoToast = lazy(() => loadUndoToast().then((module) => ({ default: module.UndoToast })))

/** Fetches the toast ahead of its first message. Call it when an action that answers with the toast is likely. */
export function warmUndoToast() {
	void loadUndoToast().catch(() => {})
}

/**
 * `say(text, undo)` shows the toast; `node` goes anywhere in the surface's markup (it renders at the end of the page,
 * so no ancestor can clip or offset it).
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
				<Suspense fallback={null}>
					<UndoToast
						toast={toast}
						className={className}
						onDismiss={dismiss}
						onUndo={() => {
							toast?.undo()
							setToast(null)
						}}
					/>
				</Suspense>,
				document.body,
			)
		: null
	return { say, node }
}
