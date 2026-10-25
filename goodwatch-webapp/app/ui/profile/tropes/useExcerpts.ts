// How a trope shows up in a few of the owner's titles: the excerpts from /u/:handle/tropes/excerpts, loaded once per
// trope and title list and kept for the page's life, so a hero band's preview and its open band share one request.
import { useEffect, useState } from "react"

interface Example {
	key: string
	text: string
}
const cache = new Map<string, Example[]>()

export function useExcerpts(handle: string, trope: string, keys: string[]) {
	const id = `${handle}\u0000${trope}\u0000${keys.join(",")}`
	const [state, setState] = useState<{ id: string; list: Example[] } | null>(
		() => (cache.has(id) ? { id, list: cache.get(id) ?? [] } : null),
	)
	// `id` holds the handle, the trope and the keys.
	useEffect(() => {
		const known = cache.get(id)
		if (known) {
			setState({ id, list: known })
			return
		}
		if (!keys.length) {
			setState({ id, list: [] })
			return
		}
		let live = true
		const q = new URLSearchParams({ trope, keys: keys.join(",") })
		fetch(`/u/${encodeURIComponent(handle)}/tropes/excerpts?${q}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((d: { examples: Example[] } | null) => {
				// A failed request isn't kept, so opening the band again retries it.
				if (d) cache.set(id, d.examples)
				if (live) setState({ id, list: d?.examples ?? [] })
			})
			.catch(() => live && setState({ id, list: [] }))
		return () => {
			live = false
		}
	}, [id])
	const list = state?.id === id ? state.list : null
	return {
		loading: list === null,
		textOf: (key: string) => list?.find((e) => e.key === key)?.text ?? null,
	}
}
