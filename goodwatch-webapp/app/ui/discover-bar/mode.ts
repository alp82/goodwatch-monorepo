// Discover's two modes. Easy is the page by default; Advanced adds the filter bar and is in the URL as mode=advanced.
import { useSearchParams } from "@remix-run/react"
import { useCallback } from "react"

export type DiscoverMode = "easy" | "advanced"

export function useDiscoverMode() {
	const [params, setParams] = useSearchParams()
	const mode: DiscoverMode = params.get("mode") === "advanced" ? "advanced" : "easy"
	const setMode = useCallback(
		(next: DiscoverMode) =>
			setParams(
				(previous) => {
					const out = new URLSearchParams(previous)
					if (next === "advanced") out.set("mode", "advanced")
					else out.delete("mode")
					return out
				},
				{ replace: true, preventScrollReset: true },
			),
		[setParams],
	)
	return { mode, setMode }
}
