// Tonight's pick for the dock, the header, and the hub sheet's Watch next tile. Members read it with a GET; a guest's
// Wishlist lives in their browser, so their pick comes from a POST with the guest progress, and a guest with an empty
// Wishlist sends no request. It refetches when the
// viewer's Wishlist, scores, or watched titles change, since each can change the pick.
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useFeature } from "~/hooks/useFeature"
import { useUserData } from "~/routes/api.user-data"
import type { TonightsPick } from "~/server/tonight.server"
import { useUser } from "~/utils/auth"
import { snapshotGuestProgress } from "~/utils/guest-progress"

async function fetchTonightsPick(guest: boolean): Promise<TonightsPick | null> {
	const response = guest
		? await fetch("/api/tonight", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ guest: snapshotGuestProgress() }),
			})
		: await fetch("/api/tonight")
	// Not found while Watch next is off for the viewer: no pick, the dock shows the Wishlist icon.
	if (response.status === 404) return null
	if (!response.ok) throw new Error(`Tonight's pick: ${response.status}`)
	const { pick } = (await response.json()) as { pick: TonightsPick | null }
	return pick
}

export function useTonightsPick(): {
	pick: TonightsPick | null
	/** Titles on the viewer's Wishlist. */
	wishlistCount: number
} {
	const watchNext = useFeature("watchNext")
	const { user, loading } = useUser()
	const { data } = useUserData()
	const signature = useMemo(() => {
		if (!data) return ""
		const wishlist = Object.keys(data.wishlist).sort().join(",")
		return `${wishlist}|${Object.keys(data.scores).length}|${Object.keys(data.watched).length}`
	}, [data])
	const wishlistCount = data ? Object.keys(data.wishlist).length : 0
	// A guest's pick is the last title on the Wishlist in their browser, so a guest with an empty Wishlist has none,
	// and asking the server would only return null. That is every first-time visitor.
	const guestWithoutWishlist = !user && wishlistCount === 0
	const query = useQuery({
		queryKey: ["tonights-pick", user?.id ?? "guest", signature],
		queryFn: () => fetchTonightsPick(!user),
		enabled: watchNext && !loading && !guestWithoutWishlist,
		placeholderData: (previous) => previous,
	})
	return {
		// Without the check, a guest who empties their Wishlist would keep seeing the previous pick as placeholder.
		pick: guestWithoutWishlist ? null : (query.data ?? null),
		wishlistCount,
	}
}
