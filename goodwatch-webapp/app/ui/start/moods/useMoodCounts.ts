// The mood picker's counts in the browser (mood-counts.ts has the request): asked for while the picker is open or
// something is picked, again after each pick, a stale request cancelled and its answer dropped (TanStack Query, keyed
// by the request and the guest's signature). The last answer stays while the next one loads, so the tiles' numbers
// don't blank between taps. Answers stay in the query cache, so reopening the picker or undoing a pick asks for
// nothing while they are fresh. A 503 (the catalog still loading) is asked again after its Retry-After; any other
// failure leaves the counts out.
//
// A guest's progress is part of the key: Discover leaves out what they have seen or hidden, so a loved or hidden title
// changes the counts.
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { DiscoverResults } from "~/server/discover-results.server"
import { guestSignature } from "~/ui/discover/guest-signature"
import type { GuestBody } from "~/ui/discover/useDiscoverBrowse"
import type { TitleKey } from "~/utils/title-key"
import {
	type CountScope,
	type MoodCounts,
	countsQuery,
	readCounts,
} from "./mood-counts"

const RETRIES = 3

class CountsError extends Error {
	readonly status: number
	/** Seconds, from a 503's Retry-After. */
	readonly retryAfter: number
	constructor(status: number, retryAfter: number) {
		super(`Mood counts failed: ${status}`)
		this.status = status
		this.retryAfter = retryAfter
	}
}

async function fetchCounts(
	query: string,
	guest: GuestBody | null,
	signal: AbortSignal,
): Promise<MoodCounts> {
	const response = await fetch(
		`/api/discover/results?${query}`,
		guest
			? {
					signal,
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ guest }),
				}
			: { signal },
	)
	if (!response.ok)
		throw new CountsError(
			response.status,
			Number(response.headers.get("Retry-After")) || 5,
		)
	return readCounts(query, (await response.json()) as DiscoverResults)
}

export function useMoodCounts({
	picks,
	ranked,
	guest,
	scope,
	active,
}: {
	picks: readonly string[]
	/** A search's ranked list while a search is on; null without one. */
	ranked: readonly TitleKey[] | null
	/** The guest's body (useGuestBody): null for a member, undefined until read. */
	guest: GuestBody | null | undefined
	scope: CountScope
	/** Whether the counts are wanted now: the picker is open or something is picked. */
	active: boolean
}): MoodCounts | null {
	const query = countsQuery(picks, scope, ranked)
	const { data } = useQuery({
		queryKey: ["start-mood-counts", guestSignature(guest), query],
		queryFn: ({ signal }) => fetchCounts(query, guest ?? null, signal),
		enabled: active && guest !== undefined,
		placeholderData: keepPreviousData,
		retry: (failures, error) =>
			error instanceof CountsError &&
			error.status === 503 &&
			failures < RETRIES,
		retryDelay: (_, error) =>
			error instanceof CountsError ? error.retryAfter * 1000 : 5000,
	})
	return data ?? null
}
