import { useSetUserSettings } from "~/routes/api.user-settings.set"
import { useUser } from "~/utils/auth"
import { readExploration, rememberExploration } from "~/ui/taste/exploration"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useUserSettings } from "~/routes/api.user-settings.get"
import {
	evaluateAvailability,
	type AvailabilityEvidence,
} from "~/utils/availability-evidence"
import { canonicalTitleId } from "~/utils/title-identity"
import type { ScoringMedia } from "~/ui/scoring/types"

const storedPreference = (key: string) => {
	try {
		return localStorage.getItem(key)
	} catch {
		return null
	}
}

export function useWatchSelection(initialCountry = "") {
	const { data: settings } = useUserSettings()
	const { user } = useUser()
	const saveSettings = useSetUserSettings()
	const [country, setCountry] = useState(initialCountry)
	const [serviceIds, setServices] = useState<number[]>([])
	const [includePaid, setIncludePaid] = useState(false)
	const [edited, setEdited] = useState(false)
	useEffect(() => {
		if (edited) return
		setCountry(
			initialCountry ||
				settings?.country_default ||
				storedPreference("country") ||
				"",
		)
		const saved = readExploration().watchSelection
		setIncludePaid(saved?.includePaid === true)
		setServices(
			(
				settings?.streaming_providers_default ??
				storedPreference("withStreamingProviders") ??
				""
			)
				.split(",")
				.map(Number)
				.filter((id) => Number.isSafeInteger(id) && id > 0),
		)
	}, [settings, initialCountry, edited])
	return {
		preferencesError: saveSettings.isError,
		country,
		serviceIds,
		includePaid,
		setCountry: (value: string) => {
			setEdited(true)
			setCountry(value)
			if (user) saveSettings.mutate({ settings: { country_default: value } })
			try {
				localStorage.setItem("country", value)
			} catch {}
		},
		setServices: (value: number[]) => {
			setEdited(true)
			setServices(value)
			if (user)
				saveSettings.mutate({
					settings: { streaming_providers_default: value.join(",") },
				})
			rememberExploration({ watchSelection: { includePaid } })
			try {
				localStorage.setItem("withStreamingProviders", value.join(","))
			} catch {}
		},
		setIncludePaid: (value: boolean) => {
			setEdited(true)
			setIncludePaid(value)
			rememberExploration({ watchSelection: { includePaid: value } })
		},
	}
}
export type WatchSelection = ReturnType<typeof useWatchSelection>
export function useWatchability(
	titles: ScoringMedia[],
	selection: Pick<WatchSelection, "country" | "serviceIds" | "includePaid">,
	enabled: boolean,
) {
	const scopes = titles.map((title) => ({
		mediaType: title.media_type,
		tmdbId: title.tmdb_id,
	}))
	const { country, serviceIds, includePaid } = selection
	const query = useQuery<{
		results: { key: string; evidence: AvailabilityEvidence | null }[]
	}>({
		queryKey: ["watchability", scopes, country, serviceIds, includePaid],
		enabled: enabled && !!country && serviceIds.length > 0 && titles.length > 0,
		queryFn: async () => {
			const results = []
			for (let i = 0; i < scopes.length; i += 100) {
				const response = await fetch("/api/watchability", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						titles: scopes.slice(i, i + 100),
						country,
						serviceIds,
						includePaid,
					}),
				})
				if (!response.ok) throw new Error("Could not check availability")
				results.push(...(await response.json()).results)
			}
			return { results }
		},
	})
	const [now, setNow] = useState(Date.now)
	const evidence = new Map(
		query.data?.results.map((item) => [item.key, item.evidence]),
	)
	const results = new Map(
		titles.map((title) => {
			const key = `${title.media_type}-${title.tmdb_id}`
			return [
				key,
				evaluateAvailability(
					evidence.get(key),
					{
						country,
						serviceIds,
						includePaid,
						mediaType: title.media_type,
						tmdbId: canonicalTitleId(title.media_type, title.tmdb_id),
					},
					Math.max(now, Date.now()),
				),
			]
		}),
	)
	const expiry = Math.min(
		...Array.from(results.values()).map(
			(result) => result.expiresAt || Infinity,
		),
	)
	useEffect(() => {
		const refresh = () => setNow(Date.now())
		const timer = Number.isFinite(expiry)
			? setTimeout(
					refresh,
					Math.min(Math.max(0, expiry - Date.now()) + 5, 2147483647),
				)
			: undefined
		window.addEventListener("focus", refresh)
		document.addEventListener("visibilitychange", refresh)
		return () => {
			clearTimeout(timer)
			window.removeEventListener("focus", refresh)
			document.removeEventListener("visibilitychange", refresh)
		}
	}, [expiry])
	return { ...query, results }
}
