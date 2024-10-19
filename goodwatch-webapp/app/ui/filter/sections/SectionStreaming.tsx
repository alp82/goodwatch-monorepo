import React from 'react'
import { useCountries } from '~/routes/api.countries'
import { useStreamingProviders } from '~/routes/api.streaming-providers'
import type { DiscoverParams } from '~/server/discover.server'
import { discoverFilters } from '~/server/types/discover-types'
import OneOrMoreItems from '~/ui/filter/OneOrMoreItems'
import EditableSection from '~/ui/filter/sections/EditableSection'
import Select, { type SelectItem } from '~/ui/form/Select'
import { Ping } from '~/ui/wait/Ping'
import { Spinner } from '~/ui/wait/Spinner'
import { useNav } from '~/utils/navigation'

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
	// data retrieval
	const streamingProvidersResult = useStreamingProviders()
	const streamingProviders = streamingProvidersResult?.data || []

	const streamingProviderIds = params.withStreamingProviders
		? params.withStreamingProviders.split(",")
		: []

	const countriesResult = useCountries()
	const countries = countriesResult?.data || []
	const countryIcon = `https://purecatamphetamine.github.io/country-flag-icons/3x2/${params.country}.svg`

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
		useNav<Pick<DiscoverParams, "withStreamingProviders" | "country">>()
	const updateStreaming = (withStreamingProviders: string) => {
		updateQueryParams({
			withStreamingProviders,
		})
	}
	const updateCountry = (country: string) => {
		updateQueryParams({
			country,
		})
	}

	const handleSelectStreaming = (selectedItems: SelectItem[]) => {
		const withStreamingProviders = selectedItems
			.map((item) => item.key)
			.join(",")
		updateStreaming(withStreamingProviders)
		localStorage.setItem("withStreamingProviders", withStreamingProviders)
	}

	const handleSelectCountry = (selectedItem: SelectItem) => {
		const country = selectedItem.key
		updateCountry(country)
		localStorage.setItem("country", country)
	}

	const handleRemoveAll = () => {
		updateStreaming("")
		updateCountry("")
	}

	// rendering

	return (
		<EditableSection
			label={discoverFilters.streaming.label}
			color={discoverFilters.streaming.color}
			visible={streamingProviderIds.length > 0}
			editing={editing}
			onEdit={onEdit}
			onClose={onClose}
			onRemoveAll={handleRemoveAll}
		>
			{(isEditing) => (
				<div className="flex flex-col flex-wrap gap-2">
					{isEditing ? (
						<div className="flex flex-col flex-wrap gap-2">
							<div className="flex items-center gap-2">
								<span className="w-6">On:</span>
								{streamingProvidersResult.isSuccess ? (
									<div className="min-w-60 xs:min-w-72">
										<Select<SelectItem>
											selectItems={streamingProviderItems}
											selectedItems={selectedStreamingProviderItems}
											withSearch={true}
											withMultiSelection={true}
											onSelect={handleSelectStreaming}
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
												(item) => item.key === params.country,
											)}
											withSearch={true}
											onSelect={handleSelectCountry}
										/>
									</div>
								) : (
									<Spinner size="small" />
								)}
							</div>
						</div>
					) : null}
					<div className="flex flex-wrap items-center gap-2">
						{selectedStreamingProviderItems.length > 0 ? (
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
										alt={params.country}
										className="h-5 w-5 md:h-8 md:w-8 flex-shrink-0 rounded"
									/>
									<span className="sr-only lg:not-sr-only block">
										{params.country}
									</span>
								</span>
							</>
						) : streamingProviders.length === 0 ? (
							<div className="relative h-8">
								<Ping size="small" />
							</div>
						) : null}
					</div>
				</div>
			)}
		</EditableSection>
	)
}
