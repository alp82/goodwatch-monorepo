import { useQueries, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import type { ProfileShell } from "~/domain/profile"
import type {
	TropeDescription,
	TropeDescriptions,
} from "~/server/profile/trope-catalog-data"
import { seesTropes } from "~/server/profile/tropes-model"
import type { TropesPreview } from "~/server/profile/tropes-preview"
import { useUser } from "~/utils/auth"
import useLocale from "~/utils/locale"
import {
	type ProfileTropeDescriptions,
	descriptionBatches,
	mergeDescriptionEntries,
	previewDescriptions,
} from "~/utils/profile-trope-descriptions"
import { profileTropeQueryKey } from "~/utils/profile-trope-resource"
import type { RankedTrope } from "./model"

/** Definitions follow rendered bands, independently of the thin filtering matrix. */
export function useDescriptions(
	shell: ProfileShell,
	visible: RankedTrope[],
	seed?: TropesPreview,
) {
	const client = useQueryClient()
	const { user } = useUser()
	const { locale } = useLocale()
	const scope = [
		...profileTropeQueryKey(shell, user?.id ?? null, locale.language),
		"descriptions",
	]
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const seeds = previewDescriptions(seed?.ranked ?? [])
	const batches = descriptionBatches(visible.map((tag) => tag.id ?? tag.name))
	const itemKey = (id: string) => [...scope, "item", id]
	const queries = useQueries({
		queries: batches.map((ids) => {
			const initialEntries = Object.fromEntries(
				ids.flatMap((id) => {
					const entry =
						client.getQueryData<TropeDescription>(itemKey(id)) ?? seeds[id]
					return entry ? [[id, entry]] : []
				}),
			)
			return {
				queryKey: [...scope, "batch", ...ids.slice().sort()],
				enabled: mounted && seesTropes(shell),
				initialData: Object.keys(initialEntries).length
					? {
							entries: initialEntries,
							catalogVersion: seed?.catalogVersion ?? "",
							pending: false,
						}
					: undefined,
				queryFn: async ({
					signal,
				}: { signal: AbortSignal }): Promise<ProfileTropeDescriptions> => {
					const response = await fetch(
						`/u/${encodeURIComponent(shell.handle)}/tropes/descriptions`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(ids),
							signal,
						},
					)
					if (!response.ok)
						throw new Error("Loading trope descriptions failed.")
					const result: ProfileTropeDescriptions = await response.json()
					for (const [id, entry] of Object.entries(result.entries))
						client.setQueryData(itemKey(id), entry)
					return result
				},
				refetchInterval: (query: {
					state: { data?: ProfileTropeDescriptions }
				}) => (query.state.data?.pending ? 1500 : (false as const)),
			}
		}),
	})
	const current: TropeDescriptions = {}
	// A newer overlapping batch wins over an older cached batch after a filter or pagination change.
	for (const tag of visible) {
		const id = tag.id ?? tag.name
		const entry = client.getQueryData<TropeDescription>(itemKey(id))
		if (entry) current[id] = entry
	}
	return mergeDescriptionEntries(
		seeds,
		queries.map((query) => query.data?.entries),
		current,
	)
}
