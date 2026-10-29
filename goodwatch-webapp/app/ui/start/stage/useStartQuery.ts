// The guest's query on the start page in a component: the field's draft, the searched text and the picks
// (start-query.ts has the rules). `onChoice` runs after every new choice (anything but typing), so the loved titles
// can start over once three are loved (useLovedThree).
//
// The searched text and the picks live in the URL too (`q`, and Discover's `moods`, `themes`, `styles`): a reload or a
// shared link opens the same query. The URL is replaced, not pushed, and changing it doesn't read the page again
// (routes/_index.tsx `shouldRevalidate`).
import { useNavigate, useSearchParams } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	EMPTY_QUERY,
	queryFromParams,
	queryParams,
	type StartQuery,
	type StartQueryAction,
	isChoice,
	querySignature,
	reduceQuery,
} from "./start-query"

export function useStartQuery({
	onChoice,
}: { onChoice?: (action: StartQueryAction) => void } = {}) {
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const [query, setQuery] = useState<StartQuery>(() => queryFromParams(params))
	// The query as the URL holds it: the last one written or read, so each side follows only the other's changes.
	const inUrl = useRef(urlKey(queryFromParams(params)))
	useEffect(() => {
		const read = queryFromParams(params)
		const key = urlKey(read)
		if (key === inUrl.current) return
		inUrl.current = key
		setQuery((current) => (urlKey(current) === key ? current : read))
	}, [params])
	useEffect(() => {
		const key = urlKey(query)
		if (key === inUrl.current) return
		inUrl.current = key
		const next = queryParams(query, new URLSearchParams(window.location.search))
		navigate(
			{ search: next.size ? `?${next}` : "" },
			{ replace: true, preventScrollReset: true },
		)
	}, [query, navigate])
	const choice = useRef(onChoice)
	choice.current = onChoice
	const dispatch = useCallback((action: StartQueryAction) => {
		setQuery((current) => reduceQuery(current, action))
		if (isChoice(action)) choice.current?.(action)
	}, [])
	const actions = useMemo(
		() => ({
			dispatch,
			setDraft: (draft: string) => dispatch({ type: "draft", draft }),
			search: (text: string) => dispatch({ type: "search", text }),
			clearSearch: () => dispatch({ type: "clearSearch" }),
			setPicks: (picks: readonly string[]) =>
				dispatch({ type: "picks", picks }),
			removePick: (id: string) => dispatch({ type: "removePick", id }),
			clearPicks: () => dispatch({ type: "clearPicks" }),
		}),
		[dispatch],
	)
	const signature = useMemo(() => querySignature(query), [query])
	return { query, signature, ...actions }
}

/** The query as the URL writes it: picks in the URL's order, the draft left out. */
const urlKey = (query: StartQuery) =>
	queryParams(query, new URLSearchParams()).toString()

export type StartQueryState = ReturnType<typeof useStartQuery>
