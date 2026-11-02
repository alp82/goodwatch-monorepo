// Runs a described search (described-search.ts): asks the interpreter and returns the URL parameters for it.
import { useCallback, useRef } from "react"
import {
	VIEW_KEYS,
	type Interpretation,
	describedParams,
	filtersToKeep,
} from "./described-search"

const INTERPRET_LIMIT = 512

export function useDescribedSearch() {
	const last = useRef<{ result: Interpretation; existing: string } | undefined>(undefined)
	const latest = useRef(0)
	/** The parameters to go to; null when a newer search took over while this one was asked. */
	const search = useCallback(async (typed: string, entering: boolean) => {
		const asking = ++latest.current
		// A change while the interpreter reads (Ready, a filter, Back) counts: the words are read again on the new URL.
		for (let attempt = 0; ; attempt++) {
			const before = window.location.search
			const current = new URLSearchParams(before)
			const kept = filtersToKeep(current, last.current?.result, last.current?.existing)
			const existing = kept.toString()
			let result: Interpretation | null = null
			try {
				const response = await fetch("/api/discover/interpret", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ query: typed.slice(0, INTERPRET_LIMIT), existing }),
				})
				if (response.ok) result = (await response.json()) as Interpretation
			} catch {
				// The words are searched as they are.
			}
			if (asking !== latest.current) return null
			if (window.location.search !== before && attempt < 2) continue
			last.current = result ? { result, existing } : undefined
			return describedParams(current, typed, kept, result, entering)
		}
	}, [])
	/** Takes back what the last search's words added, when the field is cleared. */
	const clear = useCallback((current: URLSearchParams) => {
		latest.current++
		const out = filtersToKeep(current, last.current?.result, last.current?.existing)
		for (const key of [...VIEW_KEYS, "sort"]) {
			const value = current.get(key)
			if (value) out.set(key, value)
		}
		last.current = undefined
		return out
	}, [])
	return { search, clear }
}
