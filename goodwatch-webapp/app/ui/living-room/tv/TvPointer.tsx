// The TV's own pointer, the ring, and the hook that starts pointing (pointing.ts). The ring is drawn here, hidden,
// as part of the room; everything that moves it, and the Remote with it, is a chunk of its own that is asked for
// at the first sign that a person uses the page. A visitor who only reads the page, or a crawler, never requests
// it, and until it is there a click and a tap do what they always did (`Item`, kit.tsx).
import { type RefObject, useEffect, useRef } from "react"
import { onFirstInteraction } from "~/utils/first-interaction"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { Pointing, PointingElements, PointingScene } from "./pointing"

const loadPointing = reloadOnStaleChunk(() => import("./pointing"))

/**
 * The ring: a circle with a centre dot, white with a dark edge so it reads on any picture. The pointing loop
 * moves it and writes its states as attributes (shown, over an item, over the Expand key, pressed); tv.css draws
 * them. The phone's is a fifth smaller, as its TV is.
 */
export function TvPointer({
	pointer,
	small,
}: { pointer: RefObject<HTMLDivElement>; small?: boolean }) {
	return (
		<div
			ref={pointer}
			data-tv-pointer
			aria-hidden
			className={`tvp ${small ? "tvp-small" : ""}`}
		>
			<div className="tvp-shape">
				<i className="tvp-ring" />
				<i className="tvp-dot" />
			</div>
		</div>
	)
}

/**
 * Makes the Remote aim at the cursor, or at a finger on the picture, and the ring follow it over the TV.
 * `scene` is what the room measured, or null until it has; it is read on every event.
 */
export function usePointing(
	els: PointingElements,
	scene: PointingScene | null,
) {
	const latest = useRef({ els, scene })
	latest.current = { els, scene }
	const running = useRef<Pointing | null>(null)
	useEffect(() => {
		let gone = false
		onFirstInteraction(() => {
			if (gone) return
			loadPointing()
				.then(({ startPointing }) => {
					if (gone) return
					running.current = startPointing(
						latest.current.els,
						() => latest.current.scene,
					)
				})
				// Without it the page works as before: the system cursor, a click, a tap.
				.catch(() => {})
		})
		return () => {
			gone = true
			running.current?.stop()
			running.current = null
		}
	}, [])
	// The scene changed (the TV went off, the room went away, the window was resized): the loop looks again. It
	// reads the scene itself; the dependency only says when.
	useEffect(() => running.current?.refresh(), [scene])
}
