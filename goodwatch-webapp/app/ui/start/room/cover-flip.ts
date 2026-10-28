// One shelf slot's flip to a new title (ShelfCovers.tsx): it waits for its turn in the sweep and for the new poster,
// turns edge-on ("out"), swaps the title, then turns back from the other side ("in-start", then rest) with a glint.
//
// A change that is taken back before the swap (A → B → A, or a slot hidden and shown again by a resize) cancels the
// swap and turns the cover back to face the guest: the title it shows is the one asked for again.
import { useEffect, useState } from "react"

export type Flip = "out" | "in-start" | null

/** The half of a flip, edge-on to flat (ms). */
export const HALF_FLIP_MS = 220
/** The sweep's length: the last slot starts this much after the first (ms). */
export const SWEEP_MS = 900

type Keyed = { media_type: string; tmdb_id: number }

export const keyOf = (t: Keyed | null) =>
	t ? `${t.media_type}:${t.tmdb_id}` : null

/** Waits (at most 1.2 s) for a poster to decode, so the cover flips to a drawn image. */
function decoded(src: string | null): Promise<unknown> {
	if (!src || typeof Image === "undefined") return Promise.resolve()
	const img = new Image()
	img.src = src
	return Promise.race([
		Promise.resolve()
			.then(() => img.decode())
			.catch(() => {}),
		new Promise((r) => setTimeout(r, 1200)),
	])
}

export function useCoverFlip<T extends Keyed>(
	title: T | null,
	/** 0..1: when this slot's flip starts in the sweep. */
	order: number,
	/** The poster to wait for. */
	srcOf: (t: T) => string | null,
) {
	const [shown, setShown] = useState<T | null>(title)
	const [flip, setFlip] = useState<Flip>(null)
	const [glint, setGlint] = useState(false)

	useEffect(() => {
		if (keyOf(title) === keyOf(shown)) {
			// Taken back before the swap: the cleanup cancelled it, so turn back from edge-on.
			setFlip((f) => (f === "out" ? null : f))
			return
		}
		let dead = false
		const timers: ReturnType<typeof setTimeout>[] = []
		const delay = 60 + order * SWEEP_MS
		const started = performance.now()
		decoded(title ? srcOf(title) : null).then(() => {
			if (dead) return
			const wait = Math.max(0, delay - (performance.now() - started))
			timers.push(setTimeout(() => setFlip("out"), wait))
			timers.push(
				setTimeout(() => {
					setShown(title)
					setFlip("in-start")
				}, wait + HALF_FLIP_MS),
			)
		})
		return () => {
			dead = true
			for (const t of timers) clearTimeout(t)
		}
		// Keyed by the title, not the object.
	}, [keyOf(title)])

	useEffect(() => {
		if (flip !== "in-start") return
		let raf = requestAnimationFrame(() => {
			raf = requestAnimationFrame(() => {
				setFlip(null)
				setGlint(true)
			})
		})
		return () => cancelAnimationFrame(raf)
	}, [flip])

	useEffect(() => {
		if (!glint) return
		const t = setTimeout(() => setGlint(false), 450)
		return () => clearTimeout(t)
	}, [glint])

	return { shown, flip, glint }
}
