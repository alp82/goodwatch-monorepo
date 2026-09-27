// Discover's results: pages of /api/discover/results for the filter bar's query and the For you switch, loaded by
// infinite scroll; in search mode, over the search's ranked list. Members GET; a guest's progress lives in their
// browser, so guests POST it with every request.
import { useSearchParams } from "@remix-run/react"
import {
	type InfiniteData,
	keepPreviousData,
	useInfiniteQuery,
} from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
import type { DiscoverResults } from "~/server/discover-results.server"
import type { TasteInteraction } from "~/ui/taste/types"
import { useGuestInteractions } from "~/utils/guest-progress"
import type { TitleKey } from "~/utils/title-key"

/** What a guest's browser sends: its guest progress and the country and services the guest chose. */
export interface GuestBody {
	interactions: TasteInteraction[]
	country: string | null
	services: string | null
}

/** The first pages the Discover loader computed, for the query they answer. */
export interface InitialBrowse {
	/** The API query the pages answer (filter bar query plus `foryou`). */
	key: string
	pages: DiscoverResults[]
}

/** The results endpoint's query for a filter bar query and the For you switch, and a search's ranked list. */
export const browseKey = (
	query: string,
	forYou: boolean,
	ranked?: readonly TitleKey[],
) =>
	`${query}${query ? "&" : ""}foryou=${forYou ? 1 : 0}${ranked ? `&ranked=${ranked.join(",")}` : ""}`

/**
 * A guest's progress and chosen country and services, read after hydration (the server can't see them); null for a
 * member, undefined until read.
 */
export function useGuestBody(member: boolean): GuestBody | null | undefined {
	const interactions = useGuestInteractions()
	const [chosen, setChosen] = useState<{
		country: string | null
		services: string | null
	}>()
	useEffect(() => {
		if (member) return
		let country: string | null = null
		let services: string | null = null
		try {
			country = localStorage.getItem("country")
			services = localStorage.getItem("withStreamingProviders")
		} catch {}
		setChosen({ country, services })
	}, [member])
	if (member) return null
	if (!chosen) return undefined
	return { interactions, ...chosen }
}

async function fetchPage(
	key: string,
	page: number,
	guest: GuestBody | null,
): Promise<DiscoverResults> {
	const url = `/api/discover/results?${key}&page=${page}`
	const response = await fetch(
		url,
		guest
			? {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ guest }),
				}
			: undefined,
	)
	if (!response.ok)
		throw new Error(`Discover results failed: ${response.status}`)
	return response.json()
}

// Guest progress changes the answer; this keys it without hashing thousands of interactions on every render.
function guestSignature(guest: GuestBody | null | undefined) {
	if (guest === undefined) return "pending"
	if (guest === null) return "member"
	const last = guest.interactions[guest.interactions.length - 1]
	return `guest:${guest.interactions.length}:${last?.timestamp ?? ""}:${guest.country ?? ""}:${guest.services ?? ""}`
}

/** A guest the server can answer without their progress: nothing rated, nothing chosen. */
const PLAIN_GUEST = "guest:0:::"

export function useDiscoverBrowse({
	query,
	forYou,
	member,
	guest,
	initial,
	ranked,
}: {
	query: string
	forYou: boolean
	member: boolean
	/** From useGuestBody. */
	guest: GuestBody | null | undefined
	initial: InitialBrowse | null
	/**
	 * Search mode: the search's ranked list, or null while it loads (the last results stay meanwhile). Undefined while
	 * browsing.
	 */
	ranked?: readonly TitleKey[] | null
}) {
	const key = browseKey(query, forYou, ranked ?? undefined)
	const signature = guestSignature(guest)
	// The loader's pages answer a member, or a guest who hasn't rated or chosen anything (the server's view of any guest).
	const initialFits =
		initial?.key === key &&
		(member || guest === undefined || signature === PLAIN_GUEST)
	const result = useInfiniteQuery<
		DiscoverResults,
		Error,
		InfiniteData<DiscoverResults, number>,
		string[],
		number
	>({
		queryKey: ["discover-browse", signature, key],
		queryFn: ({ pageParam }) => fetchPage(key, pageParam, guest ?? null),
		initialPageParam: 1,
		getNextPageParam: (last) =>
			last.page * last.pageSize < last.total ? last.page + 1 : undefined,
		initialData:
			initialFits && initial
				? {
						pages: initial.pages,
						pageParams: initial.pages.map((p) => p.page),
					}
				: undefined,
		placeholderData: keepPreviousData,
		// Guests wait until their progress is read, so the first request already carries it. A search waits for its list.
		enabled: guest !== undefined && ranked !== null,
	})
	return { ...result, key }
}

/**
 * The For you switch: the URL's `foryou` wins for the view, else the member's saved setting (on for guests). Flipping
 * it writes `foryou=0` while it's off (on is the default, left out) and saves the member's setting. A URL value alone
 * never changes the saved setting.
 */
export function useForYou({
	member,
	saved,
}: {
	member: boolean
	/** The member's saved setting (true for guests). */
	saved: boolean
}) {
	const [params, setParams] = useSearchParams()
	const [savedNow, setSavedNow] = useState(saved)
	const save = useSetUserSettings()
	const value = params.get("foryou")
	const on = value === "0" || value === "1" ? value === "1" : savedNow
	// A member who turned it off opens without the parameter: say so in the URL, so a shared link opens the same way.
	useEffect(() => {
		if (value === null && !on)
			setParams(
				(previous) => {
					const out = new URLSearchParams(previous)
					out.set("foryou", "0")
					return out
				},
				{ replace: true, preventScrollReset: true },
			)
	}, [value, on, setParams])
	const set = useCallback(
		(next: boolean) => {
			setParams(
				(previous) => {
					const out = new URLSearchParams(previous)
					if (next) out.delete("foryou")
					else out.set("foryou", "0")
					out.delete("page")
					return out
				},
				{ replace: true, preventScrollReset: true },
			)
			if (member) {
				setSavedNow(next)
				save.mutate({ settings: { for_you: next ? "yes" : "no" } })
			}
		},
		[setParams, member, save.mutate],
	)
	return { on, set }
}
