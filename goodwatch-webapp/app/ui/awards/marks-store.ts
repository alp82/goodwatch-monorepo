// The award marks the browser knows. The first card that asks loads every mark once, when the browser is idle, from
// /api/award-marks (about 6 KB gzipped, HTTP-cached for an hour); every later card on every page reads it from memory.
// The server's HTML has no marks, so hydration matches; a mark fades in once they arrive. A failed load is tried again
// at the next ask after a minute.
import { useEffect, useSyncExternalStore } from "react"
import {
	type AwardMediaType,
	awardKey,
	decodeAwardMarks,
} from "~/domain/award-marks"

const RETRY_MS = 60_000

let marks: Map<string, string> | null = null
let state: "idle" | "waiting" | "failed" = "idle"
let failedAt = 0
const listeners = new Set<() => void>()

async function load() {
	try {
		const response = await fetch("/api/award-marks")
		if (!response.ok) throw new Error(`HTTP ${response.status}`)
		marks = decodeAwardMarks(await response.json())
		for (const l of listeners) l()
	} catch {
		state = "failed"
		failedAt = Date.now()
	}
}

function ask() {
	if (marks || state === "waiting") return
	if (state === "failed" && Date.now() - failedAt < RETRY_MS) return
	state = "waiting"
	const idle =
		window.requestIdleCallback ?? ((run: () => void) => setTimeout(run, 200))
	idle(() => void load())
}

const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

/** The short name of the top body the title won ("Oscar"); null while unknown and for a title without a win. */
export function useAwardMark(
	mediaType: AwardMediaType,
	tmdbId: number,
): string | null {
	useEffect(ask, [])
	return useSyncExternalStore(
		subscribe,
		() => marks?.get(awardKey(mediaType, tmdbId)) ?? null,
		() => null,
	)
}
