// Where the person has been on the Explorer: every grouping change, island entry, and bridge is a browser history entry
// (pushState through the router), so Back and Forward work. The URL holds the step: the grouping and filters, then
// `island=<id>` for an island entered and `bridge=<a>,<b>` for a raised bridge. The top bar lists the steps of this
// visit; they're tracked here by the router's location keys.
import { useLocation, useNavigate, useNavigationType } from "@remix-run/react"
import { useCallback, useEffect, useState } from "react"

/** What the URL says the map is focused on, besides the grouping and filters. */
export interface MapFocus {
	island: string | null
	bridge: [string, string] | null
}

export function focusOf(params: URLSearchParams): MapFocus {
	const island = params.get("island") || null
	const pair = (params.get("bridge") ?? "").split(",").filter(Boolean)
	return {
		island,
		bridge:
			pair.length === 2 && pair[0] !== pair[1] ? [pair[0], pair[1]] : null,
	}
}

/** The URL's parameters with this focus (the grouping and filters kept). */
export function withFocus(params: URLSearchParams, focus: MapFocus) {
	const out = new URLSearchParams(params)
	if (focus.island) out.set("island", focus.island)
	else out.delete("island")
	if (focus.bridge) out.set("bridge", focus.bridge.join(","))
	else out.delete("bridge")
	return out
}

export const sameFocus = (a: MapFocus, b: MapFocus) =>
	a.island === b.island && a.bridge?.join(",") === b.bridge?.join(",")

export interface Step {
	/** The router's key of the history entry. */
	key: string
	search: string
}

/**
 * The steps of this visit and the one shown. A push adds a step after the current one (dropping any ahead of it, as
 * the browser does), a replace changes the current one, and Back or Forward moves among them. `go` moves by a number
 * of steps through the browser's own history.
 */
export function useSteps() {
	const location = useLocation()
	const type = useNavigationType()
	const navigate = useNavigate()
	const [state, setState] = useState<{ list: Step[]; at: number }>(() => ({
		list: [{ key: location.key, search: location.search }],
		at: 0,
	}))
	useEffect(() => {
		const step = { key: location.key, search: location.search }
		setState((s) => {
			if (s.list[s.at]?.key === step.key) return s
			if (type === "PUSH")
				return { list: [...s.list.slice(0, s.at + 1), step], at: s.at + 1 }
			if (type === "REPLACE") {
				const list = [...s.list]
				list[s.at] = step
				return { list, at: s.at }
			}
			const at = s.list.findIndex((x) => x.key === step.key)
			// Back past the start of this visit (after a reload, say): start over from here.
			return at >= 0 ? { list: s.list, at } : { list: [step], at: 0 }
		})
	}, [location.key, location.search, type])
	const go = useCallback((delta: number) => navigate(delta), [navigate])
	return { steps: state.list, at: state.at, go, popped: type === "POP" }
}
