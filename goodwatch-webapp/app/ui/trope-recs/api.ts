// The browser side of By your tropes: the three reads from docs/implementation/trope-recs.md, as TanStack queries.
// A 202 answer is "still building": the query keeps its pending result and asks again every two seconds.
import { useQuery } from "@tanstack/react-query"
import type { MemberTropeRef, RecKind } from "~/domain/trope-recs"
import type { TropeDescription } from "~/server/profile/trope-catalog-data"
import type { Recommendation } from "~/server/trope-recs/ranking"
import { useUser } from "~/utils/auth"

export type RecTitle = Recommendation

export interface RecsResult {
	pending: boolean
	refreshing: boolean
	kind: RecKind
	trope: string | null
	tropes: MemberTropeRef[]
	titles: RecTitle[]
}

/** The trope the address names isn't among the member's top tropes (a 400). */
export class NotYourTrope extends Error {}

const RETRY_MS = 2000

async function read<T>(url: string, signal: AbortSignal): Promise<T> {
	const response = await fetch(url, { signal })
	if (response.status === 400) throw new NotYourTrope("Not in your tropes")
	if (!response.ok) throw new Error(`${url} answered ${response.status}`)
	return response.json()
}

const again = (query: { state: { data?: { pending: boolean } } }) =>
	query.state.data?.pending ? RETRY_MS : (false as const)

/** The signed-in member's top tropes alone; disabled for guests. */
export function useMyTropes(enabled = true) {
	const { user } = useUser()
	return useQuery<{ pending: boolean; tropes: MemberTropeRef[] }>({
		queryKey: ["trope-recs-tropes", user?.id ?? null],
		enabled: enabled && !!user,
		queryFn: ({ signal }) => read("/api/trope-recs/tropes", signal),
		refetchInterval: again,
	})
}

/** The picks for a kind, for one trope (its id) or all of them. */
export function useRecs(kind: RecKind, trope: string | null, enabled = true) {
	const { user } = useUser()
	return useQuery<RecsResult>({
		queryKey: ["trope-recs", user?.id ?? null, kind, trope],
		enabled: enabled && !!user,
		queryFn: ({ signal }) => {
			const params = new URLSearchParams({ kind })
			if (trope) params.set("trope", trope)
			return read(`/api/trope-recs?${params}`, signal)
		},
		retry: (count, error) => !(error instanceof NotYourTrope) && count < 2,
		refetchInterval: again,
	})
}

interface Example {
	key: string
	text: string
	label?: string
}

/** How one trope shows up in one pick: TV Tropes text, or null when there's no write-up. */
export function useExcerpt(trope: string, key: string) {
	const { user } = useUser()
	return useQuery<{ pending: boolean; text: string | null }>({
		queryKey: ["trope-recs-excerpt", user?.id ?? null, trope, key],
		enabled: !!user,
		queryFn: async ({ signal }) => {
			const params = new URLSearchParams({ trope, keys: key })
			const data = await read<{ pending: boolean; examples: Example[] }>(
				`/api/trope-recs/excerpts?${params}`,
				signal,
			)
			return {
				pending: data.pending,
				text: data.examples.find((e) => e.key === key)?.text ?? null,
			}
		},
		refetchInterval: again,
	})
}

/** The opening of one trope's TV Tropes description, read with the member's own handle. */
export function useTropeDescription(handle: string | null, id: string | null) {
	return useQuery<{
		pending: boolean
		entries: Record<string, TropeDescription>
	}>({
		queryKey: ["trope-recs-description", handle, id],
		enabled: !!handle && !!id,
		queryFn: async ({ signal }) => {
			const response = await fetch(
				`/u/${encodeURIComponent(handle ?? "")}/tropes/descriptions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify([id]),
					signal,
				},
			)
			if (!response.ok) throw new Error("Loading the trope description failed.")
			return response.json()
		},
		refetchInterval: again,
	})
}
