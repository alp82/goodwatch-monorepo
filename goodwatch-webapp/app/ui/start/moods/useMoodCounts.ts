// The mood picker's counts in the browser (mood-counts.ts has the request): asked for while the picker is open or
// something is picked, again after each pick, the stale request cancelled. The last answer stays while the next one
// loads, so the tiles' numbers don't blank between taps. A 503 (the catalog still loading) is asked again after its
// Retry-After; any other failure leaves the counts out.
import { useEffect, useRef, useState } from "react"
import type { DiscoverResults } from "~/server/discover-results.server"
import type { GuestBody } from "~/ui/discover/useDiscoverBrowse"
import type { TitleKey } from "~/utils/title-key"
import {
	type CountScope,
	type MoodCounts,
	countsQuery,
	readCounts,
} from "./mood-counts"

const RETRIES = 3
/** Answers kept per query, so reopening the picker or undoing a pick asks for nothing. */
const kept = new Map<string, MoodCounts>()
const KEEP = 24

async function fetchCounts(
	query: string,
	guest: GuestBody | null,
	signal: AbortSignal,
): Promise<MoodCounts | null> {
	for (let attempt = 0; ; attempt++) {
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
		if (response.status === 503 && attempt < RETRIES) {
			const wait = Number(response.headers.get("Retry-After")) || 5
			await new Promise((resolve) => setTimeout(resolve, wait * 1000))
			if (signal.aborted) return null
			continue
		}
		if (!response.ok) return null
		const body = (await response.json()) as DiscoverResults
		return readCounts(query, body)
	}
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
	// The country and services change the answer too; the interactions don't, so a new loved title asks for nothing.
	const key = guest
		? `${query}|${guest.country ?? ""}|${guest.services ?? ""}`
		: query
	const [counts, setCounts] = useState<MoodCounts | null>(null)
	const body = useRef(guest)
	body.current = guest
	const ready = guest !== undefined
	useEffect(() => {
		if (!active || !ready) return
		const known = kept.get(key)
		if (known) {
			setCounts(known)
			return
		}
		const controller = new AbortController()
		fetchCounts(query, body.current ?? null, controller.signal)
			.then((answer) => {
				if (!answer || controller.signal.aborted) return
				kept.set(key, answer)
				if (kept.size > KEEP) kept.delete(kept.keys().next().value as string)
				setCounts(answer)
			})
			.catch(() => {})
		return () => controller.abort()
	}, [key, query, active, ready])
	return counts
}
