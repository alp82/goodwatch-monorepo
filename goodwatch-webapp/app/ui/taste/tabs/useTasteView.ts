import { useRevalidator } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import type { PortraitTab, PortraitViewOf } from "~/server/taste-portrait/view"
import {
	snapshotGuestProgress,
	useGuestInteractions,
} from "~/utils/guest-progress"

export interface TasteViewState<T extends PortraitTab> {
	/** Null while a guest's view loads. */
	view: PortraitViewOf<T> | null
	failed: boolean
	retry: () => void
}

/**
 * One Taste tab's view. A member's comes from the route's loader. A guest's taste lives in this browser, so the guest
 * progress is posted to /api/taste/portrait, again whenever it changes.
 */
export function useTasteView<T extends PortraitTab>(
	tab: T,
	memberView: PortraitViewOf<T> | null,
): TasteViewState<T> {
	const revalidator = useRevalidator()
	const interactions = useGuestInteractions()
	const guest = useQuery({
		queryKey: ["taste-portrait", tab, interactions],
		enabled: memberView === null,
		// Keep showing the last view while a new rating recomputes it.
		placeholderData: (previous) => previous,
		queryFn: async () => {
			const { interactions, country, services } = snapshotGuestProgress()
			const response = await fetch(`/api/taste/portrait?tab=${tab}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ guest: { interactions, country, services } }),
			})
			if (!response.ok) throw new Error(`Taste portrait: ${response.status}`)
			return (await response.json()) as PortraitViewOf<T>
		},
	})
	if (memberView)
		return {
			view: memberView,
			failed: false,
			retry: () => revalidator.revalidate(),
		}
	return {
		view: guest.data ?? null,
		failed: guest.isError,
		retry: () => guest.refetch(),
	}
}
