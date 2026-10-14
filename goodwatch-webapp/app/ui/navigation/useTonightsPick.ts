// Tonight's pick for the dock, the header, and the hub sheet's Watch next tile. Members read it with a GET; a guest's
// Wishlist lives in their browser, so their pick comes from a POST with the guest progress, and a guest with an empty
// Wishlist sends no request. It refetches when the
// viewer's Wishlist, scores, or watch state change, since each can change the pick.
//
// A member's answer also says which of their titles landed on one of their services (#456): `landed`.
import { type QueryClient, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import type { NewOnServices } from "~/domain/newly-available-signal"
import { useUserData } from "~/routes/api.user-data"
import type { TonightsPick } from "~/server/tonight.server"
import { watchStateSignature } from "~/types/user-data"
import { useUser } from "~/utils/auth"
import { snapshotGuestProgress } from "~/utils/guest-progress"

/** What /api/tonight answers, as the query keeps it. */
export interface Tonight {
	pick: TonightsPick | null
	landed?: NewOnServices
}

/** The key of every answer kept for a viewer, whatever their Wishlist was. */
export const tonightKey = (userId: string) => ["tonights-pick", userId] as const

async function fetchTonight(guest: boolean): Promise<Tonight> {
	const response = guest
		? await fetch("/api/tonight", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ guest: snapshotGuestProgress() }),
			})
		: await fetch("/api/tonight")
	if (!response.ok) throw new Error(`Tonight's pick: ${response.status}`)
	return (await response.json()) as Tonight
}

export function useTonightsPick(): {
	pick: TonightsPick | null
	/** Titles on the viewer's Wishlist. */
	wishlistCount: number
	/** A member's titles that landed on one of their services; null when none did. */
	landed: NewOnServices | null
} {
	const { user, loading } = useUser()
	const { data } = useUserData()
	const signature = useMemo(() => {
		if (!data) return ""
		const wishlist = Object.keys(data.wishlist).sort().join(",")
		return `${wishlist}|${Object.keys(data.scores).length}|${watchStateSignature(data.watchState)}`
	}, [data])
	const wishlistCount = data ? Object.keys(data.wishlist).length : 0
	// A guest's pick is the last title on the Wishlist in their browser, so a guest with an empty Wishlist has none,
	// and asking the server would only return null. That is every first-time visitor.
	const guestWithoutWishlist = !user && wishlistCount === 0
	const query = useQuery({
		queryKey: [...tonightKey(user?.id ?? "guest"), signature],
		queryFn: () => fetchTonight(!user),
		enabled: !loading && !guestWithoutWishlist,
		placeholderData: (previous) => previous,
	})
	return {
		// Without the check, a guest who empties their Wishlist would keep seeing the previous pick as placeholder.
		pick: guestWithoutWishlist ? null : (query.data?.pick ?? null),
		wishlistCount,
		landed: (user && query.data?.landed) || null,
	}
}

/** The member's visit of a page is stored: what landed behind it is cleared wherever it shows. */
export async function clearLanded(
	queryClient: QueryClient,
	userId: string,
	kind: keyof NewOnServices,
): Promise<void> {
	const queryKey = tonightKey(userId)
	// A read that left before the visit was stored would bring the old answer back.
	const underway = queryClient.isFetching({ queryKey }) > 0
	if (underway) await queryClient.cancelQueries({ queryKey })
	queryClient.setQueriesData<Tonight>({ queryKey }, (kept) =>
		kept?.landed?.[kind].count
			? {
					...kept,
					landed: {
						...kept.landed,
						[kind]: { count: 0, ids: [], only: null },
					},
				}
			: kept,
	)
	if (underway) await queryClient.invalidateQueries({ queryKey })
}
