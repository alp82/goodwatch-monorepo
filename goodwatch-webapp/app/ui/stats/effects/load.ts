// The effects chunk (runtime.ts), fetched on first interaction or first use, never for the first view. A tab from
// before a deploy reloads instead of failing on the old chunk.
import { useEffect } from "react"
import { onFirstInteraction } from "~/utils/first-interaction"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

export const loadEffects = reloadOnStaleChunk(() => import("./runtime"))

/** Starts the chapters' effects at the first sign of use; nothing with reduced motion. */
export function usePageEffects() {
	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		let stop: (() => void) | null = null
		let gone = false
		onFirstInteraction(() => {
			void loadEffects()
				.then((m) => {
					if (!gone) stop = m.startPageEffects()
				})
				.catch(() => {})
		})
		return () => {
			gone = true
			stop?.()
		}
	}, [])
}
