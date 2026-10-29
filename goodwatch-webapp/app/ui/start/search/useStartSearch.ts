// The start page's results for the guest's query (start-search.ts has the requests and their rules). The search
// waits until the guest's progress is read after hydration, so the first request already carries it; the progress is
// read again as each request starts, so loving a title never asks again for the titles on screen.
//
// A member passes their services (from the loader): members GET, and the server knows who they are.
import { useEffect, useMemo, useRef, useState } from "react"
import type { SearchScope } from "~/domain/discover-search"
import { type GuestBody, useGuestBody } from "~/ui/discover/useDiscoverBrowse"
import useLocale from "~/utils/locale"
import {
	IDLE_RESULTS,
	type StartQuery,
	type StartResults,
} from "../stage/start-query"
import {
	type ResultsScope,
	type StartSearch,
	createStartSearch,
	resultsScope,
} from "./start-search"

const ids = (value: string | null | undefined) =>
	(value ?? "")
		.split(",")
		.map(Number)
		.filter((id) => Number.isSafeInteger(id) && id > 0)

export function useStartSearch(
	query: Pick<StartQuery, "text" | "picks">,
	{ member = null }: { member?: { services: number[] } | null } = {},
): StartResults & {
	retry: () => void
	/** The results' services scope; the mood picker's counts and their wording follow it. */
	scope: ResultsScope
} {
	const guest = useGuestBody(member !== null)
	const { locale } = useLocale()
	const guestRef = useRef<GuestBody | null | undefined>(guest)
	guestRef.current = guest
	const ready = guest !== undefined

	// The viewer's country and services: a guest's own choice, else the request's country.
	const country = (guest?.country || locale.country).toUpperCase()
	const services = member ? member.services : ids(guest?.services)
	const scopeKey = `${country}|${services.join(",")}|${locale.language}`
	const scope = useMemo<SearchScope>(
		() => ({ country, services }),
		// scopeKey names the country and the services.
		[scopeKey],
	)

	const [results, setResults] = useState<StartResults>(IDLE_RESULTS)
	const search = useRef<StartSearch | null>(null)
	useEffect(() => {
		if (!ready) return
		const created = createStartSearch({
			scope,
			guest: () => guestRef.current ?? null,
			language: locale.language,
			onChange: setResults,
		})
		search.current = created
		return () => {
			created.dispose()
			if (search.current === created) search.current = null
		}
	}, [ready, scope, locale.language])

	// A new search (the scope changed) answers the query again.
	const { text, picks } = query
	const picksKey = picks.join(",")
	// picksKey names the picks.
	useEffect(() => {
		search.current?.set({ text, picks })
	}, [text, picksKey, ready, scope])

	const retry = useMemo(() => () => search.current?.retry(), [])
	return { ...results, retry, scope: resultsScope(scope) }
}
