import {
	ArrowPathIcon,
	CheckIcon,
	MagnifyingGlassIcon,
	TagIcon,
} from "@heroicons/react/20/solid";
import React from "react";
import Highlighter from "react-highlight-words";
import { useDNA } from "~/routes/api.dna";
import type { CombinationType, DiscoverParams } from "~/server/discover.server";
import type { DNAResult } from "~/server/dna.server";
import {
	type CombinationTypeOption,
	combinationTypeOptions,
	discoverFilters,
} from "~/server/types/discover-types";
import OneOrMoreItems from "~/ui/filter/OneOrMoreItems";
import EditableSection from "~/ui/filter/sections/EditableSection";
import Autocomplete, {
	type AutocompleteItem,
	type RenderItemParams,
} from "~/ui/form/Autocomplete";
import RadioBlock from "~/ui/form/RadioBlock";
import { Tag } from "~/ui/tags/Tag";
import { Ping } from "~/ui/wait/Ping";
import { SEPARATOR_SECONDARY, useNav } from "~/utils/navigation";
import { useDebounce } from "~/utils/timing";

interface SectionDNAParams {
	params: DiscoverParams;
	editing: boolean;
	onEdit: () => void;
	onClose: () => void;
}

export default function SectionDNA({
	params,
	editing,
	onEdit,
	onClose,
}: SectionDNAParams) {
	const [searchText, setSearchText] = React.useState("");
	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSearchText(event.target.value);
	};
	const debouncedSearchText = useDebounce(searchText, 200);

	const [combinationType, setCombinationType] = React.useState<CombinationType>(
		params.similarDNACombinationType || combinationTypeOptions[0].name,
	);
	const selectedCombinationTypeOption = combinationTypeOptions.find(
		(option) => option.name === combinationType,
	);
	const handleChangeCombinationType = (
		combinationTypeOption: CombinationTypeOption,
	) => {
		const combinationType = combinationTypeOption.name;
		setCombinationType(combinationType);
		updateQueryParams({
			similarDNACombinationType: combinationType,
		});
	};

	// data retrieval

	const dnaResult = useDNA({
		text: debouncedSearchText,
	});
	const dna = dnaResult.data?.result || [];

	const { similarDNA = "" } = params;
	const dnaKeys = (similarDNA || "").split(",").filter(Boolean);
	const dnaToInclude = similarDNA
		.split(",")
		.filter(Boolean)
		.map((dna) => {
			const [category, label] = dna.split(SEPARATOR_SECONDARY, 2);
			return {
				category,
				label,
			};
		});

	// autocomplete data

	const autocompleteItems = dna.map((dna: DNAResult) => {
		const key = `${dna.category}${SEPARATOR_SECONDARY}${dna.label}`;
		const label = dna.label;
		return {
			key,
			label,
			category: dna.category,
			count: dna.count_all,
		};
	});
	const autocompleteRenderItem = ({
		item,
	}: RenderItemParams<
		AutocompleteItem & { category: string; count: number }
	>) => {
		const isSelected = dnaKeys.includes(item.key);
		return (
			<div
				className={`w-full flex items-center justify-between gap-4 ${isSelected ? "text-green-400" : ""}`}
			>
				<div className="flex items-center gap-4">
					<div
						className="text-sm font-bold truncate"
						title={`Used in ${item.count} movies and shows`}
					>
						<div className="w-52 text-gray-400 font-medium">
							<Highlighter
								highlightClassName="bg-yellow-500 text-gray-900"
								searchWords={[searchText]}
								autoEscape={true}
								textToHighlight={item.category}
							/>{" "}
						</div>
						<Highlighter
							highlightClassName="bg-yellow-500 text-gray-900"
							searchWords={[searchText]}
							autoEscape={true}
							textToHighlight={item.label}
						/>
					</div>
				</div>
				{isSelected && (
					<CheckIcon
						className="h-6 w-6 p-1 text-green-100 bg-green-700 rounded-full"
						aria-hidden="true"
					/>
				)}
			</div>
		);
	};

	// update handlers

	const { updateQueryParams } =
		useNav<Pick<DiscoverParams, "similarDNA" | "similarDNACombinationType">>();
	const updateDNA = (
		dnaToInclude: DNAResult[],
		updatedCombinationType: string,
	) => {
		updateQueryParams({
			similarDNA: dnaToInclude
				.map((dna) => `${dna.category}${SEPARATOR_SECONDARY}${dna.label}`)
				.join(","),
			similarDNACombinationType: updatedCombinationType,
		});
	};

	const handleSelect = (
		selectedItem: AutocompleteItem & { category: string; count: number },
	) => {
		const updatedDNAToInclude: DNAResult[] = dnaKeys.includes(selectedItem.key)
			? dnaToInclude.filter(
					(dna) =>
						`${dna.category}${SEPARATOR_SECONDARY}${dna.label}` !==
						selectedItem.key,
				)
			: [
					...dnaToInclude,
					{
						category: selectedItem.category,
						label: selectedItem.label,
						count_all: selectedItem.count,
					},
				];
		updateDNA(updatedDNAToInclude, combinationType);
	};

	const handleDelete = (dnaToDelete: DNAResult) => {
		const updatedDNAToInclude: DNAResult[] = dnaToInclude.filter(
			(dna) =>
				`${dna.category}${SEPARATOR_SECONDARY}${dna.label}` !==
				`${dnaToDelete.category}${SEPARATOR_SECONDARY}${dnaToDelete.label}`,
		);
		updateDNA(updatedDNAToInclude, combinationType);
	};

	const handleRemoveAll = () => {
		updateDNA([], "");
		setSearchText("");
		onClose();
	};

	// rendering

	return (
		<EditableSection
			label={discoverFilters.dna.label}
			color={discoverFilters.dna.color}
			visible={dnaKeys.length > 0}
			editing={editing}
			active={true}
			onEdit={onEdit}
			onClose={onClose}
			onRemoveAll={handleRemoveAll}
		>
			{(isEditing) => (
				<div className="flex flex-col flex-wrap gap-2">
					{isEditing && (
						<div className="flex flex-col flex-wrap justify-between gap-2">
							<div className="z-30 my-2 w-[18rem] xs:w-[20rem] sm:w-[22rem] md:w-[24rem] lg:w-[26rem] xl:w-[28rem]">
								<Autocomplete<(typeof autocompleteItems)[number]>
									name="query"
									placeholder="Search DNA"
									icon={
										dnaResult.isFetching ? (
											<ArrowPathIcon
												className="h-4 w-4 text-gray-400 animate-spin"
												aria-hidden="true"
											/>
										) : (
											<MagnifyingGlassIcon
												className="h-4 w-4 text-gray-400"
												aria-hidden="true"
											/>
										)
									}
									autocompleteItems={autocompleteItems}
									additionalFieldsToMatch={["category"]}
									renderItem={autocompleteRenderItem}
									onChange={handleChange}
									onSelect={handleSelect}
								/>
							</div>
							<RadioBlock
								options={combinationTypeOptions}
								value={selectedCombinationTypeOption}
								orientation="horizontal"
								onChange={handleChangeCombinationType}
							/>
						</div>
					)}
					<div className="flex flex-wrap items-center gap-2">
						{dnaToInclude.length > 0 ? (
							dnaToInclude.map((dna, index) => (
								<OneOrMoreItems
									key={`${dna.category}${SEPARATOR_SECONDARY}${dna.label}`}
									index={index}
									amount={dnaToInclude.length}
									mode={combinationType}
								>
									<Tag
										icon={TagIcon}
										onRemove={isEditing ? () => handleDelete(dna) : undefined}
									>
										<span className="text-gray-500">{dna.category}: </span>
										<span className="font-bold">{dna.label}</span>
									</Tag>
								</OneOrMoreItems>
							))
						) : dnaResult.isLoading && dna.length === 0 ? (
							<div className="relative h-8">
								<Ping size="small" />
							</div>
						) : null}
					</div>
				</div>
			)}
		</EditableSection>
	);
}
