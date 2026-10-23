// The signed-in member's handle and profile picture for the account menu, and their library counts. The session
// only knows the sign-in provider's photo; the picture chosen in Edit profile comes from /api/account-summary.
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { libraryCounts } from "~/domain/my-library"
import type { AvatarColor } from "~/domain/profile"
import { useUserData } from "~/routes/api.user-data"
import { useUser } from "~/utils/auth"
import type { AccountCounts } from "./links"
import { providerPhoto } from "./provider-photo"

export interface AccountSummary {
	handle: string | null
	avatar: { url: string | null; color: AvatarColor }
	/** Show the "GoodWatch has profiles now" strip. */
	profilesStrip: boolean
}

export const queryKeyAccountSummary = ["account-summary"] as const

export function useAccountSummary() {
	const { user } = useUser()
	const { data } = useQuery<AccountSummary>({
		queryKey: [...queryKeyAccountSummary, user?.id],
		queryFn: async () => (await fetch("/api/account-summary")).json(),
		enabled: Boolean(user?.id),
	})
	const fallbackInitial = (user?.email ?? "?").charAt(0)
	return {
		handle: data?.handle ?? null,
		avatarUrl: data ? data.avatar.url : providerPhoto(user),
		color: data?.avatar.color ?? "amber",
		initial: (data?.handle ?? fallbackInitial).charAt(0).toUpperCase(),
		email: user?.email ?? null,
		loaded: Boolean(data),
		profilesStrip: data?.profilesStrip === true,
	}
}

export function useAccountCounts(): AccountCounts | null {
	const { data } = useUserData()
	return useMemo(() => {
		if (!data) return null
		const counts = libraryCounts(data)
		return {
			wishlist: counts.want,
			seen: counts.seen,
			scores: Object.keys(data.scores).length,
		}
	}, [data])
}
