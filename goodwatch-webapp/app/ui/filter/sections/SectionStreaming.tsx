import React, { useEffect, useMemo } from "react"
import { useCountries } from "~/routes/api.countries"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import {
	useUserCountry,
	useUserStreamingProviders,
} from "~/routes/api.user-settings.get"
import type { DiscoverParams, StreamingPreset } from "~/server/discover.server"
import { discoverFilters } from "~/server/types/discover-types"
import OneOrMoreItems from "~/ui/filter/OneOrMoreItems"
import EditableSection from "~/ui/filter/sections/EditableSection"
import Select, { type SelectItem } from "~/ui/form/Select"
import Tabs, { type Tab } from "~/ui/tabs/Tabs"
import { Ping } from "~/ui/wait/Ping"
import { Spinner } from "~/ui/wait/Spinner"
import { useUser } from "~/utils/auth"
import useLocale from "~/utils/locale"
import { useNav } from "~/utils/navigation"

const EVERYWHERE_LIMIT = 3

interface SectionStreamingParams {
	params: DiscoverParams
	editing: boolean
	onEdit: () => void
	onClose: () => void
}

export default function SectionStreaming({
	params,
	editing,
	onEdit,
	onClose,
}: SectionStreamingParams) {
	// local data

	const { locale } = useLocale()
	const localStreamingProviders = useMemo(() => {
		return (
			(typeof window !== "undefined" &&
				localStorage.getItem("withStreamingProviders")) ||
			"8,9,337"
		)
	}, [typeof window])

	const localCountry = useMemo(() => {
		return (
			(typeof window !== "undefined" && localStorage.getItem("country")) ||
			locale.country
		)
	}, [typeof window, locale.country])

	// tabs

	const [selectedTab, setSelectedTab] = React.useState<StreamingPreset>(
		params.streamingPreset || "everywhere",
	)
	const streamingTabs: Tab<StreamingPreset>[] = [
		{
			key: "everywhere",
			label: "Everywhere",
			current: selectedTab === "everywhere",
		},
		{
			key: "mine",
			label: "Mine",
			current: selectedTab === "mine",
			requiresLoginContent: (
				<>
					Select your <strong>streaming services</strong> and{" "}
					<strong>country</strong> once to quickly find what you're looking for.
				</>
			),
		},
		{
			key: "custom",
			label: "Custom",
			current: selectedTab === "custom",
		},
	]

	// selection logic

	const onSelectStreamingPreset = (streamingPreset: StreamingPreset) => {
		setSelectedTab(streamingPreset)

		let withStreamingProviders = ""
		let country = ""
		if (streamingPreset === "custom") {
			if (!params.withStreamingProviders)
				withStreamingProviders = localStreamingProviders
			if (!params.country) country = localCountry
		}

		updateQueryParams({
			streamingPreset,
			withStreamingProviders,
			country,
		})
	}

	const { user } = useUser()
	useEffect(() => {
		if (!editing || params.streamingPreset) return

		const streamingPreset = user?.id ? "mine" : "everywhere"
		onSelectStreamingPreset(streamingPreset)
	}, [user?.id, params.streamingPreset, editing])

	// data retrieval

	const streamingProvidersResult = useStreamingProviders()
	const streamingProviders = streamingProvidersResult?.data || []

	const userStreamingProviders = useUserStreamingProviders()
	let streamingProviderIds: string[] = []
	if (selectedTab === "mine") {
		streamingProviderIds = userStreamingProviders?.map((provider) =>
			provider.id.toString(),
		)
	} else if (selectedTab === "custom") {
		streamingProviderIds = (
			params.withStreamingProviders || localStreamingProviders
		).split(",")
	}

	const countriesResult = useCountries()
	const countries = countriesResult?.data || []

	const userCountry = useUserCountry()
	let country = ""
	if (selectedTab === "mine") {
		country = userCountry || ""
	} else if (selectedTab === "custom") {
		country = params.country || localCountry
	} else {
		country = localCountry
	}
	const countryIcon = `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country}.svg`

	// autocomplete data

	const streamingProviderItems = streamingProviders.map((provider) => {
		return {
			key: provider.id.toString(),
			label: provider.name,
			icon: provider.logo_path
				? `https://image.tmdb.org/t/p/w45${provider.logo_path}`
				: undefined,
		}
	})
	const selectedStreamingProviderItems = streamingProviderItems.filter(
		(provider) => {
			return streamingProviderIds.includes(provider.key.toString())
		},
	)

	const countryItems = countries.map((country) => {
		return {
			key: country.code,
			label: country.name,
			icon: `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country.code}.svg`,
		}
	})

	// update handlers

	const { updateQueryParams } =
		useNav<
			Pick<
				DiscoverParams,
				"streamingPreset" | "withStreamingProviders" | "country"
			>
		>()

	const handleSelectStreamingProviders = (selectedItems: SelectItem[]) => {
		const withStreamingProviders = selectedItems
			.map((item) => item.key)
			.join(",")
		updateQueryParams({
			withStreamingProviders,
		})
		localStorage.setItem("withStreamingProviders", withStreamingProviders)
	}

	const handleSelectCountry = (selectedItem: SelectItem) => {
		const country = selectedItem.key
		updateQueryParams({
			country,
		})
		localStorage.setItem("country", country)
	}

	const handleRemoveAll = () => {
		onClose()
		updateQueryParams({
			streamingPreset: undefined,
			withStreamingProviders: "",
			country: "",
		})
	}

	// rendering

	return (
		<EditableSection
			label={discoverFilters.streaming.label}
			color={discoverFilters.streaming.color}
			visible={Boolean(params.streamingPreset)}
			editing={editing}
			onEdit={onEdit}
			onClose={onClose}
			onRemoveAll={handleRemoveAll}
		>
			{(isEditing) => (
				<div className="w-full flex flex-col flex-wrap gap-4">
					{isEditing ? (
						<div className="flex flex-col flex-wrap gap-3">
							<Tabs
								tabs={streamingTabs}
								size="small"
								onSelect={(tab) => onSelectStreamingPreset(tab.key)}
							/>
							{selectedTab === "everywhere" && (
								<span>
									Showing all titles that are available for{" "}
									<strong>streaming on any service</strong>.
								</span>
							)}
							{selectedTab === "mine" && (
								<span>
									Only titles that are available on{" "}
									<strong>your streaming services</strong> and{" "}
									<strong>country</strong>.
								</span>
							)}
							{selectedTab === "custom" && (
								<>
									<div className="flex items-center gap-2">
										<span className="w-6">On:</span>
										{streamingProvidersResult.isSuccess ? (
											<div className="min-w-60 xs:min-w-72">
												<Select<SelectItem>
													selectItems={streamingProviderItems}
													selectedItems={selectedStreamingProviderItems}
													withSearch={true}
													withMultiSelection={true}
													onSelect={handleSelectStreamingProviders}
												/>
											</div>
										) : (
											<Spinner size="small" />
										)}
									</div>
									<div className="flex items-center gap-2">
										<span className="w-6">In:</span>
										{countriesResult.isSuccess ? (
											<div className="min-w-60 xs:min-w-72">
												<Select<SelectItem>
													selectItems={countryItems}
													selectedItems={countryItems.find(
														(item) => item.key === country,
													)}
													withSearch={true}
													onSelect={handleSelectCountry}
												/>
											</div>
										) : (
											<Spinner size="small" />
										)}
									</div>
								</>
							)}
						</div>
					) : null}
					<div className="flex flex-wrap items-center gap-2">
						{streamingProviderItems.length === 0 ? (
							<div className="relative h-8">
								<Ping size="small" />
							</div>
						) : selectedTab === "everywhere" ? (
							<>
								{streamingProviderItems
									.slice(0, EVERYWHERE_LIMIT)
									.map((provider) => (
										<span
											key={provider.key}
											className="flex items-center gap-2 bg-black/40 px-2 py-2 rounded"
										>
											<img
												src={provider.icon}
												alt={provider.label}
												className="h-5 w-5 md:h-8 md:w-8 flex-shrink-0 rounded"
											/>
											{selectedStreamingProviderItems.length < 5 && (
												<div className="md:hidden sr-only lg:not-sr-only">
													{provider.label}
												</div>
											)}
										</span>
									))}
								<span>
									and{" "}
									<strong className="mx-1 text-lg">
										{streamingProviderItems.length - EVERYWHERE_LIMIT} more
									</strong>{" "}
									streaming services in any country.
								</span>
							</>
						) : selectedStreamingProviderItems.length > 0 ? (
							<>
								{selectedStreamingProviderItems.map((provider, index) => (
									<OneOrMoreItems
										key={provider.key}
										index={index}
										amount={selectedStreamingProviderItems.length}
									>
										<span className="flex items-center gap-2 bg-black/40 px-2 py-2 rounded">
											<img
												src={provider.icon}
												alt={provider.label}
												className="h-5 w-5 md:h-8 md:w-8 flex-shrink-0 rounded"
											/>
											{selectedStreamingProviderItems.length < 5 && (
												<div className="md:hidden sr-only lg:not-sr-only">
													{provider.label}
												</div>
											)}
										</span>
									</OneOrMoreItems>
								))}
								<span className="mx-3">in</span>
								<span className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded">
									<img
										src={countryIcon}
										alt={country}
										className="h-5 w-5 md:h-8 md:w-8 flex-shrink-0 rounded"
									/>
									<span className="sr-only lg:not-sr-only block">
										{country}
									</span>
								</span>
							</>
						) : (
							<span>
								Please select <em>at least one</em> streaming service.
							</span>
						)}
					</div>
				</div>
			)}
		</EditableSection>
	)
}
