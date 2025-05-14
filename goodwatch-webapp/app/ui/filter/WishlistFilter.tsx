import { Radio, RadioGroup } from "@headlessui/react"
import React, { useState } from "react"
import { SelectItem } from "~/ui/form/Select"

export type SortBy =
	| "most_recently_added"
	| "least_recently_added"
	| "highest_score"
	| "most_popular"
export type FilterByStreaming = "mine" | "free" | "buy" | "all"

interface FilterParams {
	sortBy: SortBy
	filterByStreaming: FilterByStreaming
}

export interface WishlistFilterProps extends FilterParams {
	onChange: (params: Partial<FilterParams>) => void
}

export default function WishlistFilter({
	filterByStreaming,
	onChange,
}: WishlistFilterProps) {
	// TODO already watched? yes no
	const streamingOptions = [
		{ key: "mine", name: "Mine", description: "My streaming" },
		{ key: "free", name: "Free", description: "Free streaming" },
		{ key: "buy", name: "Buy", description: "Available to buy" },
		{ key: "all", name: "All", description: "All from Wishlist" },
	]

	const handleSelectStreaming = (selected: FilterByStreaming) => {
		onChange({
			filterByStreaming: selected,
		})
	}

	return (
		<div className="w-72 relative">
			{/*<fieldset aria-label="Choose a memory option">*/}
			{/*  <div className="flex items-center justify-between">*/}
			{/*    <div className="text-sm font-medium leading-6 text-gray-100">*/}
			{/*      RAM*/}
			{/*    </div>*/}
			{/*    <a href="#" className="text-sm font-medium leading-6 text-indigo-300 hover:text-indigo-500">*/}
			{/*      See performance specs*/}
			{/*    </a>*/}
			{/*  </div>*/}
			{/*  <RadioGroup value={filterByStreaming} onChange={handleSelectStreaming} className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">*/}
			{/*    {streamingOptions.map((option) => (*/}
			{/*      <Radio*/}
			{/*        key={option.key}*/}
			{/*        value={option}*/}
			{/*        className={({focus = false, checked = false}) => `*/}
			{/*            ${focus ? 'ring-2 ring-indigo-600 ring-offset-2' : ''}*/}
			{/*            ${checked*/}
			{/*          ? 'bg-indigo-600 text-white hover:bg-indigo-500'*/}
			{/*          : 'ring-1 ring-inset ring-gray-300 bg-white text-gray-900 hover:bg-gray-50'}*/}
			{/*            cursor-pointer focus:outline-hidden*/}
			{/*            flex items-center justify-center rounded-md py-3 px-3 text-sm font-semibold uppercase sm:flex-1*/}
			{/*          `}*/}
			{/*      >*/}
			{/*        {option.name}*/}
			{/*      </Radio>*/}
			{/*    ))}*/}
			{/*  </RadioGroup>*/}
			{/*</fieldset>*/}
		</div>
	)
}
