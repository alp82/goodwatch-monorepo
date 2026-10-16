// Your services on Where you watch: the services of the country the member is watching from, theirs first. A toggle
// saves the whole list at once; saves of the member's settings run one after another (useSetUserSettings' scope), so
// the last toggle wins. A saved service the country doesn't offer stays listed, so it can be turned off, and the notice
// says when the country offers some or none of them (services-notice.ts).
import {
	ExclamationTriangleIcon,
	MagnifyingGlassIcon,
} from "@heroicons/react/24/solid"
import { useMemo, useState } from "react"
import {
	type StreamingProvider,
	useStreamingProviders,
} from "~/routes/api.streaming-providers"
import { useUserSettings } from "~/routes/api.user-settings.get"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
import StreamingProviderToggle from "~/ui/onboarding/StreamingProviderToggle"
import { regionName } from "~/utils/display-names"
import { servicesNotice } from "./services-notice"

const FIRST = 18

export const savedServiceIds = (value: string | undefined) =>
	(value ?? "").split(",").filter(Boolean)

/** The member's saved services and which of them the country doesn't offer: for the sheet and its tile. */
export function useServicesInCountry(country: string) {
	const settings = useUserSettings()
	const saved = savedServiceIds(settings.data?.streaming_providers_default)
	// The country's own list, without the saved ones it doesn't offer: what the notice compares with.
	const offered = useStreamingProviders({
		country,
		enabled: Boolean(settings.data),
	})
	const notice =
		settings.data && offered.data && !offered.isPlaceholderData
			? servicesNotice({
					saved,
					offered: offered.data,
					countryName: regionName(country),
				})
			: null
	return { saved, notice, loaded: Boolean(settings.data) }
}

export function YourServices({ country }: { country: string }) {
	const settings = useUserSettings()
	const { notice } = useServicesInCountry(country)
	const savedOnRecord = savedServiceIds(
		settings.data?.streaming_providers_default,
	)
	// What the member picked here, ahead of the save's answer.
	const [picked, setPicked] = useState<string[] | null>(null)
	const selected = picked ?? savedOnRecord
	const providers = useStreamingProviders({
		country,
		include: selected,
		enabled: Boolean(settings.data),
	})
	const save = useSetUserSettings()
	const [query, setQuery] = useState("")
	const [all, setAll] = useState(false)

	const list = useMemo(() => {
		const q = query.trim().toLowerCase()
		const found = (providers.data ?? []).filter(
			(s) => !q || s.name.toLowerCase().includes(q),
		)
		const mine = found.filter((s) => selected.includes(String(s.id)))
		return [...mine, ...found.filter((s) => !selected.includes(String(s.id)))]
	}, [providers.data, selected, query])
	const shown =
		all || query ? list : list.slice(0, Math.max(FIRST, selected.length))

	const toggle = (provider: StreamingProvider, on: boolean) => {
		const id = String(provider.id)
		const next = on
			? [...selected.filter((x) => x !== id), id]
			: selected.filter((x) => x !== id)
		setPicked(next)
		save.mutate({ settings: { streaming_providers_default: next.join(",") } })
	}
	const retry = () =>
		save.mutate({
			settings: { streaming_providers_default: selected.join(",") },
		})

	if (!settings.data)
		return (
			<p className="text-sm text-gray-500">
				{settings.isError
					? "Your services couldn't load."
					: "Loading your services…"}
			</p>
		)

	return (
		<div className="flex flex-col gap-3">
			{notice && (
				<output
					data-services-notice
					className="flex gap-2 rounded-lg bg-amber-950/50 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-800/70"
				>
					<ExclamationTriangleIcon
						className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
						aria-hidden="true"
					/>
					{notice.text}
				</output>
			)}
			<output aria-live="polite" className="text-sm empty:hidden">
				{save.isError ? (
					<span className="flex flex-wrap items-center gap-2 text-red-300">
						<span role="alert">Couldn't save your services.</span>
						<button
							type="button"
							onClick={retry}
							className="h-8 cursor-pointer rounded-full bg-white px-3 font-semibold text-black hover:bg-gray-200"
						>
							Retry
						</button>
					</span>
				) : save.isPending ? (
					<span className="text-gray-400">Saving your services…</span>
				) : null}
			</output>
			<label className="flex h-9 max-w-sm items-center gap-2 rounded-lg bg-white/[0.07] px-2 ring-1 ring-white/10 focus-within:ring-white/30">
				<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-400" />
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={`Search services in ${regionName(country)}`}
					aria-label="Search services"
					className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
				/>
			</label>
			{providers.isPending && (
				<p className="text-sm text-gray-500">Loading services…</p>
			)}
			{providers.isError && (
				<p className="text-sm text-gray-400">The services couldn't load.</p>
			)}
			<div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
				{shown.map((provider) => (
					<StreamingProviderToggle
						key={provider.id}
						provider={provider}
						selected={selected.includes(String(provider.id))}
						onToggle={toggle}
					/>
				))}
			</div>
			{!query && list.length > shown.length && (
				<button
					type="button"
					onClick={() => setAll(true)}
					className="cursor-pointer self-start text-sm font-semibold text-amber-500 hover:text-amber-400"
				>
					Show all {list.length} services
				</button>
			)}
			{query && list.length === 0 && (
				<p className="text-sm text-gray-500">No service matches.</p>
			)}
		</div>
	)
}
