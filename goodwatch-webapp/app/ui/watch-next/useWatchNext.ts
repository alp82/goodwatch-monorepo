// The Watch next page's state and data. The sort, moods, and On my services live in the URL (`sort=waiting&
// moods=funny,scary&services=all`, defaults left out) so a view can be shared and reloaded; titles passed over with
// Not tonight live only in this visit. Members read /api/watch-next with GET; a guest's Wishlist and ratings live in
// their browser, so guests POST their guest progress to the same URL.
import { useSearchParams } from "@remix-run/react"
import {
	keepPreviousData,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { timeOf } from "./labels"
import { type WatchNextChoice, watchNextChoiceOf } from "~/domain/watch-next"
import type { WatchNext, WatchNextTitle } from "~/server/watch-next.server"
import type { TasteInteraction } from "~/ui/taste/types"
import { useUser } from "~/utils/auth"
import { useGuestInteractions } from "~/utils/guest-progress"
import type { TitleKey } from "~/utils/title-key"

export type { WatchNextChoice }

/** Cards per request to /api/watch-next/cards (the title cards' MAX_KEYS). */
export const CARDS_PER_REQUEST = 60

const SERVICES_PENDING_RETRY_MS = 3000

export const choiceFromParams = watchNextChoiceOf

/** My movies' choice (#385): Watch next's, and the time under "How long?" (`time=120`). */
export type PageChoice = WatchNextChoice & { time?: number | null }

/** The choice a page's URL carries. `movies`: the page is My movies, which also reads the time. */
export const pageChoiceOf = (
	params: URLSearchParams,
	movies: boolean,
): PageChoice =>
	movies
		? { ...choiceFromParams(params), time: timeOf(params.get("time")) }
		: choiceFromParams(params)

/** The page URL's parameters for a choice, keeping any others. */
function choiceToParams(choice: PageChoice, current: URLSearchParams) {
	const params = new URLSearchParams(current)
	for (const key of ["sort", "moods", "services"]) params.delete(key)
	if (choice.sort) params.set("sort", choice.sort)
	if (choice.moods.length) params.set("moods", choice.moods.join(","))
	if (!choice.onMyServices) params.set("services", "all")
	if (choice.time !== undefined) {
		params.delete("time")
		if (choice.time) params.set("time", String(choice.time))
	}
	return params
}

/**
 * The API's query string for a choice and the titles passed over tonight. A choice with a time (also "any length")
 * is My movies', which asks for the Wishlist's movies only.
 */
export function apiQuery(choice: PageChoice, passed: TitleKey[] = []) {
	const params = choiceToParams(choice, new URLSearchParams())
	if (choice.time !== undefined) params.set("kind", "movie")
	if (passed.length) params.set("notTonight", passed.join(","))
	return params.toString()
}

// What a guest's browser sends: the guest progress and the country and services the guest chose.
function guestBody(interactions: TasteInteraction[]) {
	let country: string | null = null
	let services: string | null = null
	try {
		country = localStorage.getItem("country")
		services = localStorage.getItem("withStreamingProviders")
	} catch {}
	return JSON.stringify({ guest: { interactions, country, services } })
}

async function request<T>(
	path: string,
	query: string,
	guest: TasteInteraction[] | null,
): Promise<T> {
	const url = query ? `${path}?${query}` : path
	const response = guest
		? await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: guestBody(guest),
			})
		: await fetch(url)
	if (!response.ok) throw new Error(`${path} answered ${response.status}`)
	return (await response.json()) as T
}

export const watchNextQueryKey = ["watch-next"] as const

/**
 * The page's data. `initial` is what the loader computed for a member on the first request (null for guests, whose
 * progress only their browser holds).
 */
export function useWatchNext(
	initial: {
		query: string
		data: WatchNext | null
	},
	/** The page is My movies. */
	movies = false,
) {
	const [params, setParams] = useSearchParams()
	const choice = useMemo(() => pageChoiceOf(params, movies), [params, movies])
	const [passed, setPassed] = useState<TitleKey[]>([])
	const { user, loading } = useUser()
	const interactions = useGuestInteractions()
	const guest = !user
	const query = apiQuery(choice, passed)
	const viewer = user?.id ?? "guest"

	const result = useQuery<WatchNext>({
		queryKey: [
			...watchNextQueryKey,
			viewer,
			query,
			guest ? interactions : null,
		],
		queryFn: () =>
			request<WatchNext>("/api/watch-next", query, guest ? interactions : null),
		enabled: !loading,
		initialData:
			!guest && initial.data && query === initial.query
				? initial.data
				: undefined,
		placeholderData: keepPreviousData,
		// Right after a restart the country's availability may still load: ask again until On my services narrows.
		refetchInterval: (query) =>
			query.state.data?.servicesPending ? SERVICES_PENDING_RETRY_MS : false,
	})

	const setChoice = useCallback(
		(next: Partial<PageChoice>) =>
			setParams(
				(current) =>
					choiceToParams({ ...pageChoiceOf(current, movies), ...next }, current),
				{ replace: true, preventScrollReset: true },
			),
		[setParams, movies],
	)

	/** Not tonight: the title goes to the end of the view for this visit. */
	const pass = useCallback(
		(key: TitleKey) =>
			setPassed((keys) => [...keys.filter((k) => k !== key), key]),
		[],
	)

	return {
		choice,
		setChoice,
		pass,
		passed,
		query,
		guest,
		viewer,
		interactions: guest ? interactions : null,
		data: result.data ?? null,
		isLoading: result.isLoading || loading,
		isFetching: result.isFetching,
		isError: result.isError && !result.data,
		refetch: result.refetch,
	}
}

export type WatchNextState = ReturnType<typeof useWatchNext>

/**
 * Cards for some Wishlist titles of a later tier, fetched once `enabled` (the tier scrolled into view), in requests of
 * up to CARDS_PER_REQUEST titles. The first request covers the first `first` keys (what the tier shows before its
 * "+N"), so showing the rest keeps what already loaded. Returns what has loaded so far, by key.
 */
export function useTierCards(
	state: WatchNextState,
	keys: TitleKey[],
	enabled: boolean,
	first = CARDS_PER_REQUEST,
): Map<TitleKey, WatchNextTitle> {
	const chunks: TitleKey[][] = []
	const head = Math.min(first, CARDS_PER_REQUEST)
	if (keys.length) chunks.push(keys.slice(0, head))
	for (let i = head; i < keys.length; i += CARDS_PER_REQUEST)
		chunks.push(keys.slice(i, i + CARDS_PER_REQUEST))
	const results = useQueries({
		queries: chunks.map((chunk) => {
			const query = `${state.query}${state.query ? "&" : ""}keys=${chunk.join(",")}`
			return {
				queryKey: [
					...watchNextQueryKey,
					"cards",
					state.viewer,
					query,
					state.interactions,
				],
				queryFn: () =>
					request<{ titles: WatchNextTitle[] }>(
						"/api/watch-next/cards",
						query,
						state.interactions,
					),
				enabled,
			}
		}),
	})
	const found = new Map<TitleKey, WatchNextTitle>()
	for (const result of results)
		for (const title of result.data?.titles ?? []) found.set(title.key, title)
	return found
}

/** Refetches everything Watch next shows (after I watched it or Undo). */
export function useRefreshWatchNext() {
	const client = useQueryClient()
	return useCallback(
		() => client.invalidateQueries({ queryKey: watchNextQueryKey }),
		[client],
	)
}

/**
 * A member's saved title mark (a score, Want to See, Seen, Not interested) made anywhere on the page, such as on a
 * poster card, refreshes Watch next. A guest's marks change the guest progress, which is part of the query.
 */
export function useRefreshAfterMarks() {
	const client = useQueryClient()
	const refresh = useRefreshWatchNext()
	const { user } = useUser()
	const member = Boolean(user)
	useEffect(() => {
		if (!member) return
		return client.getMutationCache().subscribe((event) => {
			if (event.type === "updated" && event.action.type === "success") refresh()
		})
	}, [client, refresh, member])
}
