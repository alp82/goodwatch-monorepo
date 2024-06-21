import { useFetcher } from "@remix-run/react";
import React, { useEffect } from "react";
import type { StreamingProviderResults } from "~/server/streaming-providers.server";
import Select, { type SelectItem } from "~/ui/form/Select";

export interface FilterCountriesProps {
	type: "movie" | "tv";
	selectedProviders: string[];
	onChange: (providers: string) => void;
}

export default function FilterStreamingProviders({
	type,
	selectedProviders,
	onChange,
}: FilterCountriesProps) {
	const providersFetcher = useFetcher<{
		streamingProviders: StreamingProviderResults;
	}>();
	useEffect(() => {
		providersFetcher.submit(
			{ type },
			{
				method: "get",
				action: "/api/discover/streaming-providers",
			},
		);
	}, [type]);
	const streamingProviders = providersFetcher.data?.streamingProviders || [];

	const selectItems = streamingProviders.map((provider) => {
		return {
			key: provider.id.toString(),
			label: provider.name,
			icon: provider.logo_path
				? `https://image.tmdb.org/t/p/w45${provider.logo_path}`
				: undefined,
		};
	});

	const handleSelect = (selectedItems: SelectItem[]) => {
		const withStreamingProviders = selectedItems
			.map((item) => item.key)
			.join(",");
		onChange(withStreamingProviders);
		localStorage.setItem("withStreamingProviders", withStreamingProviders);
	};

	return (
		<div className="w-52">
			<Select<SelectItem>
				selectItems={selectItems}
				selectedItems={selectItems.filter((item) =>
					selectedProviders.includes(item.key),
				)}
				withSearch={true}
				withMultiSelection={true}
				onSelect={handleSelect}
			/>
		</div>
	);
}
