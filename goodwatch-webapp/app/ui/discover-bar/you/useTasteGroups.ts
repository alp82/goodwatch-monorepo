// The member's taste groups for the You tab, from /api/discover/panel?part=taste: each group's key, name, number, word
// dots and loved posters. Members only; the server keeps them 10 minutes (memberSides), and so does this cache.
import { useQuery } from "@tanstack/react-query"
import type { PanelTasteGroup } from "~/server/discover-panel.server"
import { useUser } from "~/utils/auth"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { TASTE_GROUPS_FIXTURE_ID, tasteGroupsKey } from "./taste-groups-key"

export type TasteGroup = PanelTasteGroup

export function useTasteGroups(enabled: boolean, fixture = false) {
	const { locale } = useLocale()
	const { user, loading } = useUser()
	return useQuery<TasteGroup[]>({
		queryKey: tasteGroupsKey(
			locale.language,
			fixture ? TASTE_GROUPS_FIXTURE_ID : loading ? null : (user?.id ?? null),
		),
		queryFn: async () => {
			const response = await fetch(
				mediaLanguageUrl("/api/discover/panel?part=taste", locale.language),
			)
			if (!response.ok)
				throw new Error(`Discover taste groups failed: ${response.status}`)
			const body: { groups: TasteGroup[] } = await response.json()
			return body.groups
		},
		staleTime: 10 * 60 * 1000,
		enabled: enabled && !loading && Boolean(user) && !fixture,
	})
}
