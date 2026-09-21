import React from "react";
import type { DiscoverParams } from "~/server/discover.server";
import {
	DISCOVER_FILTER_TYPES,
	type DiscoverFilterType,
	discoverFilters,
} from "~/server/types/discover-types";
import AddFilterMenu from "~/ui/filter/AddFilterMenu";
import SectionCast from "~/ui/filter/sections/SectionCast";
import SectionCrew from "~/ui/filter/sections/SectionCrew";
import SectionFingerprint from "~/ui/filter/sections/SectionFingerprint";
import SectionGenre from "~/ui/filter/sections/SectionGenre";
import SectionRelease from "~/ui/filter/sections/SectionRelease";
import SectionScore from "~/ui/filter/sections/SectionScore";
import SectionSimilar from "~/ui/filter/sections/SectionSimilar";
import SectionType, { type TitleType } from "~/ui/filter/sections/SectionType";
import SectionStreaming from "~/ui/filter/sections/SectionStreaming";
import SectionWatch from "~/ui/filter/sections/SectionWatch";

interface FilterBarParams {
	params: DiscoverParams;
	filterToEdit: DiscoverFilterType | null;
	onTypeChange: (type: TitleType | undefined) => void;
	onEditToggle: (filterType: DiscoverFilterType | null) => void;
}

export default function FilterBar({
	params,
	filterToEdit,
	onTypeChange,
	onEditToggle,
}: FilterBarParams) {
	const handleClose = () => {
		onEditToggle(null);
	};

	const unusedFilters = DISCOVER_FILTER_TYPES.filter(
		(filterType) =>
			filterType !== filterToEdit &&
			!discoverFilters[filterType].associatedParams.some(
				(associatedParam) =>
					params[associatedParam] && params[associatedParam] !== "all",
			),
	).map((filterType) => ({ key: filterType, ...discoverFilters[filterType] }));

	return (
		<div className="m-auto max-w-7xl w-full px-4 flex flex-col flex-wrap gap-1 text-sm border-gray-900 rounded-lg">
			<div className="flex flex-wrap items-stretch gap-1">
				<SectionType
					value={
						params.type === "all" || !params.type
							? undefined
							: params.type.startsWith("movie")
								? "movie"
								: "show"
					}
					onChange={onTypeChange}
					editing={filterToEdit === "type"}
					onEdit={() => onEditToggle("type")}
					onClose={handleClose}
				/>

				<SectionWatch
					params={params}
					editing={filterToEdit === "watch"}
					onEdit={() => onEditToggle("watch")}
					onClose={handleClose}
				/>

				<SectionStreaming
					params={params}
					editing={filterToEdit === "streaming"}
					onEdit={() => onEditToggle("streaming")}
					onClose={handleClose}
				/>

				<SectionScore
					params={params}
					editing={filterToEdit === "score"}
					onEdit={() => onEditToggle("score")}
					onClose={handleClose}
				/>

				<SectionSimilar
					params={params}
					editing={filterToEdit === "similar"}
					onEdit={() => onEditToggle("similar")}
					onClose={handleClose}
				/>

				<SectionFingerprint
					params={params}
					editing={filterToEdit === "fingerprint"}
					onEdit={() => onEditToggle("fingerprint")}
					onClose={handleClose}
				/>

				<SectionGenre
					params={params}
					editing={filterToEdit === "genre"}
					onEdit={() => onEditToggle("genre")}
					onClose={handleClose}
				/>

				<SectionRelease
					params={params}
					editing={filterToEdit === "release"}
					onEdit={() => onEditToggle("release")}
					onClose={handleClose}
				/>

				<SectionCast
					params={params}
					editing={filterToEdit === "cast"}
					onEdit={() => onEditToggle("cast")}
					onClose={handleClose}
				/>

				<SectionCrew
					params={params}
					editing={filterToEdit === "crew"}
					onEdit={() => onEditToggle("crew")}
					onClose={handleClose}
				/>

				<AddFilterMenu options={unusedFilters} onSelect={onEditToggle} />
			</div>
		</div>
	);
}
