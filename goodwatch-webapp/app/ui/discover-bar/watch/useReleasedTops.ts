// The Released sub-tab's pictures: the top title of each decade and of each New and After preset, in the list's order,
// from /api/discover/panel?part=released. The year choice doesn't change them (the server reads every year), so the
// request leaves it out and a new year pick asks again for nothing. Members GET; guests POST their progress.
import { useQuery } from "@tanstack/react-query"
import type { TitleCard } from "~/server/title-cards.server"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { releasedPanelQuery } from "./released-choices"

export type ReleasedTop = Pick<
	TitleCard,
	"title" | "poster_path" | "backdrop_path"
>

interface ReleasedPanel {
	part: "released"
	available: boolean
	options: { id: string; topTitle: ReleasedTop | null }[]
}

/** Each panel id's top title; empty while loading or when the request fails. */
export function useReleasedTops(
	query: string,
	member: boolean,
	enabled: boolean,
): Map<string, ReleasedTop> {
	const { locale } = useLocale()
	const url = mediaLanguageUrl(
		`/api/discover/panel?${releasedPanelQuery(query)}`,
		locale.language,
	)
	const { data } = useQuery<Map<string, ReleasedTop>>({
		queryKey: ["discover-panel", url, member ? "member" : "guest"],
		enabled,
		placeholderData: (previous) => previous,
		queryFn: async ({ signal }) => {
			const response = await fetch(
				url,
				member
					? { signal }
					: {
							signal,
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ guest: snapshotGuestProgress() }),
						},
			)
			if (!response.ok)
				throw new Error(`Discover panel failed: ${response.status}`)
			const body = (await response.json()) as ReleasedPanel
			const tops = new Map<string, ReleasedTop>()
			for (const option of body.options ?? [])
				if (option.topTitle) tops.set(option.id, option.topTitle)
			return tops
		},
	})
	return data ?? EMPTY
}

const EMPTY = new Map<string, ReleasedTop>()
