// The guest's query on the start page in a component: the field's draft, the searched text and the picks
// (start-query.ts has the rules). `onChoice` runs after every new choice (anything but typing), so the loved titles
// can start over once three are loved (useLovedThree).
import { useCallback, useMemo, useRef, useState } from "react"
import {
	EMPTY_QUERY,
	type StartQuery,
	type StartQueryAction,
	isChoice,
	querySignature,
	reduceQuery,
} from "./start-query"

export function useStartQuery({
	onChoice,
}: { onChoice?: (action: StartQueryAction) => void } = {}) {
	const [query, setQuery] = useState<StartQuery>(EMPTY_QUERY)
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

export type StartQueryState = ReturnType<typeof useStartQuery>
