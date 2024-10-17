import { TagIcon } from "@heroicons/react/20/solid"
import { UserIcon } from "@heroicons/react/24/solid"
import React from "react"
import { useGenres } from "~/routes/api.genres.all"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import type { DiscoverFilters, DiscoverParams } from "~/server/discover.server"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import OneOrMoreItems from "~/ui/filter/OneOrMoreItems"

interface FilterBarParams {
	params: DiscoverParams
	filters: DiscoverFilters
	onToggle: () => void
}

export default function FilterBar({
	params,
	filters,
	onToggle,
}: FilterBarParams) {
	const { data: streamingProviders } = useStreamingProviders()
	const { data: genres } = useGenres()

	const enabledStreamingProviders = (streamingProviders || [])
		.filter((provider) => {
			const streamingProviders = params.withStreamingProviders
				? params.withStreamingProviders.split(",")
				: []
			return streamingProviders.includes(provider.id.toString())
		})
		.map((provider) => {
			return {
				key: provider.id,
				label: provider.name,
				icon: provider.logo_path
					? `https://image.tmdb.org/t/p/w45${provider.logo_path}`
					: undefined,
			}
		})

	const countryIcon = `https://purecatamphetamine.github.io/country-flag-icons/3x2/${params.country}.svg`

	const genreIds = (params.withGenres || "")
		.split(",")
		.filter((genre) => Boolean(genre))
	const selectedGenres = (genres || [])
		.filter((genre) => genreIds.includes(genre.id.toString()))
		.map((genre) => genre.name)

	const cast = filters.castMembers || []

	return (
		<div className="sticky top-16 w-full flex flex-center justify-center bg-gray-950 z-40">
			<div
				className="m-auto max-w-7xl w-full py-4 px-4 flex flex-col flex-wrap gap-1 text-sm truncate border-gray-900 rounded-lg cursor-pointer"
				onClick={onToggle}
				onKeyDown={() => null}
			>
				<div className="flex flex-wrap items-stretch gap-1">
					<FilterBarSection
						label="Streaming"
						color="emerald"
						onSelect={onToggle}
					>
						{enabledStreamingProviders.length > 0 && (
							<>
								{enabledStreamingProviders.map((provider) => (
									<span
										key={provider.key}
										className="flex items-center gap-2 bg-black/40 px-2 py-2 rounded"
									>
										<img
											src={provider.icon}
											alt={provider.label}
											className="h-5 w-5 md:h-8 md:w-8 flex-shrink-0 rounded"
										/>
										{enabledStreamingProviders.length < 5 && (
											<div className="md:hidden sr-only lg:not-sr-only">
												{provider.label}
											</div>
										)}
									</span>
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
						)}
					</FilterBarSection>

					{selectedGenres.length > 0 && (
						<FilterBarSection label="Genre" color="amber" onSelect={onToggle}>
							<div className="flex flex-wrap items-center gap-2">
								{selectedGenres.map((genre, index) => (
									<OneOrMoreItems
										key={genre}
										index={index}
										amount={selectedGenres.length}
									>
										<span className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded">
											<TagIcon className="h-5 w-5 flex-shrink-0" />
											{genre}
										</span>
									</OneOrMoreItems>
								))}
							</div>
						</FilterBarSection>
					)}

					{params.minYear && params.maxYear && (
						<FilterBarSection label="Release" color="cyan" onSelect={onToggle}>
							<span className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded">
								{params.minYear === params.maxYear ? (
									<>{params.maxYear}</>
								) : (
									<>
										{params.minYear} - {params.maxYear}
									</>
								)}
							</span>
						</FilterBarSection>
					)}

					{cast.length > 0 && (
						<FilterBarSection label="Cast" color="purple" onSelect={onToggle}>
							<div className="flex flex-wrap items-center gap-2">
								{cast.map((castMember, index) => (
									<OneOrMoreItems
										key={castMember}
										index={index}
										amount={cast.length}
									>
										<span className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded">
											<UserIcon className="h-5 w-5 flex-shrink-0" />
											{castMember}
										</span>
									</OneOrMoreItems>
								))}
							</div>
						</FilterBarSection>
					)}
				</div>
			</div>
		</div>
	)
}