// PROTOTYPE - throwaway (#662). The prototype's state in the tab: the variant and member from the address
// (`?variant=line|dot|note|none&as=m1..m5`), kept for the tab so the hub and the Taste page see them after a
// navigation, and the forming set a rating in this tab started (scores in the prototype are never saved).
import { useEffect, useState } from "react"
import type { Forming, HintView } from "~/server/prototype-forming-hint/index.server"

export const VARIANTS = ["line", "dot", "note", "none"] as const
export type Variant = (typeof VARIANTS)[number]
export const VARIANT_INFO: Record<Variant, string> = {
	line: "A quiet line where the taste line was, fading after 8 seconds",
	dot: "Nothing at the moment; a dot on the Taste tile in Browse",
	note: "Nothing at the moment; a note on Your taste mix",
	none: "Don't build it: nothing anywhere",
}

const KEY = "proto-662"
const FIRED = "proto-662-fired"
const SEEN = "proto-662-seen"
const EVENT = "proto-662-change"

export interface Proto {
	variant: Variant
	as: string | null
}

function read<T>(key: string): T | null {
	try {
		const raw = sessionStorage.getItem(key)
		return raw ? (JSON.parse(raw) as T) : null
	} catch {
		return null
	}
}
function write(key: string, value: unknown) {
	try {
		if (value === null) sessionStorage.removeItem(key)
		else sessionStorage.setItem(key, JSON.stringify(value))
	} catch {}
	window.dispatchEvent(new Event(EVENT))
}

/** The prototype's variant and member; null when the prototype is off (no `?variant=` in this tab). */
export function useProto(): Proto | null {
	const [proto, setProto] = useState<Proto | null>(null)
	useEffect(() => {
		const sync = () => setProto(read<Proto>(KEY))
		// The address sets the prototype for the tab; written only when it changes, so the change event doesn't loop.
		const params = new URLSearchParams(window.location.search)
		const variant = params.get("variant") as Variant | null
		const current = read<Proto>(KEY)
		if (variant && VARIANTS.includes(variant) && (current?.variant !== variant || current?.as !== params.get("as")))
			write(KEY, { variant, as: params.get("as") })
		sync()
		window.addEventListener(EVENT, sync)
		window.addEventListener("popstate", sync)
		return () => {
			window.removeEventListener(EVENT, sync)
			window.removeEventListener("popstate", sync)
		}
	}, [])
	return proto
}

export function setProto(next: Proto | null) {
	write(KEY, next)
	write(FIRED, null)
	write(SEEN, null)
}

/** What a rating in this tab started, until the Taste page has shown it. */
export function useFired() {
	const [fired, set] = useState<{ fired: Forming | null; seen: boolean }>({ fired: null, seen: false })
	useEffect(() => {
		const sync = () => set({ fired: read<Forming>(FIRED), seen: !!read<boolean>(SEEN) })
		sync()
		window.addEventListener(EVENT, sync)
		return () => window.removeEventListener(EVENT, sync)
	}, [])
	return fired
}
export const fire = (f: Forming | null) => {
	write(FIRED, f)
	write(SEEN, null)
}
// Written once: the change event would otherwise re-render every reader for nothing.
export const markSeen = () => {
	if (!read<boolean>(SEEN)) write(SEEN, true)
}

export async function fetchHint(proto: Proto, key?: number, score?: number): Promise<HintView | null> {
	const params = new URLSearchParams()
	if (proto.as) params.set("as", proto.as)
	if (key && score) {
		params.set("key", String(key))
		params.set("score", String(score))
	}
	const res = await fetch(`/prototype/forming-hint/api?${params}`)
	return res.ok ? ((await res.json()) as HintView | null) : null
}

/** The hint now, for the member (`now`), fetched once per member. */
export function useHint(proto: Proto | null) {
	const [hint, setHint] = useState<HintView | null>(null)
	useEffect(() => {
		if (!proto) return
		let live = true
		fetchHint(proto).then((h) => live && setHint(h))
		return () => {
			live = false
		}
	}, [proto?.as, !!proto])
	return hint
}
