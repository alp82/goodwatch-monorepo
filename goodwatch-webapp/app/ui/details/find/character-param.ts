// `?character=Walter White&actor=Bryan Cranston` on a title page (the search panel's Characters group links it,
// characterHref in domain/character-portraits.ts): after hydration the page takes the parameters off the address
// (replaceState, keeping the router's history state, so no loader runs and no history entry is added) and asks for
// the character, which opens Starring, scrolls to the cast row and opens its quick view (CastSection.tsx). It is read
// in the browser only, so the server's HTML (and its caching) is the same with or without it, and the canonical
// address leaves it out. A pick for the page already open is a navigation too: it runs again, in place.
import { useLocation } from "@remix-run/react"
import { useEffect, useRef } from "react"
import {
	type CharacterAsk,
	readCharacterAsk,
} from "~/domain/character-portraits"

export function useCharacterParam(onAsk: (ask: CharacterAsk) => void) {
	const location = useLocation()
	const latest = useRef(onAsk)
	latest.current = onAsk
	// Once per navigation (location.key).
	useEffect(() => {
		const found = readCharacterAsk(window.location.search)
		if (!found) return
		window.history.replaceState(
			window.history.state,
			"",
			window.location.pathname + found.rest + window.location.hash,
		)
		latest.current(found.ask)
	}, [location.key])
}
