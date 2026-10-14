import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
// The pool: the titles the TV draws its own picks from (the best six and three per mood for the person), read
// with `POST /api/living-room/picks?view=pool`. Members GET; guests POST their browser's progress. Both answers
// are private and never stored by a cache.
//
// It is the start page's heaviest request, so nothing asks for it on arrival: a guest's home asks at the first
// interaction, a member's when the Discover tile first has the focus (TvLivingRoom.tsx decides). A visitor who
// leaves without touching the page, and every crawler, never causes it.
import { useQuery } from "@tanstack/react-query"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import type { TvPool } from "./tv-home"

const POOL_URL = "/api/living-room/picks?view=pool"

/** The ids in a browser's saved services, "8,337". */
const serviceIds = (saved: string | null) =>
	(saved ?? "")
		.split(",")
		.map(Number)
		.filter((id) => Number.isInteger(id) && id > 0)

/** The pool, or null until it is there. `failed`: it was asked for and did not come, after the query's retries. */
export function useTvPoolState(
	member: boolean,
	enabled: boolean,
): { pool: TvPool | null; failed: boolean } {
	const { locale } = useLocale()
	const pool = useQuery<TvPool>({
		queryKey: ["living-room-pool", member ? "member" : "guest", locale.language],
		enabled,
		queryFn: async () => {
			const guest = member ? null : snapshotGuestProgress()
			const response = await fetch(
				mediaLanguageUrl(POOL_URL, locale.language),
				guest
					? {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ guest }),
						}
					: undefined,
			)
			if (!response.ok) throw new Error("Unable to load the TV's pool")
			const pool: TvPool = await response.json()
			// The pool names a member's saved services. A guest's are what their browser just sent: Tonight puts
			// the titles that stream on them first (tv-home.ts, `tonightOrder`).
			return guest ? { ...pool, ownServiceIds: serviceIds(guest.services) } : pool
		},
	})
	return { pool: pool.data ?? null, failed: pool.isError }
}

export function useTvPool(member: boolean, enabled: boolean): TvPool | null {
	return useTvPoolState(member, enabled).pool
}
