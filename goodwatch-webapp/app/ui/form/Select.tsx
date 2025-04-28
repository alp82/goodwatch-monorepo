import {
	Listbox,
	ListboxButton,
	ListboxOption,
	ListboxOptions,
	Transition,
} from "@headlessui/react"
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid"
import { useVirtualizer } from "@tanstack/react-virtual"
import type React from "react"
import { Fragment, useEffect, useRef, useState } from "react"
import { useAutoFocus } from "~/utils/form"

export interface SelectItem {
	key: string
	label: string
	icon?: string
	disabled?: boolean
}

export interface SelectPropsBase<RenderItem> {
	selectItems: RenderItem[]
	withSearch?: boolean
	isLoading?: boolean
}

export interface SelectPropsSingle<RenderItem>
	extends SelectPropsBase<RenderItem> {
	selectedItems?: RenderItem
	withMultiSelection?: false
	onSelect: (selectedItem: RenderItem) => void
}

export interface SelectPropsMulti<RenderItem>
	extends SelectPropsBase<RenderItem> {
	selectedItems: RenderItem[]
	withMultiSelection: true
	onSelect: (selectedItems: RenderItem[]) => void
}

export type SelectProps<RenderItem> =
	| SelectPropsSingle<RenderItem>
	| SelectPropsMulti<RenderItem>

export default function Select<RenderItem extends SelectItem>({
	selectItems,
	selectedItems,
	withSearch,
	withMultiSelection,
	isLoading = false,
	onSelect,
}: SelectProps<RenderItem>) {
	const autoFocusRef = useAutoFocus<HTMLInputElement>()
	const [query, setQuery] = useState("")

	let searchMatches = query
		? selectItems.filter((item) => {
				const lowercaseQuery = query.toLowerCase()
				return (
					item.key.toLowerCase().includes(lowercaseQuery) ||
					item.label.toLowerCase().includes(lowercaseQuery)
				)
			})
		: selectItems

	if (withMultiSelection) {
		searchMatches = searchMatches.sort((a, b) => {
			if (selectedItems.find((item) => item.key === a.key)) {
				return -1
			}
			return 0
		})
	}

	const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
		setQuery(event.target.value)
	}

	const handleSelect = (selectedItem: RenderItem) => {
		onSelect(selectedItem)
		setQuery("")
	}

	const handleMultiSelect = (selectedItems: RenderItem[]) => {
		onSelect(selectedItems)
	}

	// virtualization

	const scrollRef = useRef(null)
	const virtualList = useVirtualizer({
		count: searchMatches.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 40,
		overscan: 10,
	})

	const [isDropdownOpen, setIsDropdownOpen] = useState(false)
	useEffect(() => {
		if (isDropdownOpen) {
			virtualList.measure()
		}
	}, [isDropdownOpen, virtualList])

	return (
		<Listbox
			value={withMultiSelection ? selectedItems || [] : selectedItems || ""}
			onChange={withMultiSelection ? handleMultiSelect : handleSelect}
			multiple={withMultiSelection}
		>
			{({ open }) => {
				if (open && !isDropdownOpen) setIsDropdownOpen(true)
				if (!open && isDropdownOpen) setIsDropdownOpen(false)
				return (
					<>
						<div className="relative">
							<ListboxButton
								className="
								relative w-full py-1.5 pl-2 pr-10
								rounded-md shadow-sm cursor-pointer bg-stone-700 hover:bg-stone-600
								ring-1 ring-inset ring-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-400
								text-left text-gray-100 text-sm sm:text-base
							"
							>
								{selectedItems ? (
									withMultiSelection ? (
										<div className="flex flex-wrap items-center gap-2">
											{selectedItems.map((item) => (
												<span key={item.key} className="flex items-center">
													<img
														src={item.icon}
														alt={item.label}
														title={item.label}
														className="h-5 w-5 flex-shrink-0 rounded-full"
													/>
													<span className="sr-only ml-3 block truncate">
														{item.label}
													</span>
												</span>
											))}
										</div>
									) : (
										<span className="flex items-center">
											<img
												src={selectedItems.icon}
												alt={selectedItems.label}
												className="h-5 w-5 flex-shrink-0 rounded-full"
											/>
											<span className="ml-3 block truncate">
												{selectedItems.label}
											</span>
										</span>
									)
								) : isLoading ? (
									<span className="text-sm animate-pulse">Loading...</span>
								) : (
									<span className="ml-3 block truncate">&nbsp;</span>
								)}
								<span className="pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-2">
									<ChevronUpDownIcon
										className="h-5 w-5 text-gray-400"
										aria-hidden="true"
									/>
								</span>
							</ListboxButton>

							<Transition
								show={open}
								as={Fragment}
								enter="transition ease-in-out duration-100"
								enterFrom="opacity-0"
								enterTo="opacity-100"
								leave="transition ease-in-out duration-100"
								leaveFrom="opacity-100"
								leaveTo="opacity-0"
							>
								<ListboxOptions
									className={`
									absolute top-10 z-50 mt-1 max-h-96 w-full overflow-auto
									rounded-md bg-stone-800
									shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none
									text-sm sm:text-base
								`}
									ref={scrollRef}
								>
									{withSearch && (
										<div className="sticky top-0 z-50 bg-stone-800">
											<div className="text-gray-100 cursor-default select-none relative py-2 px-3">
												<input
													type="search"
													name="search"
													defaultValue={query}
													autoComplete={"off"}
													className="bg-stone-900 focus:ring-blue-500 focus:border-blue-500 block w-full border-gray-300 rounded-md text-sm sm:text-base"
													placeholder="Search"
													onChange={handleSearch}
													ref={autoFocusRef}
												/>
											</div>
											<hr className="mb-2 h-px border-t-0 bg-gray-500" />
										</div>
									)}
									<div
										className="relative"
										style={{ height: `${virtualList.getTotalSize()}px` }}
									>
										{virtualList.getVirtualItems().map((virtualItem) => {
											const item = searchMatches[virtualItem.index]
											return (
												<ListboxOption
													key={item.key}
													value={item}
													className={({ focus }) => `
														absolute top-0 left-0 w-full
														cursor-default select-none py-2 pl-3 pr-9
														${focus ? "bg-amber-500 text-black" : "text-gray-100"}
													`}
													style={{
														height: `${virtualItem.size}px`,
														transform: `translateY(${virtualItem.start}px)`,
													}}
												>
													{({ selected, focus }) => {
														const isSelected = withMultiSelection
															? selectedItems.find(
																	(selectedItem) =>
																		selectedItem.key === item.key,
																)
															: selected
														return (
															<>
																<div className="flex items-center">
																	{item.icon && (
																		<img
																			src={item.icon}
																			alt=""
																			className="h-5 w-5 flex-shrink-0 rounded-full"
																		/>
																	)}
																	<span
																		className={`${isSelected ? "font-bold" : "font-normal"} ml-3 block truncate`}
																	>
																		{item.label}
																	</span>
																</div>

																{isSelected ? (
																	<span
																		className={`
																		absolute inset-y-0 right-0
																		flex items-center pr-4
																		${focus ? "text-white" : "text-amber-300"}
																	`}
																	>
																		<CheckIcon
																			className="h-5 w-5"
																			aria-hidden="true"
																		/>
																	</span>
																) : null}
															</>
														)
													}}
												</ListboxOption>
											)
										})}
									</div>
								</ListboxOptions>
							</Transition>
						</div>
					</>
				)
			}}
		</Listbox>
	)
}
